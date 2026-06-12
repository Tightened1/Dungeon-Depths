// ── ANIMATED TITLE SCREEN ──
let titleParticles=[];
let titleT=0;
function initTitleParticles(){
  titleParticles=[];
  for(let i=0;i<60;i++){
    titleParticles.push({
      x:Math.random()*800,y:Math.random()*600,
      vx:(Math.random()-0.5)*0.3,vy:-0.2-Math.random()*0.5,
      life:Math.random(),maxLife:0.5+Math.random()*1.5,
      size:1+Math.random()*2,
      col:['#c9a227','#e87a3a','#c85ae8','#5aaae8','#e85a5a'][Math.floor(Math.random()*5)]
    });
  }
}
initTitleParticles();

function drawClassChooser(){
  let cw=canvas.width,ch=canvas.height;
  titleT+=0.02;

  // Background — vertical gradient (even across the full width so both columns match)
  let bg=ctx.createLinearGradient(0,0,0,ch);
  bg.addColorStop(0,'#150c24');bg.addColorStop(0.5,'#0e0818');bg.addColorStop(1,'#070410');
  ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
  // Gentle central warmth, kept wide & subtle so it doesn't favour one column
  let warm=ctx.createRadialGradient(cw/2,ch*0.4,0,cw/2,ch*0.4,Math.max(cw,ch)*0.7);
  warm.addColorStop(0,'rgba(60,36,90,0.35)');warm.addColorStop(1,'rgba(60,36,90,0)');
  ctx.fillStyle=warm;ctx.fillRect(0,0,cw,ch);

  // Torch glows positioned over each column so lighting is symmetric
  let tf=0.7+Math.sin(titleT*5)*0.15+Math.cos(titleT*3.3)*0.1;
  [[cw*0.27,ch*0.30],[cw*0.73,ch*0.30]].forEach(([gx,gy])=>{
    let tg=ctx.createRadialGradient(gx,gy,2,gx,gy,ch*0.5);
    tg.addColorStop(0,`rgba(230,140,50,${0.16*tf})`);
    tg.addColorStop(0.5,`rgba(180,80,30,${0.06*tf})`);
    tg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=tg;ctx.fillRect(gx-ch*0.5,gy-ch*0.5,ch,ch);
  });

  // Drifting low fog band across the middle
  ctx.save();
  for(let i=0;i<3;i++){
    let fy=ch*(0.5+i*0.07);
    let off=Math.sin(titleT*0.6+i)*cw*0.15;
    let fg=ctx.createLinearGradient(0,fy-30,0,fy+30);
    fg.addColorStop(0,'rgba(60,50,90,0)');
    fg.addColorStop(0.5,`rgba(70,55,100,${0.05-i*0.012})`);
    fg.addColorStop(1,'rgba(60,50,90,0)');
    ctx.fillStyle=fg;ctx.fillRect(off-cw*0.2,fy-30,cw*1.4,60);
  }
  ctx.restore();

  // Ember particles
  titleParticles.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.life+=0.012;
    if(p.y<-10||p.life>p.maxLife){p.x=Math.random()*cw;p.y=ch;p.life=0}
    ctx.globalAlpha=Math.sin(p.life/p.maxLife*Math.PI)*0.5;
    ctx.fillStyle=p.col;ctx.fillRect(p.x,p.y,p.size,p.size);
    ctx.globalAlpha=1;
  });

  // Compact title with crossed-swords flourish
  let titleSize=Math.min(42,Math.floor(ch*0.065));
  ctx.save();
  // crossed-swords glyph above the title
  ctx.font=`${Math.floor(titleSize*0.7)}px Cinzel,serif`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.shadowColor='#e8b840';ctx.shadowBlur=14+Math.sin(titleT*2)*5;
  ctx.fillStyle=`rgba(232,184,64,${0.85+Math.sin(titleT*2)*0.15})`;
  ctx.fillText('⚔',cw/2,2);
  ctx.shadowBlur=0;
  // title text with gradient + glow
  ctx.shadowColor='#c9a227';ctx.shadowBlur=20+Math.sin(titleT*2)*6;
  let titleGrad=ctx.createLinearGradient(0,titleSize*0.6,0,titleSize*1.9);
  titleGrad.addColorStop(0,'#fff0b8');titleGrad.addColorStop(0.5,'#d4ac2e');titleGrad.addColorStop(1,'#7a5410');
  ctx.fillStyle=titleGrad;
  ctx.font=`bold ${titleSize}px Cinzel,serif`;
  ctx.fillText('DUNGEON DEPTHS',cw/2,titleSize*0.55);
  ctx.shadowBlur=0;
  // decorative rule lines flanking the subtitle
  let subY=titleSize*1.7+10;
  ctx.strokeStyle='rgba(180,150,80,0.4)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cw/2-130,subY+5);ctx.lineTo(cw/2-70,subY+5);
  ctx.moveTo(cw/2+70,subY+5);ctx.lineTo(cw/2+130,subY+5);ctx.stroke();
  ctx.fillStyle='rgba(190,160,90,0.6)';
  ctx.font=`11px "Share Tech Mono"`;
  ctx.fillText('CHOOSE YOUR CLASS',cw/2,subY);
  ctx.restore();

  // Cards — 2 columns, 3 rows, fixed height so all 6 fit
  let topY=titleSize+36;
  let cardPad=6;
  let cardW=Math.floor((cw-80-cardPad)/2);
  let availH=ch-topY-24;
  let rows=Math.ceil(CLASSES.length/2);
  let cardH=Math.floor((availH-(rows-1)*cardPad)/rows);
  // Clamp card height so text stays readable
  cardH=Math.min(cardH,110);

  CLASSES.forEach((c,i)=>{
    let col=i%2,row=Math.floor(i/2);
    let cx2=40+col*(cardW+cardPad);
    let cy2=topY+row*(cardH+cardPad);
    let isHov=(titleHover===i);

    // Card bg (hover lifts + glows)
    if(isHov){ctx.shadowColor=c.color;ctx.shadowBlur=16}
    ctx.fillStyle=isHov?'rgba(58,38,90,0.96)':'rgba(18,12,28,0.92)';
    ctx.fillRect(cx2,cy2,cardW,cardH);
    ctx.shadowBlur=0;
    // Border
    ctx.strokeStyle=isHov?c.color:'rgba(55,38,75,0.7)';
    ctx.lineWidth=isHov?2:1;ctx.strokeRect(cx2,cy2,cardW,cardH);
    // Left colour strip
    ctx.fillStyle=c.color;ctx.fillRect(cx2,cy2,3,cardH);
    // Ghost symbol watermark
    ctx.fillStyle=c.color;ctx.font=`bold ${cardH}px "Share Tech Mono"`;
    ctx.textAlign='right';ctx.textBaseline='bottom';
    ctx.globalAlpha=isHov?0.10:0.06;ctx.fillText(c.sym,cx2+cardW-4,cy2+cardH+2);ctx.globalAlpha=1;
    // Key hint
    ctx.fillStyle=c.color;ctx.font=`bold 10px "Share Tech Mono"`;
    ctx.textAlign='right';ctx.textBaseline='top';
    ctx.fillText('['+(i+1)+']',cx2+cardW-6,cy2+5);
    // Class name
    ctx.fillStyle=c.color;ctx.font=`bold 15px Cinzel,serif`;
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText(c.sym+'  '+c.name,cx2+10,cy2+6);
    // Stats
    ctx.fillStyle='rgba(200,180,120,0.65)';ctx.font=`10px "Share Tech Mono"`;
    ctx.fillText('HP:'+c.hp+'  ATK:'+c.atk+'  DEF:'+c.def,cx2+10,cy2+26);
    // Desc
    ctx.fillStyle='rgba(150,130,90,0.55)';ctx.font=`10px "Share Tech Mono"`;
    ctx.fillText(c.desc,cx2+10,cy2+42);
    // Paths
    ctx.fillStyle='rgba(110,90,150,0.6)';ctx.font=`10px "Share Tech Mono"`;
    ctx.fillText(c.paths.map(p=>p.name).join(' · '),cx2+10,cy2+58);
  });

  // Vignette — softened & based on the larger dimension so wide layouts aren't darkened at the columns
  let vg=ctx.createRadialGradient(cw/2,ch/2,Math.max(cw,ch)*0.45,cw/2,ch/2,Math.max(cw,ch)*0.85);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.4)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,cw,ch);

  // Footer with a gentle pulse
  let fp2=0.4+Math.sin(titleT*3)*0.25;
  ctx.fillStyle=`rgba(150,120,70,${fp2})`;ctx.font=`10px "Share Tech Mono"`;ctx.textAlign='center';
  ctx.fillText('Click a card or press [1]–['+CLASSES.length+'] to select',cw/2,ch-8);

  // Hall of the Fallen — global top 10 (only when a leaderboard is configured)
  if(typeof drawLbTitlePanel==='function')drawLbTitlePanel(cw,ch);

  // Continue-run banner (if a saved run exists)
  let sp=savePeek();
  if(sp&&sp.player){
    let bw=300,bh=26,bx=cw/2-bw/2,by=ch-46;
    let pulse=0.75+Math.sin(titleT*2.5)*0.25;
    ctx.fillStyle='rgba(20,30,16,0.92)';ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle=`rgba(110,200,110,${pulse})`;ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle=`rgba(150,230,150,${pulse})`;ctx.font='bold 11px "Share Tech Mono"';
    ctx.fillText('[C] Continue — '+(sp.player.cls||'Hero')+' · Floor '+sp.floor+' · Turn '+sp.turn,cw/2,by+bh/2+1);
  }
}

let titleHover=-1;
canvas.addEventListener('mousemove',e=>{
  let bounds=canvas.getBoundingClientRect();
  let mx=(e.clientX-bounds.left)*(canvas.width/bounds.width);
  let my=(e.clientY-bounds.top)*(canvas.height/bounds.height);
  let cw=canvas.width,ch=canvas.height;
  if(classChooser){
    let titleSize=Math.min(42,Math.floor(ch*0.065));
    let topY=titleSize+36;
    let cardPad=6;
    let cardW=Math.floor((cw-80-cardPad)/2);
    let availH=ch-topY-24;
    let rows=Math.ceil(CLASSES.length/2);
    let cardH=Math.min(Math.floor((availH-(rows-1)*cardPad)/rows),110);
    titleHover=-1;
    CLASSES.forEach((c,i)=>{
      let col=i%2,row=Math.floor(i/2);
      let cx2=40+col*(cardW+cardPad),cy2=topY+row*(cardH+cardPad);
      if(mx>=cx2&&mx<=cx2+cardW&&my>=cy2&&my<=cy2+cardH)titleHover=i;
    });
  }
  if(specChooser){
    let cls=CLASSES.find(c=>c.name===player.cls);if(!cls)return;
    let headerH=52,cardPad=5;
    let availH=ch-headerH-20;
    let pathH=Math.min(Math.floor((availH-(cls.paths.length-1)*cardPad)/cls.paths.length),120);
    specHover=-1;
    cls.paths.forEach((_,i)=>{let py2=headerH+8+i*(pathH+cardPad);if(my>=py2&&my<=py2+pathH)specHover=i});
  }
});

// ══ MOUSE-LOOK (first-person) ══
// Click the view to capture the mouse; moving it rotates your facing like Doom.
// Esc (or clicking again) releases. Turning is free — it costs no turn.
let mouseLookSens=0.00175;
canvas.addEventListener('click',()=>{
  if(fpMode&&!gameOver&&!invOpen&&!merchOpen&&!treeOpen&&!relicOpen){
    if(document.pointerLockElement!==canvas){canvas.requestPointerLock&&canvas.requestPointerLock();}
  }
});
document.addEventListener('pointerlockchange',()=>{
  let locked=document.pointerLockElement===canvas;
  if(fpMode)addLog(locked?'Mouse-look ON — move mouse to turn, Esc to release':'Mouse-look released',8);
});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==canvas)return;
  if(!fpMode)return;
  if(player.angle===undefined)player.angle=faceToAngle(player.facing||1);
  player.angle+=(e.movementX||0)*mouseLookSens;
  // keep angle in -PI..PI for tidiness
  while(player.angle>Math.PI)player.angle-=2*Math.PI;
  while(player.angle<-Math.PI)player.angle+=2*Math.PI;
  player.facing=angleToFace(player.angle);
  drawAll();
});
// Release pointer lock automatically when leaving FP or opening a menu
function maybeReleasePointerLock(){
  if(document.pointerLockElement===canvas&&(!fpMode||invOpen||merchOpen||treeOpen||relicOpen||gameOver)){
    document.exitPointerLock&&document.exitPointerLock();
  }
}

function drawSpecChooser(){
  let cw=canvas.width,ch=canvas.height;
  let cls=CLASSES.find(c=>c.name===player.cls);

  // Background
  let bg=ctx.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch));
  bg.addColorStop(0,'#1a1028');bg.addColorStop(1,'#060410');
  ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);

  // Compact header
  let headerH=52;
  ctx.fillStyle='rgba(200,180,100,0.08)';ctx.fillRect(0,0,cw,headerH);
  ctx.fillStyle=player.color;
  ctx.font=`bold 18px Cinzel,serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor=player.color;ctx.shadowBlur=12;
  ctx.fillText(player.cls.toUpperCase()+' — CHOOSE YOUR PATH',cw/2,18);
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(160,140,80,0.45)';ctx.font=`10px "Share Tech Mono"`;
  ctx.fillText('Your specialisation defines your skill tree. You can only unlock nodes on your chosen path.',cw/2,38);

  // Path cards — fixed height, all 3 fit comfortably
  let cardPad=5;
  let availH=ch-headerH-20;
  let pathH=Math.floor((availH-(cls.paths.length-1)*cardPad)/cls.paths.length);
  pathH=Math.min(pathH,120);

  cls.paths.forEach((p,i)=>{
    let py2=headerH+8+i*(pathH+cardPad);
    let isHov=(specHover===i);

    ctx.fillStyle=isHov?'rgba(50,30,80,0.95)':'rgba(16,10,28,0.92)';
    ctx.fillRect(40,py2,cw-80,pathH);
    ctx.strokeStyle=isHov?p.color:'rgba(50,35,70,0.5)';
    ctx.lineWidth=isHov?2:1;ctx.strokeRect(40,py2,cw-80,pathH);
    ctx.fillStyle=p.color;ctx.fillRect(40,py2,3,pathH);

    // Ghost watermark
    ctx.fillStyle=p.color;ctx.font=`bold ${pathH*1.2}px Cinzel,serif`;
    ctx.textAlign='right';ctx.textBaseline='bottom';
    ctx.globalAlpha=0.04;ctx.fillText(p.name[0],cw-44,py2+pathH+4);ctx.globalAlpha=1;

    // Key hint
    ctx.fillStyle=p.color;ctx.font=`bold 10px "Share Tech Mono"`;
    ctx.textAlign='right';ctx.textBaseline='top';
    ctx.fillText('['+(i+1)+']',cw-48,py2+6);

    // Path name
    ctx.fillStyle=p.color;ctx.font=`bold 15px Cinzel,serif`;
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText(p.name,54,py2+7);

    // Desc
    ctx.fillStyle='rgba(180,160,100,0.6)';ctx.font=`10px "Share Tech Mono"`;
    ctx.fillText(p.desc,54,py2+28);

    // Node list
    ctx.fillStyle='rgba(120,100,160,0.5)';ctx.font=`10px "Share Tech Mono"`;
    let nodeStr=p.nodes.map(n=>n.name).join('  →  ');
    ctx.fillText(nodeStr,54,py2+44);

    // First node note
    let firstAbil=p.nodes.find(n=>n.isAbil);
    if(firstAbil){
      ctx.fillStyle='rgba(180,220,100,0.4)';ctx.font=`10px "Share Tech Mono"`;
      ctx.fillText('First skill point unlocks: '+firstAbil.name,54,py2+60);
    }
  });

  ctx.fillStyle='rgba(80,60,40,0.4)';ctx.font=`10px "Share Tech Mono"`;ctx.textAlign='center';
  ctx.fillText('Click or press [1]–['+cls.paths.length+'] to choose your path',cw/2,ch-8);
}
let specHover=-1;


// ══ CANVAS CLICKS ══
canvas.addEventListener('click',e=>{
  if(invOpen||merchOpen||treeOpen||gameOver||relicOpen)return;
  let bounds=canvas.getBoundingClientRect();
  let mx=(e.clientX-bounds.left)*(canvas.width/bounds.width);
  let my=(e.clientY-bounds.top)*(canvas.height/bounds.height);
  let cw=canvas.width,ch=canvas.height;
  if(classChooser){
    let titleSize=Math.min(42,Math.floor(ch*0.065));
    let topY=titleSize+36;
    let cardPad=6;
    let cardW=Math.floor((cw-80-cardPad)/2);
    let availH=ch-topY-24;
    let rows=Math.ceil(CLASSES.length/2);
    let cardH=Math.min(Math.floor((availH-(rows-1)*cardPad)/rows),110);
    CLASSES.forEach((c,i)=>{
      let col=i%2,row=Math.floor(i/2);
      let cx2=40+col*(cardW+cardPad),cy2=topY+row*(cardH+cardPad);
      if(mx>=cx2&&mx<=cx2+cardW&&my>=cy2&&my<=cy2+cardH)chooseClass(i);
    });
    return;
  }
  if(specChooser){
    let cls=CLASSES.find(c=>c.name===player.cls);if(!cls)return;
    let headerH=52,cardPad=5;
    let availH=ch-headerH-20;
    let pathH=Math.min(Math.floor((availH-(cls.paths.length-1)*cardPad)/cls.paths.length),120);
    cls.paths.forEach((_,i)=>{
      let py2=headerH+8+i*(pathH+cardPad);
      if(my>=py2&&my<=py2+pathH)chooseSpec(i);
    });
    return;
  }
});

function chooseClass(ci){
  let c=CLASSES[ci];
  player={x:0,y:0,cls:c.name,sym:'@',color:c.color,hp:c.hp,mhp:c.hp,atk:c.atk,def:c.def,
    xp:0,level:1,gold:0,berserk:0,shielded:0,atkBuff:0,atkBuffTurns:0,defBuff:0,defBuffTurns:0,tempDef:0,
    ghost:0,stealthed:0,arcaneSurge:0,soulStack:0,soulCharges:0,skillPts:0,_martyrUsed:false,
    spec:null,specIdx:null,treeNodes:{},atStair:false,atMerch:false,facing:1,
    abilities:c.baseAbils.map(a=>({...a,cd:0})),inventory:[],eq:{weapon:null,armor:null,ring:null,amulet:null}};
  classChooser=false;specChooser=true;drawAll();
}

function chooseSpec(pi){
  let cls=CLASSES.find(c=>c.name===player.cls);
  player.spec=cls.paths[pi].name;player.specIdx=pi;specChooser=false;
  player.relics=[];
  // Shuffle boss order - Void Dragon always last
  bossOrder=[...BOSS_TYPES.slice(0,-1)].sort(()=>Math.random()-0.5);
  bossOrder.push(BOSS_TYPES[BOSS_TYPES.length-1]); // Void Dragon always final
  mkDungeon();let rm=G.rooms[0];player.x=rm.cx;player.y=rm.cy;
  mkMonsters();mkItems();fov();updateUI();drawAll();
  addLog(player.cls+' ('+player.spec+') enters the depths.',0);
  addLog('T=skill tree | I=inventory | Skill pts every 3 levels',8);
  // Show starting relic choice
  setTimeout(()=>{
    let pool=pickRelicPool(3);
    if(pool.length>0)showRelicChoice(pool,()=>{fov();updateUI();drawAll();updateRelicPanel()});
  },200);
}

// ══ INVENTORY ══
function openInv(){invOpen=true;selIdx=-1;pendingDiscard=false;document.getElementById('inv-overlay').classList.add('open');renderInv()}
function closeInv(){invOpen=false;document.getElementById('inv-overlay').classList.remove('open')}
window.openInv=openInv;window.closeInv=closeInv;

function getInvCats(){let inv=player.inventory||[];return{weapons:inv.filter(i=>i.type==='weapon'),armor:inv.filter(i=>i.type==='armor'),rings:inv.filter(i=>i.type==='ring'),amulets:inv.filter(i=>i.type==='amulet'),potions:inv.filter(i=>i.type==='potion')}}

function renderInv(){
  document.getElementById('inv-gold-amt').textContent=player.gold;
  let cats=getInvCats(),eq=player.eq||{};
  let defs=[{key:'weapons',label:'Weapons',col:'#c8b050',items:cats.weapons},{key:'armor',label:'Armour',col:'#5aaae8',items:cats.armor},{key:'rings',label:'Rings',col:'#e8e850',items:cats.rings},{key:'amulets',label:'Amulets',col:'#c85ae8',items:cats.amulets},{key:'potions',label:'Potions',col:'#e85a5a',items:cats.potions}];
  let html='';
  defs.forEach(cat=>{
    let open=catOpen[cat.key]!==false;
    html+=`<div class="icat-hdr" onclick="toggleCat('${cat.key}')"><span class="icat-label" style="color:${cat.col}">${cat.label}</span><div style="display:flex;gap:5px;align-items:center"><span class="icat-count">${cat.items.length}</span><span class="icat-arrow${open?' open':''}">▶</span></div></div>`;
    html+=`<div id="cat-${cat.key}" style="display:${open?'block':'none'}">`;
    if(!cat.items.length)html+='<div style="padding:4px 9px 4px 14px;font-size:9px;color:#2a2040">Empty</div>';
    cat.items.forEach(it=>{
      let gi=player.inventory.indexOf(it),isEq=Object.values(eq).includes(it);
      let rc2=RARE_COLORS[it.rare||0],lvlS=(it.level||0)>0?' +'+(it.level):'';
      html+=`<div class="ientry${gi===selIdx?' sel':''}" onclick="selItem(${gi})"><span class="isym" style="color:${it.col}">${it.sym}</span><div class="iinfo"><div class="iname${isEq?' eq':''}">${it.name}${lvlS}</div><div class="irare" style="color:${rc2}">${RARE_NAMES[it.rare||0]}${isEq?' [E]':''}</div></div></div>`;
    });
    html+='</div>';
  });
  document.getElementById('inv-list-col').innerHTML=html;
  if(selIdx>=0&&selIdx<player.inventory.length)showDetail(player.inventory[selIdx]);else showDetail(null);
}

window.toggleCat=function(k){catOpen[k]=!catOpen[k];renderInv()};
window.selItem=function(i){selIdx=i;pendingDiscard=false;document.getElementById('conf-box').classList.remove('show');renderInv()};

function showDetail(it){
  let empty=document.getElementById('idc-empty'),content=document.getElementById('idc-content');
  if(!it){empty.style.display='block';content.style.display='none';return}
  empty.style.display='none';content.style.display='block';
  let lvl=it.level||0,rc2=RARE_COLORS[it.rare||0];
  let pips='';for(let i=0;i<MAX_ITEM_LVL;i++)pips+=`<span class="lvlpip" style="background:${i<lvl?rc2:'#1e1830'}"></span>`;
  document.getElementById('idc-name').innerHTML=`<span style="color:${it.col}">${it.sym}</span> ${it.name}${lvl>0?` <span style="color:${rc2};font-size:10px">+${lvl}</span>`:''}`;
  document.getElementById('idc-sub').innerHTML=`<span class="rbadge" style="background:${RARE_BG[it.rare||0]};color:${rc2}">${RARE_NAMES[it.rare||0]}</span><span style="color:#3a2a5a">${it.type}</span>${pips}`;
  let st=upgradeStats(it),eq=player.eq||{},curEq=it.slot?eq[it.slot]:null,isEq=Object.values(eq).includes(it);
  let rows='';
  if(it.atk||st.atk){let v=st.atk||it.atk||0,cur=curEq&&curEq!==it?(upgradeStats(curEq).atk||curEq.atk||0):null;rows+=srow('ATK',v,cur!==null?v-cur:null)}
  if(it.def||st.def){let v=st.def||it.def||0,cur=curEq&&curEq!==it?(upgradeStats(curEq).def||curEq.def||0):null;rows+=srow('DEF',v,cur!==null?v-cur:null)}
  if(it.heal)rows+=srow('Heals',it.heal+' HP',null);
  if(isEq)rows+=`<div class="dsrow" style="color:#3a5a8a;font-size:8px">Currently equipped</div>`;
  else if(curEq&&it.slot)rows+=`<div class="dsrow" style="color:#3a2a5a;font-size:8px">Replaces: ${curEq.name}</div>`;
  document.getElementById('idc-stats').innerHTML=rows;
  let affixHtml='';
  if(it.affixes&&it.affixes.length){affixHtml='<div style="font-family:Cinzel,serif;font-size:8px;color:#6a5a8a;letter-spacing:1px;margin-bottom:2px">AFFIXES</div>';affixHtml+=it.affixes.map(af=>`<div class="affix-row">${af.label}</div>`).join('')}
  document.getElementById('idc-affixes').innerHTML=affixHtml;
  document.getElementById('idc-desc').textContent=it.desc||'';
  let acts='';
  if(it.type==='potion')acts+=`<button class="iact use-btn" onclick="invUse(${selIdx})">Use</button>`;
  else if(it.slot)acts+=isEq?`<button class="iact eq-btn" onclick="invEquip(${selIdx})">Unequip</button>`:`<button class="iact eq-btn" onclick="invEquip(${selIdx})">Equip</button>`;
  acts+=`<button class="iact disc-btn" onclick="askDiscard()">Discard</button>`;
  document.getElementById('idc-acts').innerHTML=acts;
  document.getElementById('conf-box').classList.remove('show');
  let ub=document.getElementById('upg-box'),upgBtn=document.getElementById('upg-btn');
  if(UPGRADEABLE.includes(it.type)){
    ub.style.display='block';
    if(lvl>=MAX_ITEM_LVL){document.getElementById('upg-stats').innerHTML='<span style="color:#c9a227">MAX LEVEL</span>';upgBtn.disabled=true;upgBtn.textContent='Max Level';document.getElementById('upg-lvl').textContent=''}
    else{
      let cost=upgradeCost(it),nst=upgradeStats({...it,level:lvl+1}),cst=upgradeStats(it),lines='';
      if(it.atk)lines+=`ATK: ${cst.atk||it.atk} → <span style="color:#5ec95e">${nst.atk}</span><br>`;
      if(it.def)lines+=`DEF: ${cst.def||it.def} → <span style="color:#5aaae8">${nst.def}</span><br>`;
      document.getElementById('upg-stats').innerHTML=lines+`<span style="color:#c9a227">Cost: ${cost}g</span>`;
      upgBtn.disabled=player.gold<cost;upgBtn.textContent=player.gold>=cost?`Upgrade for ${cost}g`:`Need ${cost}g`;
      document.getElementById('upg-lvl').textContent=`Level ${lvl}/${MAX_ITEM_LVL}`;
    }
  }else ub.style.display='none';
}

function srow(label,val,diff){let d=diff!=null?`<span class="dsv ${diff>0?'up':'dn'}">${diff>0?'+':''}${diff}</span>`:'';return `<div class="dsrow"><span>${label}</span><span class="dsv">${val} ${d}</span></div>`}

window.invEquip=function(i){let it=player.inventory[i];if(!it||!it.slot)return;let eq=player.eq;eq[it.slot]=eq[it.slot]===it?null:it;addLog(eq[it.slot]?'Equipped '+it.name:'Unequipped '+it.name);updateUI();renderInv()};
window.invUse=function(i){let it=player.inventory[i];if(!it||it.type!=='potion')return;
  if(player.noPotions){addLog('Hollow Throne: cannot use potions!',2);return}
  let healAmt=Math.floor((it.heal||15)*(player.healMult!==undefined?player.healMult:1));
  healAmt+=(player.potionBonus||0);
  player.hp=Math.min(player.mhp,player.hp+healAmt);spawnFloatNum('+'+healAmt,player.x,player.y,'#5ec95e',false);addLog('Drank '+it.name+'! +'+healAmt+' HP',6);player.inventory.splice(i,1);selIdx=-1;updateUI();renderInv();drawAll()};
window.askDiscard=function(){pendingDiscard=true;document.getElementById('conf-box').classList.add('show')};
window.confirmDiscard=function(){if(!pendingDiscard||selIdx<0)return;let it=player.inventory[selIdx];if(it){Object.keys(player.eq).forEach(k=>{if(player.eq[k]===it)player.eq[k]=null});addLog('Discarded '+it.name+'.');player.inventory.splice(selIdx,1)}selIdx=-1;pendingDiscard=false;document.getElementById('conf-box').classList.remove('show');updateUI();renderInv()};
window.cancelDiscard=function(){pendingDiscard=false;document.getElementById('conf-box').classList.remove('show')};
window.doUpgrade=function(){if(selIdx<0)return;let it=player.inventory[selIdx];if(!it||!UPGRADEABLE.includes(it.type))return;if((it.level||0)>=MAX_ITEM_LVL)return;let cost=upgradeCost(it);if(player.gold<cost){addLog('Not enough gold!',2);return}player.gold-=cost;it.level=(it.level||0)+1;addLog(it.name+' upgraded to +'+it.level+'!',3);updateUI();renderInv();drawAll()};

// ══ SKILL TREE ══
function openTree(){treeOpen=true;selectedPath=player.specIdx||0;document.getElementById('tree-overlay').classList.add('open');renderTree()}
function closeTree(){treeOpen=false;document.getElementById('tree-overlay').classList.remove('open')}
window.openTree=openTree;window.closeTree=closeTree;

function renderTree(){
  let cls=CLASSES.find(c=>c.name===player.cls);if(!cls)return;
  document.getElementById('tree-pts-hdr').textContent=player.skillPts||0;
  let btns='';cls.paths.forEach((p,i)=>{btns+=`<button class="tree-path-btn${i===selectedPath?' active':''}" onclick="selectPath(${i})" style="color:${p.color};border-color:${i===selectedPath?p.color:'#2d2240'}">${p.name}<br><span style="font-size:9px;color:#5a4a6a">${p.desc}</span></button>`});
  document.getElementById('tree-path-btns').innerHTML=btns;
  let path=cls.paths[selectedPath];
  document.getElementById('tree-path-label').innerHTML=`<span style="font-family:Cinzel,serif;font-size:13px;color:${path.color}">${path.name}</span>${player.spec!==path.name?'<span style="color:#c95e5e;font-size:9px;margin-left:8px">(Your path: '+player.spec+')</span>':''}`;
  document.getElementById('tree-pts-disp').innerHTML=`<div style="font-size:10px;color:#c9a227;margin-bottom:8px">Skill Points available: ${player.skillPts||0} &nbsp;|&nbsp; Earned every 3 levels</div>`;
  let nodes='';
  path.nodes.forEach((node,ni)=>{
    let rank=getNodeRank(node.name),maxrank=node.ranks||1,cost=node.costPer||1;
    let locked=ni>0&&getNodeRank(path.nodes[ni-1].name)<1;
    let maxed=rank>=maxrank;
    let pips='';for(let i=0;i<maxrank;i++)pips+=`<span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:2px;background:${i<rank?path.color:'#2a2040'};border:1px solid #3a3060"></span>`;
    let borderCol=maxed?'#c9a227':rank>0?'#4a3a6a':'#2d2240';
    nodes+=`<div style="background:#0e0c18;border:1px solid ${borderCol};padding:9px 12px;margin-bottom:7px;opacity:${locked?0.45:1}">
      <div style="font-family:Cinzel,serif;font-size:12px;color:#c9a227;margin-bottom:2px">${node.name}${node.isAbil?' <span style="font-size:9px;color:#7a6a9a">[Grants Ability]</span>':''}</div>
      <div style="font-size:10px;color:#6a5a7a;margin-bottom:4px;line-height:1.4">${node.desc}</div>
      <div style="font-size:9px;color:#8a6a3a;margin-bottom:4px">Cost: ${cost} skill pt${cost>1?'s':''} per rank &nbsp; Rank: ${pips} ${rank}/${maxrank}</div>
      ${!maxed&&!locked?`<button class="tree-btn" onclick="unlockNode('${path.name}','${node.name}',${ni})" ${(player.skillPts||0)<cost||player.spec!==path.name?'disabled':''}>${player.spec!==path.name?'Wrong path':'Unlock ('+cost+'pt)'}</button>`:''}
      ${maxed?'<span style="color:#c9a227;font-size:9px">✓ MAXED</span>':''}
      ${locked?'<span style="color:#3a3060;font-size:9px">🔒 Unlock previous first</span>':''}
    </div>`;
  });
  document.getElementById('tree-nodes').innerHTML=nodes;
}

window.selectPath=function(i){selectedPath=i;renderTree()};
window.unlockNode=function(pathName,nodeName,ni){
  if(player.spec!==pathName){addLog('You are on the '+player.spec+' path!',2);return}
  if(player.cdHalved){let cls2=CLASSES.find(cl=>cl.name===player.cls);let path2=cls2&&cls2.paths.find(p=>p.name===pathName);let node2=path2&&path2.nodes[ni];if(node2&&node2.isAbil){addLog('Chain of Fate: ability nodes are locked!',2);return}}
  let cls=CLASSES.find(c=>c.name===player.cls);if(!cls)return;
  let path=cls.paths.find(p=>p.name===pathName);if(!path)return;
  let node=path.nodes[ni];if(!node)return;
  let cost=node.costPer||1;
  if((player.skillPts||0)<cost){addLog('Not enough skill points!',2);return}
  let rank=getNodeRank(nodeName);if(rank>=(node.ranks||1)){addLog('Already maxed!',0);return}
  if(ni>0&&getNodeRank(path.nodes[ni-1].name)<1){addLog('Unlock previous node first!',2);return}
  player.skillPts-=cost;player.treeNodes[nodeName]=(player.treeNodes[nodeName]||0)+1;
  if(node.effect)node.effect(player,rank+1);
  if(node.isAbil&&rank===0){
    let ad={...node.abilDef,cd:0};
    if(!player.abilities.find(a=>a.name===ad.name)){
      player.abilities.push(ad);
      let keyNum=player.abilities.length;
      addLog('ABILITY UNLOCKED: '+ad.name+' — press ['+keyNum+'] to use!',8);
    }
  }
  addLog(nodeName+' rank '+(rank+1)+'!',3);updateUI();renderTree();
};

// ══ MERCHANT ══
function openMerch(){
  if(!G.merchant){addLog('No merchant on this floor.',2);return}
  if(player.x!==G.merchant.x||player.y!==G.merchant.y){addLog('Walk to the Merchant (M) first!',2);return}
  merchOpen=true;merchantSellSel.clear();document.getElementById('merch-overlay').classList.add('open');renderMerch();
}
function closeMerch(){merchOpen=false;document.getElementById('merch-overlay').classList.remove('open')}
window.closeMerch=closeMerch;

function renderMerch(){
  document.getElementById('merch-gold-val').textContent=player.gold;document.getElementById('merch-buy-gold').textContent='Gold: '+player.gold;
  let eq=player.eq||{};
  document.getElementById('merch-sell-list').innerHTML=player.inventory.map((it,i)=>{
    let sv=Math.floor(it.val*(0.5+(it.level||0)*0.2)),isSel=merchantSellSel.has(i);
    return `<div class="msell-entry${isSel?' msel':''}" onclick="toggleSellSel(${i})"><span class="msell-sym" style="color:${it.col}">${it.sym}</span><div class="msell-info"><div class="msell-name">${it.name}${(it.level||0)>0?' +'+(it.level):''}</div><div class="msell-price">${sv}g${Object.values(eq).includes(it)?' [E]':''}</div></div></div>`;
  }).join('')||'<div style="padding:10px;font-size:9px;color:#2a2040">No items</div>';
  let total=0;merchantSellSel.forEach(i=>{let it=player.inventory[i];if(it)total+=Math.floor(it.val*(0.5+(it.level||0)*0.2)*(1+(player.sellBonus||0)))});
  document.getElementById('merch-sel-count').textContent=merchantSellSel.size;
  document.getElementById('merch-sel-val').textContent=total;
  document.getElementById('merch-sell-btn').disabled=merchantSellSel.size===0;
  document.getElementById('merch-buy-list').innerHTML=merchantItems.map((it,i)=>{
    let canAfford=player.gold>=it.shopPrice,stats=[];
    if(it.atk)stats.push('ATK+'+it.atk);if(it.def)stats.push('DEF+'+it.def);if(it.heal)stats.push('Heal+'+it.heal);
    let rc2=RARE_COLORS[it.rare||0];
    return `<div class="mbuy-entry${!canAfford?' cant-afford':''}" onclick="buyItem(${i})"><span class="mbuy-sym" style="color:${it.col}">${it.sym}</span><div class="mbuy-info"><div class="mbuy-name"><span style="color:${rc2}">[${RARE_NAMES[it.rare||0][0]}]</span> ${it.name}</div><div class="mbuy-stats">${stats.join(' ')}</div></div><span class="mbuy-price${!canAfford?' cant':''}">${it.shopPrice}g</span></div>`;
  }).join('')||'<div style="padding:10px;font-size:9px;color:#2a2040">Sold out</div>';
}

window.toggleSellSel=function(i){if(merchantSellSel.has(i))merchantSellSel.delete(i);else if(merchantSellSel.size<8)merchantSellSel.add(i);renderMerch()};
window.doMerchSell=function(){
  let sorted=[...merchantSellSel].sort((a,b)=>b-a),total=0;
  sorted.forEach(i=>{let it=player.inventory[i];if(!it)return;total+=Math.floor(it.val*(0.5+(it.level||0)*0.2)*(1+(player.sellBonus||0)));Object.keys(player.eq).forEach(k=>{if(player.eq[k]===it)player.eq[k]=null});player.inventory.splice(i,1)});
  player.gold+=total;merchantSellSel.clear();addLog('Sold '+sorted.length+' items for '+total+'g!',3);selIdx=-1;updateUI();renderMerch();
};
window.buyItem=function(i){
  let it=merchantItems[i];if(!it)return;
  if(player.gold<it.shopPrice){addLog('Not enough gold!',2);return}
  if(it.type==='potion'&&(player.inventory||[]).filter(i=>i.type==='potion').length>=5){addLog('Potion bag full! (max 5)',0);return}
  if(it.type!=='potion'&&player.inventory.some(inv=>inv.name===it.name)){addLog('Already own '+it.name,0);return}
  player.gold-=it.shopPrice;let copy={...it};delete copy.shopPrice;player.inventory.push(copy);merchantItems.splice(i,1);
  addLog('Purchased: '+it.name+'!',8);updateUI();renderMerch();
};

// ══ INPUT ══
document.addEventListener('keydown',e=>{
  // Death-screen name entry captures keys before ANY other shortcut,
  // so typing a name can never open menus or restart the run.
  if(gameOver&&typeof lbHandleDeathKey==='function'&&lbHandleDeathKey(e)){e.preventDefault();return}
  if(classChooser){
    if((e.key==='c'||e.key==='C')&&hasSave()){if(loadGame())return;}
    let n=parseInt(e.key)-1;
    if(n>=0&&n<CLASSES.length)chooseClass(n);
    return;
  }
  if(specChooser){
    let cls=CLASSES.find(c=>c.name===player.cls);
    let n=parseInt(e.key)-1;
    if(cls&&n>=0&&n<cls.paths.length)chooseSpec(n);
    return;
  }
  if(e.key==='i'||e.key==='I'){if(merchOpen||treeOpen||relicOpen)return;invOpen?closeInv():openInv();return}
  if(e.key==='t'||e.key==='T'){if(invOpen||merchOpen||relicOpen)return;treeOpen?closeTree():openTree();return}
  if(invOpen){if(e.key==='Escape')closeInv();return}
  if(merchOpen){if(e.key==='Escape')closeMerch();return}
  if(treeOpen){if(e.key==='Escape')closeTree();return}
  if(relicOpen)return;
  if(gameOver){
    if(typeof lbHandleDeathKey==='function'&&lbHandleDeathKey(e))return;
    if(e.key==='r'||e.key==='R'){if(typeof lbReset==='function')lbReset();classChooser=true;specChooser=false;relicOpen=false;floor=1;turn=0;bossesKilled=0;totalKills=0;diffScale=1;bossFloor=false;bossActive=false;msgs=[];particles=[];anims=[];bossOrder=[];document.getElementById("relic-overlay").classList.remove("open");drawAll()}return}
  // Toggle first-person / top-down
  if(e.key==='f'||e.key==='F'){fpMode=!fpMode;if(fpMode&&player.angle===undefined)player.angle=faceToAngle(player.facing||1);if(!fpMode)maybeReleasePointerLock();addLog(fpMode?'First-person — mouse-look or ←/→ to turn, WASD to move/strafe, F to exit':'Top-down view',8);fov();updateUI();drawAll();return}
  if(e.key==='1')useAbility(0);if(e.key==='2')useAbility(1);if(e.key==='3')useAbility(2);if(e.key==='4')useAbility(3);
  if(e.key==='5')useAbility(4);if(e.key==='6')useAbility(5);if(e.key==='7')useAbility(6);if(e.key==='8')useAbility(7);
  if(e.key==='Enter'){nextFloor();return}

  // If stunned, any movement attempt simply passes the turn (which ticks the stun down)
  // — this prevents a permanent-stun lock where tryMove blocks and doTurn never runs.
  if((player.stun||0)>0){
    let isMove=['w','W','a','A','s','S','d','D','q','Q','e','E','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key);
    if(isMove){
      e.preventDefault();
      // In first-person, allow free turning (arrow keys only) even while stunned
      if(fpMode&&e.key==='ArrowLeft'){if(player.angle===undefined)player.angle=faceToAngle(player.facing||1);player.angle-=Math.PI/8;player.facing=angleToFace(player.angle);drawAll();return}
      if(fpMode&&e.key==='ArrowRight'){if(player.angle===undefined)player.angle=faceToAngle(player.facing||1);player.angle+=Math.PI/8;player.facing=angleToFace(player.angle);drawAll();return}
      doTurn(); // consume the turn; doTurn decrements player.stun
      return;
    }
  }

  if(fpMode){
    if(player.angle===undefined)player.angle=faceToAngle(player.facing||1);
    const ROT=Math.PI/8; // 22.5° per tap
    // Turning via arrow keys (mouse-look also turns); A/D now strafe instead
    if(e.key==='ArrowLeft'){player.angle-=ROT;player.facing=angleToFace(player.angle);e.preventDefault();drawAll();return}
    if(e.key==='ArrowRight'){player.angle+=ROT;player.facing=angleToFace(player.angle);e.preventDefault();drawAll();return}
    // Movement snaps to the cardinal tile nearest the view angle (keeps it grid/turn-based)
    let fc=FACINGS[angleToFace(player.angle)];               // forward cardinal
    let rc=FACINGS[(angleToFace(player.angle)+1)%4];          // right cardinal
    let mvx=0,mvy=0;
    if(e.key==='w'||e.key==='W'||e.key==='ArrowUp'){mvx=fc.dx;mvy=fc.dy}             // forward
    else if(e.key==='s'||e.key==='S'||e.key==='ArrowDown'){mvx=-fc.dx;mvy=-fc.dy}    // back
    else if(e.key==='a'||e.key==='A'||e.key==='q'||e.key==='Q'){mvx=-rc.dx;mvy=-rc.dy} // strafe left
    else if(e.key==='d'||e.key==='D'||e.key==='e'||e.key==='E'){mvx=rc.dx;mvy=rc.dy}   // strafe right
    if(mvx||mvy){e.preventDefault();let moved=tryMove(player,player.x+mvx,player.y+mvy);if(moved){fpStep=1;doTurn()}else drawAll()}
    return;
  }

  let dx=0,dy=0;
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')dx=-1;
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')dx=1;
  if(e.key==='ArrowUp'||e.key==='w'||e.key==='W')dy=-1;
  if(e.key==='ArrowDown'||e.key==='s'||e.key==='S')dy=1;
  if(dx||dy){e.preventDefault();let moved=tryMove(player,player.x+dx,player.y+dy);if(moved)doTurn()}
});

// ══ LOOP ══
function tick(){
  animT+=0.03;flickerT++;
  if(typeof maybeReleasePointerLock==='function')maybeReleasePointerLock();
  tickFloatNums();
  tickShake();
  if(hitFlash>0)hitFlash=Math.max(0,hitFlash-0.06);
  if(fpSwing>0)fpSwing=Math.max(0,fpSwing-0.09);
  if(fpStep>0)fpStep=Math.max(0,fpStep-0.12);
  if(classChooser||specChooser){
    // Animate title/spec screen continuously
    titleT+=0.02;
    if(flickerT%2===0)drawAll();
  } else if(!invOpen&&!merchOpen&&!treeOpen){
    if(flickerT%2===0||bossActive||hitFlash>0)drawAll();
  }
  requestAnimationFrame(tick);
}
tick();drawAll();
