// ══ DUNGEON GEN ══
function mkDungeon(){
  let C=cols(),R=rows();
  G={tiles:Array(R).fill(null).map(()=>Array(C).fill('#')),rooms:[],
     exp:Array(R).fill(null).map(()=>Array(C).fill(false)),
     vis:Array(R).fill(null).map(()=>Array(C).fill(false)),merchant:null,lava:[],iceWall:[],hazards:[]};
  let rooms=[],maxRooms=bossFloor?4:rnd(6,8);
  for(let a=0;a<400&&rooms.length<maxRooms;a++){
    let rw=rnd(4,9),rh=rnd(3,6);
    let rx=rnd(Math.floor(C*0.1),Math.floor(C*0.85)-rw);
    let ry=rnd(Math.floor(R*0.1),Math.floor(R*0.85)-rh);
    if(!rooms.some(r=>rx<r.x+r.w+1&&rx+rw+1>r.x&&ry<r.y+r.h+1&&ry+rh+1>r.y))
      rooms.push({x:rx,y:ry,w:rw,h:rh,cx:rx+Math.floor(rw/2),cy:ry+Math.floor(rh/2)});
  }
  rooms.forEach(r=>{for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)G.tiles[y][x]='.'});
  // Sort by proximity for short corridors
  let sorted=[rooms[0]],remaining=rooms.slice(1);
  while(remaining.length){
    let last=sorted[sorted.length-1];
    remaining.sort((a,b)=>Math.hypot(a.cx-last.cx,a.cy-last.cy)-Math.hypot(b.cx-last.cx,b.cy-last.cy));
    sorted.push(remaining.shift());
  }
  for(let i=1;i<sorted.length;i++){
    let a=sorted[i-1],b=sorted[i],cx=a.cx,cy=a.cy;
    while(cx!==b.cx){G.tiles[cy][cx]='.';cx+=cx<b.cx?1:-1}
    while(cy!==b.cy){G.tiles[cy][cx]='.';cy+=cy<b.cy?1:-1}
  }
  G.rooms=sorted;
  if(!bossFloor){let sr=sorted[sorted.length-1];G.stairX=sr.cx;G.stairY=sr.cy;G.tiles[sr.cy][sr.cx]='>'}
  // ── Secret room: at most 1 per floor, 10% chance, hidden behind a bumpable wall ──
  G.secretWalls=[];G.secretRooms=[];
  if(!bossFloor&&floor>=2&&Math.random()<0.10){
    let numSecrets=1;
    let secretsPlaced=0;
    for(let s=0;s<numSecrets;s++){
      let tries=0;
      while(tries++<200){
        let rw=rnd(3,5),rh=rnd(3,4);
        let rx=rnd(1,C-rw-1),ry=rnd(1,R-rh-1);
        // Room tiles themselves must all be walls
        let overlaps=false;
        for(let y2=ry;y2<ry+rh&&!overlaps;y2++)
          for(let x2=rx;x2<rx+rw&&!overlaps;x2++)
            if(inB(x2,y2)&&G.tiles[y2][x2]!=='#')overlaps=true;
        if(overlaps)continue;
        // Find candidates: any wall tile directly adjacent to BOTH
        //   a) a room edge tile (inside rx..rx+rw, ry..ry+rh)
        //   b) an existing floor tile outside the room
        // This wall tile becomes the secret door
        let candidates=[];
        for(let y2=ry;y2<ry+rh;y2++)for(let x2=rx;x2<rx+rw;x2++){
          let isEdge=(x2===rx||x2===rx+rw-1||y2===ry||y2===ry+rh-1);
          if(!isEdge)continue;
          [[0,-1],[0,1],[-1,0],[1,0]].forEach(([ddx,ddy])=>{
            let wx=x2+ddx,wy=y2+ddy; // candidate secret wall (just outside room)
            if(!inB(wx,wy)||G.tiles[wy][wx]!=='#')return; // must be a wall
            if(wx>=rx&&wx<rx+rw&&wy>=ry&&wy<ry+rh)return; // must be outside room
            // Check if this wall tile is also adjacent to existing floor
            let nearFloor=[[0,-1],[0,1],[-1,0],[1,0]].some(([dx2,dy2])=>{
              let fx=wx+dx2,fy=wy+dy2;
              return inB(fx,fy)&&G.tiles[fy][fx]==='.'&&!(fx>=rx&&fx<rx+rw&&fy>=ry&&fy<ry+rh);
            });
            if(nearFloor)candidates.push({wx,wy});
          });
        }
        if(!candidates.length)continue;
        let entry=candidates[rnd(0,candidates.length-1)];
        // Carve room, leave secret wall tile as '#'
        for(let y2=ry;y2<ry+rh;y2++)for(let x2=rx;x2<rx+rw;x2++)G.tiles[y2][x2]='.';
        // Make sure entry wall is still '#' (carving above won't touch it since it's outside room bounds)
        G.tiles[entry.wy][entry.wx]='#'; // secret wall - looks identical to normal wall
        G.secretWalls.push({x:entry.wx,y:entry.wy,found:false,s});
        G.secretRooms.push({x:rx,y:ry,w:rw,h:rh,cx:rx+Math.floor(rw/2),cy:ry+Math.floor(rh/2),idx:s,stocked:false});
        secretsPlaced++;
        break;
      }
    }
    if(secretsPlaced===0)console.log('No secret rooms placed on floor',floor);
    else console.log(secretsPlaced,'secret room(s) placed on floor',floor);
  }
  seedHazards();
  seedTorches();
}

// ══ WALL TORCHES (first-person ambience) ══
// Mounted on wall tiles that face a walkable floor tile. Each torch records
// the wall cell, the adjacent floor cell it lights, and a random flicker phase.
function seedTorches(){
  G.torches=[];
  let candidates=[];
  for(let y=1;y<rows()-1;y++)for(let x=1;x<cols()-1;x++){
    if(G.tiles[y][x]!=='#')continue;
    // must border at least one floor tile (so it's a visible wall face)
    let dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(let [dx,dy] of dirs){
      let fx=x+dx,fy=y+dy;
      if(inB(fx,fy)&&G.tiles[fy][fx]==='.'){
        candidates.push({x,y,fx,fy,dx,dy});
        break;
      }
    }
  }
  candidates.sort(()=>Math.random()-0.5);
  // roughly one torch per ~14 eligible wall faces, a few more on deeper floors
  let count=Math.min(candidates.length, 6+Math.floor(floor*0.6));
  let usedFloor=new Set();
  for(let i=0;i<candidates.length&&G.torches.length<count;i++){
    let c=candidates[i];
    let fk=c.fx+','+c.fy;
    if(usedFloor.has(fk))continue;      // don't crowd one tile with many torches
    usedFloor.add(fk);
    G.torches.push({x:c.x,y:c.y,fx:c.fx,fy:c.fy,dx:c.dx,dy:c.dy,phase:Math.random()*6.28});
  }
}
function torchLightAt(fx,fy){
  // returns 0..1 warm light contribution at a floor tile from nearby torches
  let best=0;
  (G.torches||[]).forEach(t=>{
    let d=Math.abs(t.fx-fx)+Math.abs(t.fy-fy);
    if(d<=3){let v=(1-d/4);if(v>best)best=v}
  });
  return best;
}

// ══ ENVIRONMENTAL HAZARDS ══
// Static terrain features the player must navigate around.
//  - 'spike': hidden trap, springs when stepped on (one-shot burst of damage)
//  - 'fire' : a permanent flame/lava pool that burns anything standing on it
function seedHazards(){
  G.hazards=[];
  if(bossFloor||floor<2)return; // give the player a gentle start
  let theme=getFloorTheme();
  // floor tiles that aren't the player start, stairs, or merchant
  let open=[];
  for(let y=0;y<rows();y++)for(let x=0;x<cols();x++){
    if(G.tiles[y][x]!=='.')continue;
    open.push({x,y});
  }
  // shuffle
  open.sort(()=>Math.random()-0.5);
  let nSpikes=Math.min(2+Math.floor(floor/2),8);
  let nPools =Math.min(1+Math.floor(floor/3),5);
  let used=new Set();
  let startRoom=G.rooms[0];
  function farFromStart(p){return Math.abs(p.x-startRoom.cx)+Math.abs(p.y-startRoom.cy)>4}
  function place(type){
    for(let i=0;i<open.length;i++){
      let p=open[i];let k=p.x+','+p.y;
      if(used.has(k)||!farFromStart(p))continue;
      if(G.stairX===p.x&&G.stairY===p.y)continue;
      used.add(k);
      G.hazards.push({x:p.x,y:p.y,type,armed:true});
      return true;
    }
    return false;
  }
  for(let i=0;i<nSpikes;i++)place('spike');
  // fire pools cluster a little for a "lava pool" feel
  for(let i=0;i<nPools;i++)place('fire');
}
function hazardAt(x,y){return (G.hazards||[]).find(h=>h.x===x&&h.y===y)}

function mkMonsters(){
  monsters=[];bossActive=false;
  if(bossFloor){
    let bIdx=Math.min(Math.floor((floor-1)/5)-1,bossOrder.length-1);
    let bt={...bossOrder[Math.max(0,bIdx)]};
    let sf=diffScale>1?diffScale:1;
    bt.mhp=Math.floor(bt.hp*sf);bt.hp=bt.mhp;bt.atk=Math.floor(bt.atk*sf);bt.def=Math.floor(bt.def*sf);
    bt.xp=Math.floor(bt.xp*sf);bt.gold=Math.floor(bt.gold*sf);
    let rm=G.rooms[Math.floor(G.rooms.length/2)];
    bt.x=rm.cx;bt.y=rm.cy;bt.id=Math.random();bt.stun=0;bt.isBoss=true;bt.bossRef=bossOrder[Math.max(0,bIdx)];
    monsters.push(bt);bossActive=true;
    for(let i=0;i<rnd(2,4);i++){
      let tier=Math.min(floor-1,MTYPES.length-1);
      let mt=MTYPES[rnd(Math.max(0,tier-2),tier)];
      let scHP=(1+floor*0.085)*diffScale;
      let scATK=(1+floor*0.065)*(1+(diffScale-1)*0.6);
      let rm2=G.rooms[rnd(0,G.rooms.length-1)];
      let bsHP=Math.min(Math.floor(mt.hp*scHP),460);
      let bsATK=Math.min(Math.floor(mt.atk*scATK),54);
      let bsDEF=Math.min(Math.floor(mt.def*(1+floor*0.05)*diffScale),30);
      monsters.push({...mt,x:rnd(rm2.x,rm2.x+rm2.w-1),y:rnd(rm2.y,rm2.y+rm2.h-1),
        mhp:bsHP,hp:bsHP,atk:bsATK,def:bsDEF,id:Math.random(),stun:0,poison:0});
    }
    addLog('⚠ BOSS FLOOR! '+bt.name+' awaits!',2);return;
  }
  let cnt=Math.min(4+floor*2,20);
  for(let i=0;i<cnt;i++){
    let rm=G.rooms[rnd(1,G.rooms.length-1)];
    let mx=rnd(rm.x,rm.x+rm.w-1),my=rnd(rm.y,rm.y+rm.h-1);
    if(mx===player.x&&my===player.y)continue;
    let maxT=Math.min(Math.floor(floor/2),MTYPES.length-1);
    let mt=MTYPES[rnd(0,maxT)];
    let scHP=(1+floor*0.085)*diffScale;
    let scATK=(1+floor*0.065)*(1+(diffScale-1)*0.6); // ATK grows gentler than HP
    let sHP=Math.min(Math.floor(mt.hp*scHP),420);
    let sATK=Math.min(Math.floor(mt.atk*scATK),48);
    let sDEF=Math.min(Math.floor(mt.def*(1+floor*0.05)*diffScale),26);
    let mon={...mt,x:mx,y:my,mhp:sHP,hp:sHP,atk:sATK,def:sDEF,id:Math.random(),stun:0,poison:0};
    // Elite roll — chance rises with depth, none on floor 1
    let eliteChance=floor<=1?0:Math.min(0.22,0.05+floor*0.012);
    if(Math.random()<eliteChance)makeElite(mon);
    monsters.push(mon);
  }
}

// ══ ELITE ENEMIES ══
// Each elite gets one modifier with a visual tell and a gameplay twist.
const ELITE_MODS=[
  {id:'shielded', name:'Shielded', col:'#7ad0ff', desc:'Absorbs the first few hits'},
  {id:'volatile', name:'Volatile', col:'#ff8a3a', desc:'Explodes on death'},
  {id:'frenzied', name:'Frenzied', col:'#ff5050', desc:'Enrages below half HP'},
  {id:'leeching', name:'Leeching', col:'#cc55cc', desc:'Heals when it hits you'},
  {id:'swift',    name:'Swift',    col:'#ffe24a', desc:'Moves an extra step'},
];
function makeElite(m){
  let mod=ELITE_MODS[rnd(0,ELITE_MODS.length-1)];
  m.elite=mod.id; m.eliteName=mod.name; m.eliteCol=mod.col;
  // Elites are tougher and more rewarding
  m.mhp=Math.floor(m.mhp*1.8); m.hp=m.mhp;
  m.atk=Math.floor(m.atk*1.25);
  m.xp=Math.floor((m.xp||5)*2.2); m.gold=Math.floor((m.gold||3)*2.2);
  m.name=mod.name+' '+m.name;
  if(mod.id==='shielded')m.shieldHits=3;
  if(mod.id==='swift')m.spd=(m.spd||1)+1;
  return m;
}

// ══ ITEM RARITY & ROLLING ══
// Weighted rarity for chest items: 2% legendary, 20% rare, 35% uncommon, 43% common.
function rollRarity(){
  let r=Math.random()*100;
  if(r<2)return 3;        // legendary
  if(r<22)return 2;       // rare
  if(r<57)return 1;       // uncommon
  return 0;               // common
}
// Pick a random item of a given rarity from a category pool; falls back to nearest tier.
function pickItemOfRarity(pool,rare){
  let matches=pool.filter(it=>it.rare===rare);
  if(!matches.length){ // widen search downward then upward
    for(let dr=1;dr<4&&!matches.length;dr++){
      matches=pool.filter(it=>it.rare===rare-dr); if(matches.length)break;
      matches=pool.filter(it=>it.rare===rare+dr);
    }
  }
  if(!matches.length)matches=pool;
  return {...matches[rnd(0,matches.length-1)]};
}
// Roll a single equipment item across all categories at a target rarity.
function rollChestItem(rare){
  let cats=[['weapon',WEAPONS],['armor',ARMORS],['ring',RINGS],['amulet',AMULETS]];
  let [type,pool]=cats[rnd(0,cats.length-1)];
  let it=pickItemOfRarity(pool,rare);
  it.type=type;it.slot=type;it.level=0;it.id=Math.random();
  return it;
}
// Potion rarity for chests: 10% rare(2), 30% uncommon(1), 60% common(0).
function rollPotion(goldenChest){
  let r=Math.random()*100, tier;
  if(goldenChest){tier=(r<30)?2:1;}            // golden: 30% rare, 70% uncommon
  else{tier=(r<10)?2:(r<40)?1:0;}              // normal: 10/30/60
  let pot=POTIONS.find(p=>p.rare===tier)||POTIONS[0];
  let it={...pot};it.type='potion';it.slot=null;it.level=0;it.id=Math.random();
  return it;
}

// ══ CHESTS ══
// Replace loose floor items with 2–4 chests placed in ROOMS (never hallways).
// The starting room always has one. 5% of chests become Golden chests.
// Chests are opened by walking into them (handled in tryMove).
function mkItems(){
  items=[];
  G.chests=[];
  if(bossFloor)return; // boss floors handle their own loot drop
  let rooms=G.rooms||[];
  if(!rooms.length)return;
  let startRoom=rooms[0];
  // gather candidate room tiles (interior floor, not on stairs/player start)
  function roomTiles(rm){
    let ts=[];
    for(let y=rm.y;y<rm.y+rm.h;y++)for(let x=rm.x;x<rm.x+rm.w;x++){
      if(!inB(x,y)||G.tiles[y][x]!=='.')continue;
      if(G.stairX===x&&G.stairY===y)continue;
      if(x===player.x&&y===player.y)continue;
      ts.push({x,y});
    }
    return ts;
  }
  let placed=new Set();
  function placeChest(rm,forceGolden){
    let ts=roomTiles(rm).filter(t=>!placed.has(t.x+','+t.y));
    if(!ts.length)return false;
    let t=ts[rnd(0,ts.length-1)];
    placed.add(t.x+','+t.y);
    let golden=forceGolden||(Math.random()<0.05);
    G.chests.push({x:t.x,y:t.y,golden,opened:false,id:Math.random()});
    return true;
  }
  // guaranteed chest in the starting room
  placeChest(startRoom,false);
  // 1–3 more chests (total 2–4) in random non-start rooms (rooms only)
  let extra=rnd(1,3);
  let otherRooms=rooms.slice(1);
  for(let i=0;i<extra;i++){
    let rm = otherRooms.length ? otherRooms[rnd(0,otherRooms.length-1)] : startRoom;
    placeChest(rm,false);
  }
}

// Generate the contents of an opened chest. Returns an array of item objects
// positioned around (ox,oy). Golden chests also stage a relic choice.
function openChest(chest){
  if(chest.opened)return;
  chest.opened=true;
  let drops=[];
  if(chest.golden){
    // 1 guaranteed legendary + guaranteed potion (golden odds); relics handled separately
    drops.push(rollChestItem(3));
    drops.push(rollPotion(true));
    // offer a choice of 3 relics the player doesn't already own (reuse the relic overlay)
    let owned=new Set((player.relics||[]).map(r=>r.id));
    let avail=ALL_RELICS.filter(r=>!owned.has(r.id));
    avail.sort(()=>Math.random()-0.5);
    let choice=avail.slice(0,3);
    if(choice.length&&typeof showRelicChoice==='function'){
      showRelicChoice(choice,null);
      let sub=document.getElementById('relic-subtitle');if(sub)sub.textContent='Golden Chest! Choose one relic';
    }
    addLog('✦ GOLDEN CHEST! A legendary and a relic await!',7);
  } else {
    let n=rnd(2,3);
    for(let i=0;i<n;i++)drops.push(rollChestItem(rollRarity()));
    drops.push(rollPotion(false)); // guaranteed potion
    addLog('Chest opened — '+n+' items + a potion!',3);
  }
  // scatter drops onto nearby free room tiles
  let spots=[];
  for(let r=0;r<=2;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    let x=chest.x+dx,y=chest.y+dy;
    if(inB(x,y)&&G.tiles[y][x]==='.'&&!(G.stairX===x&&G.stairY===y)&&!items.some(it=>it.x===x&&it.y===y)&&!spots.some(s=>s.x===x&&s.y===y))spots.push({x,y});
  }
  spots.sort((a,b)=>(Math.abs(a.x-chest.x)+Math.abs(a.y-chest.y))-(Math.abs(b.x-chest.x)+Math.abs(b.y-chest.y)));
  drops.forEach((it,i)=>{let s=spots[i]||{x:chest.x,y:chest.y};it.x=s.x;it.y=s.y;items.push(it);floorItemsFound++;});
  fov();updateUI();drawAll();
}
function chestAt(x,y){return (G.chests||[]).find(c=>c.x===x&&c.y===y&&!c.opened)}

// ══ FOV ══
function fov(){
  let C=cols(),R=rows();
  G.vis=Array(R).fill(null).map(()=>Array(C).fill(false));
  if(player.allSight){
    // Reveal all non-wall tiles as both visible and explored
    for(let y=0;y<R;y++)for(let x=0;x<C;x++){
      if(G.tiles[y][x]!=='#'){G.vis[y][x]=true;G.exp[y][x]=true;}
    }
    // Still run normal FOV so adjacent walls are also visible
    for(let a=0;a<360;a+=0.8){
      let rd=a*Math.PI/180,dx=Math.cos(rd),dy=Math.sin(rd),xx=player.x+.5,yy=player.y+.5;
      for(let i=0;i<8;i++){let tx=Math.floor(xx),ty=Math.floor(yy);if(!inB(tx,ty))break;G.vis[ty][tx]=true;G.exp[ty][tx]=true;if(G.tiles[ty][tx]==='#')break;xx+=dx;yy+=dy}
    }
    return;
  }
  for(let a=0;a<360;a+=0.8){
    let rd=a*Math.PI/180,dx=Math.cos(rd),dy=Math.sin(rd),x=player.x+.5,y=player.y+.5;
    for(let i=0;i<8;i++){let tx=Math.floor(x),ty=Math.floor(y);if(!inB(tx,ty))break;G.vis[ty][tx]=true;G.exp[ty][tx]=true;if(G.tiles[ty][tx]==='#')break;x+=dx;y+=dy}
  }
}

// ══ STATS ══
function effStat(s){
  let b=player[s]||0,bonus=0;
  Object.values(player.eq||{}).forEach(it=>{
    if(!it)return;
    let st=upgradeStats(it);
    bonus+=st[s]!==undefined?st[s]:(it[s]||0);
    if(it.affixes)it.affixes.forEach(af=>{if(af.id==='blessing')bonus+=1});
  });
  bonus+=(player.tempDef||0)+(player.atkBuff||0)+(player.weaponBonus||0)+(player.soulStack||0);
  if(s==='atk')bonus+=(player.momBuff||0);
  if(s==='def')bonus+=(player.defBuff||0);
  if(s==='def'){
    if(player.hp<player.mhp*0.5)bonus+=(player.barrierBonus||0);
    bonus+=(player.aura||0);
  }
  if(s==='atk'){
    if(player.hp<player.mhp*0.3)bonus+=(player.lastStand||0);
    if(player.zealot&&player.hp<player.mhp*0.3)bonus+=b;
    if(player.berserkCrest&&player.hp<player.mhp*0.25)bonus+=b; // 2x ATK
    if(player.bloodlust){let miss=1-player.hp/player.mhp;bonus+=Math.floor(miss*10)*(player.bloodlust||0)}
    bonus+=(player.holyBlade||0);
    bonus+=(player.spellBonusFlat||0); // for spells (approximation)
  }
  return Math.max(0,b+bonus);
}

function abilDmgMult(){
  let m=1;
  Object.values(player.eq||{}).forEach(it=>{
    if(it&&it.affixes)it.affixes.forEach(af=>{
      if(af.id==='arcane')m+=0.3;
      if(af.id==='overload'&&Math.random()<0.1)m*=3;
    });
  });
  if(player.arcaneSurge>0)m*=3;
  m+=(player.spellBattery||0);
  // Chaos gem: 25% chance 4x, 10% chance hits self (handled in useAbility)
  if(player.chaosGem&&Math.random()<0.25)m*=4;
  return m;
}

function triggerAffix(trigger,target=null){
  Object.values(player.eq||{}).forEach(it=>{
    if(!it||!it.affixes)return;
    it.affixes.forEach(af=>{if(af.trigger===trigger&&af.effect){try{af.effect(player,target)}catch(e){}}});
  });
}

// ══ LOG & PARTICLES ══
const LC=['#8a9a6a','#c8e85a','#e85a5a','#e8c85a','#5aaae8','#c85ae8','#5ae8e8','#ff6644','#ffaa33','#aaffaa'];
function addLog(msg,ci=0){msgs.unshift({msg,col:LC[ci%LC.length]});if(msgs.length>80)msgs.pop();document.getElementById('log-inner').innerHTML=msgs.slice(0,14).map((m,i)=>`<div style="color:${m.col};opacity:${Math.max(0.15,1-i*0.06)}">${m.msg}</div>`).join('')}

function spawnP(x,y,col,type='hit'){let n=type==='boss'?20:type==='death'?12:6;for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=type==='boss'?rnd(2,6):rnd(1,4);particles.push({x:x*TW+TW/2,y:y*TH+TH/2,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,col,sz:type==='boss'?3:2})}}

// ══ ABILITY ANIMATIONS ══
function spawnAnim(type,sx,sy,tx,ty,col,big=false){anims.push({type,sx,sy,tx:tx||sx,ty:ty||sy,col,t:0,life:1,id:Math.random(),big})}

function updateAnims(){
  actx.clearRect(0,0,ac.width,ac.height);
  anims=anims.filter(a=>{
    a.t+=0.1;a.life=1-a.t;if(a.life<=0)return false;
    let px=a.sx*TW+TW/2,py=a.sy*TH+TH/2,tx=a.tx*TW+TW/2,ty=a.ty*TH+TH/2;
    let prog=Math.min(1,a.t),cx=px+(tx-px)*prog,cy=py+(ty-py)*prog;
    actx.globalAlpha=a.life;
    if(a.type==='fireball'){
      actx.fillStyle=a.col||'#e87a3a';actx.beginPath();actx.arc(cx,cy,5+Math.sin(a.t*12)*1.5,0,Math.PI*2);actx.fill();
      actx.fillStyle='#ffe050';actx.beginPath();actx.arc(cx,cy,2,0,Math.PI*2);actx.fill();
      actx.fillStyle='rgba(232,120,50,0.25)';actx.fillRect(cx-6,cy-6,12,12);
    }else if(a.type==='lightning'){
      actx.strokeStyle=a.col||'#e8e850';actx.lineWidth=2;actx.beginPath();actx.moveTo(px,py);
      let steps=6;for(let i=1;i<=steps;i++){actx.lineTo(px+(tx-px)*(i/steps)+rnd(-7,7),py+(ty-py)*(i/steps)+rnd(-7,7))}
      actx.stroke();actx.strokeStyle='rgba(255,255,200,0.4)';actx.lineWidth=0.5;actx.stroke();
    }else if(a.type==='ice'){
      actx.fillStyle=a.col||'#5aaae8';actx.beginPath();actx.arc(cx,cy,4,0,Math.PI*2);actx.fill();
      for(let i=0;i<6;i++){let ang=i*Math.PI/3+a.t*3;actx.strokeStyle='rgba(150,220,255,0.6)';actx.lineWidth=1;actx.beginPath();actx.moveTo(cx,cy);actx.lineTo(cx+Math.cos(ang)*8,cy+Math.sin(ang)*8);actx.stroke()}
    }else if(a.type==='holy'){
      actx.fillStyle=a.col||'#ffe8aa';actx.beginPath();actx.arc(cx,cy,4+Math.sin(a.t*8)*2,0,Math.PI*2);actx.fill();
      actx.strokeStyle='rgba(255,255,220,0.5)';actx.lineWidth=1;actx.stroke();
    }else if(a.type==='shadow'){
      actx.fillStyle=a.col||'#6633cc';actx.beginPath();actx.arc(cx,cy,5,0,Math.PI*2);actx.fill();
      for(let i=0;i<3;i++){actx.fillStyle='rgba(100,50,200,0.3)';actx.beginPath();actx.arc(cx+rnd(-6,6),cy+rnd(-6,6),rnd(2,4),0,Math.PI*2);actx.fill()}
    }else if(a.type==='explosion'){
      let r=prog*28;actx.strokeStyle=a.col||'#e87a3a';actx.lineWidth=3*(1-prog);actx.beginPath();actx.arc(a.tx*TW+TW/2,a.ty*TH+TH/2,r,0,Math.PI*2);actx.stroke();
      actx.fillStyle=(a.col||'#e87a3a')+'33';actx.beginPath();actx.arc(a.tx*TW+TW/2,a.ty*TH+TH/2,r,0,Math.PI*2);actx.fill();
    }else if(a.type==='slash'){
      actx.strokeStyle=a.col||'#c8e85a';actx.lineWidth=2;actx.beginPath();actx.arc(tx,ty,8,a.t*Math.PI*2,a.t*Math.PI*2+1.5);actx.stroke();
    }else if(a.type==='poison'){
      actx.fillStyle=a.col||'#44cc44';actx.beginPath();actx.arc(cx,cy,4,0,Math.PI*2);actx.fill();
      actx.fillStyle='rgba(50,200,50,0.3)';for(let i=0;i<4;i++){actx.beginPath();actx.arc(cx+Math.cos(a.t*5+i)*8,cy+Math.sin(a.t*5+i)*8,2,0,Math.PI*2);actx.fill()}
    }else if(a.type==='death'){
      let dcx=a.tx*TW+TW/2, dcy=a.ty*TH+TH/2, big=a.big?1:0;
      let maxR=big?38:18;
      // expanding shockwave ring
      let r=prog*maxR;
      actx.strokeStyle=a.col||'#ffffff';actx.lineWidth=(big?3:2)*(1-prog);
      actx.beginPath();actx.arc(dcx,dcy,r,0,Math.PI*2);actx.stroke();
      // bright core flash that fades fast
      let flashA=Math.max(0,1-prog*2.2);
      actx.fillStyle=a.col||'#ffffff';actx.globalAlpha=a.life*flashA;
      actx.beginPath();actx.arc(dcx,dcy,(big?9:5)*(1-prog*0.5),0,Math.PI*2);actx.fill();
      actx.globalAlpha=a.life;
      // shard streaks flying outward (sprite "shatter")
      let shards=big?10:6;
      for(let i=0;i<shards;i++){
        let ang=(i/shards)*Math.PI*2 + a.id*6;
        let dist=prog*maxR*1.1;
        let sxp=dcx+Math.cos(ang)*dist, syp=dcy+Math.sin(ang)*dist;
        let sz=(big?3:2)*(1-prog);
        actx.fillStyle=a.col||'#ffffff';
        actx.fillRect(sxp-sz/2,syp-sz/2,sz,sz);
      }
    }
    actx.globalAlpha=1;return true;
  });
  if(anims.length>0)setTimeout(()=>{if(!invOpen&&!merchOpen&&!treeOpen)updateAnims()},30);
  else actx.clearRect(0,0,ac.width,ac.height);
}

