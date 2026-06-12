// ══ LEADERBOARD — "Hall of the Fallen" (Supabase) ══
// SETUP (see SETUP_LEADERBOARD.md): paste your two values below.
// While these are empty the leaderboard is fully disabled and the game
// behaves exactly as before — safe to ship either way.
let LB_URL='';   // e.g. 'https://abcdefghijkl.supabase.co'
let LB_KEY='';   // your 'anon public' API key (it is designed to be public)

function LB_ENABLED(){return !!(LB_URL&&LB_KEY)}
function lbHeaders(){return {apikey:LB_KEY,Authorization:'Bearer '+LB_KEY,'Content-Type':'application/json'}}

// ── fetch top scores (cached 60s; never blocks or breaks the title) ──
let lbCache=null,lbFetchedAt=0,lbStatus='idle'; // idle|loading|ok|err
function fetchLeaderboard(force){
  if(!LB_ENABLED())return;
  let now=Date.now();
  if(!force&&(lbStatus==='loading'||(lbCache&&now-lbFetchedAt<60000)))return;
  lbStatus='loading';
  fetch(LB_URL+'/rest/v1/scores?select=name,cls,floor,kills&order=floor.desc,kills.desc&limit=10',
        {headers:lbHeaders()})
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(rows=>{lbCache=rows;lbFetchedAt=Date.now();lbStatus='ok';if(classChooser)drawAll()})
    .catch(()=>{lbStatus='err'});
}

// ── score submission (arcade-style name entry on the death screen) ──
let lbSubmitState='off'; // off|naming|sending|sent|err|skipped
let lbName='';
function lbLoadName(){try{return localStorage.getItem('dd_lb_name')||''}catch(e){return ''}}
function lbOnDeath(){ // called once when the hero falls
  if(!LB_ENABLED()){lbSubmitState='off';return}
  lbSubmitState='naming';lbName=lbLoadName();
}
function lbReset(){lbSubmitState='off';}
function lbSubmit(){
  if(!LB_ENABLED())return;
  let nm=lbName.trim().slice(0,12);
  if(!nm){lbSubmitState='skipped';return}
  try{localStorage.setItem('dd_lb_name',nm)}catch(e){}
  lbSubmitState='sending';
  fetch(LB_URL+'/rest/v1/scores',{method:'POST',
    headers:{...lbHeaders(),Prefer:'return=minimal'},
    body:JSON.stringify({
      name:nm,
      cls:player.cls||'Warrior',
      floor:Math.max(1,Math.min(100,floor)),
      kills:Math.max(0,Math.min(5000,totalKills)),
      turns:Math.max(1,Math.min(200000,turn))
    })})
   .then(r=>{lbSubmitState=r.ok?'sent':'err';fetchLeaderboard(true);drawAll()})
   .catch(()=>{lbSubmitState='err';drawAll()});
}
// Consumes death-screen keys while naming. Returns true if the key was handled.
function lbHandleDeathKey(e){
  if(lbSubmitState!=='naming')return false;
  if(e.key==='Enter'){lbSubmit();return true}
  if(e.key==='Escape'){lbSubmitState='skipped';drawAll();return true}
  if(e.key==='Backspace'){lbName=lbName.slice(0,-1);drawAll();return true}
  if(e.key.length===1&&/[a-zA-Z0-9 _\-]/.test(e.key)&&lbName.length<12){lbName+=e.key;drawAll();return true}
  // swallow everything else (incl. R) so typing never restarts the game
  return true;
}

// ── death-screen UI (drawn under the run-summary card) ──
function drawLbDeathUI(W,H,bx,by,cardW,cardH){
  if(lbSubmitState==='off')return;
  let y=by+cardH+14, cx=W/2;
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(lbSubmitState==='naming'){
    ctx.fillStyle='rgba(200,170,110,0.9)';ctx.font='11px "Share Tech Mono"';
    ctx.fillText('Inscribe your name in the Hall of the Fallen',cx,y);
    let bw=190,bh=24,ix=cx-bw/2,iy=y+10;
    ctx.fillStyle='rgba(10,6,14,0.9)';ctx.fillRect(ix,iy,bw,bh);
    ctx.strokeStyle='rgba(201,162,39,0.7)';ctx.lineWidth=1;ctx.strokeRect(ix,iy,bw,bh);
    let blink=Math.sin(animT*6)>0?'_':' ';
    ctx.fillStyle='#e8d8a0';ctx.font='13px "Share Tech Mono"';
    ctx.fillText(lbName+blink,cx,iy+bh/2+1);
    ctx.fillStyle='rgba(150,130,120,0.7)';ctx.font='9px "Share Tech Mono"';
    ctx.fillText('Enter = submit   Esc = skip',cx,iy+bh+12);
  } else if(lbSubmitState==='sending'){
    ctx.fillStyle='rgba(200,170,110,0.8)';ctx.font='11px "Share Tech Mono"';
    ctx.fillText('Carving your name into the Hall…',cx,y+8);
  } else if(lbSubmitState==='sent'){
    ctx.fillStyle='rgba(140,220,140,0.9)';ctx.font='11px "Share Tech Mono"';
    ctx.fillText('✓ Your fall is recorded in the Hall',cx,y+8);
  } else if(lbSubmitState==='err'){
    ctx.fillStyle='rgba(220,120,100,0.9)';ctx.font='11px "Share Tech Mono"';
    ctx.fillText('The Hall is unreachable — score not recorded',cx,y+8);
  }
}

// ── title-screen panel: HALL OF THE FALLEN, top 10 in two columns ──
function drawLbTitlePanel(cw,ch){
  if(!LB_ENABLED())return;
  fetchLeaderboard();
  if(lbStatus==='err'&&!lbCache)return;            // unreachable → show nothing
  let rows=lbCache||[];
  let pw=Math.min(560,cw-80), phH=98;
  let px2=cw/2-pw/2, py2=ch-46-12-phH;
  ctx.fillStyle='rgba(8,5,14,0.78)';ctx.fillRect(px2,py2,pw,phH);
  ctx.strokeStyle='rgba(120,95,165,0.45)';ctx.lineWidth=1;ctx.strokeRect(px2,py2,pw,phH);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#c9a227';ctx.font='bold 11px Cinzel,serif';
  ctx.fillText('⚰ HALL OF THE FALLEN ⚰',cw/2,py2+13);
  ctx.font='9px "Share Tech Mono"';
  if(lbStatus==='loading'&&!lbCache){
    ctx.fillStyle='rgba(150,130,160,0.7)';
    ctx.fillText('consulting the archives…',cw/2,py2+phH/2+6);
    return;
  }
  if(rows.length===0){
    ctx.fillStyle='rgba(150,130,160,0.7)';
    ctx.fillText('No heroes have fallen yet — be the first',cw/2,py2+phH/2+6);
    return;
  }
  let colW=pw/2-18;
  rows.slice(0,10).forEach((r,i)=>{
    let col=i<5?0:1, row=i%5;
    let rx=px2+12+col*(colW+12), ry=py2+30+row*13;
    ctx.textAlign='left';
    ctx.fillStyle=i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(190,170,200,0.85)';
    let nm=(r.name||'???').slice(0,12);
    ctx.fillText((i+1)+'. '+nm,rx,ry);
    ctx.textAlign='right';
    ctx.fillStyle='rgba(150,200,150,0.8)';
    ctx.fillText('F'+r.floor+' · '+(r.kills||0)+'k',rx+colW,ry);
  });
}
