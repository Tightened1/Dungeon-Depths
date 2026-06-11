// ══ RANGE PREVIEW ══
function showRangePreview(i){
  let ab=player.abilities&&player.abilities[i];
  rc.style.display='block';rctx.clearRect(0,0,rc.width,rc.height);
  if(!ab||ab.cd>0||gameOver){rc.style.display='none';return}
  function ft(tx,ty,col){if(!inB(tx,ty))return;rctx.fillStyle=col;rctx.fillRect(tx*TW,ty*TH,TW,TH)}
  let px=player.x,py=player.y;
  if(ab.aoe){
    if(ab.name==='Fireball'){
      let near=monsters.find(m=>m.hp>0&&G.vis[m.y]&&G.vis[m.y][m.x]);
      let cx=near?near.x:px+2,cy=near?near.y:py;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)ft(cx+dx,cy+dy,'rgba(232,120,50,0.35)');
    }else{let r=ab.range||2;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(!dx&&!dy)continue;if(Math.abs(dx)<=r&&Math.abs(dy)<=r)ft(px+dx,py+dy,'rgba(200,160,80,0.28)')}}
  }else if(ab.range>1){
    for(let dy=-ab.range;dy<=ab.range;dy++)for(let dx=-ab.range;dx<=ab.range;dx++){if(Math.abs(dx)+Math.abs(dy)<=ab.range&&(dx||dy))ft(px+dx,py+dy,'rgba(100,180,255,0.2)')}
  }else{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;ft(px+dx,py+dy,'rgba(200,180,80,0.2)')}}
  monsters.forEach(m=>{
    if(m.hp<=0)return;
    let inR=ab.range>1?Math.abs(m.x-px)<=ab.range&&Math.abs(m.y-py)<=ab.range:Math.abs(m.x-px)+Math.abs(m.y-py)<=1;
    if(inR&&G.vis[m.y]&&G.vis[m.y][m.x]){rctx.strokeStyle='rgba(255,80,80,0.9)';rctx.lineWidth=1.5;rctx.strokeRect(m.x*TW+1,m.y*TH+1,TW-2,TH-2)}
  });
}
function clearRangePreview(){rc.style.display='none';rctx.clearRect(0,0,rc.width,rc.height)}



// ══ ABILITY TOOLTIP ══
function showAbilTooltip(idx, el){
  let ab=player.abilities&&player.abilities[idx];
  if(!ab)return;
  let tip=document.getElementById('abil-tooltip');
  let atk=effStat('atk');
  let adm=abilDmgMult();
  let ls=lvlScale();
  // Estimate damage for display
  let estDmg=null;
  if(ab.isSpell||ab.name==='Magic Missile'||ab.name==='Fireball'||ab.name==='Ice Lance'||ab.name==='Chain Lightning'){
    estDmg=Math.floor(atk*(ab.name==='Fireball'?2.2:ab.name==='Ice Lance'?1.8:ab.name==='Chain Lightning'?1.6:1.2)*adm*ls);
  } else if(!ab.name.includes('Berserker')&&!ab.name.includes('Ghost')&&!ab.name.includes('Shield')&&!ab.name.includes('Titan')&&!ab.name.includes('Sanctuary')&&!ab.name.includes('Holy Light')&&!ab.name.includes('Raise')&&!ab.name.includes('Summon')&&!ab.name.includes('Corruption')&&!ab.name.includes('Blight')&&ab.range>0){
    estDmg=Math.floor(atk*1.3*ls);
  }
  let rngStr=ab.range>1?'Range: '+ab.range+' tiles':ab.aoe?'AOE around target':'Melee (adjacent)';
  let cdStr=ab.cd>0?'Cooldown: '+ab.cd+' turns remaining':'Ready to use';
  let failStr=ab.isSpell&&spellFailChance()>0?'Spell fail: '+spellFailChance()+'%':'';
  let html=`<div class="att-name">${ab.name}</div>
    <div class="att-row">${ab.desc}</div>
    <div class="att-row">${rngStr}</div>
    ${estDmg!==null?`<div class="att-row att-dmg">Est. damage: ~${estDmg}</div>`:''}
    <div class="att-row att-cd">${cdStr} (max: ${ab.max})</div>
    ${failStr?`<div class="att-row" style="color:#c95e5e">${failStr}</div>`:''}`;
  tip.innerHTML=html;
  tip.style.display='block';
  // Position relative to sidebar
  let rect=el.getBoundingClientRect();
  let sideEl=document.getElementById('side');
  let sideRect=sideEl.getBoundingClientRect();
  tip.style.right=(window.innerWidth-sideRect.left+4)+'px';
  tip.style.top=Math.min(rect.top, window.innerHeight-120)+'px';
  tip.style.left='auto';
}
function hideAbilTooltip(){
  document.getElementById('abil-tooltip').style.display='none';
}

// ══ FLOATING DAMAGE NUMBERS ══
let floatNums=[];
function spawnFloatNum(text, x, y, col, big=false){
  let bounds=canvas.getBoundingClientRect();
  let scaleX=bounds.width/canvas.width, scaleY=bounds.height/canvas.height;
  // Convert tile coords to screen coords
  let sx=bounds.left + (x+0.5)*TW*scaleX;
  let sy=bounds.top  + (y-0.2)*TH*scaleY;
  let el=document.createElement('div');
  el.className='fdmg';
  el.style.cssText=`position:fixed;left:${sx}px;top:${sy}px;color:${col};font-size:${big?15:11}px;font-weight:bold;opacity:1;transform:translateX(-50%);pointer-events:none;z-index:9999;text-shadow:1px 1px 3px #000,0 0 6px #000`;
  el.textContent=text;
  document.body.appendChild(el);
  floatNums.push({el,vy:-1.4,life:1.0,big});
}
function tickFloatNums(){
  floatNums=floatNums.filter(fn=>{
    fn.life-=0.035;
    fn.vy*=0.92;
    let top=parseFloat(fn.el.style.top);
    fn.el.style.top=(top+fn.vy)+'px';
    fn.el.style.opacity=Math.max(0,fn.life).toFixed(2);
    if(fn.life<=0){fn.el.remove();return false}
    return true;
  });
}




// ══ FLOOR THEMES ══
function getFloorTheme(){
  let tier=Math.ceil(floor/5);
  // fp palette: wall [r,g,b], mortar [r,g,b], highlight [r,g,b], floor [r,g,b], ceil [r,g,b], accent (torch/glow hue)
  if(tier<=1)return{tileTint:null, name:'Dungeon',
    fp:{wall:[104,92,128], mortar:[44,38,58], hi:[150,135,180], floor:[58,50,40], floor2:[44,38,30], ceil:[26,22,38], moss:null}};
  if(tier===2)return{tileTint:'rgba(0,80,20,0.22)', name:'Fungal Caves',
    fp:{wall:[70,96,72], mortar:[28,44,30], hi:[120,160,110], floor:[42,56,40], floor2:[32,44,32], ceil:[20,34,24], moss:[90,170,90]}};
  if(tier===3)return{tileTint:'rgba(180,50,0,0.28)', name:'Hellfire Depths',
    fp:{wall:[128,68,52], mortar:[58,24,18], hi:[200,110,70], floor:[70,38,28], floor2:[52,26,20], ceil:[40,18,14], moss:null, ember:true}};
  if(tier===4)return{tileTint:'rgba(30,0,120,0.30)', name:'Shadow Realm',
    fp:{wall:[72,64,124], mortar:[28,24,56], hi:[120,108,200], floor:[40,36,68], floor2:[30,26,52], ceil:[22,18,44], moss:null}};
  return {tileTint:'rgba(80,0,80,0.35)', name:'The Void',
    fp:{wall:[104,52,128], mortar:[44,18,56], hi:[180,90,210], floor:[56,30,68], floor2:[42,22,52], ceil:[30,14,40], moss:null, ember:true}};
}

// ══ SCREEN SHAKE ══
let shakeFrames=0,shakeMag=0;
// ══ HIT FLASH (player took damage) ══
let hitFlash=0; // 0..1, decays each frame
function triggerHitFlash(intensity=0.5){hitFlash=Math.min(1,Math.max(hitFlash,intensity))}
function triggerShake(mag=4,frames=6){
  shakeMag=mag;shakeFrames=frames;
}
function tickShake(){
  if(shakeFrames<=0){
    ['gc','rc','ac'].forEach(id=>{let el=document.getElementById(id);if(el)el.style.transform='';});
    return;
  }
  shakeFrames--;
  let decay=shakeFrames/6;
  let sx=(Math.random()*2-1)*shakeMag*decay;
  let sy=(Math.random()*2-1)*shakeMag*decay;
  ['gc','rc','ac'].forEach(id=>{
    let el=document.getElementById(id);
    if(el)el.style.transform=`translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
  });
}

// ══ BOSS BAR ══
function updateBossBar(){
  let wrap=document.getElementById('boss-bar-wrap');
  let boss=monsters.find(m=>m.isBoss&&m.hp>0&&!m._dead);
  if(!boss||!bossActive){wrap.style.display='none';return}
  wrap.style.display='block';
  document.getElementById('boss-bar-name').textContent='⚠ '+boss.name+' ⚠';
  let pct=Math.max(0,boss.hp/boss.mhp)*100;
  let fill=document.getElementById('boss-bar-fill');
  fill.style.width=pct+'%';
  // Enrage at 30%
  if(pct<=30)fill.classList.add('enraged');
  else fill.classList.remove('enraged');
  document.getElementById('boss-bar-hp').textContent=boss.hp+'/'+boss.mhp;
}

// ══ MINI-MAP ══
function drawMinimap(){
  if(classChooser||specChooser||gameOver)return;
  let mc=document.getElementById('minimap-canvas');
  if(!mc)return;
  let panel=document.getElementById('minimap-panel');
  let pw=panel.clientWidth-16; // padding
  mc.width=pw;mc.height=60;
  document.getElementById('mm-floor').textContent=floor+(bossFloor?' ⚠':'');
  let mctx=mc.getContext('2d');
  mctx.clearRect(0,0,mc.width,mc.height);
  mctx.fillStyle='#0a0810';
  mctx.fillRect(0,0,mc.width,mc.height);
  let C=cols(),R=rows();
  if(!G.tiles)return;
  let scaleX=pw/C,scaleY=60/R;
  // Draw explored tiles
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){
    if(!G.exp[y]||!G.exp[y][x])continue;
    let t=G.tiles[y][x];
    let col=G.vis[y][x]?(t==='#'?'#2a2040':(t==='>'?'#a870f0':t==='M'?'#e8a030':'#4a3a2a'))
                       :(t==='#'?'#18122a':'#2a2016');
    // Secret wall highlight (only inside explored tiles loop — won't trigger for unexplored walls)
    // Handled separately below
    mctx.fillStyle=col;
    mctx.fillRect(Math.floor(x*scaleX),Math.floor(y*scaleY),Math.max(1,Math.ceil(scaleX)),Math.max(1,Math.ceil(scaleY)));
  }
  // Secret wall proximity hint — faint purple, only within 3 tiles of player
  (G.secretWalls||[]).forEach(sw=>{
    if(sw.found)return;
    let dist=Math.abs(sw.x-player.x)+Math.abs(sw.y-player.y);
    if(dist>3)return;
    mctx.globalAlpha=0.18; // very faint — easy to miss unless looking
    mctx.fillStyle='#7a3aaa';
    mctx.fillRect(Math.floor(sw.x*scaleX),Math.floor(sw.y*scaleY),Math.max(1,Math.ceil(scaleX)),Math.max(1,Math.ceil(scaleY)));
    mctx.globalAlpha=1;
  });

  // Monsters (visible)
  monsters.forEach(m=>{
    if(m.hp<=0||m._dead)return;
    if(!G.vis[m.y]||!G.vis[m.y][m.x])return;
    mctx.fillStyle=m.isBoss?'#ff4444':'#e85a5a';
    let mx=Math.floor(m.x*scaleX),my=Math.floor(m.y*scaleY);
    mctx.fillRect(mx,my,Math.max(1,Math.ceil(scaleX)),Math.max(1,Math.ceil(scaleY)));
  });
  // Items (visible)
  items.forEach(it=>{
    if(!G.vis[it.y]||!G.vis[it.y][it.x])return;
    mctx.fillStyle=it.type==='gold'?'#e8c840':'#5ad0ff';
    mctx.fillRect(Math.floor(it.x*scaleX),Math.floor(it.y*scaleY),Math.max(1,Math.ceil(scaleX)),Math.max(1,Math.ceil(scaleY)));
  });
  // Merchant
  if(G.merchant&&G.vis[G.merchant.y]&&G.vis[G.merchant.y][G.merchant.x]){
    mctx.fillStyle='#e8a030';
    mctx.fillRect(Math.floor(G.merchant.x*scaleX),Math.floor(G.merchant.y*scaleY),Math.max(2,Math.ceil(scaleX)),Math.max(2,Math.ceil(scaleY)));
  }
  // Player dot
  mctx.fillStyle='#e8c840';
  let ppx=Math.floor(player.x*scaleX),ppy=Math.floor(player.y*scaleY);
  mctx.fillRect(ppx,ppy,Math.max(2,Math.ceil(scaleX)),Math.max(2,Math.ceil(scaleY)));
}

// ══ UI ══
function updateUI(){
  document.getElementById('hdr-floor').textContent=floor+(bossFloor?' ⚠':'');
  document.getElementById('hdr-turn').textContent=turn;
  document.getElementById('hdr-bosses').textContent=bossesKilled;
  document.getElementById('hdr-diff').textContent=diffScale>1?'x'+diffScale.toFixed(1)+' diff':'';
  let fc=spellFailChance();document.getElementById('hdr-fail').textContent=fc>0?fc+'% spell fail':'';
  document.getElementById('fl-bar').textContent='Floor '+floor+(bossFloor?' ⚠':'');
  document.getElementById('s-class').textContent=player.cls||'-';
  document.getElementById('s-lvl').textContent='Lv'+player.level;
  document.getElementById('s-spec').textContent=player.spec?player.spec+' Path':'Choose path [T]';
  document.getElementById('hp-txt').textContent=Math.max(0,player.hp)+'/'+player.mhp;
  document.getElementById('xp-txt').textContent=player.xp+'/'+(player.level*10);
  document.getElementById('s-atk').textContent=effStat('atk');
  document.getElementById('s-def').textContent=effStat('def');
  document.getElementById('s-gold').textContent=player.gold;
  document.getElementById('s-spts').textContent=player.skillPts||0;
  document.getElementById('tree-pts-btn').textContent=player.skillPts||0;
  document.getElementById('tree-pts-hdr').textContent=player.skillPts||0;
  let hpP=Math.max(0,player.hp/player.mhp*100);
  document.getElementById('hp-bar').style.width=hpP+'%';
  document.getElementById('hp-bar').style.background=hpP>50?'#8b2020':hpP>25?'#c86a20':'#e82020';
  document.getElementById('xp-bar').style.width=(player.xp/(player.level*10)*100)+'%';
  let eq=player.eq||{};
  ['weapon','armor','ring','amulet'].forEach(s=>{let it=eq[s];document.getElementById('e-'+s).textContent=it?it.name.replace(/\[.*?\] /,'')+((it.level||0)>0?' +'+(it.level):''):'-'});
  document.getElementById('inv-cnt').textContent=player.inventory.length;
  let hint=player.level<7?'(Lv7&15 unlock more)':player.level<15?'(Lv15 unlocks ultimate)':'';
  document.getElementById('abil-hint').textContent=hint;
  let fc2=spellFailChance();
  document.getElementById('abil-list').innerHTML=(player.abilities||[]).map((a,i)=>{
    let rng=a.range>1?'r'+a.range:a.aoe?'aoe':'adj';
    let fs=a.isSpell&&fc2>0?` <span style="color:#c95e5e;font-size:7px">✗${fc2}%</span>`:'';
    let isTree=i>=4;
    let keyLabel=`[${i+1}]`;
    return `<div class="arow${a.cd>0?' acd':''}${isTree?' tree-abil':''}" onmouseenter="showRangePreview(${i});showAbilTooltip(${i},this)" onmouseleave="clearRangePreview();hideAbilTooltip()" onclick="useAbility(${i})"><span class="akey">${keyLabel}</span>${a.name}${a.cd>0?' ('+a.cd+')':' ✓'}${fs}<span class="arow-meta">${rng}</span></div>`;
  }).join('');
  if(invOpen)renderInv();
  if(treeOpen)renderTree();
  drawMinimap();
  updateBossBar();
  updateBuildPanel();
}

