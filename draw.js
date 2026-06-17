// ── MAIN DRAW FUNCTIONS ──
// ══════════════════════════════════════════════════
// FIRST-PERSON RAYCASTER — Doom-style view, turn-based brain.
// Smooth textured walls + billboarded sprites. Movement still snaps
// to grid tiles via tryMove/doTurn, so all game logic is untouched.
// ══════════════════════════════════════════════════
const FOV=Math.PI/3;            // 60° field of view
function fpExplored(wx,wy){return inB(wx,wy)&&G.exp[wy]&&G.exp[wy][wx]}
function fpVisible(wx,wy){return inB(wx,wy)&&G.vis[wy]&&G.vis[wy][wx]}
function faceToAngle(f){return [ -Math.PI/2, 0, Math.PI/2, Math.PI ][f]; }
function angleToFace(a){
  // nearest cardinal → N/E/S/W index (atan2: 0=E, +PI/2=S(down), PI=W, -PI/2=N(up))
  let deg=((a*180/Math.PI)%360+360)%360;
  if(deg>=315||deg<45)return 1;   // E
  if(deg<135)return 2;            // S
  if(deg<225)return 3;            // W
  return 0;                       // N
}

let _zbuf=null; // per-column wall distance, for sprite occlusion
let _zbufCols=null, _fpBuf=null, _fpCanvas=null, _fpCtx=null; // raycaster pixel buffer
// Procedural brick brightness at wall coord (u,v) in 0..1 — returns multiplier ~0.4..1.15
function brickTex(u,v,seed){
  let course=Math.floor(v*5);                 // 5 brick rows up the wall
  let off=(course%2)*0.5;                      // alternate courses offset
  let bu=(u*3+off);                            // 3 bricks wide per tile
  let bx=bu-Math.floor(bu);
  let by=(v*5)-course;
  let m=1;
  // mortar gaps
  if(bx<0.07||bx>0.93)m*=0.45;
  if(by<0.10||by>0.90)m*=0.5;
  // per-brick tint variation (stable hash)
  let h=Math.sin((Math.floor(bu)*12.9898+course*78.233+seed))*43758.5453;
  h=h-Math.floor(h);
  m*=0.82+h*0.32;
  // top-left highlight, bottom-right shadow on each brick
  if(bx<0.18&&by<0.22)m*=1.18;
  if(bx>0.82||by>0.82)m*=0.8;
  // occasional crack
  if(h>0.93&&bx>0.3&&bx<0.7)m*=0.5;
  return m;
}
// ══ ZONE TEXTURE ATLASES ══
// 64×64 pixel-art textures per zone (wall/floor/ceil), generated once and
// sampled per-pixel by the raycaster. Far richer than procedural math,
// with near-zero runtime cost.
const TEXS=64;
let _fpTexCache={};
function getZoneTextures(){
  let tier=Math.ceil(floor/5); if(tier<1)tier=1; if(tier>5)tier=5;
  if(_fpTexCache[tier])return _fpTexCache[tier];
  let fp=getFloorTheme().fp;
  let s=tier*987131+17;
  function rnd01(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}
  function make(){return new Uint8ClampedArray(TEXS*TEXS*3);}
  function setpx(a,x,y,r,g,b){let o=(((y%TEXS+TEXS)%TEXS)*TEXS+((x%TEXS+TEXS)%TEXS))*3;a[o]=r;a[o+1]=g;a[o+2]=b;}
  function getpx(a,x,y){let o=(((y%TEXS+TEXS)%TEXS)*TEXS+((x%TEXS+TEXS)%TEXS))*3;return[a[o],a[o+1],a[o+2]];}
  function scalepx(a,x,y,f){let o=(((y%TEXS+TEXS)%TEXS)*TEXS+((x%TEXS+TEXS)%TEXS))*3;a[o]=Math.min(255,a[o]*f);a[o+1]=Math.min(255,a[o+1]*f);a[o+2]=Math.min(255,a[o+2]*f);}

  // ── WALL: brick courses with bevels, jitter, noise, cracks, zone accents ──
  let wall=make();
  let [wr,wg,wb]=fp.wall;
  let COURSES=4, BW=TEXS/2, BH=TEXS/COURSES;   // 2 bricks per row, 4 courses
  for(let y=0;y<TEXS;y++){
    let course=(y/BH)|0, by=y-course*BH;
    let off=(course%2)?BW/2:0;
    for(let x=0;x<TEXS;x++){
      let bx=(x+off)%BW;
      let brickId=course*7+(((x+off)/BW)|0);
      // stable per-brick brightness
      let h=Math.sin(brickId*127.1+tier*311.7)*43758.5453;h-=Math.floor(h);
      let base=0.82+h*0.3;
      let isMortar=(bx<2||bx>BW-3||by<2||by>BH-3);
      if(isMortar){
        let n=0.8+rnd01()*0.4;
        setpx(wall,x,y,fp.mortar[0]*n,fp.mortar[1]*n,fp.mortar[2]*n);
      }else{
        let f=base;
        // bevel: light top-left, dark bottom-right
        if(bx<5||by<5)f*=1.16;
        if(bx>BW-7||by>BH-7)f*=0.82;
        // speckle
        f*=0.93+rnd01()*0.14;
        setpx(wall,x,y,wr*f,wg*f,wb*f);
      }
    }
  }
  // cracks: random downward walks, darkened (glowing for ember zones)
  let nCracks=3+((rnd01()*3)|0);
  for(let c=0;c<nCracks;c++){
    let cx=(rnd01()*TEXS)|0, cy=(rnd01()*TEXS*0.4)|0, len=14+((rnd01()*22)|0);
    for(let i=0;i<len;i++){
      if(fp.ember&&rnd01()<0.5){let glow=fp.hi;setpx(wall,cx,cy,Math.min(255,glow[0]*1.35),glow[1]*0.8,glow[2]*0.4);}
      else scalepx(wall,cx,cy,0.45);
      if(rnd01()<0.6)scalepx(wall,cx+1,cy,0.6);
      cy++; cx+=(rnd01()<0.5?-1:1)*((rnd01()<0.4)?1:0);
    }
  }
  // moss patches (fungal)
  if(fp.moss){
    for(let p=0;p<6;p++){
      let mx=(rnd01()*TEXS)|0,my=(rnd01()*TEXS)|0,rad=2+((rnd01()*4)|0);
      for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
        if(dx*dx+dy*dy>rad*rad||rnd01()<0.35)continue;
        let f=0.7+rnd01()*0.5;
        setpx(wall,mx+dx,my+dy,fp.moss[0]*f*0.55,fp.moss[1]*f*0.75,fp.moss[2]*f*0.5);
      }
    }
  }
  // glowing runes (void)
  if(tier===5){
    for(let rGlyph=0;rGlyph<3;rGlyph++){
      let gx=6+((rnd01()*(TEXS-12))|0), gy=6+((rnd01()*(TEXS-14))|0);
      let strokes=[[0,0,0,4],[0,2,2,2],[2,0,2,4]]; // simple glyph
      strokes.forEach(([x0,y0,x1,y1])=>{
        let steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));
        for(let i=0;i<=steps;i++){
          let xx=gx+Math.round(x0+(x1-x0)*i/steps), yy=gy+Math.round(y0+(y1-y0)*i/steps);
          setpx(wall,xx,yy,200,90,235);
        }
      });
    }
  }

  // ── FLOOR: 2×2 flagstones with bevels, jitter, pebbles ──
  let floorT=make();
  let FS=TEXS/2;
  for(let y=0;y<TEXS;y++){
    let sy=(y/FS)|0, fy=y-sy*FS;
    for(let x=0;x<TEXS;x++){
      let sxs=(x/FS)|0, fx=x-sxs*FS;
      let stoneId=sy*2+sxs;
      let h=Math.sin(stoneId*61.3+tier*97.7)*43758.5453;h-=Math.floor(h);
      let base=0.84+h*0.26;
      let isGrout=(fx<2||fx>FS-3||fy<2||fy>FS-3);
      if(isGrout){
        let n=0.7+rnd01()*0.3;
        setpx(floorT,x,y,fp.floor2[0]*0.5*n,fp.floor2[1]*0.5*n,fp.floor2[2]*0.5*n);
      }else{
        let f=base;
        if(fx<4||fy<4)f*=1.12;
        if(fx>FS-6||fy>FS-6)f*=0.85;
        f*=0.93+rnd01()*0.14;
        setpx(floorT,x,y,fp.floor[0]*f,fp.floor[1]*f,fp.floor[2]*f);
      }
    }
  }
  // pebbles / debris
  for(let p=0;p<10;p++){
    let pxx=(rnd01()*TEXS)|0,pyy=(rnd01()*TEXS)|0;
    scalepx(floorT,pxx,pyy,0.55);scalepx(floorT,pxx+1,pyy,0.7);
  }
  if(fp.moss){for(let p=0;p<8;p++){let mx2=(rnd01()*TEXS)|0,my2=(rnd01()*TEXS)|0;setpx(floorT,mx2,my2,fp.moss[0]*0.45,fp.moss[1]*0.6,fp.moss[2]*0.4);}}

  // ── CEILING: rough stone, stains ──
  let ceilT=make();
  for(let y=0;y<TEXS;y++)for(let x=0;x<TEXS;x++){
    let f=0.85+rnd01()*0.3;
    setpx(ceilT,x,y,fp.ceil[0]*f,fp.ceil[1]*f,fp.ceil[2]*f);
  }
  for(let st=0;st<5;st++){
    let sx2=(rnd01()*TEXS)|0,sy2=(rnd01()*TEXS)|0,len=4+((rnd01()*10)|0);
    for(let i=0;i<len;i++){scalepx(ceilT,sx2,sy2+i,0.6);if(rnd01()<0.4)scalepx(ceilT,sx2+1,sy2+i,0.75);}
  }
  if(fp.ember){for(let e2=0;e2<6;e2++){let ex=(rnd01()*TEXS)|0,ey=(rnd01()*TEXS)|0;setpx(ceilT,ex,ey,180,70,25);}}

  _fpTexCache[tier]={wall,floor:floorT,ceil:ceilT};
  return _fpTexCache[tier];
}

// ── First-person textures from the 0x72 sheet ──
// Samples the same wall/floor tiles the top-down view uses, upscaled to the
// raycaster's 64x64 RGB format and tinted toward each zone's palette so the
// zones keep their colour identity. Falls back to the procedural textures
// above if the sheet isn't loaded. Cached per zone tier.
let _fpSheetTexCache={};
function _sampleTileRGB(name){
  // returns a 64x64x3 Uint8ClampedArray from a 16x16 sheet tile, or null
  let s=SPR[name]; if(!s||!sheetReady)return null;
  let tc=document.createElement('canvas');tc.width=s[2];tc.height=s[3];
  let tx=tc.getContext('2d');tx.imageSmoothingEnabled=false;
  tx.drawImage(SHEET,s[0],s[1],s[2],s[3],0,0,s[2],s[3]);
  let src;try{src=tx.getImageData(0,0,s[2],s[3]).data}catch(e){return null}
  let out=new Uint8ClampedArray(TEXS*TEXS*3);
  let sw=s[2],sh=s[3];
  for(let y=0;y<TEXS;y++)for(let x=0;x<TEXS;x++){
    let sx=(x*sw/TEXS)|0, sy=(y*sh/TEXS)|0;
    let si=(sy*sw+sx)*4, a=src[si+3];
    let r=src[si],g=src[si+1],b=src[si+2];
    if(a<128){r=20;g=18;b=26;}
    let o=(y*TEXS+x)*3; out[o]=r;out[o+1]=g;out[o+2]=b;
  }
  return out;
}
function _tintToward(arr,col,amt){
  // shift every pixel a fraction (amt 0..1) toward col [r,g,b], preserving
  // the tile's own light/dark structure so detail survives the recolour.
  for(let i=0;i<arr.length;i+=3){
    arr[i]  =arr[i]  +(col[0]-arr[i]  )*amt;
    arr[i+1]=arr[i+1]+(col[1]-arr[i+1])*amt;
    arr[i+2]=arr[i+2]+(col[2]-arr[i+2])*amt;
  }
  return arr;
}
function getSheetTextures(tier,fp){
  if(_fpSheetTexCache[tier])return _fpSheetTexCache[tier];
  let wallName = fp.moss ? 'wall_goo' : 'wall_mid';     // ooze walls in the fungal zone
  let floorName= tier>=3 ? 'floor_4' : 'floor_1';        // slightly rougher floor deeper down
  let wall=_sampleTileRGB(wallName);
  let floor=_sampleTileRGB(floorName);
  if(!wall||!floor)return null;                          // sheet not ready → caller falls back
  // Tint toward the zone palette. Dungeon (tier 1) keeps the art almost raw;
  // deeper zones tint harder so the colour identity reads clearly.
  let wAmt=tier===1?0.10:0.34, fAmt=tier===1?0.10:0.30;
  _tintToward(wall, fp.wall, wAmt);
  _tintToward(floor, fp.floor, fAmt);
  // Ceiling: the pack has no ceiling tile, so derive a darkened wall.
  let ceil=new Uint8ClampedArray(wall.length);
  for(let i=0;i<wall.length;i+=3){
    ceil[i]  =Math.min(255, wall[i]  *0.42 + fp.ceil[0]*0.5);
    ceil[i+1]=Math.min(255, wall[i+1]*0.42 + fp.ceil[1]*0.5);
    ceil[i+2]=Math.min(255, wall[i+2]*0.42 + fp.ceil[2]*0.5);
  }
  _fpSheetTexCache[tier]={wall,floor,ceil};
  return _fpSheetTexCache[tier];
}

function drawFP(){
  let W=canvas.width,H=canvas.height;
  let theme=getFloorTheme();
  let fp=theme.fp;
  if(player.angle===undefined)player.angle=faceToAngle(player.facing||1);
  let ang=player.angle;
  let px=player.x+0.5, py=player.y+0.5;

  // ── Render floor, ceiling and walls into a low-res ImageData buffer (fast) ──
  let halfTan=Math.tan(FOV/2);
  const DS=2;                              // downsample factor (internal res = canvas/DS)
  let RW=Math.ceil(W/DS), RH=Math.ceil(H/DS);
  if(!_fpBuf||_fpBuf.width!==RW||_fpBuf.height!==RH){
    _fpBuf=ctx.createImageData(RW,RH);
    _fpCanvas=document.createElement('canvas');_fpCanvas.width=RW;_fpCanvas.height=RH;
    _fpCtx=_fpCanvas.getContext('2d');
  }
  let buf=_fpBuf.data;
  let horizonR=RH/2;
  let pxc=px, pyc=py;
  let TEX=getZoneTextures();
  let _tier=Math.ceil(floor/5); if(_tier<1)_tier=1; if(_tier>5)_tier=5;
  let _sheetTex=getSheetTextures(_tier, getFloorTheme().fp);
  if(_sheetTex)TEX=_sheetTex;        // use real pack art when the sheet is loaded
  let TXW=TEX.wall, TXF=TEX.floor, TXC=TEX.ceil;

  // precompute left/right ray directions
  let dirL_x=Math.cos(ang-FOV/2), dirL_y=Math.sin(ang-FOV/2);
  let dirR_x=Math.cos(ang+FOV/2), dirR_y=Math.sin(ang+FOV/2);

  // zbuf at column resolution
  if(!_zbuf||_zbuf.length!==RW)_zbuf=new Float32Array(RW);

  // 1) FLOOR + CEILING (per internal row, texture-sampled)
  for(let y=0;y<RH;y++){
    let isFloor=y>horizonR;
    let p=isFloor?(y-horizonR):(horizonR-y);
    if(p<1)p=1;
    let rowDist=(RH/2)/p;
    let fogF=Math.max(0.05,1-rowDist/9);
    let wxL=pxc+dirL_x*rowDist, wyL=pyc+dirL_y*rowDist;
    let wxR=pxc+dirR_x*rowDist, wyR=pyc+dirR_y*rowDist;
    let stepX=(wxR-wxL)/RW, stepY=(wyR-wyL)/RW;
    let wx=wxL, wy=wyL;
    let rowOff=y*RW*4;
    let lastTX=-99999, lastTY=-99999, sh=0, tl=0, parity=1;
    let tex=isFloor?TXF:TXC;
    for(let x=0;x<RW;x++){
      let tileX=wx<0?(wx|0)-1:(wx|0), tileY=wy<0?(wy|0)-1:(wy|0);
      if(tileX!==lastTX||tileY!==lastTY){
        lastTX=tileX;lastTY=tileY;
        let seen=fpVisible(tileX,tileY);
        sh=fogF*(seen?1:0.4);
        tl=seen?torchLightAt(tileX,tileY):0;
        parity=((tileX+tileY)&1)?0.88:1.0;       // subtle tile alternation
      }
      let fu=wx-tileX; if(fu<0)fu+=1;
      let fv=wy-tileY; if(fv<0)fv+=1;
      let to=(((fv*TEXS)|0)*TEXS+((fu*TEXS)|0))*3;
      let shp=sh*parity;
      let r=tex[to]*shp + tl*(isFloor?70:24);
      let g=tex[to+1]*shp + tl*(isFloor?38:12);
      let b=tex[to+2]*shp;
      let o=rowOff+x*4;
      buf[o]=r>255?255:r; buf[o+1]=g>255?255:g; buf[o+2]=b>255?255:b; buf[o+3]=255;
      wx+=stepX; wy+=stepY;
    }
  }

  // 2) WALLS (one ray per internal column)
  let baseR=fp.wall[0],baseG=fp.wall[1],baseB=fp.wall[2];
  let mR=fp.mortar[0],mG=fp.mortar[1],mB=fp.mortar[2];
  for(let x=0;x<RW;x++){
    let camX=2*x/RW-1;
    let rayAng=ang+Math.atan(camX*halfTan);
    let cosA=Math.cos(rayAng), sinA=Math.sin(rayAng);
    let mapX=Math.floor(pxc), mapY=Math.floor(pyc);
    let deltaX=Math.abs(1/(cosA||1e-9)), deltaY=Math.abs(1/(sinA||1e-9));
    let stepX,stepY,sideDistX,sideDistY;
    if(cosA<0){stepX=-1;sideDistX=(pxc-mapX)*deltaX}else{stepX=1;sideDistX=(mapX+1-pxc)*deltaX}
    if(sinA<0){stepY=-1;sideDistY=(pyc-mapY)*deltaY}else{stepY=1;sideDistY=(mapY+1-pyc)*deltaY}
    let hit=false,side=0,dist=24,guard=0;
    while(!hit&&guard++<80){
      if(sideDistX<sideDistY){sideDistX+=deltaX;mapX+=stepX;side=0}
      else{sideDistY+=deltaY;mapY+=stepY;side=1}
      if(!inB(mapX,mapY)){dist=(side===0)?(sideDistX-deltaX):(sideDistY-deltaY);hit=true;break}
      let t=G.tiles[mapY]&&G.tiles[mapY][mapX];
      if(t===undefined||t==='#'){hit=true;dist=(side===0)?(sideDistX-deltaX):(sideDistY-deltaY);}
    }
    if(dist<=0.01)dist=0.01;
    let corrected=dist*Math.cos(rayAng-ang);
    if(corrected<0.05)corrected=0.05;
    _zbuf[x]=dist;
    let lineH=Math.min(RH*4,RH/corrected);
    let top=Math.floor(horizonR-lineH/2), bot=Math.floor(horizonR+lineH/2);
    let vis=fpVisible(mapX,mapY);
    let light=Math.max(0.05,1-corrected/9)*(vis?1:0.42);
    if(side===1)light*=0.74;
    let tl=vis?torchLightAt(mapX,mapY):0;
    let wallU=(side===0)?(pyc+dist*sinA):(pxc+dist*cosA);
    wallU-=Math.floor(wallU);
    let tileSeed=((mapX*73856093)^(mapY*19349663))%1000;
    let tileJit=0.88+((tileSeed%97)/97)*0.24;     // per-tile brightness variation
    let y0=top<0?0:top, y1=bot>RH?RH:bot;
    let txCol=(wallU*TEXS)|0;
    let lightJ=light*tileJit;
    let warmW=tl*0.95;
    for(let y=y0;y<y1;y++){
      let v=(y-top)/lineH;
      let to=(((v*TEXS)|0)*TEXS+txCol)*3;
      let r=TXW[to]*lightJ, g=TXW[to+1]*lightJ, b=TXW[to+2]*lightJ;
      if(warmW>0){r=r+(255-r)*0.45*warmW+50*warmW;g=g+(150-g)*0.35*warmW+24*warmW;b=b*(1-0.25*warmW);}
      let o=(y*RW+x)*4;
      buf[o]=r>255?255:r; buf[o+1]=g>255?255:g; buf[o+2]=b>255?255:b; buf[o+3]=255;
    }
  }

  // blit buffer scaled up to the canvas
  _fpCtx.putImageData(_fpBuf,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(_fpCanvas,0,0,RW,RH,0,0,W,H);

  // expand zbuf (RW) to the COLW-column space used by sprite occlusion
  const COLW=2;
  let numCols=Math.ceil(W/COLW);
  let projPlane=(W/2)/halfTan;
  // sprite code samples _zbufCols[col]; build it from _zbuf
  if(!_zbufCols||_zbufCols.length!==numCols)_zbufCols=new Float32Array(numCols);
  for(let c=0;c<numCols;c++){let rx=Math.min(RW-1,Math.floor(c*COLW/DS));_zbufCols[c]=_zbuf[rx];}

  drawFPSprites(px,py,ang,projPlane,W,H,COLW,numCols);

  let vg=ctx.createRadialGradient(W/2,H/2,H*0.30,W/2,H/2,H*0.95);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.5)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  drawFPWeapon(W,H);
  drawFPHud(W,H);
  drawFPRadar(W,H,px,py,ang);
}

function drawFPSprites(px,py,ang,projPlane,W,H,COLW,numCols){
  let list=[];
  let add=(wx,wy,kind,ref)=>{
    let cx=wx+0.5, cy=wy+0.5, dx=cx-px, dy=cy-py;
    let dist=Math.hypot(dx,dy); if(dist<0.15)return;
    let rel=Math.atan2(dy,dx)-ang;
    while(rel<-Math.PI)rel+=2*Math.PI; while(rel>Math.PI)rel-=2*Math.PI;
    if(Math.abs(rel)>FOV/2+0.4)return;
    let screenX=W/2 + Math.tan(rel)*projPlane;
    list.push({screenX,dist,rel,kind,ref,wx,wy});
  };
  items.forEach(it=>{if(fpVisible(it.x,it.y))add(it.x,it.y,'item',it)});
  for(let y=0;y<rows();y++)for(let x=0;x<cols();x++){
    if(!fpVisible(x,y))continue;
    if(G.tiles[y]&&G.tiles[y][x]==='>')add(x,y,'stair');
    let hz=(typeof hazardAt==='function')?hazardAt(x,y):null;
    if(hz&&(hz.type==='fire'||hz.sprung))add(x,y,'hazard',hz);
  }
  if(G.merchant&&fpVisible(G.merchant.x,G.merchant.y))add(G.merchant.x,G.merchant.y,'merchant');
  monsters.forEach(m=>{if(m.hp>0&&!m._dead&&fpVisible(m.x,m.y))add(m.x,m.y,'mon',m)});
  // Wall torches — billboard sits on the wall face, nudged toward the lit floor tile
  (G.torches||[]).forEach(t=>{
    if(!fpVisible(t.fx,t.fy))return;            // only if the floor it lights is seen
    let wx=t.x+ (t.fx-t.x)*0.42, wy=t.y+ (t.fy-t.y)*0.42; // pull off the wall toward floor
    let cx=wx+0.5, cy=wy+0.5, dx=cx-px, dy=cy-py;
    let dist=Math.hypot(dx,dy); if(dist<0.15)return;
    let rel=Math.atan2(dy,dx)-ang;
    while(rel<-Math.PI)rel+=2*Math.PI; while(rel>Math.PI)rel-=2*Math.PI;
    if(Math.abs(rel)>FOV/2+0.4)return;
    let screenX=W/2 + Math.tan(rel)*projPlane;
    list.push({screenX,dist,rel,kind:'torch',ref:t,wx,wy});
  });

  list.sort((a,b)=>b.dist-a.dist);
  list.forEach(o=>{
    let corrected=o.dist*Math.cos(o.rel); if(corrected<0.1)return;
    let dShade=Math.max(0.18,1-corrected/9);
    let projH=Math.min(H*2, H/corrected);
    let col=Math.floor(o.screenX/COLW);
    let occluded=(col>=0&&col<numCols&&_zbufCols&&_zbufCols[col]<o.dist-0.35);
    let baseY=H/2+projH/2;
    if(o.kind==='item'){
      if(occluded)return; let sz=Math.max(3,Math.min(28,projH*0.12));
      let iy=baseY-sz; // sits on the floor
      ctx.globalAlpha=dShade;ctx.fillStyle=(o.ref&&RARE_COLORS[o.ref.rare||0])||'#d8c070';
      ctx.fillRect(o.screenX-sz/2,iy,sz,sz);
      ctx.globalAlpha=dShade*0.6;ctx.fillStyle='#fff4c0';ctx.fillRect(o.screenX-sz/4,iy+sz*0.15,sz/2,sz/2);
      ctx.globalAlpha=1;return;
    }
    if(o.kind==='hazard'){
      let sz=Math.max(6,projH*0.5);
      if(o.ref.type==='fire'){
        let f=0.6+Math.sin(animT*6+o.wx)*0.3;
        let g=ctx.createLinearGradient(0,baseY-sz*0.6,0,baseY);
        g.addColorStop(0,`rgba(255,180,60,${0.5*dShade*f})`);g.addColorStop(1,`rgba(200,60,20,${0.3*dShade})`);
        ctx.fillStyle=g;ctx.fillRect(o.screenX-sz/2,baseY-sz*0.5,sz,sz*0.5);
      } else {
        ctx.fillStyle=`rgba(150,160,170,${0.8*dShade})`;
        for(let i=0;i<4;i++){let sxp=o.screenX-sz/2+i*(sz/4);ctx.beginPath();ctx.moveTo(sxp,baseY);ctx.lineTo(sxp+sz/8,baseY-sz*0.4);ctx.lineTo(sxp+sz/4,baseY);ctx.closePath();ctx.fill();}
      }
      return;
    }
    if(o.kind==='stair'){
      let sz=Math.max(8,projH*0.6);
      let g=ctx.createLinearGradient(0,baseY-sz,0,baseY);
      g.addColorStop(0,'rgba(170,110,255,0.0)');g.addColorStop(1,`rgba(150,80,230,${0.55*dShade})`);
      ctx.fillStyle=g;ctx.fillRect(o.screenX-sz*0.45,baseY-sz*0.55,sz*0.9,sz*0.55);
      ctx.fillStyle=`rgba(210,170,255,${0.8*dShade})`;ctx.textAlign='center';ctx.textBaseline='bottom';
      ctx.font=`bold ${Math.floor(sz*0.4)}px Cinzel,serif`;ctx.fillText('▼',o.screenX,baseY);
      return;
    }
    if(o.kind==='torch'){
      // mounted on the wall — allow drawing right up against it
      if(col>=0&&col<numCols&&_zbufCols&&_zbufCols[col]<o.dist-0.7)return;
      let f=0.78+Math.sin(animT*9+o.ref.phase)*0.12+Math.cos(animT*6.3+o.ref.phase)*0.10;
      // size is a fixed fraction of the wall height at this distance (perspective only)
      let wallH=Math.min(H*4, H/Math.max(0.05,o.dist*Math.cos(o.rel)));
      let unit=wallH*0.085;                 // one "torch unit"
      let mountY=H/2 - wallH*0.16;     // sit in the upper third of the wall
      let sx=o.screenX;
      // soft warm glow on the wall behind it
      let gr=ctx.createRadialGradient(sx,mountY,1,sx,mountY,unit*5);
      gr.addColorStop(0,`rgba(255,180,90,${0.40*f*dShade})`);
      gr.addColorStop(0.5,`rgba(230,120,45,${0.16*f*dShade})`);
      gr.addColorStop(1,'rgba(120,50,20,0)');
      ctx.fillStyle=gr;ctx.fillRect(sx-unit*5,mountY-unit*5,unit*10,unit*10);
      // iron bracket: wall plate + diagonal arm + cup
      ctx.fillStyle=`rgba(38,30,22,${0.95*Math.max(0.4,dShade)})`;
      ctx.fillRect(sx-unit*0.30, mountY-unit*0.2, unit*0.6, unit*2.2);  // post
      ctx.fillRect(sx-unit*0.55, mountY+unit*1.9, unit*1.1, unit*0.4);  // cup base
      // flame — stacked teardrops, fixed proportions
      let fh=unit*(2.4+Math.sin(animT*11+o.ref.phase)*0.25);
      let fb=mountY+unit*0.4; // flame bottom
      ctx.fillStyle=`rgba(210,60,15,${0.85*dShade})`;
      ctx.beginPath();ctx.moveTo(sx,fb-fh);ctx.quadraticCurveTo(sx+unit*0.9,fb-fh*0.4,sx,fb);ctx.quadraticCurveTo(sx-unit*0.9,fb-fh*0.4,sx,fb-fh);ctx.fill();
      ctx.fillStyle=`rgba(255,150,40,${0.92*dShade})`;
      ctx.beginPath();ctx.moveTo(sx,fb-fh*0.85);ctx.quadraticCurveTo(sx+unit*0.6,fb-fh*0.35,sx,fb-unit*0.1);ctx.quadraticCurveTo(sx-unit*0.6,fb-fh*0.35,sx,fb-fh*0.85);ctx.fill();
      ctx.fillStyle=`rgba(255,235,150,${0.95*dShade})`;
      ctx.beginPath();ctx.moveTo(sx,fb-fh*0.6);ctx.quadraticCurveTo(sx+unit*0.28,fb-fh*0.28,sx,fb-unit*0.15);ctx.quadraticCurveTo(sx-unit*0.28,fb-fh*0.28,sx,fb-fh*0.6);ctx.fill();
      return;
    }
    if(occluded)return;
    let cv = o.kind==='merchant' ? spriteToCanvas('merchant')
            : spriteToCanvas(o.ref.isBoss?('B:'+o.ref.name):o.ref.sym, o.ref);
    let m=o.kind==='mon'?o.ref:null;
    let scale=(m&&m.isBoss)?1.5:1;
    drawFPSpriteImg(cv,o.screenX,baseY,projH*0.82*scale,dShade,m);
  });
}

let _fpSpriteCache={};
function spriteToCanvas(key,m){
  if(_fpSpriteCache[key])return _fpSpriteCache[key];
  // 0x72 sheet crop for regular monsters (matches the top-down art)
  if(sheetReady&&key!=='merchant'&&!key.startsWith('B:')){
    let nm=MON_SHEET[key];
    if(nm&&SPR[nm]){
      let s=SPR[nm];
      let cv=document.createElement('canvas');cv.width=s[2];cv.height=s[3];
      cv.getContext('2d').drawImage(SHEET,s[0],s[1],s[2],s[3],0,0,s[2],s[3]);
      _fpSpriteCache[key]=cv;return cv;
    }
  }
  let map,pal;
  if(key==='merchant'){
    let cv=document.createElement('canvas');cv.width=16;cv.height=18;
    let o=cv.getContext('2d');
    o.fillStyle='#5a3410';o.fillRect(4,7,10,11);
    o.fillStyle='#7a4c16';o.fillRect(5,6,8,3);
    o.fillStyle='#b8862a';o.fillRect(5,11,8,1);
    o.fillStyle='#caa468';o.fillRect(6,2,6,6);
    o.fillStyle='#9a7848';o.fillRect(6,7,6,2);
    o.fillStyle='#241406';o.fillRect(4,1,10,2);
    o.fillStyle='#f0e860';o.fillRect(7,4,1,1);o.fillRect(10,4,1,1);
    o.fillStyle='#2a1a08';o.fillRect(13,8,3,4);
    o.fillStyle='#ffd25a';o.fillRect(14,9,1,2);
    _fpSpriteCache[key]=cv;return cv;
  }
  if(key.startsWith('B:')){
    let n=key.slice(2);
    // Prefer the CC0 sheet boss art in first-person too
    let bnm=BOSS_SHEET[n];
    if(bnm&&sheetReady&&SPR[bnm]){
      let s=SPR[bnm];
      let cv=document.createElement('canvas');cv.width=s[2];cv.height=s[3];
      cv.getContext('2d').drawImage(SHEET,s[0],s[1],s[2],s[3],0,0,s[2],s[3]);
      _fpSpriteCache[key]=cv;return cv;
    }
    let sp=BOSS_SPRITES[n];if(sp){map=sp.map;pal=sp.pal}
  }
  if(!map){let sp=MONSTER_SPRITES[key]||(m&&MONSTER_SPRITES[m.sym]);if(sp){map=sp.map;pal=sp.pal}}
  if(!map){map=GENERIC_MON_SPRITE;pal={1:(m&&m.col)||'#aaa',2:(m&&m.col)||'#888',3:'#ccc',4:'#fff',5:'#f44',6:'#666',7:'#fa6'}}
  let colsN=map[0].length, rowsN=map.length;
  let cv=document.createElement('canvas');cv.width=colsN;cv.height=rowsN;
  let octx=cv.getContext('2d');
  for(let r=0;r<rowsN;r++)for(let cI=0;cI<map[r].length;cI++){let p=map[r][cI];if(!p)continue;octx.fillStyle=pal[p]||'#fff';octx.fillRect(cI,r,1,1)}
  _fpSpriteCache[key]=cv;return cv;
}

function drawFPSpriteImg(cv,screenX,baseY,size,dShade,m){
  if(!cv)return;
  let aspect=cv.height/cv.width;
  let w=size*0.9, h=w*aspect, x=screenX-w/2, y=baseY-h;
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle=`rgba(0,0,0,${0.4*dShade})`;
  ctx.beginPath();ctx.ellipse(screenX,baseY,w*0.4,h*0.05,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=Math.max(0.3,dShade);
  ctx.drawImage(cv,x,y,w,h);
  ctx.globalAlpha=1;
  if(m){
    if(m.elite){ctx.strokeStyle=(m.eliteCol||'#fff');ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);}
    if(m.isBoss){
      ctx.fillStyle='rgba(0,0,0,0.7)';let nw=m.name.length*5.5;
      ctx.fillRect(screenX-nw/2-3,y-13,nw+6,11);
      ctx.fillStyle=m.col;ctx.font='bold 8px "Share Tech Mono"';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(m.name,screenX,y-7);
    }
    let hpP=Math.max(0,m.hp/m.mhp);
    ctx.fillStyle='#1a0a0a';ctx.fillRect(screenX-w*0.45,baseY+2,w*0.9,3);
    ctx.fillStyle=hpP>0.6?'#22aa22':hpP>0.3?'#aaaa22':'#cc2222';
    ctx.fillRect(screenX-w*0.45,baseY+2,w*0.9*hpP,3);
    if(!m.isMinion&&m.stun<=0&&Math.abs(m.x-player.x)<=1&&Math.abs(m.y-player.y)<=1){
      let pulse=0.5+Math.sin(animT*6)*0.5;
      ctx.fillStyle=`rgba(255,60,60,${0.55+pulse*0.4})`;ctx.font='bold 11px "Share Tech Mono"';ctx.textAlign='center';
      ctx.fillText('!',screenX,y-15);
    }
  }
}

function drawFPRadar(W,H,px,py,ang){
  let R=58;                        // radar radius (px)
  let cx=W-R-16, cy=H-R-16;        // bottom-right
  let range=9;                     // tiles shown from centre
  let scale=R/range;
  // rotate so the player's facing points UP on the radar
  let rot=-ang-Math.PI/2;
  let cosR=Math.cos(rot), sinR=Math.sin(rot);
  function toRadar(wx,wy){
    let dx=(wx+0.5)-px, dy=(wy+0.5)-py;
    let rx=dx*cosR-dy*sinR, ry=dx*sinR+dy*cosR;
    return [cx+rx*scale, cy+ry*scale];
  }
  // backdrop disc
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
  ctx.fillStyle='rgba(6,5,12,0.82)';ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='rgba(120,95,165,0.65)';ctx.stroke();
  // clip to circle
  ctx.beginPath();ctx.arc(cx,cy,R-2,0,Math.PI*2);ctx.clip();

  // explored tiles near the player
  let pcx=Math.floor(px), pcy=Math.floor(py);
  for(let dy=-range-1;dy<=range+1;dy++)for(let dx=-range-1;dx<=range+1;dx++){
    let tx=pcx+dx, ty=pcy+dy;
    if(!inB(tx,ty)||!G.exp[ty]||!G.exp[ty][tx])continue;
    let t=G.tiles[ty][tx];
    let vis=G.vis[ty]&&G.vis[ty][tx];
    let [sx,sy]=toRadar(tx,ty);
    let cellsz=Math.ceil(scale)+1;
    if(t==='#'){ctx.fillStyle=vis?'rgba(120,100,150,0.85)':'rgba(60,50,80,0.6)';}
    else if(t==='>'){ctx.fillStyle='rgba(170,110,255,0.95)';}
    else{ctx.fillStyle=vis?'rgba(60,52,38,0.7)':'rgba(34,28,20,0.55)';}
    ctx.fillRect(sx-cellsz/2,sy-cellsz/2,cellsz,cellsz);
  }
  // items
  items.forEach(it=>{if(!G.vis[it.y]||!G.vis[it.y][it.x])return;let [sx,sy]=toRadar(it.x,it.y);ctx.fillStyle=it.type==='gold'?'#e8c840':'#5ad0ff';ctx.fillRect(sx-1.5,sy-1.5,3,3)});
  // merchant
  if(G.merchant&&G.vis[G.merchant.y]&&G.vis[G.merchant.y][G.merchant.x]){let [sx,sy]=toRadar(G.merchant.x,G.merchant.y);ctx.fillStyle='#e8a030';ctx.fillRect(sx-2,sy-2,4,4)}
  // enemies (pulse)
  let ep=0.6+Math.sin(animT*5)*0.4;
  monsters.forEach(m=>{if(m.hp<=0||m._dead)return;if(!G.vis[m.y]||!G.vis[m.y][m.x])return;let [sx,sy]=toRadar(m.x,m.y);ctx.fillStyle=m.isBoss?`rgba(255,60,60,${ep})`:(m.elite?(m.eliteCol||'#ff8a3a'):'#cc3333');ctx.beginPath();ctx.arc(sx,sy,m.isBoss?3.2:2.2,0,Math.PI*2);ctx.fill()});
  ctx.restore();

  // facing cone + player marker (drawn over the clip, pointing up)
  ctx.save();
  ctx.translate(cx,cy);
  let coneA=FOV/2;
  let grad=ctx.createRadialGradient(0,0,2,0,0,R*0.7);
  grad.addColorStop(0,'rgba(255,220,120,0.35)');grad.addColorStop(1,'rgba(255,200,90,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.moveTo(0,0);
  ctx.arc(0,0,R*0.7,-Math.PI/2-coneA,-Math.PI/2+coneA);
  ctx.closePath();ctx.fill();
  // player arrow pointing up
  ctx.fillStyle='#ffe24a';
  ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,2);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();
  ctx.restore();

  // cardinal N tick on the rim (shows where North is as you turn)
  let nAng=rot+ (-Math.PI/2) - rot; // north (world up, dy<0) maps via rotation
  // compute north direction on radar: world vector (0,-1) rotated
  let nx=0*cosR-(-1)*sinR, ny=0*sinR+(-1)*cosR;
  ctx.fillStyle='rgba(180,160,220,0.9)';ctx.font='bold 8px "Share Tech Mono"';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('N',cx+nx*(R-7),cy+ny*(R-7));
}

// ══ WEAPON VIEWMODEL ══
// Class weapon held at the bottom of the first-person view.
// Idle sway + step dip + attack swing. Pixel art generated once per class.
let fpSwing=0, fpStep=0;
let _fpWeaponCache={};
function getWeaponSprite(cls){
  if(_fpWeaponCache[cls])return _fpWeaponCache[cls];
  let cv=document.createElement('canvas');cv.width=32;cv.height=52;
  let o=cv.getContext('2d');
  function p(x,y,w,h,c){o.fillStyle=c;o.fillRect(x,y,w,h);}
  if(cls==='Rogue'){
    // slim dagger
    p(14,2,4,22,'#b8c4cc');p(15,2,1,22,'#e8f0f4');p(17,3,1,20,'#7a868e');
    p(15,0,2,3,'#dde6ea');                       // tip
    p(10,24,12,3,'#8a6a2a');p(10,24,12,1,'#c9a23f'); // guard
    p(13,27,6,14,'#3a2a1a');p(13,29,6,1,'#5a4630');p(13,33,6,1,'#5a4630');p(13,37,6,1,'#5a4630'); // wrapped grip
    p(12,41,8,4,'#8a6a2a');p(13,42,6,2,'#c9a23f'); // pommel
  } else if(cls==='Mage'){
    // staff with glowing orb
    p(14,14,4,38,'#5a4226');p(15,14,1,38,'#7a5c38');   // shaft
    p(11,8,10,3,'#6a4e2c');p(11,8,3,8,'#6a4e2c');p(18,8,3,8,'#6a4e2c'); // claw
    p(12,2,8,8,'#7ac4ff');p(13,3,6,6,'#b8e2ff');p(14,4,3,3,'#ffffff'); // orb
  } else if(cls==='Cleric'){
    // flanged mace
    p(14,16,4,36,'#5a4226');p(15,16,1,36,'#7a5c38');
    p(10,2,12,14,'#9aa4ac');p(11,3,10,12,'#b8c2ca');
    p(8,5,2,8,'#8a949c');p(22,5,2,8,'#8a949c');     // flanges
    p(12,6,3,3,'#e8f0f4');                           // glint
    p(13,0,6,2,'#c9a23f');                           // holy tip
  } else if(cls==='Necromancer'){
    // skull staff, green glow
    p(14,16,4,36,'#2a3026');p(15,16,1,36,'#3e463a');
    p(11,4,10,10,'#d8d4c4');p(12,5,8,8,'#eae6d8');   // skull
    p(13,8,2,2,'#3aff6a');p(17,8,2,2,'#3aff6a');     // glowing eyes
    p(14,11,4,2,'#9a9684');                          // teeth
    p(12,14,8,2,'#1a2016');
  } else if(cls==='Paladin'){
    // radiant longsword
    p(14,0,4,26,'#d8dde2');p(15,0,1,26,'#ffffff');p(17,1,1,24,'#a8b2ba');
    p(9,26,14,3,'#c9a23f');p(9,26,14,1,'#ffe27a');   // gold guard
    p(13,29,6,13,'#7a2a2a');p(13,32,6,1,'#9a4040');p(13,36,6,1,'#9a4040');
    p(12,42,8,4,'#c9a23f');p(14,43,4,2,'#ffe27a');
  } else {
    // Warrior broadsword (default)
    p(13,0,6,26,'#b0bac2');p(15,0,1,26,'#e6edf2');p(18,1,1,24,'#7e8890');
    p(9,26,14,3,'#8a6a2a');p(9,26,14,1,'#c9a23f');
    p(13,29,6,13,'#4a3220');p(13,31,6,1,'#6a4c34');p(13,35,6,1,'#6a4c34');p(13,39,6,1,'#6a4c34');
    p(12,42,8,4,'#8a6a2a');p(14,43,4,2,'#c9a23f');
  }
  _fpWeaponCache[cls]=cv;return cv;
}
function drawFPWeapon(W,H){
  let cv=getWeaponSprite(player.cls||'Warrior');
  let scale=Math.floor(H*0.0095*0.55*10)/10;   // ~5x at 700px height
  if(scale<3)scale=3;
  let w=cv.width*scale, h=cv.height*scale;
  // idle sway + breathing
  let swayX=Math.sin(animT*1.7)*5;
  let swayY=Math.cos(animT*2.3)*4;
  // step dip when moving
  let dip=Math.sin(Math.min(1,fpStep)*Math.PI)*16;
  // attack swing: arc up-left then return
  let sw=Math.sin(Math.min(1,fpSwing)*Math.PI);
  let swingX=-sw*W*0.10, swingY=-sw*H*0.10, rot=-sw*0.5;
  let bx=W*0.60+swayX+swingX, by=H-h*0.72+swayY+dip+swingY;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.translate(bx+w/2,by+h);
  ctx.rotate(0.16+rot);                          // resting tilt
  // subtle glow for casters
  if(player.cls==='Mage'){ctx.shadowColor='#7ac4ff';ctx.shadowBlur=14*sw+5}
  if(player.cls==='Necromancer'){ctx.shadowColor='#3aff6a';ctx.shadowBlur=14*sw+5}
  if(player.cls==='Paladin'){ctx.shadowColor='#ffe27a';ctx.shadowBlur=10*sw+4}
  ctx.drawImage(cv,-w/2,-h,w,h);
  ctx.restore();
}

function drawFPHud(W,H){
  let deg=((player.angle*180/Math.PI)%360+360)%360;
  let names=[[0,'E'],[45,'SE'],[90,'S'],[135,'SW'],[180,'W'],[225,'NW'],[270,'N'],[315,'NE']];
  let best='',bd=999;names.forEach(([d,n])=>{let dd=Math.min(Math.abs(d-deg),360-Math.abs(d-deg));if(dd<bd){bd=dd;best=n}});
  ctx.fillStyle='rgba(8,6,16,0.7)';ctx.fillRect(W/2-28,8,56,18);
  ctx.strokeStyle='rgba(120,90,160,0.5)';ctx.lineWidth=1;ctx.strokeRect(W/2-28,8,56,18);
  ctx.fillStyle='#c9a227';ctx.font='bold 12px "Share Tech Mono"';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('◄ '+best+' ►',W/2,18);
  ctx.strokeStyle='rgba(220,180,90,0.4)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(W/2-7,H/2);ctx.lineTo(W/2-2,H/2);ctx.moveTo(W/2+2,H/2);ctx.lineTo(W/2+7,H/2);
  ctx.moveTo(W/2,H/2-7);ctx.lineTo(W/2,H/2-2);ctx.moveTo(W/2,H/2+2);ctx.lineTo(W/2,H/2+7);ctx.stroke();
}

function drawAll(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(classChooser){drawClassChooser();return}
  if(specChooser){drawSpecChooser();return}
  if(relicOpen){return} // relic overlay handles display
  // Safety: during a floor transition the player position / map can briefly be invalid
  if(!G.tiles||!isFinite(player.x)||!isFinite(player.y))return;
  torchFrame=-1; // rebuild light map each frame
  if(fpMode){
    drawFP();
    if(!gameOver)drawLowHpWarning();
    if(hitFlash>0.01)drawHitFlash();
    if(gameOver)drawDead();
    else if(bossFloor&&bossActive)drawBossHUD();
    return;
  }
  drawDungeon();drawEffects();drawItems();drawMons();drawPlayer();drawParts();
  drawVignette();
  if(!gameOver)drawLowHpWarning();
  if(hitFlash>0.01)drawHitFlash();
  if(gameOver)drawDead();
  else if(bossFloor&&bossActive)drawBossHUD();
}

// Pulsing red edge when the hero is critically wounded
function drawLowHpWarning(){
  if(!player.mhp)return;
  let frac=player.hp/player.mhp;
  if(frac>0.3||player.hp<=0)return;
  let W=canvas.width,H=canvas.height;
  // closer to death = stronger + faster pulse
  let sev=1-(frac/0.3);                 // 0 at 30% HP, 1 near 0
  let pulse=0.5+Math.sin(animT*(4+sev*4))*0.5;
  let a=(0.18+sev*0.34)*pulse;
  let g=ctx.createRadialGradient(W/2,H/2,H*0.32,W/2,H/2,H*0.9);
  g.addColorStop(0,'rgba(140,0,0,0)');
  g.addColorStop(1,`rgba(170,10,10,${a})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}

// Red damage flash — strongest at screen edges so it doesn't obscure the action
function drawHitFlash(){
  let W=canvas.width,H=canvas.height;
  let a=hitFlash;
  let g=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.85);
  g.addColorStop(0,`rgba(180,0,0,${a*0.12})`);
  g.addColorStop(1,`rgba(200,0,0,${a*0.6})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}

// Drifting dust motes pool (ambient atmosphere)
let dustMotes=[];
function initDust(){
  dustMotes=[];
  for(let i=0;i<26;i++){
    dustMotes.push({
      x:Math.random(),y:Math.random(),
      vx:(Math.random()-0.5)*0.0004,vy:-0.0002-Math.random()*0.0004,
      sz:0.5+Math.random()*1.2,ph:Math.random()*6.28
    });
  }
}
initDust();

function drawVignette(){
  let W=canvas.width,H=canvas.height;
  let px2=player.x*TW+TW/2,py2=player.y*TH+TH/2;
  if(!isFinite(px2)||!isFinite(py2)){px2=W/2;py2=H/2;} // safety during floor transitions

  // 1) Warm flickering torch light around the hero (additive)
  if(!(player.stealthed>0)){
    let flick=1+Math.sin(animT*7)*0.05+Math.cos(animT*5.3)*0.04;
    let radius=TW*7.5*flick;
    let lg=ctx.createRadialGradient(px2,py2,TW*0.8,px2,py2,radius);
    lg.addColorStop(0,'rgba(255,190,110,0.22)');
    lg.addColorStop(0.45,'rgba(230,150,70,0.10)');
    lg.addColorStop(1,'rgba(180,90,40,0)');
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.fillStyle=lg;ctx.fillRect(px2-radius,py2-radius,radius*2,radius*2);
    ctx.restore();
  }

  // 2) Cool ambient depth fill — centered on the hero so both sides match
  let maxR=Math.max(W,H);
  let amb=ctx.createRadialGradient(px2,py2,TW*5,px2,py2,maxR*0.7);
  amb.addColorStop(0,'rgba(0,0,0,0)');
  amb.addColorStop(1,'rgba(10,8,26,0.5)');
  ctx.fillStyle=amb;ctx.fillRect(0,0,W,H);

  // 3) Hard dark edge falloff — also centered on the hero
  let vg=ctx.createRadialGradient(px2,py2,TW*7,px2,py2,maxR*0.62);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.62)');
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);

  // 4) Drifting dust motes near the torch light
  ctx.save();ctx.globalCompositeOperation='lighter';
  dustMotes.forEach(d=>{
    d.x+=d.vx;d.y+=d.vy;
    if(d.y<-0.02){d.y=1.02;d.x=Math.random()}
    if(d.x<-0.02)d.x=1.02;if(d.x>1.02)d.x=-0.02;
    let dx=d.x*W,dy=d.y*H;
    let dist=Math.hypot(dx-px2,dy-py2);
    let near=Math.max(0,1-dist/(TW*8));
    if(near<=0)return;
    let tw=0.4+Math.sin(animT*3+d.ph)*0.3;
    ctx.fillStyle=`rgba(255,210,150,${near*tw*0.5})`;
    ctx.fillRect(dx,dy,d.sz,d.sz);
  });
  ctx.restore();
}

function drawHazard(px,py,hz,light){
  if(hz.type==='fire'){
    // animated flame pool
    let f=0.6+Math.sin(animT*6+px)*0.2+Math.cos(animT*4+py)*0.2;
    let g=ctx.createRadialGradient(px+TW/2,py+TH/2,1,px+TW/2,py+TH/2,TW*0.7);
    g.addColorStop(0,`rgba(255,180,60,${0.55*f})`);
    g.addColorStop(0.5,`rgba(220,90,30,${0.4*f})`);
    g.addColorStop(1,'rgba(120,30,10,0.15)');
    ctx.fillStyle=g;ctx.fillRect(px,py,TW,TH);
    // flickering embers
    for(let i=0;i<3;i++){
      let ex=px+4+((i*5+Math.floor(animT*9))%(TW-6));
      let ey=py+TH-3-((Math.floor(animT*7)+i*3)%6);
      ctx.fillStyle=`rgba(255,${180+i*20},80,${0.6*f})`;ctx.fillRect(ex,ey,2,2);
    }
  } else if(hz.type==='spike'){
    if(hz.armed){
      if(typeof player!=='undefined'&&player.revealTraps){
        // relic: traps clearly marked
        let pulse=0.4+Math.sin(animT*4+px)*0.2;
        ctx.strokeStyle=`rgba(255,90,90,${pulse})`;ctx.lineWidth=1.5;
        ctx.strokeRect(px+2,py+2,TW-4,TH-4);
        ctx.fillStyle=`rgba(255,120,80,${0.35*pulse})`;ctx.fillRect(px+3,py+3,TW-6,TH-6);
        ctx.fillStyle=`rgba(255,200,120,${pulse})`;ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('!',px+TW/2,py+TH/2);
      } else {
      // subtle tell: faint cracked outline so an observant player can spot it
      ctx.strokeStyle=`rgba(120,110,90,${0.25*light})`;ctx.lineWidth=1;
      ctx.strokeRect(px+3,py+3,TW-6,TH-6);
      ctx.fillStyle=`rgba(90,80,70,${0.2*light})`;
      ctx.fillRect(px+TW/2-1,py+4,2,2);ctx.fillRect(px+5,py+TH-6,2,2);ctx.fillRect(px+TW-7,py+TH-6,2,2);
      }
    } else {
      // sprung: visible metal spikes jutting up
      if(sheetReady&&SPR.floor_spikes){drawSheetTile('floor_spikes',px,py,3);return;}
      ctx.fillStyle='#1a1410';ctx.fillRect(px+2,py+2,TW-4,TH-4);
      ctx.fillStyle='#9aa0a8';
      for(let i=0;i<4;i++){
        let sx=px+3+i*4;
        ctx.beginPath();ctx.moveTo(sx,py+TH-3);ctx.lineTo(sx+2,py+3);ctx.lineTo(sx+4,py+TH-3);ctx.closePath();ctx.fill();
      }
      ctx.fillStyle='rgba(120,20,20,0.5)';ctx.fillRect(px+2,py+TH-4,TW-4,2); // blood
    }
  }
}

function drawDungeon(){
  let C=cols(),R=rows();
  for(let y=0;y<R;y++){
    for(let x=0;x<C;x++){
      let t=G.tiles[y]&&G.tiles[y][x];
      let vis=G.vis[y]&&G.vis[y][x];
      let exp=G.exp[y]&&G.exp[y][x];
      if(!exp)continue;
      let px2=x*TW,py2=y*TH;
      let light=vis?getLightAt(x,y):0;
      let _ftint=getFloorTheme().tileTint;
      if(t==='#'){
        spriteWall(px2,py2,vis&&light>0.1);
        if(vis&&_ftint){ctx.fillStyle=_ftint;ctx.fillRect(px2,py2,TW,TH)}
        if(vis&&light>0){ctx.fillStyle=`rgba(220,160,80,${light*0.08})`;ctx.fillRect(px2,py2,TW,TH)}
        if(!vis&&exp){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(px2,py2,TW,TH)}
      } else {
        spriteFloor(px2,py2,vis&&light>0.05);
        if(vis&&_ftint){ctx.fillStyle=_ftint;ctx.fillRect(px2,py2,TW,TH)}
        if(vis&&light>0){ctx.fillStyle=`rgba(220,150,60,${light*0.12})`;ctx.fillRect(px2,py2,TW,TH)}
        if(!vis&&exp){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(px2,py2,TW,TH)}
        if(t==='>'){spriteStair(px2,py2)}
        // Environmental hazards
        let _hz=hazardAt(x,y);
        if(_hz&&vis&&light>0.04)drawHazard(px2,py2,_hz,light);
      }
    }
  }
  // Merchant
  if(G.merchant){
    let mx=G.merchant.x,my=G.merchant.y;
    if(G.vis[my]&&G.vis[my][mx])spriteMerchant(mx*TW,my*TH,animT);
  }
}

function drawEffects(){
  (G.iceWall||[]).forEach(w=>{
    if(!G.vis[w.y]||!G.vis[w.y][w.x])return;
    ctx.fillStyle='rgba(100,200,255,0.5)';ctx.fillRect(w.x*TW,w.y*TH,TW,TH);
    ctx.strokeStyle='rgba(180,240,255,0.7)';ctx.lineWidth=1;ctx.strokeRect(w.x*TW,w.y*TH,TW,TH);
  });
  (G.lava||[]).forEach(l=>{
    if(!G.vis[l.y]||!G.vis[l.y][l.x])return;
    let pulse=0.5+Math.sin(animT*4+l.x)*0.2;
    ctx.fillStyle=`rgba(220,80,20,${pulse})`;ctx.fillRect(l.x*TW,l.y*TH,TW,TH);
    ctx.fillStyle=`rgba(255,150,30,${pulse*0.5})`;ctx.fillRect(l.x*TW+4,l.y*TH+6,TW-8,TH-10);
  });
  if(player.sacredGround){
    let sg=player.sacredGround;
    ctx.fillStyle=`rgba(220,200,80,${0.1+Math.sin(animT*3)*0.05})`;
    ctx.fillRect((sg.x-sg.r)*TW,(sg.y-sg.r)*TH,(sg.r*2+1)*TW,(sg.r*2+1)*TH);
  }
}

function drawItems(){
  // Chests first (so dropped items render on top once opened)
  (G.chests||[]).forEach(ch=>{
    if(ch.opened)return;
    if(!G.vis[ch.y]||!G.vis[ch.y][ch.x])return;
    let x=ch.x*TW,y=ch.y*TH;
    // gentle bob + glow
    let bob=Math.sin(animT*2.5+ch.x+ch.y)*1.2;
    if(ch.golden){
      let g=ctx.createRadialGradient(x+TW/2,y+TH/2,1,x+TW/2,y+TH/2,TW);
      let pulse=0.25+Math.sin(animT*3)*0.12;
      g.addColorStop(0,`rgba(255,210,80,${pulse})`);g.addColorStop(1,'rgba(255,210,80,0)');
      ctx.fillStyle=g;ctx.fillRect(x-TW/2,y-TH/2,TW*2,TH*2);
    }
    let drew=false;
    if(sheetReady&&SPR.crate){
      ctx.save();ctx.imageSmoothingEnabled=false;
      if(ch.golden)ctx.filter='sepia(1) saturate(3) hue-rotate(-12deg) brightness(1.15)';
      let s=SPR.crate;
      ctx.drawImage(SHEET,s[0],s[1],s[2],s[3],x+1,y+1+bob,TW-2,TH-2);
      ctx.restore();drew=true;
    }
    if(!drew){ // fallback: drawn chest
      ctx.fillStyle=ch.golden?'#c9a227':'#7a5230';ctx.fillRect(x+3,y+5+bob,TW-6,TH-8);
      ctx.fillStyle=ch.golden?'#ffe27a':'#9a6a40';ctx.fillRect(x+3,y+5+bob,TW-6,2);
      ctx.fillStyle='#3a2616';ctx.fillRect(x+TW/2-1,y+7+bob,2,3);
    }
  });
  items.forEach(it=>{
    if(!G.vis[it.y]||!G.vis[it.y][it.x])return;
    drawItemSprite(it.x,it.y,it);
  });
}

function drawMons(){
  monsters.forEach(m=>{
    if(m.hp<=0||m._dead)return;
    if(!G.vis[m.y]||!G.vis[m.y][m.x])return;
    let mx=m.x*TW,my=m.y*TH;
    let hpP=m.hp/m.mhp;
    // Attack-intent telegraph: adjacent, non-friendly enemy that will strike next turn
    if(!m.isMinion&&m.stun<=0&&!gameOver){
      let adj=(Math.abs(m.x-player.x)<=1&&Math.abs(m.y-player.y)<=1&&!(m.x===player.x&&m.y===player.y));
      if(adj){
        let pulse=0.5+Math.sin(animT*6)*0.5;
        ctx.fillStyle=`rgba(255,60,60,${0.55+pulse*0.4})`;
        ctx.font='bold 9px "Share Tech Mono"';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('!',mx+TW/2,my-6);
        ctx.strokeStyle=`rgba(255,50,50,${0.3+pulse*0.4})`;ctx.lineWidth=1;
        ctx.strokeRect(mx+0.5,my+0.5,TW-1,TH-1);
      }
    }
    if(m.isBoss){
      // Boss pulse aura
      let auraR=24+Math.sin(animT*3)*5;
      let grad=ctx.createRadialGradient(mx+TW/2,my+TH/2,2,mx+TW/2,my+TH/2,auraR);
      grad.addColorStop(0,m.col+'55');grad.addColorStop(0.6,m.col+'22');grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;ctx.fillRect(mx-auraR,my-auraR,TW+auraR*2,TH+auraR*2);
      // Ground shadow
      ctx.fillStyle='rgba(0,0,0,0.45)';
      ctx.beginPath();ctx.ellipse(mx+TW/2,my+TH-1,TW*0.7,TH*0.28,0,0,Math.PI*2);ctx.fill();
      // Boss sprite — prefer the CC0 sheet art, else the hand-coded sprite
      let _bnm=BOSS_SHEET[m.name], _bdrew=false;
      if(_bnm&&sheetReady&&SPR[_bnm]){
        let s=SPR[_bnm];
        let bw2=TW*1.5, bh2=bw2*(s[3]/s[2]);
        let flip=m.x>player.x;
        ctx.save();ctx.imageSmoothingEnabled=false;
        if(flip){ctx.translate(mx+TW/2,0);ctx.scale(-1,1);ctx.translate(-(mx+TW/2),0);}
        ctx.drawImage(SHEET,s[0],s[1],s[2],s[3],mx+TW/2-bw2/2,my+TH-bh2,bw2,bh2);
        ctx.restore();
        _bdrew=true;
      }
      if(!_bdrew){
        let sp=BOSS_SPRITES[m.name]||MONSTER_SPRITES[m.sym]||{map:GENERIC_MON_SPRITE,pal:{1:m.col,2:m.col,3:m.col,4:'#ffffff',5:'#ff4444',6:'#888888'}};
        let bScale=1.5,bw=18*bScale;
        ctx.save();ctx.translate(mx+TW/2-bw/2,my+TH-18*bScale);
        drawSprite(0,0,sp.map,sp.pal,bScale);
        ctx.restore();
      }
      // Boss name
      ctx.fillStyle='rgba(0,0,0,0.78)';let nw=m.name.length*5.5;ctx.fillRect(mx+TW/2-nw/2-3,my-16,nw+6,11);
      ctx.fillStyle=m.col;ctx.font='bold 8px "Share Tech Mono"';ctx.textAlign='center';ctx.fillText(m.name,mx+TW/2,my-9);
      // HP bar
      ctx.fillStyle='#330000';ctx.fillRect(mx-2,my+TH,TW+4,4);
      ctx.fillStyle=`hsl(${hpP*110},80%,45%)`;ctx.fillRect(mx-2,my+TH,Math.floor((TW+4)*hpP),4);
    } else {
      // Elite aura tell — pulsing colored ring + corner pip
      if(m.elite){
        let er=10+Math.sin(animT*4+m.id)*2.5;
        let eg=ctx.createRadialGradient(mx+TW/2,my+TH/2,2,mx+TW/2,my+TH/2,er);
        eg.addColorStop(0,'transparent');eg.addColorStop(0.7,(m.eliteCol||'#fff')+'00');eg.addColorStop(0.85,(m.eliteCol||'#fff')+'66');eg.addColorStop(1,'transparent');
        ctx.fillStyle=eg;ctx.fillRect(mx+TW/2-er,my+TH/2-er,er*2,er*2);
        ctx.strokeStyle=(m.eliteCol||'#fff')+'cc';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(mx+TW/2,my+TH/2,er*0.78,0,Math.PI*2);ctx.stroke();
      }
      // Ground shadow for depth
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.beginPath();ctx.ellipse(mx+TW/2,my+TH-2,TW*0.40,TH*0.16,0,0,Math.PI*2);ctx.fill();
      // Stun/poison overlay
      if(m.stun>0){ctx.fillStyle='rgba(120,120,200,0.3)';ctx.fillRect(mx,my,TW,TH)}
      if(m.poison>0){ctx.fillStyle='rgba(50,200,50,0.25)';ctx.fillRect(mx,my,TW,TH)}
      // Minion border
      if(m.isMinion){ctx.strokeStyle='rgba(80,220,100,0.6)';ctx.lineWidth=1.5;ctx.strokeRect(mx,my,TW,TH)}
      // Sprite — prefer the 0x72 sheet, fall back to code-drawn pixel art
      let _sheetNm=MON_SHEET[m.sym], _drew=false;
      if(_sheetNm&&sheetReady&&SPR[_sheetNm]){
        let s=SPR[_sheetNm];
        let dw=TW*(s[2]/16);
        let dh=dw*(s[3]/s[2]);
        let flip=m.x>player.x; // sprites face right; flip to face the hero
        _drew=drawSheet(_sheetNm,mx+TW/2,my+TH-1,dw,{flip,phase:Math.floor((m.id||0)*4)});
        if(_drew&&m.isMinion){ctx.fillStyle='rgba(120,255,140,0.30)';ctx.fillRect(mx+TW/2-dw/2,my+TH-1-dh,dw,dh)}
        if(_drew&&m.stun>0){ctx.fillStyle='rgba(110,110,220,0.35)';ctx.fillRect(mx+TW/2-dw/2,my+TH-1-dh,dw,dh)}
      }
      if(!_drew){
      let sp=MONSTER_SPRITES[m.sym];
      if(sp){
        let pal={...sp.pal};
        if(m.isMinion){Object.keys(pal).forEach(k=>{pal[k]='#aaffaa'})}
        if(m.stun>0){Object.keys(pal).forEach(k=>{pal[k]='#8888cc'})}
        drawSprite(mx,my,sp.map,pal);
      } else {
        // Fallback glyph for unknown monsters
        ctx.fillStyle=m.isMinion?'#aaffaa':m.col;
        ctx.font='bold 13px "Share Tech Mono"';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(m.sym,mx+TW/2,my+TH/2);
      }
      }
      // HP bar
      ctx.fillStyle='#1a0a0a';ctx.fillRect(mx+1,my+TH-3,TW-2,2);
      ctx.fillStyle=hpP>0.6?'#22aa22':hpP>0.3?'#aaaa22':'#cc2222';
      ctx.fillRect(mx+1,my+TH-3,Math.floor((TW-2)*hpP),2);
      // Minion timer bar + HP text
      if(m.isMinion&&m.turnsLeft!==undefined){
        let tP=m.turnsLeft/40;
        ctx.fillStyle='#0a1a0a';ctx.fillRect(mx+1,my-3,TW-2,2);
        ctx.fillStyle=tP>0.5?'#22cc44':tP>0.25?'#cccc22':'#cc2222';
        ctx.fillRect(mx+1,my-3,Math.floor((TW-2)*tP),2);
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(mx,my-13,TW,10);
        ctx.fillStyle='#aaffaa';ctx.font='7px "Share Tech Mono"';ctx.textAlign='center';
        ctx.fillText(m.hp+'/'+m.mhp,mx+TW/2,my-7);
      }
    }
    // Light overlay — darken based on distance from player
    let light=getLightAt(m.x,m.y);
    if(light<0.8){ctx.fillStyle=`rgba(0,0,0,${(1-light)*0.5})`;ctx.fillRect(mx,my,TW,TH)}
  });
}

function drawPlayer(){
  let px2=player.x*TW,py2=player.y*TH;
  // Status auras
  if(player.stealthed>0){
    ctx.fillStyle=`rgba(80,40,180,${0.12+Math.sin(animT*3)*0.06})`;ctx.fillRect(px2-3,py2-3,TW+6,TH+6);
    ctx.strokeStyle='rgba(120,80,220,0.5)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(px2-2,py2-2,TW+4,TH+4);ctx.setLineDash([]);
  } else {
    // Torch glow around player
    let g=ctx.createRadialGradient(px2+TW/2,py2+TH/2,1,px2+TW/2,py2+TH/2,TW);
    let flicker=0.12+Math.sin(animT*7)*0.04;
    g.addColorStop(0,`rgba(220,150,60,${flicker})`);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(px2-TW,py2-TH,TW*3,TH*3);
  }
  if(player.shielded>0){ctx.strokeStyle='rgba(80,200,220,0.7)';ctx.lineWidth=2;ctx.strokeRect(px2-2,py2-2,TW+4,TH+4)}
  if(player.berserk>0){
    let br=`rgba(220,80,30,${0.15+Math.sin(animT*6)*0.1})`;
    ctx.fillStyle=br;ctx.fillRect(px2-2,py2-2,TW+4,TH+4);
    ctx.strokeStyle='rgba(220,80,30,0.6)';ctx.lineWidth=1.5;ctx.strokeRect(px2-1,py2-1,TW+2,TH+2);
  }
  if(player.lichForm>0){ctx.strokeStyle='rgba(80,200,100,0.7)';ctx.lineWidth=2;ctx.strokeRect(px2-2,py2-2,TW+4,TH+4)}
  // Ground shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath();ctx.ellipse(px2+TW/2,py2+TH-2,TW*0.40,TH*0.16,0,0,Math.PI*2);ctx.fill();
  // Draw player sprite — 0x72 hero if the sheet is ready
  let _hero=HERO_SHEET[player.cls], _drewP=false;
  if(_hero&&sheetReady){
    let nm=(hitFlash>0.25&&SPR[_hero+'_hit'])?_hero+'_hit':_hero;
    _drewP=drawSheet(nm,px2+TW/2,py2+TH-1,TW,{flip:player.facing===3});
  }
  if(!_drewP){
    let pal=PLAYER_PALETTES[player.cls]||PLAYER_PALETTES.Warrior;
    drawSprite(px2,py2,PLAYER_SPRITE,pal);
  }
}

function drawParts(){
  particles=particles.filter(p=>{
    p.x+=p.vx;p.y+=p.vy;p.vx*=0.88;p.vy*=0.88;p.life-=0.06;
    if(p.life<=0)return false;
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.col;
    // Larger, more visible particles
    ctx.fillRect(p.x-p.sz,p.y-p.sz,p.sz*2,p.sz*2);
    ctx.globalAlpha=1;
    return true;
  });
  if(particles.length>0)setTimeout(()=>{if(!invOpen&&!merchOpen&&!treeOpen&&!classChooser&&!specChooser)drawAll()},16);
}

// Combat vignette while a boss is alive (red pulsing edge glow)
function drawBossHUD(){
  let boss=monsters.find(m=>m.isBoss&&m.hp>0&&!m._dead);if(!boss)return;
  let a=0.18+Math.sin(animT*3)*0.10;
  let grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*0.42,canvas.width/2,canvas.height/2,canvas.height);
  grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,`rgba(200,20,20,${a})`);
  ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);
}

// Death screen — drawn over a darkened battlefield when the hero falls
function drawDead(){
  let W=canvas.width,H=canvas.height,cx=W/2,cy=H/2;
  // Ensure the transient floor-intro card never overlaps the death summary
  let _fi=document.getElementById('floor-intro');if(_fi)_fi.classList.remove('show');
  // Darken whole screen
  ctx.fillStyle='rgba(4,2,8,0.82)';ctx.fillRect(0,0,W,H);
  // Blood-red radial pulse from centre
  let a=0.28+Math.sin(animT*2)*0.10;
  let grad=ctx.createRadialGradient(cx,cy,H*0.12,cx,cy,H*0.9);
  grad.addColorStop(0,`rgba(120,10,10,${a})`);grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);

  // Summary card
  let cardW=320,cardH=210,bx=cx-cardW/2,by=cy-cardH/2;
  ctx.fillStyle='rgba(10,5,12,0.7)';ctx.fillRect(bx,by,cardW,cardH);
  ctx.strokeStyle='rgba(150,30,30,0.6)';ctx.lineWidth=1;ctx.strokeRect(bx,by,cardW,cardH);

  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#c92020';ctx.font='bold 34px Cinzel,serif';
  ctx.shadowColor='#ff0000';ctx.shadowBlur=24;
  ctx.fillText('YOU DIED',cx,by+38);
  ctx.shadowBlur=0;

  // Class / spec line
  ctx.fillStyle='rgba(200,170,110,0.9)';ctx.font='12px "Share Tech Mono"';
  let specName=player.spec?(' · '+player.spec):'';
  ctx.fillText((player.cls||'Hero')+specName,cx,by+66);

  // Stat rows
  let rows=[
    ['Reached','Floor '+floor],
    ['Level',(player.level||1)],
    ['Bosses Slain',bossesKilled],
    ['Total Kills',totalKills],
    ['Gold',(player.gold||0)],
  ];
  ctx.font='11px "Share Tech Mono"';
  let ry=by+90;
  rows.forEach(r=>{
    ctx.textAlign='left';ctx.fillStyle='rgba(150,130,120,0.8)';
    ctx.fillText(r[0],bx+40,ry);
    ctx.textAlign='right';ctx.fillStyle='rgba(220,200,150,0.95)';
    ctx.fillText(''+r[1],bx+cardW-40,ry);
    ry+=18;
  });

  // Leaderboard name entry (drawn under the card when configured)
  if(typeof drawLbDeathUI==='function')drawLbDeathUI(W,H,bx,by,cardW,cardH);
  // Pulsing prompt (hidden while typing a name)
  let _lbTyping=(typeof lbSubmitState!=='undefined'&&(lbSubmitState==='naming'||lbSubmitState==='sending'));
  if(!_lbTyping){
    ctx.textAlign='center';
    let pp=0.5+Math.sin(animT*4)*0.4;
    ctx.fillStyle=`rgba(200,160,90,${pp})`;ctx.font='12px "Share Tech Mono"';
    ctx.fillText('Press  R  to descend once more...',cx,by+cardH-16);
  }
}

