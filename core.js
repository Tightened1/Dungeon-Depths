// ══ CANVAS SETUP ══
const canvas=document.getElementById('gc'),rc=document.getElementById('rc'),ac=document.getElementById('ac');
const ctx=canvas.getContext('2d'),rctx=rc.getContext('2d'),actx=ac.getContext('2d');
function resizeCanvas(){const col=document.getElementById('canvas-col');[canvas,rc,ac].forEach(c=>{c.width=col.clientWidth;c.height=col.clientHeight})}
resizeCanvas();window.addEventListener('resize',()=>{resizeCanvas();drawAll()});
// TW/TH defined in render section
function cols(){return Math.floor(canvas.width/TW)}
function rows(){return Math.floor(canvas.height/TH)}

// ══ STATE ══
let G={},player={},monsters=[],items=[],anims=[],turn=0,floor=1,gameOver=false,msgs=[],particles=[];
let invOpen=false,merchOpen=false,treeOpen=false,selIdx=-1,pendingDiscard=false;
let classChooser=true,specChooser=false,bossesKilled=0,diffScale=1,bossActive=false,bossFloor=false;
// Prestige: unlocked by defeating the God Demon on floor 100. Persists across sessions.
let victoryWin=false;
let prestigeRun=false; // true when playing the prestige class → themed hard-mode floors
let prestigeUnlocked=(()=>{try{return localStorage.getItem('dd_prestige_unlocked')==='1'}catch(e){return false}})();
let animT=0,flickerT=0,catOpen={weapons:true,armor:true,rings:true,amulets:true,potions:true};
let merchantItems=[],merchantSellSel=new Set(),selectedPath=0;
let floorKills=0,floorItemsFound=0; // floor summary tracking
let totalKills=0; // whole-run kill tally for the death summary
let bossOrder=[]; // shuffled boss order per run
let fpMode=false; // first-person view toggle
const FACINGS=[{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0}]; // N,E,S,W

// ══ SAVE SYSTEM ══
// Autosaves the current run to the browser's localStorage every turn.
// Permadeath stays intact: the save is wiped on death. Functions are not
// serializable, so relics and item affixes are rehydrated by id on load.
const SAVE_KEY='dungeon_depths_save_v1';
const SAVE_VERSION=5; // floor-100 finale, prestige class, upgrade cap 10
let _savePeek; // cached parsed save for the title-screen banner
// A save is only valid if it parses, matches the current version, and has the
// core fields. Anything else (corrupt, or from a future/older game build) is
// treated as "no save" so it can never crash a returning player.
function _validSave(d){
  return !!(d && d.v===SAVE_VERSION && d.G && d.player && d.player.cls);
}
function hasSave(){return !!savePeek();}
function savePeek(){
  if(_savePeek!==undefined)return _savePeek;
  try{
    let raw=localStorage.getItem(SAVE_KEY);
    let d=raw?JSON.parse(raw):null;
    if(d&&!_validSave(d)){clearSave();_savePeek=null;return null} // discard incompatible
    _savePeek=d||null;
  }catch(e){_savePeek=null}
  return _savePeek;
}
function saveGame(){
  if(gameOver||classChooser||specChooser)return;
  try{
    let data={v:SAVE_VERSION,floor,turn,bossesKilled,totalKills,diffScale,bossFloor,bossActive,
      bossOrder,floorKills,floorItemsFound,merchantItems,player,monsters,items,G,fpMode};
    localStorage.setItem(SAVE_KEY,JSON.stringify(data));
    _savePeek=undefined;
  }catch(e){/* storage blocked or full — play continues without saves */}
}
function clearSave(){try{localStorage.removeItem(SAVE_KEY)}catch(e){};_savePeek=undefined}
function _rehydrateAffixes(it){
  if(!it||!it.affixes)return;
  it.affixes=it.affixes.map(af=>{
    for(let cls in AFFIXES_BY_CLASS){let f=AFFIXES_BY_CLASS[cls].find(a=>a.id===af.id);if(f)return f}
    return af;
  });
}
function loadGame(){
  let raw;try{raw=localStorage.getItem(SAVE_KEY)}catch(e){return false}
  if(!raw)return false;
  let d;try{d=JSON.parse(raw)}catch(e){clearSave();return false}
  if(!_validSave(d)){clearSave();return false} // wrong version / corrupt → discard, stay on title
  try{
  floor=d.floor;turn=d.turn;bossesKilled=d.bossesKilled||0;totalKills=d.totalKills||0;
  diffScale=d.diffScale||1;bossFloor=!!d.bossFloor;bossActive=!!d.bossActive;
  bossOrder=d.bossOrder||[];floorKills=d.floorKills||0;floorItemsFound=d.floorItemsFound||0;
  merchantItems=d.merchantItems||[];
  player=d.player;monsters=d.monsters||[];items=d.items||[];G=d.G;fpMode=!!d.fpMode;
  // Rehydrate function-bearing definitions stripped by JSON
  if(player.relics)player.relics=player.relics.map(sr=>ALL_RELICS.find(r=>r.id===sr.id)||sr);
  Object.values(player.eq||{}).forEach(_rehydrateAffixes);
  (player.inventory||[]).forEach(_rehydrateAffixes);
  items.forEach(_rehydrateAffixes);
  merchantItems.forEach(_rehydrateAffixes);
  anims=[];particles=[];
  gameOver=false;classChooser=false;specChooser=false;relicOpen=false;
  invOpen=false;merchOpen=false;treeOpen=false;pendingDiscard=false;selIdx=-1;
  torchFrame=-1;
  let ro=document.getElementById('relic-overlay');if(ro)ro.classList.remove('open');
  fov();updateUI();updateRelicPanel();updateBuildPanel();
  addLog('Run restored — floor '+floor+', turn '+turn+'. Welcome back.',8);
  drawAll();
  return true;
  }catch(e){
    // Any unexpected shape in an otherwise version-matched save: fail safe.
    clearSave();classChooser=true;gameOver=false;
    try{drawAll()}catch(_){}
    return false;
  }
}

const RARE_COLORS={0:'#8a8a6a',1:'#5aaae8',2:'#c85ae8',3:'#e8a020',4:'#ff5555'};
const RARE_NAMES={0:'Common',1:'Uncommon',2:'Rare',3:'Legendary',4:'Boss Drop'};
const RARE_BG={0:'#1a1a12',1:'#122030',2:'#200e30',3:'#251806',4:'#2a0808'};
const MAX_ITEM_LVL=10;
const UPGRADEABLE=['weapon','armor','ring','amulet'];

// ══ CLASSES ══ ATK order: Warrior > Rogue > Paladin > Necromancer > Cleric > Mage (Mage spells scale high)
const CLASSES=[
  {name:'Warrior',hp:40,atk:12,def:6,color:'#e8a05a',sym:'@',desc:'Frontline tank. Highest ATK & DEF.',
   baseAbils:[{name:'Shield Bash',desc:'Stun+dmg adjacent',key:'1',cd:0,max:3,range:1,aoe:false,isSpell:false},{name:'Berserker',desc:'2x ATK for 2 turns',key:'2',cd:0,max:5,range:0,aoe:false,isSpell:false}],
   lvl7Abil:{name:'War Cry',desc:'+5 ATK for 3 turns',key:'3',cd:0,max:6,range:0,aoe:false,isSpell:false},
   lvl15Abil:{name:'Whirlwind',desc:'Hit all 8 adjacent tiles',key:'4',cd:0,max:7,range:1,aoe:true,isSpell:false},
   paths:[
    {name:'Powerhouse',color:'#e8a05a',desc:'Tank — absorb & reflect damage',nodes:[
      {name:'Iron Skin',desc:'Passive +3 DEF permanently',ranks:3,costPer:1,effect:(p,r)=>{p.def+=3},label:'+3 DEF per rank'},
      {name:'Fortified',desc:'+15 Max HP per rank',ranks:3,costPer:1,effect:(p,r)=>{p.mhp+=15;p.hp+=15},label:'+15 max HP'},
      {name:'Retaliate',desc:'Reflect 4 dmg when hit per rank',ranks:3,costPer:2,effect:(p,r)=>{p.reflectFlat=(p.reflectFlat||0)+4},label:'+4 reflect dmg'},
      {name:'Titan Form',desc:'Active: +20HP & immune 1 turn CD8',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Titan Form',desc:'+20HP & immune 1 turn',cd:0,max:8,range:0,aoe:false,isSpell:false}},
    ]},
    {name:'Retaliator',color:'#e85a5a',desc:'Damage grows as HP falls',nodes:[
      {name:'Battle Cry',desc:'Active: Cone shout damages 3 tiles ahead CD5',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Battle Cry',desc:'Cone — 3 tiles ahead',cd:0,max:5,range:3,aoe:true,isSpell:false}},
      {name:'Bloodlust',desc:'ATK scales with missing HP — passive',ranks:3,costPer:1,effect:(p,r)=>{p.bloodlust=(p.bloodlust||0)+1},label:'ATK scales with missing HP'},
      {name:'Last Stand',desc:'+8 ATK below 25% HP per rank',ranks:2,costPer:2,effect:(p,r)=>{p.lastStand=(p.lastStand||0)+8},label:'+8 ATK at low HP'},
      {name:'Endless Fury',desc:'Kills reset Berserker CD',ranks:1,costPer:3,effect:(p,r)=>{p.endlessFury=true},label:'Kills reset Berserker'},
    ]},
    {name:'Weapons Expert',color:'#c9a227',desc:'Weapon buffs, lifesteal on kill',nodes:[
      {name:'Legendary Edge',desc:'Active: Next attack deals 5x dmg CD10',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Legendary Edge',desc:'Next attack 5x dmg',cd:0,max:10,range:1,aoe:false,isSpell:false}},
      {name:'Weapon Mastery',desc:'+3 ATK bonus from weapons per rank — passive',ranks:3,costPer:1,effect:(p,r)=>{p.weaponBonus=(p.weaponBonus||0)+3},label:'+3 weapon ATK'},
      {name:'Weapon Lifesteal',desc:'+5 HP on kill per rank',ranks:2,costPer:2,effect:(p,r)=>{p.wpnLifesteal=(p.wpnLifesteal||0)+5},label:'+5 HP on kill'},
      {name:'Double Strike',desc:'+25% chance to attack twice per rank',ranks:2,costPer:2,effect:(p,r)=>{p.doubleStrike=(p.doubleStrike||0)+25},label:'+25% double strike'},
    ]}
   ]},
  {name:'Rogue',hp:24,atk:10,def:3,color:'#7ae870',sym:'@',desc:'Fast & deadly. High burst damage.',
   baseAbils:[{name:'Backstab',desc:'3x dmg on adjacent enemy',key:'1',cd:0,max:4,range:1,aoe:false,isSpell:false},{name:'Shadowstep',desc:'Teleport in FOV',key:'2',cd:0,max:6,range:7,aoe:false,isSpell:false}],
   lvl7Abil:{name:'Poison Strike',desc:'Dmg + 3 poison/turn',key:'3',cd:0,max:5,range:1,aoe:false,isSpell:false},
   lvl15Abil:{name:'Death Mark',desc:'Next hit slays (bosses: massive dmg)',key:'4',cd:0,max:10,range:1,aoe:false,isSpell:false},
   paths:[
    {name:'Assassin',color:'#7ae870',desc:'Stealth kills and elimination',nodes:[
      {name:'Shadow Walk',desc:'Active: Move unseen 3 turns CD8',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Shadow Walk',desc:'Move unseen 3 turns',cd:0,max:8,range:0,aoe:false,isSpell:false}},
      {name:'Silent Step',desc:'Stealth attacks deal +100% dmg per rank — passive',ranks:2,costPer:2,effect:(p,r)=>{p.silentStep=(p.silentStep||0)+1},label:'+100% stealth dmg'},
      {name:'Disguise',desc:'Active: Mimic enemy ATK for 5 turns CD12',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Disguise',desc:'Mimic nearest enemy ATK',cd:0,max:12,range:0,aoe:false,isSpell:false}},
      {name:'Marked Kill',desc:'+10 HP on stealth kill per rank',ranks:2,costPer:2,effect:(p,r)=>{p.markedHeal=(p.markedHeal||0)+10},label:'+10 HP on stealth kill'},
    ]},
    {name:'Marksman',color:'#88cc55',desc:'Ranged precision — melee core, deadly abilities at distance',nodes:[
      {name:'Long Shot',desc:'Active: ranged shot, 2.2x dmg at range CD4',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Long Shot',desc:'2.2x ranged shot',cd:0,max:4,range:6,aoe:false,isSpell:false}},
      {name:'Eagle Eye',desc:'+1 ability range & +6% ranged dmg per rank — passive',ranks:3,costPer:1,effect:(p,r)=>{p.rangedBonus=(p.rangedBonus||0)+1},label:'+range & ranged dmg'},
      {name:'Multi Shot',desc:'Active: hit up to 3 enemies in a line CD6',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Multi Shot',desc:'Hits 3 in a line',cd:0,max:6,range:5,aoe:true,isSpell:false}},
      {name:'Deadeye',desc:'+12% crit (double) dmg on ranged hits per rank',ranks:2,costPer:2,effect:(p,r)=>{p.deadeye=(p.deadeye||0)+12},label:'+12% ranged crit'},
    ]},
    {name:'Ghost',color:'#aabbff',desc:'Dodge and avoid damage',nodes:[
      {name:'Ghost Form',desc:'Active: Untargetable 2 turns CD10',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Ghost Form',desc:'Untargetable 2 turns',cd:0,max:10,range:0,aoe:false,isSpell:false}},
      {name:'Evasion',desc:'+8% dodge chance per rank — passive',ranks:3,costPer:1,effect:(p,r)=>{p.dodge=(p.dodge||0)+8},label:'+8% dodge'},
      {name:'Phase Step',desc:'+25% chance attacks pass through per rank',ranks:2,costPer:2,effect:(p,r)=>{p.phase=(p.phase||0)+25},label:'+25% phase chance'},
      {name:'Momentum',desc:'+4 ATK after dodging per rank',ranks:2,costPer:2,effect:(p,r)=>{p.momentumBonus=(p.momentumBonus||0)+4},label:'+4 ATK on dodge'},
    ]}
   ]},
  {name:'Mage',hp:19,atk:5,def:1,color:'#a05ae8',sym:'@',desc:'Low base ATK but spells hit hardest.',
   baseAbils:[{name:'Magic Missile',desc:'Basic ranged dmg, no fail',key:'1',cd:0,max:2,range:2,aoe:false,isSpell:true},{name:'Blink',desc:'Instant teleport anywhere',key:'2',cd:0,max:5,range:0,aoe:false,isSpell:false}],
   lvl7Abil:{name:'Arcane Surge',desc:'Triple spell dmg 2 turns',key:'3',cd:0,max:7,range:0,aoe:false,isSpell:false},
   lvl15Abil:{name:'Time Stop',desc:'Freeze all enemies 3 turns',key:'4',cd:0,max:12,range:0,aoe:false,isSpell:false},
   paths:[
    {name:'Fire Mastery',color:'#e87a3a',desc:'Fire spells that scale with upgrades',nodes:[
      {name:'Fireball',desc:'Active: AoE 3x3 fire. Rank improves dmg. CD4',ranks:3,costPer:1,isAbil:true,upgAbil:true,abilDef:{name:'Fireball',desc:'AoE fire (rank scales dmg)',cd:0,max:4,range:3,aoe:true,isSpell:true}},
      {name:'Combustion',desc:'+2 burn dmg to targets hit per rank',ranks:2,costPer:2,effect:(p,r)=>{p.combustion=(p.combustion||0)+2},label:'+2 burn dmg'},
      {name:'Meteor',desc:'Active: Single target massive 5x dmg CD8',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Meteor',desc:'5x dmg single target',cd:0,max:8,range:5,aoe:false,isSpell:true}},
      {name:'Lava Flow',desc:'Active: 4-tile lava line (2dmg/turn) CD7',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Lava Flow',desc:'Lava line 4 tiles',cd:0,max:7,range:4,aoe:true,isSpell:true}},
    ]},
    {name:'Ice Mastery',color:'#5aaae8',desc:'Freeze and shatter enemies',nodes:[
      {name:'Frost Bolt',desc:'Active: 2.5x dmg + slow enemy CD3',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Frost Bolt',desc:'2.5x dmg + freeze',cd:0,max:3,range:5,aoe:false,isSpell:true}},
      {name:'Deep Freeze',desc:'+75% dmg vs frozen enemies per rank',ranks:2,costPer:2,effect:(p,r)=>{p.deepFreeze=(p.deepFreeze||0)+1},label:'+75% vs frozen'},
      {name:'Blizzard',desc:'Active: 5x5 AoE cold storm CD9',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Blizzard',desc:'5x5 AoE cold',cd:0,max:9,range:4,aoe:true,isSpell:true}},
      {name:'Ice Wall',desc:'Active: Block 3 tiles 4 turns CD6',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Ice Wall',desc:'Block 3 tiles 4 turns',cd:0,max:6,range:3,aoe:false,isSpell:false}},
    ]},
    {name:'Lightning Master',color:'#e8e85a',desc:'Chain lightning and storms',nodes:[
      {name:'Chain Lightning',desc:'Active: Bounces to 3 enemies CD3',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Chain Lightning',desc:'Bounce to 3 enemies',cd:0,max:3,range:5,aoe:true,isSpell:true}},
      {name:'Static',desc:'+3 lightning spell dmg per rank',ranks:3,costPer:1,effect:(p,r)=>{p.staticBonus=(p.staticBonus||0)+3},label:'+3 lightning dmg'},
      {name:'Lightning Storm',desc:'Active: 7x7 AoE lightning CD10',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Lightning Storm',desc:'7x7 AoE lightning',cd:0,max:10,range:6,aoe:true,isSpell:true}},
      {name:'Heavenly Bolt',desc:'Active: 4x single target beam CD7',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Heavenly Bolt',desc:'4x dmg beam',cd:0,max:7,range:6,aoe:false,isSpell:true}},
    ]}
   ]},
  {name:'Cleric',hp:30,atk:6,def:5,color:'#5ae8e8',sym:'@',desc:'Healer & support. Lowest ATK.',
   baseAbils:[{name:'Heal',desc:'Restore HP',key:'1',cd:0,max:4,range:0,aoe:false,isSpell:false},{name:'Holy Nova',desc:'Dmg all 8 adjacent tiles',key:'2',cd:0,max:5,range:1,aoe:true,isSpell:false}],
   lvl7Abil:{name:'Divine Shield',desc:'Immune all dmg 2 turns',key:'3',cd:0,max:7,range:0,aoe:false,isSpell:false},
   lvl15Abil:{name:'Smite',desc:'Lightning strike 4 range',key:'4',cd:0,max:6,range:4,aoe:false,isSpell:true},
   paths:[
    {name:'Dark Magic',color:'#9a3a9a',desc:'Summon undead, costs Max HP',nodes:[
      {name:'Raise Skeleton',desc:'Active: Summon skeleton ally. Reserves 12% max HP while active. Despawns after 80 turns, restoring HP. CD5',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Raise Skeleton',desc:'Summon skeleton (reserves 12% HP, 80 turns)',cd:0,max:5,range:0,aoe:false,isSpell:false}},
      {name:'Dark Pact',desc:'+5 ATK per rank, -8 max HP — passive',ranks:3,costPer:1,effect:(p,r)=>{p.atk+=5;p.mhp=Math.max(10,p.mhp-8)},label:'+5 ATK -8 maxHP'},
      {name:'Summon Vampire',desc:'Active: Summon vampire ally. Reserves 20% max HP while active. Despawns after 80 turns restoring HP. CD8',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Summon Vampire',desc:'Summon vampire (reserves 20% HP, 80 turns)',cd:0,max:8,range:0,aoe:false,isSpell:false}},
      {name:'Death Nova',desc:'Active: Dark AoE costs 15HP CD6',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Death Nova',desc:'Dark AoE (-15 HP cost)',cd:0,max:6,range:3,aoe:true,isSpell:false}},
    ]},
    {name:'Holy Path',color:'#ffe8aa',desc:'Holy damage and radiance',nodes:[
      {name:'Holy Bolt',desc:'Active: 3x range holy bolt CD3',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Holy Bolt',desc:'3x dmg holy bolt',cd:0,max:3,range:4,aoe:false,isSpell:false}},
      {name:'Consecrate',desc:'+4 Holy Nova dmg per rank — passive',ranks:3,costPer:1,effect:(p,r)=>{p.holyBonus=(p.holyBonus||0)+4},label:'+4 Holy Nova dmg'},
      {name:'Radiance',desc:'Active: Blind all visible enemies 3 turns CD6',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Radiance',desc:'Blind enemies 3 turns',cd:0,max:6,range:0,aoe:true,isSpell:false}},
      {name:'Sacred Ground',desc:'Active: 3x3 area +1HP/turn 4 turns CD7',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Sacred Ground',desc:'+1HP/turn 3x3 area',cd:0,max:7,range:2,aoe:true,isSpell:false}},
    ]},
    {name:'Wise One',color:'#aae8e8',desc:'Buffs, meditation, transcendence',nodes:[
      {name:'Ancient Power',desc:'Active: +6 ATK/DEF 5 turns CD8',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Ancient Power',desc:'+6 ATK/DEF 5 turns',cd:0,max:8,range:0,aoe:false,isSpell:false}},
      {name:'Meditation',desc:'+2 all stats permanently per rank — passive',ranks:2,costPer:2,effect:(p,r)=>{p.atk+=2;p.def+=2;p.mhp+=8;p.hp+=8},label:'+2 ATK/DEF +8 HP'},
      {name:'Foresight',desc:'Reveal entire floor — passive',ranks:1,costPer:1,effect:(p,r)=>{p.allSight=true},label:'Reveal floor'},
      {name:'Transcendence',desc:'Active: Cannot die for 1 turn CD15',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Transcendence',desc:'Cannot die 1 turn',cd:0,max:15,range:0,aoe:false,isSpell:false}},
    ]}
   ]},
  {name:'Paladin',hp:36,atk:9,def:5,color:'#e8e050',sym:'@',desc:'Holy warrior. Balance of offence and protection.',
   baseAbils:[{name:'Blessed Strike',desc:'ATK+5 holy dmg adj enemy',key:'1',cd:0,max:3,range:1,aoe:false,isSpell:false},{name:'Lay on Hands',desc:'Heal 20HP',key:'2',cd:0,max:5,range:0,aoe:false,isSpell:false}],
   lvl7Abil:{name:'Judgement',desc:'2x dmg + stun adjacent',key:'3',cd:0,max:5,range:1,aoe:false,isSpell:false},
   lvl15Abil:{name:'Holy Wrath',desc:'5x AoE all visible enemies',key:'4',cd:0,max:10,range:0,aoe:true,isSpell:true},
   paths:[
    {name:'Crusader',color:'#e8c840',desc:'Offensive holy power vs evil',nodes:[
      {name:'Crusader Charge',desc:'Active: Charge 3 tiles damaging all in path CD6',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Crusader Charge',desc:'Charge 3 tiles dmg all',cd:0,max:6,range:3,aoe:true,isSpell:false}},
      {name:'Smite Evil',desc:'+6 dmg vs bosses per rank — passive',ranks:3,costPer:1,effect:(p,r)=>{p.smiteBonus=(p.smiteBonus||0)+6},label:'+6 boss dmg'},
      {name:'Holy Blade',desc:'+3 holy dmg on every weapon attack per rank',ranks:2,costPer:2,effect:(p,r)=>{p.holyBlade=(p.holyBlade||0)+3},label:'+3 holy on hit'},
      {name:'Divine Vengeance',desc:'Store incoming dmg, release on next hit',ranks:1,costPer:3,effect:(p,r)=>{p.vengeance=true},label:'Store+release damage'},
    ]},
    {name:'Protector',color:'#aae0ff',desc:'Shield and absorption',nodes:[
      {name:'Sacred Vow',desc:'Active: Absorb 45 damage shield CD8',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Sacred Vow',desc:'45 dmg absorb shield',cd:0,max:8,range:0,aoe:false,isSpell:false}},
      {name:'Holy Barrier',desc:'+7 DEF below 50% HP per rank — passive',ranks:2,costPer:1,effect:(p,r)=>{p.barrierBonus=(p.barrierBonus||0)+7},label:'+7 DEF at low HP'},
      {name:'Aura of Protection',desc:'-3 from all incoming damage per rank',ranks:3,costPer:2,effect:(p,r)=>{p.aura=(p.aura||0)+3},label:'-3 all damage'},
      {name:'Sanctuary',desc:'Active: All dmg reduced to 1 for 2 turns CD12',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Sanctuary',desc:'All dmg = 1 for 2 turns',cd:0,max:12,range:0,aoe:false,isSpell:false}},
    ]},
    {name:'Zealot',color:'#ff9940',desc:'Self-sacrifice for raw power',nodes:[
      {name:'Fanatic',desc:'-2 maxHP, +4 ATK per rank',ranks:4,costPer:1,effect:(p,r)=>{p.mhp=Math.max(10,p.mhp-2);p.atk+=4},label:'-2 maxHP +4 ATK'},
      {name:'Zealous Fury',desc:'2x ATK below 30% HP',ranks:1,costPer:2,effect:(p,r)=>{p.zealot=true},label:'2x ATK below 30% HP'},
      {name:'Sacrifice Strike',desc:'Active: Spend 20HP for 5x dmg CD6',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Sacrifice Strike',desc:'Spend 20HP for 5x dmg',cd:0,max:6,range:1,aoe:false,isSpell:false}},
      {name:'Martyr',desc:'On death: explode AoE + revive at 1HP (once per run)',ranks:1,costPer:3,effect:(p,r)=>{p.martyr=true},label:'Death explosion + revive'},
    ]}
   ]},
  {name:'Necromancer',hp:22,atk:7,def:2,color:'#55cc88',sym:'@',desc:'Commands the dead. Grows stronger with kills.',
   baseAbils:[{name:'Soul Drain',desc:'Steal HP from adjacent enemy',key:'1',cd:0,max:3,range:1,aoe:false,isSpell:true},{name:'Bone Shield',desc:'+6 DEF for 3 turns',key:'2',cd:0,max:5,range:0,aoe:false,isSpell:false}],
   lvl7Abil:{name:'Corpse Burst',desc:'AoE explosion on enemies near you',key:'3',cd:0,max:5,range:2,aoe:true,isSpell:true},
   lvl15Abil:{name:'Lich Form',desc:'Immune+dmg aura 3 turns',key:'4',cd:0,max:12,range:0,aoe:false,isSpell:false},
   paths:[
    {name:'Undead Army',color:'#55cc88',desc:'Raise powerful undead allies',nodes:[
      {name:'Raise Skeleton',desc:'Active: Summon skeleton ally. Reserves 12% max HP while active. Despawns after 80 turns, restoring HP. CD5',ranks:1,costPer:1,isAbil:true,abilDef:{name:'Raise Skeleton',desc:'Summon skeleton (reserves 12% HP, 80 turns)',cd:0,max:5,range:0,aoe:false,isSpell:false}},
      {name:'Army of Bones',desc:'Raise your minion cap. Rank 1 = 3, Rank 2 = 4, Rank 3 = 5 simultaneously.',ranks:3,costPer:1,effect:(p,r)=>{p.maxMinions=(p.maxMinions||2)+1},label:'+1 max minions per rank (base: 2)'},
      {name:'Warlord',desc:'Minions deal +5 dmg per rank',ranks:2,costPer:2,effect:(p,r)=>{p.minionBonus=(p.minionBonus||0)+5},label:'+5 minion dmg per rank'},
      {name:'Raise Dragon',desc:'Active: Raise a powerful dragon minion. No HP cost. CD15',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Raise Dragon',desc:'Raise a dragon ally (no HP cost)',cd:0,max:15,range:0,aoe:false,isSpell:false}},
    ]},
    {name:'Soul Harvester',color:'#cc88ff',desc:'Grow stronger with every kill',nodes:[
      {name:'Soul Siphon',desc:'Gain +2 ATK per kill stacking up to +30',ranks:1,costPer:2,effect:(p,r)=>{p.soulSiphon=true},label:'Stack ATK on kills'},
      {name:'Harvest',desc:'+12 HP per kill per rank',ranks:2,costPer:2,effect:(p,r)=>{p.soulHarvest=(p.soulHarvest||0)+12},label:'+12 HP on kill'},
      {name:'Soul Jar',desc:'5 soul charges = full heal',ranks:1,costPer:2,effect:(p,r)=>{p.soulJar=true},label:'5 kills = full heal'},
      {name:'Soul Storm',desc:'Active: Release souls as AoE CD6',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Soul Storm',desc:'Release souls as AoE',cd:0,max:6,range:4,aoe:true,isSpell:true}},
    ]},
    {name:'Plague Doctor',color:'#aaff77',desc:'Disease and rot',nodes:[
      {name:'Infect',desc:'Attacks apply 1 poison per rank',ranks:2,costPer:1,effect:(p,r)=>{p.infectChance=(p.infectChance||0)+1},label:'Attacks apply poison'},
      {name:'Epidemic',desc:'Poison spreads on enemy death',ranks:1,costPer:2,effect:(p,r)=>{p.epidemic=true},label:'Poison spreads on kill'},
      {name:'Rot Cloud',desc:'Active: 5x5 poison cloud CD7',ranks:1,costPer:2,isAbil:true,abilDef:{name:'Rot Cloud',desc:'5x5 poison cloud',cd:0,max:7,range:4,aoe:true,isSpell:true}},
      {name:'Pandemic',desc:'+3 poison dmg, poisoned explode on death per rank',ranks:2,costPer:3,effect:(p,r)=>{p.pandemic=(p.pandemic||0)+3},label:'+3 poison + death burst'},
    ]}
   ]},
  // ── PRESTIGE CLASS (unlocked by defeating the God Demon) ──
  // Starts maxed: huge stats, all abilities, a legendary weapon. Filtered out of
  // the class chooser unless prestigeUnlocked. Selecting it flags the run as
  // prestige mode → themed hard-mode floors (handled in mkMonsters).
  {name:'Godslayer',hp:80,atk:24,def:14,color:'#ffcc33',sym:'@',prestige:true,desc:'PRESTIGE — maxed hero. Faces a far deadlier dungeon.',
   baseAbils:[
     {name:'Legendary Edge',desc:'Next attack 5x dmg',key:'1',cd:0,max:6,range:1,aoe:false,isSpell:false},
     {name:'Whirlwind',desc:'Hit all 8 adjacent',key:'2',cd:0,max:4,range:1,aoe:true,isSpell:false},
     {name:'Heavenly Bolt',desc:'4x ranged smite',key:'3',cd:0,max:5,range:7,aoe:false,isSpell:true},
     {name:'Multi Shot',desc:'Hits 3 in a line',key:'4',cd:0,max:4,range:6,aoe:true,isSpell:false},
   ],
   paths:[
    {name:'Ascendant',color:'#ffcc33',desc:'A god among mortals — every strength at once',nodes:[
      {name:'Divine Might',desc:'+6 ATK per rank',ranks:3,costPer:1,effect:(p,r)=>{p.atk+=6},label:'+6 ATK'},
      {name:'Aegis',desc:'+20 Max HP & +3 DEF per rank',ranks:3,costPer:1,effect:(p,r)=>{p.mhp+=20;p.hp+=20;p.def+=3},label:'+20 HP +3 DEF'},
      {name:'Soul Reaver',desc:'+8 HP on kill per rank',ranks:2,costPer:2,effect:(p,r)=>{p.wpnLifesteal=(p.wpnLifesteal||0)+8},label:'+8 HP on kill'},
      {name:'Cataclysm',desc:'Active: massive 6x6 blast CD8',ranks:1,costPer:3,isAbil:true,abilDef:{name:'Cataclysm',desc:'6x6 blast',cd:0,max:8,range:6,aoe:true,isSpell:true}},
    ]}
   ]}
];

// ══ MONSTERS ══
const MTYPES=[
  {name:'Rat',sym:'r',hp:4,atk:2,def:0,xp:2,gold:1,col:'#9a7a5a',sight:5},
  {name:'Goblin',sym:'g',hp:8,atk:4,def:1,xp:5,gold:3,col:'#7a9a5a',sight:6},
  {name:'Orc',sym:'O',hp:16,atk:7,def:3,xp:10,gold:6,col:'#5a8a5a',sight:6},
  {name:'Skeleton',sym:'s',hp:11,atk:5,def:2,xp:8,gold:4,col:'#bbbbbb',sight:7},
  {name:'Vampire',sym:'V',hp:22,atk:9,def:4,xp:15,gold:8,col:'#9a3a9a',sight:8,spd:1,rangeAtk:3,drainHp:4},
  {name:'Troll',sym:'T',hp:28,atk:11,def:5,xp:18,gold:10,col:'#5a9a5a',sight:5},
  {name:'Werewolf',sym:'W',hp:30,atk:13,def:4,xp:20,gold:12,col:'#8a6a3a',sight:7},
  {name:'Lich',sym:'L',hp:20,atk:14,def:3,xp:22,gold:14,col:'#5a8aaa',sight:9,rangeAtk:4,raisesDead:true},
  {name:'Demon',sym:'&',hp:35,atk:15,def:6,xp:28,gold:16,col:'#c83a3a',sight:7,spd:2},
  {name:'Dragon',sym:'D',hp:55,atk:20,def:8,xp:55,gold:35,col:'#e84a4a',sight:8,spd:3,rangeAtk:5,specialLoot:true}
];
const BOSS_TYPES=[
  {name:'BONE KING',sym:'K',hp:160,atk:18,def:8,xp:80,gold:70,col:'#eeeebb',sight:14,bossAbil:'raise_dead'},
  {name:'BLOOD WITCH',sym:'W',hp:140,atk:22,def:6,xp:100,gold:80,col:'#cc44cc',sight:14,bossAbil:'blood_missile'},
  {name:'IRON COLOSSUS',sym:'C',hp:220,atk:18,def:16,xp:120,gold:90,col:'#88aacc',sight:12,bossAbil:'shockwave'},
  {name:'SHADOW LORD',sym:'S',hp:200,atk:28,def:12,xp:140,gold:100,col:'#6633cc',sight:16,bossAbil:'shadow_nova'},
  {name:'VOID DRAGON',sym:'X',hp:320,atk:36,def:18,xp:220,gold:160,col:'#ff3333',sight:18,bossAbil:'void_breath'},
  {name:'GOD DEMON',sym:'@',hp:900,atk:48,def:24,xp:1000,gold:500,col:'#ffcc33',sight:20,bossAbil:'void_breath',isFinal:true},
];
const MAX_FLOOR=100;

// ══ ITEMS ══
const WEAPONS=[
  {name:'Rusty Dagger',sym:'/',col:'#8a8a6a',rare:0,atk:2,val:5,desc:'Barely sharp.'},
  {name:'Short Sword',sym:'/',col:'#a0a0a0',rare:0,atk:3,val:7,desc:'Standard blade.'},
  {name:'Mace',sym:'/',col:'#9a7a5a',rare:0,atk:4,val:9,desc:'Blunt force.'},
  {name:'Iron Sword',sym:'/',col:'#b0b0b0',rare:1,atk:6,val:15,desc:'Well balanced.'},
  {name:'Battle Axe',sym:'/',col:'#c8a06a',rare:1,atk:8,val:18,desc:'Heavy two-hander.'},
  {name:'War Hammer',sym:'/',col:'#a0b0b0',rare:1,atk:7,def:1,val:20,desc:'Crushing weight.'},
  {name:'Elven Blade',sym:'/',col:'#aae8aa',rare:2,atk:10,val:35,desc:'Impossibly light.'},
  {name:'Flame Blade',sym:'/',col:'#e87a3a',rare:2,atk:12,val:45,desc:'Seared with runes.'},
  {name:'Frost Edge',sym:'/',col:'#5aace8',rare:2,atk:11,def:2,val:42,desc:'Slows blood.'},
  {name:'Shadow Fang',sym:'/',col:'#6a3aaa',rare:2,atk:11,val:38,desc:'Drinks shadows.'},
  {name:'Void Reaper',sym:'/',col:'#c85ae8',rare:3,atk:16,val:80,desc:'Cuts reality.'},
  {name:'Dragon Claw',sym:'/',col:'#e83a3a',rare:3,atk:18,val:95,desc:'From a wyrm.',specialLoot:true},
  {name:'Godslayer',sym:'/',col:'#ffe050',rare:3,atk:20,val:120,desc:'Legend made steel.',specialLoot:true},
];
const ARMORS=[
  {name:'Cloth Robe',sym:']',col:'#9a8a7a',rare:0,def:1,val:5,desc:'Barely anything.'},
  {name:'Leather Armor',sym:']',col:'#8a6a3a',rare:0,def:2,val:8,desc:'Cured hide.'},
  {name:'Padded Vest',sym:']',col:'#7a8a6a',rare:0,def:3,val:10,desc:'Multiple layers.'},
  {name:'Chain Mail',sym:']',col:'#a0a8aa',rare:1,def:5,val:20,desc:'Interlocked rings.'},
  {name:'Scale Armor',sym:']',col:'#8aaa8a',rare:1,def:6,val:24,desc:'Overlapping plates.'},
  {name:'Battle Plate',sym:']',col:'#b0b8c0',rare:1,def:7,atk:1,val:28,desc:'Full steel plate.'},
  {name:'Dragon Scale',sym:']',col:'#e84a4a',rare:2,def:10,val:60,desc:'Near impenetrable.'},
  {name:'Storm Plate',sym:']',col:'#5aaae8',rare:2,def:11,val:65,desc:'Crackles with lightning.'},
  {name:'Shadow Shroud',sym:']',col:'#5a3a8a',rare:2,def:8,val:45,desc:'Absorbs darkness.'},
  {name:'Void Plate',sym:']',col:'#8a5ae8',rare:3,def:14,val:100,desc:'Forged in the void.'},
  {name:'Titan Aegis',sym:']',col:'#e8e0a0',rare:3,def:16,atk:2,val:120,desc:'Indestructible.'},
];
const RINGS=[
  {name:'Copper Band',sym:'o',col:'#c87a3a',rare:0,atk:1,val:6,desc:'Minor boost.'},
  {name:'Jade Ring',sym:'o',col:'#5ac87a',rare:0,def:1,val:6,desc:'Minor ward.'},
  {name:'Ruby Ring',sym:'o',col:'#e85a5a',rare:1,atk:3,val:20,desc:'Burning aggression.'},
  {name:'Sapphire Ring',sym:'o',col:'#5aaae8',rare:1,def:3,val:20,desc:'Cool resistance.'},
  {name:'War Ring',sym:'o',col:'#e8a05a',rare:2,atk:5,val:35,desc:'Warlord sigil.'},
  {name:'Guardian Ring',sym:'o',col:'#aae8aa',rare:2,def:5,val:35,desc:'Ancient ward.'},
  {name:'Eclipse Ring',sym:'o',col:'#334477',rare:3,atk:4,def:4,val:90,desc:'Perfect balance.'},
];
const AMULETS=[
  {name:'Bone Charm',sym:'"',col:'#ccbb99',rare:0,atk:1,val:7,desc:'Crude talisman.'},
  {name:'Stone Pendant',sym:'"',col:'#887766',rare:1,def:3,atk:1,val:25,desc:'Earth power.'},
  {name:'Power Amulet',sym:'"',col:'#c85ae8',rare:2,atk:4,def:2,val:40,desc:'Crackling energy.'},
  {name:'Omega Pendant',sym:'"',col:'#ffe050',rare:3,atk:6,def:6,val:110,desc:'The last relic.'},
];
const POTIONS=[
  {name:'Health Potion',sym:'!',col:'#e85a5a',rare:0,heal:15,val:10,desc:'Restores 15 HP.'},
  {name:'Greater Potion',sym:'!',col:'#c82020',rare:1,heal:30,val:22,desc:'Restores 30 HP.'},
  {name:'Elixir of Life',sym:'!',col:'#ff8888',rare:2,heal:60,val:50,desc:'Restores 60 HP.'},
];

// ══ RELICS ══
// Each relic has: id, name, icon, type ('pure'|'cursed'|'balanced'), flavor text,
// buffs[] / debuffs[] (display strings), apply(player) function called on pickup
const ALL_RELICS=[
  // ── PURE BUFFS (16) ──
  {id:'thiefs_tools',name:"Thief's Tools",icon:'🛠',type:'pure',
   buffs:['Disarm spike traps harmlessly','Traps revealed on the map'],debuffs:[],
   flavor:'A roll of picks, files and clever wire.',
   apply:(p)=>{p.trapDisarm=true;p.revealTraps=true}},
  {id:'heart_stone',name:'Heart Stone',icon:'💎',type:'pure',
   buffs:['+20 Max HP','Gain 8 HP at start of each floor'],debuffs:[],
   flavor:'A gem warm to the touch.',
   apply:(p)=>{p.mhp+=20;p.hp=Math.min(p.hp+20,p.mhp);p.floorHeal=(p.floorHeal||0)+8}},
  {id:'war_drum',name:'War Drum',icon:'🥁',type:'pure',
   buffs:['+4 ATK permanently'],debuffs:[],
   flavor:'Its rhythm steels your nerve.',
   apply:(p)=>{p.atk+=4}},
  {id:'iron_veil',name:'Iron Veil',icon:'🛡',type:'pure',
   buffs:['+4 DEF permanently'],debuffs:[],
   flavor:'A shimmering curtain of protection.',
   apply:(p)=>{p.def+=4}},
  {id:'swift_boots',name:'Swift Boots',icon:'👢',type:'pure',
   buffs:['+10% dodge chance'],debuffs:[],
   flavor:'Soles worn by a thief of legend.',
   apply:(p)=>{p.dodge=(p.dodge||0)+10}},
  {id:'gilded_coin',name:'Gilded Coin',icon:'🪙',type:'pure',
   buffs:['+50 gold','+3 gold per kill','Items sell for 20% more'],debuffs:[],
   flavor:'Fortune favours the bold.',
   apply:(p)=>{p.gold+=50;p.sellBonus=(p.sellBonus||0)+0.2;p.bountyGold=(p.bountyGold||0)+3}},
  {id:'soul_lantern',name:'Soul Lantern',icon:'🪔',type:'pure',
   buffs:['+3 HP per kill'],debuffs:[],
   flavor:'Each death fuels its flame.',
   apply:(p)=>{p.lanternHeal=(p.lanternHeal||0)+3}},
  {id:'crystal_vial',name:'Crystal Vial',icon:'⚗',type:'pure',
   buffs:['Potions heal +20 extra HP'],debuffs:[],
   flavor:'Magnifies every draught.',
   apply:(p)=>{p.potionBonus=(p.potionBonus||0)+20}},
  {id:'thunder_charm',name:'Thunder Charm',icon:'⚡',type:'pure',
   buffs:['15% chance: attacks stun 1 turn'],debuffs:[],
   flavor:'Crackles at the moment of impact.',
   apply:(p)=>{p.thunderCharm=(p.thunderCharm||0)+15}},
  {id:'phantom_cloak',name:'Phantom Cloak',icon:'👻',type:'pure',
   buffs:['First hit each floor: no damage'],debuffs:[],
   flavor:'The first strike always misses.',
   apply:(p)=>{p.phantomCloak=true;p.cloakActive=true}},
  {id:'rune_of_fury',name:'Rune of Fury',icon:'🔥',type:'pure',
   buffs:['Ability cooldowns reduced by 1'],debuffs:[],
   flavor:'Each glyph screams with power.',
   apply:(p)=>{p.cdReduction=(p.cdReduction||0)+1}},
  {id:'fortune_scroll',name:'Fortune Scroll',icon:'📜',type:'pure',
   buffs:['Gain 1 skill point now'],debuffs:[],
   flavor:'Knowledge compressed into destiny.',
   apply:(p)=>{p.skillPts=(p.skillPts||0)+1}},
  {id:'echo_blade',name:'Echo Blade',icon:'🗡',type:'pure',
   buffs:['+20% chance: weapon attacks hit twice'],debuffs:[],
   flavor:'Every slash leaves an afterimage.',
   apply:(p)=>{p.doubleStrike=(p.doubleStrike||0)+20}},
  {id:'titan_heart',name:'Titan Heart',icon:'❤',type:'pure',
   buffs:['+30 Max HP'],debuffs:[],
   flavor:'Pumped from a fallen colossus.',
   apply:(p)=>{p.mhp+=30;p.hp=Math.min(p.hp+30,p.mhp)}},
  {id:'sage_eye',name:'Sage Eye',icon:'👁',type:'pure',
   buffs:['Reveal entire floor (permanent)','+2 DEF'],debuffs:[],
   flavor:'See past every shadow.',
   apply:(p)=>{p.allSight=true;p.def+=2}},
  {id:'bounty_mark',name:'Bounty Mark',icon:'🎯',type:'pure',
   buffs:['+6 gold per kill','+2 ATK'],debuffs:[],
   flavor:'Every enemy is worth something.',
   apply:(p)=>{p.bountyGold=(p.bountyGold||0)+6;p.atk+=2}},
  {id:'mana_shard',name:'Mana Shard',icon:'🔮',type:'pure',
   buffs:['+15% spell resistance','+8 Max HP'],debuffs:[],
   flavor:'Crystallised arcane focus.',
   apply:(p)=>{p.spellResist=(p.spellResist||0)+15;p.mhp+=8;p.hp=Math.min(p.hp+8,p.mhp)}},

  // ── BALANCED (buff + debuff) (24) ──
  {id:'blood_pact',name:'Blood Pact',icon:'🩸',type:'balanced',
   buffs:['+8 ATK'],debuffs:['-15 Max HP'],
   flavor:'Power has a price in flesh.',
   apply:(p)=>{p.atk+=8;p.mhp=Math.max(10,p.mhp-15);p.hp=Math.min(p.hp,p.mhp)}},
  {id:'berserker_crest',name:'Berserker Crest',icon:'⚔',type:'balanced',
   buffs:['+6 ATK','2x damage below 25% HP'],debuffs:['-8 DEF'],
   flavor:'Rage and recklessness, inseparable.',
   apply:(p)=>{p.atk+=6;p.def=Math.max(0,p.def-8);p.berserkCrest=true}},
  {id:'void_crystal',name:'Void Crystal',icon:'🌑',type:'balanced',
   buffs:['Attacks ignore 6 DEF'],debuffs:['Take +3 extra damage per hit'],
   flavor:'It devours defence — yours and theirs.',
   apply:(p)=>{p.armorPierce=(p.armorPierce||0)+6;p.dmgTaken=(p.dmgTaken||0)+3}},
  {id:'glass_cannon',name:'Glass Cannon',icon:'💥',type:'balanced',
   buffs:['+12 ATK'],debuffs:['-10 DEF','-20 Max HP'],
   flavor:'Devastating. Fragile.',
   apply:(p)=>{p.atk+=12;p.def=Math.max(0,p.def-10);p.mhp=Math.max(10,p.mhp-20);p.hp=Math.min(p.hp,p.mhp)}},
  {id:'vampiric_hunger',name:'Vampiric Hunger',icon:'🧛',type:'balanced',
   buffs:['+8 HP on kill'],debuffs:['-5 DEF'],
   flavor:'Life stolen, defence sacrificed.',
   apply:(p)=>{p.lanternHeal=(p.lanternHeal||0)+8;p.def=Math.max(0,p.def-5)}},
  {id:'cursed_blade',name:'Cursed Blade',icon:'🔪',type:'balanced',
   buffs:['+8 ATK on every attack'],debuffs:['-3 HP on every attack (self)'],
   flavor:'It thirsts — for your blood too.',
   apply:(p)=>{p.cursedBlade=true;p.atk+=8;p.cursedBladeCost=3}},
  {id:'stone_flesh',name:'Stone Flesh',icon:'🪨',type:'balanced',
   buffs:['+8 DEF','+20 Max HP'],debuffs:['-3 ATK','Dodge reduced to 0%'],
   flavor:'Immovable. Ponderous.',
   apply:(p)=>{p.def+=8;p.mhp+=20;p.hp=Math.min(p.hp+20,p.mhp);p.atk=Math.max(1,p.atk-3);p.dodge=0;p.stoneFleshed=true}},
  {id:'twin_fang',name:'Twin Fang',icon:'🐍',type:'balanced',
   buffs:['Attacks apply 2 poison','Poison damage +3/tick'],debuffs:['-4 ATK (physical)'],
   flavor:'Venom flows, strength fades.',
   apply:(p)=>{p.infectChance=(p.infectChance||0)+2;p.poisonBonus=(p.poisonBonus||0)+3;p.atk=Math.max(1,p.atk-4)}},
  {id:'dark_sigil',name:'Dark Sigil',icon:'🔯',type:'balanced',
   buffs:['Gain 2 skill points now'],debuffs:['-25 Max HP'],
   flavor:'Knowledge exacts a toll.',
   apply:(p)=>{p.skillPts=(p.skillPts||0)+2;p.mhp=Math.max(10,p.mhp-25);p.hp=Math.min(p.hp,p.mhp)}},
  {id:'mirror_shield',name:'Mirror Shield',icon:'🪞',type:'balanced',
   buffs:['Reflect 6 damage on every hit'],debuffs:['-4 ATK'],
   flavor:'Your pain, returned with interest.',
   apply:(p)=>{p.reflectFlat=(p.reflectFlat||0)+6;p.atk=Math.max(1,p.atk-4)}},
  {id:'chaos_gem',name:'Chaos Gem',icon:'🎲',type:'balanced',
   buffs:['25% chance: ability deals 4x damage'],debuffs:['10% chance: ability damages you instead'],
   flavor:'Order is overrated.',
   apply:(p)=>{p.chaosGem=true}},
  {id:'undying_ember',name:'Undying Ember',icon:'🕯',type:'balanced',
   buffs:['Revive once at 30% HP on death'],debuffs:['Max HP reduced by 30 after revive'],
   flavor:'It dies, yet burns on.',
   apply:(p)=>{p.undyingEmber=true}},
  {id:'spell_battery',name:'Spell Battery',icon:'⚡',type:'balanced',
   buffs:['Spells deal +50% damage'],debuffs:['Spell fail chance +10%'],
   flavor:'Overflow is a feature.',
   apply:(p)=>{p.spellBattery=(p.spellBattery||0)+0.5;p.spellPenalty=(p.spellPenalty||0)+10}},
  {id:'leech_ring',name:'Leech Ring',icon:'💍',type:'balanced',
   buffs:['Steal 5 HP per melee hit'],debuffs:['Abilities cost 3 HP each'],
   flavor:'Feed and drain.',
   apply:(p)=>{p.leechRing=true}},
  {id:'runic_gamble',name:'Runic Gamble',icon:'🎰',type:'balanced',
   buffs:['+6 ATK','+4 DEF'],debuffs:['Base ATK/DEF reset to class values each boss floor'],
   flavor:'Everything risked, everything gained.',
   apply:(p)=>{p.atk+=6;p.def+=4;p.runicGamble=true;let cls=CLASSES.find(cl=>cl.name===p.cls);p.runicBaseAtk=cls?cls.atk:p.atk;p.runicBaseDef=cls?cls.def:p.def;}},
  {id:'iron_will',name:'Iron Will',icon:'🗿',type:'balanced',
   buffs:['Cannot be killed in one hit above 15 HP'],debuffs:['Healing reduced by 50%'],
   flavor:'The body refuses to yield.',
   apply:(p)=>{p.ironWill=true}},
  {id:'eclipse_ring',name:'Eclipse Relic',icon:'🌘',type:'balanced',
   buffs:['+5 ATK','+3 DEF'],debuffs:['No gold drops from enemies','-10 Max HP'],
   flavor:'Power that costs your fortune.',
   apply:(p)=>{p.atk+=5;p.def+=3;p.noGoldDrops=true;p.mhp=Math.max(10,p.mhp-10);p.hp=Math.min(p.hp,p.mhp)}},
  {id:'warlord_band',name:'Warlord Band',icon:'🏴',type:'balanced',
   buffs:['Boss damage +15','+3 ATK'],debuffs:['-3 DEF'],
   flavor:'Forged for the hunt of kings.',
   apply:(p)=>{p.smiteBonus=(p.smiteBonus||0)+15;p.atk+=3;p.def=Math.max(0,p.def-3)}},
  {id:'resonant_core',name:'Resonant Core',icon:'🔵',type:'balanced',
   buffs:['Kills grant +1 temporary ATK (up to +15)'],debuffs:['-3 base ATK'],
   flavor:'It grows hungry with every death.',
   apply:(p)=>{p.resonantCore=true;p.atk=Math.max(1,p.atk-3)}},
  {id:'thorn_crown',name:'Thorn Crown',icon:'👑',type:'balanced',
   buffs:['Reflect 30% of incoming damage'],debuffs:['Take 15% more damage'],
   flavor:'The sovereign who bleeds.',
   apply:(p)=>{p.thornCrown=true}},
  {id:'abyssal_eye',name:'Abyssal Eye',icon:'🕳',type:'balanced',
   buffs:['See all enemies on the floor'],debuffs:['Enemies target you first'],
   flavor:'To see all is to be seen by all.',
   apply:(p)=>{p.allSight=true;p.abyssalCurse=true}},
  {id:'war_trophy',name:'War Trophy',icon:'🏆',type:'balanced',
   buffs:['+10 ATK after each boss kill'],debuffs:['Lose 5 ATK on any death (min 1)'],
   flavor:'Victory compounds. Defeat diminishes.',
   apply:(p)=>{p.warTrophy=true}},
  {id:'phantom_edge',name:'Phantom Edge',icon:'🌫',type:'balanced',
   buffs:['30% chance to deal double damage'],debuffs:['30% chance to deal half damage'],
   flavor:'The dice decide your fate.',
   apply:(p)=>{p.phantomEdge=true}},
  {id:'crimson_heart',name:'Crimson Heart',icon:'❣',type:'balanced',
   buffs:['Gain 6 HP at start of each floor','+10 Max HP'],debuffs:['Lose 2 HP per ability used'],
   flavor:'The heart that beats too fast.',
   apply:(p)=>{p.floorHeal=(p.floorHeal||0)+6;p.mhp+=10;p.hp=Math.min(p.hp+10,p.mhp);p.abilHpCost=(p.abilHpCost||0)+2}},

  // ── CURSED (mostly debuffs, small buff) (10) ──
  {id:'skull_brand',name:'Skull Brand',icon:'💀',type:'cursed',
   buffs:['Enemies drop double XP'],debuffs:['-20 Max HP','-3 DEF'],
   flavor:'Marked for suffering.',
   apply:(p)=>{p.xpMult=(p.xpMult||1)*2;p.mhp=Math.max(10,p.mhp-20);p.hp=Math.min(p.hp,p.mhp);p.def=Math.max(0,p.def-3)}},
  {id:'doom_seal',name:'Doom Seal',icon:'☠',type:'cursed',
   buffs:['+25 ATK'],debuffs:['Lose 5 HP per turn','-10 Max HP'],
   flavor:'Power demands a constant toll.',
   apply:(p)=>{p.atk+=25;p.doomSeal=true;p.mhp=Math.max(10,p.mhp-10);p.hp=Math.min(p.hp,p.mhp)}},
  {id:'betrayer_ring',name:'Betrayer Ring',icon:'🔴',type:'cursed',
   buffs:['+12 ATK','+50% damage dealt'],debuffs:['Take +25% damage','-15 Max HP'],
   flavor:'Strength for fragility.',
   apply:(p)=>{p.atk+=12;p.dmgMult=(p.dmgMult||1)*1.5;p.dmgTakenPct=(p.dmgTakenPct||0)+0.25;p.mhp=Math.max(10,p.mhp-15);p.hp=Math.min(p.hp,p.mhp)}},
  {id:'chain_of_fate',name:'Chain of Fate',icon:'⛓',type:'cursed',
   buffs:['All cooldowns halved'],debuffs:['Abilities can no longer be upgraded'],
   flavor:'Power locked in place.',
   apply:(p)=>{p.abilities.forEach(a=>{a.max=Math.max(1,Math.floor(a.max/2))});p.cdHalved=true}},
  {id:'hollow_throne',name:'Hollow Throne',icon:'🪑',type:'cursed',
   buffs:['+20 ATK','Immune to stun'],debuffs:['Cannot use potions','Healing reduced by 75%'],
   flavor:'A king who no longer needs rest.',
   apply:(p)=>{p.atk+=20;p.stunImmune=true;p.noPotions=true;p.healMult=(p.healMult||1)*0.25}},
  {id:'pact_of_ashes',name:'Pact of Ashes',icon:'🌋',type:'cursed',
   buffs:['Killing blow deals AoE splash'],debuffs:['Lose 8 HP on every kill'],
   flavor:'Victory burns everything.',
   apply:(p)=>{p.killSplash=true;p.killHpLoss=(p.killHpLoss||0)+8}},
  {id:'spider_thread',name:'Spider Thread',icon:'🕸',type:'cursed',
   buffs:['Enemies are slowed (skip 1 turn) when adjacent'],debuffs:['Cannot move diagonally','Speed reduced'],
   flavor:'Trap everything. Move like stone.',
   apply:(p)=>{p.spiderThread=true}},
  {id:'lich_fragment',name:'Lich Fragment',icon:'🦴',type:'cursed',
   buffs:['Undead minions deal +10 damage'],debuffs:['Lose 15 Max HP per boss killed'],
   flavor:'The lich power decays its host.',
   apply:(p)=>{p.minionBonus=(p.minionBonus||0)+10;p.lichFragment=true}},
  {id:'obsidian_brand',name:'Obsidian Brand',icon:'⬛',type:'cursed',
   buffs:['Spells deal +8 damage'],debuffs:['-6 ATK (physical)','-4 DEF'],
   flavor:'The arcane consumes the physical.',
   apply:(p)=>{p.spellBonusFlat=(p.spellBonusFlat||0)+8;p.atk=Math.max(1,p.atk-6);p.def=Math.max(0,p.def-4)}},
  {id:'mirror_curse',name:'Mirror Curse',icon:'🪟',type:'cursed',
   buffs:['Take no damage from first hit each floor'],debuffs:['Receive double damage for rest of floor after first hit'],
   flavor:'Perfect for exactly one blow.',
   apply:(p)=>{p.mirrorCurse=true;p.mirrorActive=true}},
];


// ══ RELIC SYNERGIES ══
const RELIC_SYNERGIES=[
  {ids:['glass_cannon','cursed_blade'],tag:'💀 Death Wish'},
  {ids:['glass_cannon','berserker_crest'],tag:'⚔ Glass Berserker'},
  {ids:['void_crystal','blood_pact'],tag:'🩸 Void Reaper'},
  {ids:['vampiric_hunger','leech_ring'],tag:'🧛 Life Thief'},
  {ids:['vampiric_hunger','soul_lantern'],tag:'⚗ Lifesteal Build'},
  {ids:['thunder_charm','echo_blade'],tag:'⚡ Storm Blades'},
  {ids:['echo_blade','berserker_crest'],tag:'🗡 Frenzied Strikes'},
  {ids:['mirror_shield','thorn_crown'],tag:'🪞 Thorned Mirror'},
  {ids:['crystal_vial','heart_stone'],tag:'💊 Potion Master'},
  {ids:['doom_seal','iron_will'],tag:'☠ Living Death'},
  {ids:['spell_battery','mana_shard'],tag:'🔮 Arcane Surge'},
  {ids:['phantom_cloak','mirror_curse'],tag:'👻 One-Hit Wonder'},
  {ids:['dark_sigil','fortune_scroll'],tag:'📜 Scholars Path'},
  {ids:['skull_brand','bounty_mark'],tag:'🎯 Bounty Hunter'},
  {ids:['rune_of_fury','chaos_gem'],tag:'🎲 Chaos Mage'},
  {ids:['resonant_core','war_trophy'],tag:'🏆 Snowball Build'},
  {ids:['stone_flesh','mirror_shield'],tag:'🪨 Iron Wall'},
  {ids:['twin_fang','blood_pact'],tag:'🐍 Venom Pact'},
];
function getRelicSynergy(relic){
  if(!player.relics||player.relics.length===0)return null;
  let carried=player.relics.map(r=>r.id);
  for(let syn of RELIC_SYNERGIES){
    if(syn.ids.includes(relic.id)&&syn.ids.some(id=>carried.includes(id)))return syn.tag;
  }
  return null;
}

// ── RELIC SYSTEM STATE ──
let relicOpen=false,pendingRelicPool=[],relicCallback=null;

function pickRelicPool(count=3){
  let available=ALL_RELICS.filter(r=>!(player.relics||[]).some(pr=>pr.id===r.id));
  let shuffled=[...available].sort(()=>Math.random()-0.5);
  return shuffled.slice(0,Math.min(count,shuffled.length));
}

function showRelicChoice(pool, onPick){
  pendingRelicPool=pool;relicCallback=onPick;
  relicOpen=true;
  let overlay=document.getElementById('relic-overlay');
  overlay.classList.add('open');
  let subtitle=document.getElementById('relic-subtitle');
  subtitle.textContent=(player.relics&&player.relics.length>0)?
    'Boss slain! Choose your next relic — '+(player.relics.length)+' already carried':
    'Choose one relic to start your journey';
  let cardsDiv=document.getElementById('relic-cards');
  cardsDiv.innerHTML=pool.map((r,i)=>{
    let buffHtml=r.buffs.map(b=>`<div>✦ ${b}</div>`).join('');
    let debuffHtml=r.debuffs.map(d=>`<div>✗ ${d}</div>`).join('');
    let typeLabel={pure:'Pure Blessing',balanced:'Double-Edged',cursed:'Dark Bargain'}[r.type];
    let syn=getRelicSynergy(r);
    return `<div class="relic-card" onclick="pickRelic(${i})">
      <span class="rc-type ${r.type}">${typeLabel}</span>
      ${syn?`<div style="font-size:9px;color:#c9a227;text-align:center;margin-bottom:2px">✦ SYNERGY: ${syn}</div>`:''}
      <div class="rc-icon">${r.icon}</div>
      <div class="rc-name">${r.name}</div>
      <div class="rc-buffs">${buffHtml}</div>
      ${debuffHtml?`<div class="rc-debuffs">${debuffHtml}</div>`:''}
      <div class="rc-flavor">"${r.flavor}"</div>
    </div>`;
  }).join('');
}

window.pickRelic=function(i){
  let r=pendingRelicPool[i];if(!r)return;
  if(!player.relics)player.relics=[];
  player.relics.push(r);
  r.apply(player);
  addLog('Relic: '+r.icon+' '+r.name+' acquired!',8);
  if(r.debuffs.length>0)addLog('Cursed: '+r.debuffs.join(', '),2);
  relicOpen=false;
  document.getElementById('relic-overlay').classList.remove('open');
  updateRelicPanel();
  if(relicCallback)relicCallback();
  relicCallback=null;
  if(!invOpen&&!merchOpen&&!treeOpen)updateUI();
};

function updateRelicPanel(){
  let panel=document.getElementById('relic-panel');
  let pips=document.getElementById('relic-pip-row');
  if(!player.relics||player.relics.length===0){panel.style.display='none';return}
  panel.style.display='block';
  pips.innerHTML=(player.relics||[]).map(r=>`<span class="relic-pip" title="${r.name}: ${r.buffs.concat(r.debuffs).join(' | ')}">${r.icon}</span>`).join('');
}

// ══ BUILD / SYNERGY PANEL ══
// Surfaces the player's active build: spec passives, equipped affixes, relics,
// and highlights real synergies (stacked poison/reflect/lifesteal/dodge sources).
function buildNodeLabel(name){
  let cls=CLASSES.find(c=>c.name===player.cls);
  if(!cls)return name;
  for(let path of cls.paths){
    for(let n of (path.nodes||path.tree||[])){
      if(n.name===name)return n.label||n.desc||name;
    }
  }
  return name;
}
function updateBuildPanel(){
  let panel=document.getElementById('build-panel');
  let list=document.getElementById('build-list');
  let cnt=document.getElementById('build-syn-count');
  if(!panel||!list)return;
  if(classChooser||specChooser){panel.style.display='none';return}
  panel.style.display='block';

  let rows=[];
  // Spec passives (unlocked tree nodes)
  Object.keys(player.treeNodes||{}).forEach(n=>{
    let rank=player.treeNodes[n];if(!rank)return;
    rows.push({txt:buildNodeLabel(n), tag:rank>1?('x'+rank):''});
  });
  // Equipped affixes
  Object.values(player.eq||{}).forEach(it=>{
    if(it&&it.affixes)it.affixes.forEach(af=>rows.push({txt:af.label||af.id,tag:'aff'}));
  });

  // ── Synergy detection from live player flags ──
  let syn=[];
  let poisonSrc=(player.infectChance?1:0)+(player.poisonBonus?1:0)+(player.pandemic?1:0)+(player.plague?1:0)+(player.venomFangs?1:0);
  if(poisonSrc>=2)syn.push('☣ Plague build — '+poisonSrc+' poison sources stacking');
  let reflectSrc=(player.reflectFlat?1:0)+(player.thornCrown?1:0)+(player.holyReturn?1:0);
  if(reflectSrc>=2)syn.push('✦ Retaliation — damage reflected from '+reflectSrc+' sources');
  let healSrc=(player.leechRing?1:0)+(player.soulHarvest?1:0)+(player.lifesteal?1:0)+(player.divineLife?1:0)+(player.floorHeal?1:0);
  if(healSrc>=2)syn.push('✦ Sustain — '+healSrc+' healing sources');
  if((player.dodge||0)>=20)syn.push('✦ Evasion — '+player.dodge+'% dodge chance');
  if((player.soulStack||0)>=5)syn.push('✦ Soul Power — +'+player.soulStack+' ATK from souls');
  if(player.deathMark||player.deathmark)syn.push('☠ Execute — instant-kill primed');

  let html='';
  if(syn.length){
    syn.forEach(s=>{html+=`<div class="bl-syn">${s}</div>`});
  }
  if(rows.length){
    rows.forEach(r=>{html+=`<div class="bl-row"><b>${r.txt}</b><span>${r.tag}</span></div>`});
  }
  if(!html)html='<div class="bl-empty">No passives yet — spend skill points [T] and equip gear.</div>';
  list.innerHTML=html;
  if(cnt)cnt.textContent=syn.length?('· '+syn.length+' synergies'):'';
}

// ══ CLASS-SPECIFIC AFFIXES ══
const AFFIXES_BY_CLASS={
  Warrior:[
    {id:'lifesteal',label:'+4 HP on kill',trigger:'onKill',effect:(p)=>{p.hp=Math.min(p.mhp,p.hp+4)}},
    {id:'thorns',label:'Reflect 4 dmg on hit',trigger:'onHit',effect:(p,m)=>{if(m)m.hp-=4}},
    {id:'fury',label:'+5 ATK below 30% HP',trigger:'passive'},
    {id:'warshout',label:'Berserker lasts +1 extra turn',trigger:'passive'},
    {id:'fortify',label:'+3 DEF after taking a hit',trigger:'onHit',effect:(p)=>{p.tempDef=(p.tempDef||0)+3}},
  ],
  Rogue:[
    {id:'shadowkill',label:'+6 dmg from stealth',trigger:'passive'},
    {id:'venomous',label:'Attacks poison enemies for 1',trigger:'onHit',effect:(p,m)=>{if(m)m.poison=(m.poison||0)+1}},
    {id:'goldmagnet',label:'+4 gold on kill',trigger:'onKill',effect:(p)=>{p.gold+=4}},
    {id:'nimble',label:'+10% dodge chance',trigger:'passive'},
    {id:'backstabrefund',label:'Backstab refunds 1 turn of CD',trigger:'passive'},
  ],
  Mage:[
    {id:'fireballdouble',label:'Fireball hits twice',trigger:'passive'},
    {id:'arcane',label:'+30% all spell damage',trigger:'passive'},
    {id:'manaburn',label:'Spells ignore 4 DEF',trigger:'passive'},
    {id:'regen',label:'+1 HP per turn',trigger:'onTurn',effect:(p)=>{p.hp=Math.min(p.mhp,p.hp+1)}},
    {id:'overload',label:'10% chance: spell deals 3x damage',trigger:'passive'},
  ],
  Cleric:[
    {id:'holylight',label:'+5 Holy Nova damage',trigger:'passive'},
    {id:'divinelife',label:'+6 HP per kill',trigger:'onKill',effect:(p)=>{p.hp=Math.min(p.mhp,p.hp+6)}},
    {id:'wrath',label:'+7 ATK below 40% HP',trigger:'passive'},
    {id:'blessing',label:'Equipped items give +1 to all stats',trigger:'passive'},
    {id:'renewal',label:'Heal also removes debuffs',trigger:'passive'},
  ],
  Paladin:[
    {id:'holyreturn',label:'Reflect 50% hit damage as holy',trigger:'onHit',effect:(p,m)=>{if(m)m.hp-=Math.floor((m.atk||2)*0.5)}},
    {id:'divinefavor',label:'20% chance to block all damage',trigger:'passive'},
    {id:'smiteevil',label:'+10 damage vs bosses',trigger:'passive'},
    {id:'judgmentday',label:'Judgement CD reduced by 2',trigger:'passive'},
    {id:'consecrated',label:'+3 DEF on consecrated ground',trigger:'passive'},
  ],
  Necromancer:[
    {id:'soulharvest',label:'+6 HP on kill',trigger:'onKill',effect:(p)=>{p.hp=Math.min(p.mhp,p.hp+6)}},
    {id:'deathmark',label:'Enemies die at <5% HP',trigger:'passive'},
    {id:'pestilence',label:'Attacks spread 1 poison',trigger:'onHit',effect:(p,m)=>{if(m)m.poison=(m.poison||0)+1}},
    {id:'bonewall',label:'+4 DEF after summoning',trigger:'passive'},
    {id:'lich',label:'Bone Shield lasts +2 turns',trigger:'passive'},
  ]
};

function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function inB(x,y){return x>=0&&x<cols()&&y>=0&&y<rows()}
function spellFailChance(){return Math.max(0,Math.min(45,bossesKilled*5-(player.spellResist||0)+(player.spellPenalty||0)))}
function spellFails(ab){return ab&&ab.isSpell&&Math.random()*100<spellFailChance()}
function upgradeCost(it){return Math.floor(it.val*(1+(it.level||0))*1.5)}
function upgradeStats(it){let sc=1+(it.level||0)*0.4,st={};if(it.atk)st.atk=Math.floor(it.atk*sc);if(it.def)st.def=Math.floor(it.def*sc);return st}

function mkItem(pool,type,slot,rareOverride=-1){
  let rarePick;
  if(rareOverride>=0)rarePick=rareOverride;
  else{ // rarer in general: 2% legendary, 20% rare, 35% uncommon, 43% common
    let r=Math.random()*100;
    rarePick=r<2?3:r<22?2:r<57?1:0;
  }
  let filtered=pool.filter(t=>t.rare===rarePick);
  if(!filtered.length)filtered=pool.filter(t=>t.rare<=rarePick);
  if(!filtered.length)filtered=pool;
  return {...filtered[rnd(0,filtered.length-1)],id:Math.random(),level:0,type,slot};
}

function genBossLoot(bossType,cls){
  let pools=[{p:WEAPONS,t:'weapon'},{p:ARMORS,t:'armor'},{p:RINGS,t:'ring'},{p:AMULETS,t:'amulet'}];
  let pt=pools[rnd(0,pools.length-1)];
  let base=mkItem(pt.p,pt.t,pt.t,rnd(2,3));
  base.rare=4;
  let boost=1.5+Math.random()*0.8;
  if(base.atk)base.atk=Math.floor(base.atk*boost);
  if(base.def)base.def=Math.floor(base.def*boost);
  base.name='['+bossType.name+'] '+base.name;
  base.val=Math.floor(base.val*2.5);
  let classAffixes=AFFIXES_BY_CLASS[cls]||AFFIXES_BY_CLASS['Warrior'];
  base.affixes=[...classAffixes].sort(()=>Math.random()-0.5).slice(0,rnd(1,2));
  base.desc="Forged from "+bossType.name+"'s power. Attuned to "+cls+".";
  return base;
}

function genMerchantStock(){
  let stock=[];
  let pools=[{p:WEAPONS,t:'weapon'},{p:ARMORS,t:'armor'},{p:RINGS,t:'ring'},{p:AMULETS,t:'amulet'}];
  let usedNames=new Set();
  let attempts=0;
  while(stock.length<8&&attempts<60){
    attempts++;
    let pt=pools[rnd(0,pools.length-1)];
    let maxRare=floor>=10?3:2;
    let it=mkItem(pt.p,pt.t,pt.t,rnd(Math.max(0,Math.floor(floor/4)),Math.min(maxRare,Math.floor(floor/3)+1)));
    if(usedNames.has(it.name))continue;
    usedNames.add(it.name);
    it.shopPrice=Math.floor(it.val*(1.8+Math.random()*0.6+floor*0.15));
    stock.push(it);
  }
  POTIONS.forEach(pot=>{stock.push({...pot,id:Math.random(),level:0,type:'potion',slot:null,shopPrice:18+floor*2})});
  return stock;
}

