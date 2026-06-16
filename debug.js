// ══ DEBUG PANEL ══
// Hidden developer tools. Unlocked by typing the secret sequence below
// during play (not on menus). ANY use of debug taints the current run so it
// can NEVER submit a leaderboard score — keeping the shared board honest even
// though the panel ships in the live game.
//
// Secret unlock sequence: type  i d k f a   (Doom homage), within ~2s.
// Change DEBUG_CODE if you want a different combo. This is convenience, not
// security: the code is readable in-source and the flag is flippable from the
// console. The leaderboard lockout is the part that actually matters.
const DEBUG_CODE='idkfa';
let _dbgBuf='', _dbgBufT=0, debugUnlocked=false, debugPanelOpen=false;

// Mark this run as debug-touched (persists on the player object, so it travels
// with the save and a loaded debug run still can't submit).
function debugTaint(){
  if(player) player._debug=true;
}
function isDebugRun(){return !!(player&&player._debug);}

// Listen for the unlock sequence on every keydown (added in shell.js handler).
function debugWatchKey(e){
  if(classChooser||specChooser||gameOver)return;          // only mid-run
  if(e.key&&e.key.length===1){
    let now=Date.now();
    if(now-_dbgBufT>2000)_dbgBuf='';                       // reset if slow
    _dbgBufT=now;
    _dbgBuf=(_dbgBuf+e.key.toLowerCase()).slice(-DEBUG_CODE.length);
    if(_dbgBuf===DEBUG_CODE){
      debugUnlocked=true; debugPanelOpen=true; _dbgBuf='';
      addLog('⚙ DEBUG MODE unlocked — this run will NOT post a score.',7);
      renderDebugPanel();
    }
  }
}

// ── commands ──
function dbgGotoFloor(n){
  debugTaint();
  n=Math.max(1,Math.min(100,n|0));
  floor=n-1;                       // nextFloor increments to n
  // place player on a fake stair so nextFloor proceeds, then advance
  player.x=player.x; // no-op, keep position
  // bypass the stair requirement by calling the generation directly
  floor=n; bossFloor=(floor%5===0);
  bossActive=false;
  floorKills=0; floorItemsFound=0;
  if(typeof mkDungeon==='function'){
    mkDungeon();
    let rm=G.rooms[0]; player.x=rm.cx; player.y=rm.cy;
    player.atStair=false; player.atMerch=false;
    if(typeof mkMonsters==='function')mkMonsters();
    if(typeof mkItems==='function')mkItems();
    fov(); updateUI(); drawAll();
  }
  addLog('⚙ Jumped to floor '+floor,7);
  saveGame();
}
function dbgSpawnBoss(name){
  debugTaint();
  let bt=(typeof BOSS_TYPES!=='undefined')&&BOSS_TYPES.find(b=>b.name===name);
  if(!bt){addLog('⚙ No such boss: '+name,2);return}
  // find a floor tile near the player
  let spot=null;
  for(let r=1;r<6&&!spot;r++)for(let dy=-r;dy<=r&&!spot;dy++)for(let dx=-r;dx<=r&&!spot;dx++){
    let x=player.x+dx,y=player.y+dy;
    if(inB(x,y)&&G.tiles[y][x]==='.'&&!(x===player.x&&y===player.y)&&!monsters.some(m=>m.x===x&&m.y===y))spot={x,y};
  }
  if(!spot){addLog('⚙ No room to spawn boss',2);return}
  monsters.push({...bt,x:spot.x,y:spot.y,mhp:bt.hp,hp:bt.hp,isBoss:true,id:Math.random(),stun:0,poison:0});
  bossActive=true;
  fov();updateUI();drawAll();
  addLog('⚙ Spawned '+name,7);
}
function dbgAddGold(n){debugTaint();player.gold=(player.gold||0)+n;updateUI();drawAll();addLog('⚙ +'+n+' gold',7);}
function dbgHeal(){debugTaint();player.hp=player.mhp;updateUI();drawAll();addLog('⚙ Full heal',7);}
function dbgLevelUp(){debugTaint();if(typeof gainXP==='function'){gainXP((player.xpNext||10));}else{player.level++;player.skillPts=(player.skillPts||0)+1;}updateUI();drawAll();addLog('⚙ Level up',7);}
function dbgGodToggle(){debugTaint();player._godmode=!player._godmode;updateUI();drawAll();addLog('⚙ God mode '+(player._godmode?'ON':'OFF'),7);}
function dbgReveal(){debugTaint();for(let y=0;y<G.tiles.length;y++)for(let x=0;x<G.tiles[0].length;x++){if(G.exp[y])G.exp[y][x]=true;}drawAll();addLog('⚙ Map revealed',7);}
function dbgKillAll(){debugTaint();monsters.forEach(m=>{if(!m.isBoss){m.hp=-999;m._dead=true;}});monsters=monsters.filter(m=>m.hp>0&&!m._dead);fov();updateUI();drawAll();addLog('⚙ Cleared non-boss monsters',7);}

// ── panel UI (simple HTML overlay, built once) ──
function renderDebugPanel(){
  let el=document.getElementById('debug-panel');
  if(!el){
    el=document.createElement('div');
    el.id='debug-panel';
    el.style.cssText='position:fixed;top:8px;left:8px;z-index:9999;background:rgba(12,10,18,0.95);'
      +'border:1px solid #6a4caa;border-radius:6px;padding:10px;font:11px "Share Tech Mono",monospace;'
      +'color:#cbbbe6;width:200px;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
    document.body.appendChild(el);
  }
  el.style.display=debugPanelOpen?'block':'none';
  if(!debugPanelOpen)return;
  el.innerHTML=
    '<div style="color:#b48aff;font-weight:bold;margin-bottom:6px">⚙ DEBUG &nbsp;'
    +'<span style="float:right;cursor:pointer" id="dbg-x">✕</span></div>'
    +'<div style="color:#e8a;margin-bottom:6px;font-size:10px">Run is flagged — no score will post.</div>'
    +'<div style="display:flex;gap:4px;margin-bottom:4px"><input id="dbg-floor" type="number" min="1" max="100" value="'+(floor+1)+'" style="width:46px;background:#1a1426;border:1px solid #444;color:#ddd;padding:2px"><button data-cmd="goto">Go to floor</button></div>'
    +'<button data-cmd="gold">+500 gold</button>'
    +'<button data-cmd="heal">Full heal</button>'
    +'<button data-cmd="level">Level up</button>'
    +'<button data-cmd="god">Toggle god mode</button>'
    +'<button data-cmd="reveal">Reveal map</button>'
    +'<button data-cmd="killall">Clear monsters</button>'
    +'<div style="color:#b48aff;margin:6px 0 3px">Spawn boss</div>'
    +(typeof BOSS_TYPES!=='undefined'?BOSS_TYPES.map(b=>'<button data-boss="'+b.name+'">'+b.name+'</button>').join(''):'');
  // style buttons
  el.querySelectorAll('button').forEach(btn=>{
    btn.style.cssText='display:block;width:100%;margin:2px 0;background:#241a38;border:1px solid #4a3a6a;'
      +'color:#cbbbe6;padding:3px 6px;font:11px "Share Tech Mono";cursor:pointer;text-align:left;border-radius:3px';
  });
  el.querySelector('#dbg-x').onclick=()=>{debugPanelOpen=false;renderDebugPanel();};
  el.querySelectorAll('button[data-cmd]').forEach(btn=>btn.onclick=()=>{
    let c=btn.getAttribute('data-cmd');
    if(c==='goto')dbgGotoFloor(parseInt(document.getElementById('dbg-floor').value)||1);
    else if(c==='gold')dbgAddGold(500);
    else if(c==='heal')dbgHeal();
    else if(c==='level')dbgLevelUp();
    else if(c==='god')dbgGodToggle();
    else if(c==='reveal')dbgReveal();
    else if(c==='killall')dbgKillAll();
  });
  el.querySelectorAll('button[data-boss]').forEach(btn=>btn.onclick=()=>dbgSpawnBoss(btn.getAttribute('data-boss')));
}
