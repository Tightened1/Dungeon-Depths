// ══ RENDER ══
const TC={wall:{v:'#1c1626',e:'#0f0d14'},floor:{v:'#231d12',e:'#14100a'}};
// ══════════════════════════════════════════════════
// GRAPHICS ENGINE — Pixel-art sprite renderer
// ══════════════════════════════════════════════════

const TW=18,TH=18; // Larger tiles for better sprites

// ══ 0x72 DUNGEON TILESET II (CC0) — real pixel-art spritesheet ══
// Loaded async; every draw site falls back to the original code-drawn
// sprites until it's ready (or if tileset.png is missing).
const SHEET=new Image();let sheetReady=false;
SHEET.onload=()=>{sheetReady=true};
SHEET.onerror=()=>{sheetReady=false};
SHEET.src='tileset.png';
const SPR={"column":[0,0,16,48,1],"big_zombie":[16,0,32,36,4],"ogre":[144,0,32,36,4],"big_demon":[272,0,32,36,4],"weapon_red_magic_staff":[400,0,8,30,1],"knight_m":[408,0,16,28,4],"knight_f":[0,48,16,28,4],"elf_m":[64,48,16,28,4],"wizzard_m":[128,48,16,28,4],"wizzard_f":[192,48,16,28,4],"dwarf_m":[256,48,16,28,4],"knight_m_hit":[320,48,16,28,1],"knight_f_hit":[336,48,16,28,1],"elf_m_hit":[352,48,16,28,1],"wizzard_m_hit":[368,48,16,28,1],"wizzard_f_hit":[384,48,16,28,1],"dwarf_m_hit":[400,48,16,28,1],"crate":[416,48,16,24,1],"weapon_hammer":[432,48,10,24,1],"slug":[442,48,16,23,4],"masked_orc":[0,76,16,23,4],"orc_warrior":[64,76,16,23,4],"orc_shaman":[128,76,16,23,4],"necromancer":[192,76,16,23,4],"wogol":[256,76,16,23,4],"chort":[320,76,16,23,4],"doc":[384,76,16,23,4],"pumpkin_dude":[448,76,16,23,4],"weapon_golden_sword":[0,99,10,22,1],"weapon_regular_sword":[10,99,10,21,1],"floor_1":[20,99,16,16,1],"floor_2":[36,99,16,16,1],"floor_3":[52,99,16,16,1],"floor_4":[68,99,16,16,1],"floor_5":[84,99,16,16,1],"floor_6":[100,99,16,16,1],"floor_7":[116,99,16,16,1],"floor_8":[132,99,16,16,1],"wall_mid":[148,99,16,16,1],"wall_top_mid":[164,99,16,16,1],"wall_hole_1":[180,99,16,16,1],"wall_hole_2":[196,99,16,16,1],"wall_goo":[212,99,16,16,1],"wall_banner_red":[228,99,16,16,1],"wall_banner_blue":[244,99,16,16,1],"wall_banner_green":[260,99,16,16,1],"wall_banner_yellow":[276,99,16,16,1],"floor_stairs":[292,99,16,16,1],"floor_ladder":[308,99,16,16,1],"floor_spikes":[324,99,16,16,4],"flask_red":[388,99,16,16,1],"flask_blue":[404,99,16,16,1],"flask_green":[420,99,16,16,1],"flask_yellow":[436,99,16,16,1],"flask_big_red":[452,99,16,16,1],"flask_big_blue":[468,99,16,16,1],"skull":[484,99,16,16,1],"tiny_slug":[0,121,16,16,4],"goblin":[64,121,16,16,4],"imp":[128,121,16,16,4],"tiny_zombie":[192,121,16,16,4],"skelet":[256,121,16,16,4],"muddy":[320,121,16,16,4],"swampy":[384,121,16,16,4],"ice_zombie":[448,121,16,16,4],"angel":[0,137,16,16,4],"coin":[64,137,6,7,4]};
// game monster sym -> sheet sprite
const MON_SHEET={r:'tiny_slug',g:'goblin',O:'orc_warrior',s:'skelet',V:'doc',T:'ogre',W:'chort',L:'necromancer','&':'big_demon',D:'wogol'};
// player class -> hero sprite
const HERO_SHEET={Warrior:'knight_m',Paladin:'knight_f',Rogue:'elf_m',Mage:'wizzard_m',Cleric:'dwarf_m',Necromancer:'wizzard_f'};
// Blit a sheet sprite anchored at bottom-centre (destX = centre, destYB = feet line).
function drawSheet(name,destX,destYB,destW,opts={}){
  if(!sheetReady)return false;
  let s=SPR[name];if(!s)return false;
  let sx=s[0],sy=s[1],w=s[2],h=s[3],n=s[4]||1;
  let f=opts.frame!==undefined?opts.frame:((Math.floor(animT*5)+(opts.phase||0))%n);
  let dw=destW,dh=destW*(h/w);
  let dx=destX-dw/2,dy=destYB-dh;
  ctx.imageSmoothingEnabled=false;
  if(opts.flip){
    ctx.save();ctx.translate(dx+dw/2,0);ctx.scale(-1,1);ctx.translate(-(dx+dw/2),0);
    ctx.drawImage(SHEET,sx+f*w,sy,w,h,dx,dy,dw,dh);ctx.restore();
  } else ctx.drawImage(SHEET,sx+f*w,sy,w,h,dx,dy,dw,dh);
  return true;
}
// Blit a 16x16 sheet tile stretched over a full TWxTH cell.
function drawSheetTile(name,x,y,frame){
  if(!sheetReady)return false;
  let s=SPR[name];if(!s)return false;
  let f=frame!==undefined?frame:0;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(SHEET,s[0]+f*s[2],s[1],s[2],s[3],x,y,TW,TH);
  return true;
}
function tileHash(x,y){return (((x*73856093)^(y*19349663))>>>0)}

// ── SPRITE DRAWING HELPERS ──
function px(x,y,c){ctx.fillStyle=c;ctx.fillRect(x,y,1,1)}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}

// Draw a full pixel-art sprite from a palette + pixel map
function drawSprite(sx,sy,map,pal,scale=1){
  let cell=Math.ceil(scale); // avoid sub-pixel seams when scaling up
  for(let r=0;r<map.length;r++){
    for(let c=0;c<map[r].length;c++){
      let p=map[r][c];if(p===0)continue;
      ctx.fillStyle=pal[p];
      ctx.fillRect(Math.floor(sx+c*scale),Math.floor(sy+r*scale),cell,cell);
    }
  }
}

// ── SPRITE DEFINITIONS (18x18 pixel art) ──

// Cheap stable per-tile hash (0..1) — deterministic, no allocation
function thash(x,y){let n=(x*73856093)^(y*19349663);n=(n^(n>>>13))>>>0;return(n%1000)/1000}

// Wall sprite — layered stone brick with depth, cracks & moss
function spriteWall(x,y,lit){
  if(sheetReady){
    let h=tileHash(x/TW|0,y/TH|0), r=h%97;
    let tier=Math.ceil(floor/5);
    let name='wall_mid';
    if(r<3)name=['wall_banner_blue','wall_banner_green','wall_banner_red','wall_banner_blue','wall_banner_yellow'][Math.min(4,tier-1)]||'wall_banner_red';
    else if(r<6)name=(h>>8)%2?'wall_hole_1':'wall_hole_2';
    else if(tier===2&&r<14)name='wall_goo';
    if(drawSheetTile(name,x,y)){
      if(!lit){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(x,y,TW,TH)}
      return;
    }
  }
  let b=lit?'#241d30':'#130e1a';
  let m=lit?'#2f2540':'#1a1224';
  let l=lit?'#473a5e':'#271c38';
  let topHi=lit?'#5a4c72':'#332646';
  let crackC=lit?'#0c0814':'#080510';
  rect(x,y,TW,TH,b);
  // brick rows (offset courses)
  let rows=[[0,0],[9,6],[0,12]];
  rows.forEach(([ox,oy])=>{
    for(let bx=-9;bx<TW;bx+=9){
      let px=x+bx+ox;
      rect(px,y+oy,8,5,m);
      ctx.fillStyle=l;ctx.fillRect(px,y+oy,8,1);      // top mortar highlight
      ctx.fillStyle=crackC;ctx.fillRect(px,y+oy+5,8,1); // bottom mortar shadow
    }
  });
  let h=thash(x,y);
  // occasional crack
  if(h>0.86){ctx.fillStyle=crackC;ctx.fillRect(x+3+Math.floor(h*8),y+2,1,6);ctx.fillRect(x+3+Math.floor(h*8),y+5,2,1)}
  // occasional moss patch (only when lit)
  if(lit&&h<0.10){ctx.fillStyle='rgba(70,120,60,0.25)';ctx.fillRect(x+1,y+TH-4,4,3);ctx.fillRect(x+TW-5,y+2,3,2)}
  // top edge catches the light
  if(lit){ctx.fillStyle='rgba(120,100,150,0.10)';ctx.fillRect(x,y,TW,1)}
}

// Floor sprite — flagstones with grout, grime and faint sheen
function spriteFloor(x,y,lit){
  if(sheetReady){
    let h=tileHash(x/TW|0,y/TH|0), r=h%100;
    let name='floor_1';
    if(r>=70)name='floor_'+(2+((h>>7)%7));
    if(drawSheetTile(name,x,y)){
      if(!lit){ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(x,y,TW,TH)}
      return;
    }
  }
  let b=lit?'#1c1710':'#100d08';
  let g=lit?'#272016':'#16120c';
  let d=lit?'#15110a':'#0c0906';
  rect(x,y,TW,TH,b);
  // diagonal flagstone split
  ctx.fillStyle=g;
  ctx.fillRect(x,y,TW/2-1,TH/2-1);
  ctx.fillRect(x+TW/2,y+TH/2,TW/2-1,TH/2-1);
  // grout lines
  ctx.fillStyle=d;
  ctx.fillRect(x+TW/2-1,y,1,TH);
  ctx.fillRect(x,y+TH/2-1,TW,1);
  let h=thash(x,y);
  // grime speckle / pebbles
  if(h<0.22){ctx.fillStyle=lit?'rgba(0,0,0,0.22)':'rgba(0,0,0,0.3)';ctx.fillRect(x+2+Math.floor(h*40)%10,y+3+Math.floor(h*70)%9,2,2)}
  // rare cracked flagstone
  if(h>0.93){ctx.fillStyle=d;ctx.fillRect(x+4,y+5,7,1)}
  // faint warm sheen on some lit tiles
  if(lit&&h>0.4&&h<0.5){ctx.fillStyle='rgba(255,210,140,0.05)';ctx.fillRect(x+3,y+3,4,3)}
}

// Staircase sprite — descending arcane stairwell with pulsing glow
function spriteStair(x,y){
  if(sheetReady&&SPR.floor_stairs){
    drawSheetTile('floor_stairs',x,y);
    let pulse=0.10+Math.sin(animT*3)*0.08;
    let g2=ctx.createRadialGradient(x+TW/2,y+TH/2,1,x+TW/2,y+TH/2,TW*0.8);
    g2.addColorStop(0,`rgba(170,110,255,${pulse+0.12})`);g2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g2;ctx.fillRect(x-2,y-2,TW+4,TH+4);
    return;
  }
  // dark recessed pit
  rect(x,y,TW,TH,'#0c0620');
  rect(x+1,y+1,TW-2,TH-2,'#160a2e');
  // receding steps (perspective), brighter toward the bottom/back
  let sc=['#3a1c6a','#4e2890','#6838b8','#8a52e0','#a870f0'];
  for(let i=0;i<5;i++){
    let w=TW-2-i*2, sx=x+1+i, sy=y+TH-3-i*3;
    rect(sx,sy,w,3,sc[i]);
    ctx.fillStyle='rgba(220,200,255,0.18)';ctx.fillRect(sx,sy,w,1); // step lip highlight
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(sx,sy+2,w,1);     // step shadow
  }
  // pulsing arcane glow rising from the depths
  let pulse=0.10+Math.sin(animT*3)*0.06;
  let g=ctx.createRadialGradient(x+TW/2,y+TH*0.35,1,x+TW/2,y+TH*0.35,TW*0.8);
  g.addColorStop(0,`rgba(170,110,255,${pulse+0.18})`);
  g.addColorStop(1,'rgba(120,60,200,0)');
  ctx.fillStyle=g;ctx.fillRect(x-2,y-2,TW+4,TH+4);
  // floating glints
  let h=thash(x,y);
  ctx.fillStyle=`rgba(210,180,255,${0.4+Math.sin(animT*5+h*6)*0.3})`;
  ctx.fillRect(x+5,y+4+Math.sin(animT*2)*1.5,1,1);
  ctx.fillRect(x+11,y+6+Math.cos(animT*2.4)*1.5,1,1);
}

// Merchant sprite — hooded trader with a glowing lantern
function spriteMerchant(x,y,t){
  let pulse=Math.sin(t*2)*0.3+0.7;
  // warm lantern glow on the ground
  let g=ctx.createRadialGradient(x+TW/2,y+TH/2,1,x+TW/2,y+TH/2,TW*0.9);
  g.addColorStop(0,`rgba(240,190,90,${0.18*pulse})`);g.addColorStop(1,'rgba(200,140,50,0)');
  ctx.fillStyle=g;ctx.fillRect(x-2,y-2,TW+4,TH+4);
  // ground shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath();ctx.ellipse(x+TW/2,y+TH-1,TW*0.38,TH*0.14,0,0,Math.PI*2);ctx.fill();
  // long robe
  rect(x+4,y+7,10,10,'#5a3410');
  rect(x+3,y+12,12,5,'#4a2a0c');
  rect(x+5,y+6,8,3,'#7a4c16');
  // gold trim
  ctx.fillStyle='#b8862a';ctx.fillRect(x+5,y+11,8,1);
  // head + face
  rect(x+6,y+2,6,6,'#caa468');
  ctx.fillStyle='#9a7848';ctx.fillRect(x+6,y+7,6,2); // beard
  // wide-brim hat
  rect(x+4,y+1,10,2,'#241406');
  rect(x+6,y-1,6,2,'#3a2210');
  // eyes
  ctx.fillStyle='#f0e860';ctx.fillRect(x+7,y+4,1,1);ctx.fillRect(x+10,y+4,1,1);
  // lantern in hand
  ctx.fillStyle='#2a1a08';ctx.fillRect(x+13,y+8,3,4);
  ctx.fillStyle=`rgba(255,210,90,${pulse})`;ctx.fillRect(x+14,y+9,1,2);
  // sparkles of trade
  ctx.fillStyle=`rgba(240,210,90,${pulse*0.7})`;
  ctx.fillRect(x+2,y+2,1,1);ctx.fillRect(x+15,y+4,1,1);
}

// Player sprites per class
const PLAYER_PALETTES={
  Warrior:  {1:'#6a4020',2:'#c8a060',3:'#d0d8e0',4:'#c0a020',5:'#e8e8e8',6:'#e85020'},
  Rogue:    {1:'#1a1a2a',2:'#2a2a3a',3:'#70c050',4:'#504040',5:'#90d070',6:'#c04040'},
  Mage:     {1:'#1a0830',2:'#4a1890',3:'#c890f0',4:'#f0c020',5:'#e0d0ff',6:'#8020e0'},
  Cleric:   {1:'#c8d0e0',2:'#e0e8f8',3:'#f0c040',4:'#4080c0',5:'#ffffff',6:'#80c0ff'},
  Paladin:  {1:'#d0c060',2:'#e8d870',3:'#f0f0a0',4:'#c09020',5:'#fff8c0',6:'#ffe840'},
  Necromancer:{1:'#203020',2:'#305040',3:'#60c880',4:'#102810',5:'#a0ffc0',6:'#20e060'},
};
const PLAYER_SPRITE=[
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
  [0,1,2,2,2,3,3,3,3,3,3,2,2,2,1,0,0,0],
  [0,1,2,2,3,3,3,3,3,3,3,3,2,2,1,0,0,0],
  [0,1,2,3,3,4,3,3,3,4,3,3,3,2,1,0,0,0],
  [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
  [0,1,2,2,3,3,5,5,5,5,3,3,2,2,1,0,0,0],
  [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,0,1,6,6,6,6,6,6,6,6,1,0,0,0,0,0],
  [0,0,1,6,6,1,6,6,6,6,1,6,6,1,0,0,0,0],
  [0,1,6,6,1,0,1,6,6,1,0,1,6,6,1,0,0,0],
  [1,6,6,1,0,0,1,6,6,1,0,0,1,6,6,1,0,0],
  [1,6,1,0,0,0,1,6,6,1,0,0,0,1,6,1,0,0],
  [0,0,0,0,0,0,1,6,6,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,6,6,6,6,1,0,0,0,0,0,0,0],
  [0,0,0,0,1,6,6,0,0,6,6,1,0,0,0,0,0,0],
  [0,0,0,1,6,6,0,0,0,0,6,6,1,0,0,0,0,0],
  [0,0,0,1,6,0,0,0,0,0,0,6,1,0,0,0,0,0],
];

// Monster sprites
const MONSTER_SPRITES={
  r:{ // Rat
    pal:{1:'#5a3a1a',2:'#7a5a3a',3:'#9a7a5a',4:'#e0c090',5:'#e04040'},
    map:[
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,2,2,1,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,1,2,3,3,2,1,0,0,1,0,1,0,0,0,0],
      [0,0,1,2,3,3,3,3,2,1,0,1,0,0,1,0,0,0],
      [0,1,2,3,4,3,3,3,3,2,1,1,0,0,0,1,0,0],
      [0,1,2,3,3,5,3,3,3,3,2,2,1,0,0,0,1,0],
      [0,1,2,3,3,3,3,3,3,3,2,0,0,1,0,0,0,0],
      [0,0,1,2,3,3,3,3,2,1,0,0,0,0,0,0,0,0],
      [0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,2,0,0,2,1,0,0,0,0,0,0,0,0,0],
      [0,0,1,2,0,0,0,0,2,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  g:{ // Goblin
    pal:{1:'#2a4a1a',2:'#3a6a2a',3:'#5a8a4a',4:'#e0c080',5:'#e04040',6:'#c08020'},
    map:[
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
      [0,0,1,2,3,5,3,3,3,5,3,3,2,1,0,0,0,0],
      [0,0,1,2,3,3,3,4,4,3,3,3,2,1,0,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
      [0,0,0,0,1,6,6,6,6,6,6,1,0,0,0,0,0,0],
      [0,0,0,1,6,6,2,6,6,2,6,6,1,0,0,0,0,0],
      [0,0,1,6,6,2,2,6,6,2,2,6,6,1,0,0,0,0],
      [0,1,6,6,2,0,0,6,6,0,0,2,6,6,1,0,0,0],
      [0,0,1,6,0,0,0,6,6,0,0,0,6,1,0,0,0,0],
      [0,0,0,0,0,0,1,6,6,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,6,0,0,6,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  s:{ // Skeleton
    pal:{1:'#bbbbbb',2:'#dddddd',3:'#ffffff',4:'#333333',5:'#e04040',6:'#888888'},
    map:[
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,1,2,2,5,2,2,2,5,2,2,2,1,0,0,0,0],
      [0,0,1,2,2,2,2,3,3,2,2,2,2,1,0,0,0,0],
      [0,0,0,1,6,2,2,2,2,2,2,6,1,0,0,0,0,0],
      [0,0,0,0,1,1,4,4,4,4,1,1,0,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,1,0,1,1,1,1,0,1,1,0,0,0,0,0],
      [0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,0,0],
      [0,1,1,0,0,0,1,1,1,1,0,0,0,1,1,0,0,0],
      [0,0,1,0,0,0,1,1,1,1,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  O:{ // Orc
    pal:{1:'#1a3a10',2:'#2a5a20',3:'#4a7a40',4:'#e0c080',5:'#c03020',6:'#806020',7:'#e07030'},
    map:[
      [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,1,2,3,5,3,3,3,3,5,3,3,2,1,0,0,0,0],
      [0,1,2,3,3,3,4,4,4,3,3,3,2,1,0,0,0,0],
      [0,1,2,3,7,3,3,3,3,3,7,3,2,1,0,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
      [0,0,0,1,6,6,6,6,6,6,6,1,0,0,0,0,0,0],
      [0,0,1,6,6,2,6,6,6,2,6,6,1,0,0,0,0,0],
      [0,1,6,6,2,0,2,6,6,2,0,2,6,6,1,0,0,0],
      [1,6,6,2,0,0,2,6,6,2,0,0,2,6,6,1,0,0],
      [0,1,6,2,0,0,2,6,6,2,0,0,2,6,1,0,0,0],
      [0,0,0,0,0,0,1,6,6,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,6,0,0,6,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  D:{ // Dragon - bigger, scarier
    pal:{1:'#5a1010',2:'#8a2020',3:'#c03030',4:'#e84040',5:'#f0a020',6:'#201010',7:'#ff6030'},
    map:[
      [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
      [1,2,1,0,0,0,0,0,0,0,0,0,0,0,1,2,1,0],
      [0,1,2,1,0,0,1,1,1,1,1,0,0,1,2,1,0,0],
      [0,0,1,2,1,1,2,2,2,2,2,1,1,2,1,0,0,0],
      [0,0,0,1,2,2,3,5,3,5,3,2,2,1,0,0,0,0],
      [0,0,1,2,2,3,3,3,3,3,3,3,2,2,1,0,0,0],
      [0,1,2,3,3,3,3,4,4,3,3,3,3,3,2,1,0,0],
      [1,2,3,3,3,7,3,3,3,3,7,3,3,3,3,2,1,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,1,6,2,3,3,3,3,3,3,2,6,1,0,0,0,0],
      [0,0,0,1,6,2,2,2,2,2,2,6,1,0,0,0,0,0],
      [0,0,1,6,2,6,1,6,6,1,6,2,6,1,0,0,0,0],
      [0,1,6,2,6,0,0,6,6,0,0,6,2,6,1,0,0,0],
      [1,6,2,6,0,0,0,6,6,0,0,0,6,2,6,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  V:{ // Vampire
    pal:{1:'#2a0a3a',2:'#4a1a5a',3:'#7a2a8a',4:'#c0a0e0',5:'#e04060',6:'#ffffff',7:'#f0d0f0'},
    map:[
      [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0],
      [0,1,2,2,1,0,0,0,0,0,0,1,2,2,1,0,0,0],
      [1,2,2,2,2,1,1,1,1,1,1,2,2,2,2,1,0,0],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
      [0,1,3,5,3,3,3,3,3,3,3,5,3,3,1,0,0,0],
      [0,1,3,3,3,4,4,4,4,4,3,3,3,3,1,0,0,0],
      [0,1,3,7,3,3,3,3,3,3,3,3,7,3,1,0,0,0],
      [0,0,1,3,3,3,6,6,6,3,3,3,3,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,1,2,2,1,2,2,2,2,1,2,2,1,0,0,0,0],
      [0,1,2,2,1,0,1,2,2,1,0,1,2,2,1,0,0,0],
      [1,2,2,1,0,0,1,2,2,1,0,0,1,2,2,1,0,0],
      [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,2,0,0,2,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  T:{ // Troll — hulking, mossy, tusked brute
    pal:{1:'#1a3018',2:'#2e5028',3:'#4a7240',4:'#dcd28a',5:'#b83030',6:'#7a5a2a',7:'#9ab87a'},
    map:[
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,3,5,3,3,3,3,5,3,2,1,0,0,0,0],
      [0,0,1,2,3,3,3,7,7,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,4,3,3,3,3,3,3,4,2,1,0,0,0,0],
      [0,1,2,2,3,3,3,3,3,3,3,3,2,2,1,0,0,0],
      [1,2,2,3,3,3,7,3,3,7,3,3,3,2,2,1,0,0],
      [1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1,0,0],
      [1,2,2,2,3,3,3,3,3,3,3,3,2,2,2,1,0,0],
      [0,1,2,2,2,1,3,3,3,3,1,2,2,2,1,0,0,0],
      [0,0,1,1,0,0,1,2,2,1,0,0,1,1,0,0,0,0],
      [0,0,1,1,0,0,1,2,2,1,0,0,1,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  W:{ // Werewolf — lean, fanged, bristling fur
    pal:{1:'#1a120a',2:'#3a2814',3:'#6a4a28',4:'#e8e030',5:'#c83020',6:'#9a7040',7:'#d8d8d8'},
    map:[
      [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
      [0,1,2,1,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
      [0,1,2,2,1,1,1,1,1,1,1,1,2,2,1,0,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,1,2,3,4,3,3,3,3,3,3,4,3,2,1,0,0,0],
      [0,0,1,3,3,3,3,5,5,3,3,3,3,1,0,0,0,0],
      [0,0,1,3,3,3,7,7,7,7,3,3,3,1,0,0,0,0],
      [0,0,1,2,3,7,7,7,7,7,7,3,2,1,0,0,0,0],
      [0,0,0,1,2,2,3,3,3,3,2,2,1,0,0,0,0,0],
      [0,0,0,1,6,2,2,2,2,2,2,6,1,0,0,0,0,0],
      [0,0,1,6,6,2,6,6,6,6,2,6,6,1,0,0,0,0],
      [0,1,6,6,2,0,2,6,6,2,0,2,6,6,1,0,0,0],
      [0,0,1,2,0,0,1,6,6,1,0,0,2,1,0,0,0,0],
      [0,0,0,0,0,0,1,6,6,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  L:{ // Lich — hooded undead sorcerer with glowing eyes
    pal:{1:'#0a1622',2:'#16304a',3:'#2a567a',4:'#5ad8ff',5:'#bff0ff',6:'#d8d0b0',7:'#2a8aaa'},
    map:[
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,3,6,6,3,3,6,6,3,2,1,0,0,0,0],
      [0,0,1,2,3,6,4,6,6,4,6,3,2,1,0,0,0,0],
      [0,0,1,2,3,6,6,3,3,6,6,3,2,1,0,0,0,0],
      [0,0,1,2,3,3,3,6,6,3,3,3,2,1,0,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0,0,0],
      [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,0,0,0],
      [0,1,2,3,2,3,7,4,4,7,3,2,3,2,1,0,0,0],
      [0,1,2,3,2,3,3,3,3,3,3,2,3,2,1,0,0,0],
      [0,0,1,2,1,2,2,2,2,2,2,1,2,1,0,0,0,0],
      [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  '&':{ // Demon — horned, fiery-eyed, ember-skinned fiend
    pal:{1:'#2a0808',2:'#5a1010',3:'#a82018',4:'#ff7020',5:'#ffd040',6:'#1a0404',7:'#e83828'},
    map:[
      [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
      [0,1,2,1,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
      [0,1,2,2,1,1,1,1,1,1,1,1,2,2,1,0,0,0],
      [1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1,0,0],
      [1,2,3,3,5,4,3,3,3,3,4,5,3,3,2,1,0,0],
      [0,1,3,3,4,5,3,7,7,3,5,4,3,3,1,0,0,0],
      [0,1,3,3,3,3,7,7,7,7,3,3,3,3,1,0,0,0],
      [0,1,3,3,3,3,3,4,4,3,3,3,3,3,1,0,0,0],
      [0,0,1,3,3,7,3,3,3,3,7,3,3,1,0,0,0,0],
      [0,0,1,6,3,3,3,3,3,3,3,3,6,1,0,0,0,0],
      [0,1,6,6,3,3,7,3,3,7,3,3,6,6,1,0,0,0],
      [1,6,6,3,3,0,3,3,3,3,0,3,3,6,6,1,0,0],
      [0,1,1,3,0,0,1,3,3,1,0,0,3,1,1,0,0,0],
      [0,0,0,0,0,0,1,3,3,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
};

// ── BOSS SPRITES (keyed by boss name; drawn larger) ──
const BOSS_SPRITES={
  'BONE KING':{ // crowned skull-lord
    pal:{1:'#7a7458',2:'#cfc7a0',3:'#f4eecc',4:'#1a1408',5:'#e02828',6:'#e8c020',7:'#9a8a30'},
    map:[
      [0,0,0,0,0,6,6,0,6,6,0,0,0,0,0,0,0,0],
      [0,0,0,0,6,7,6,6,6,7,6,0,0,0,0,0,0,0],
      [0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,1,1,0,0,0,0,0],
      [0,1,2,2,2,3,3,3,3,3,2,2,2,1,0,0,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,1,2,3,4,4,3,3,3,4,4,3,2,1,0,0,0,0],
      [0,1,2,3,4,4,3,5,3,4,4,3,2,1,0,0,0,0],
      [0,1,2,3,3,3,4,4,4,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,3,4,3,4,3,4,3,2,1,0,0,0,0,0],
      [0,0,0,1,2,3,3,3,3,3,2,1,0,0,0,0,0,0],
      [0,0,1,2,2,1,2,1,2,1,2,2,1,0,0,0,0,0],
      [0,1,2,2,0,0,1,2,1,0,0,2,2,1,0,0,0,0],
      [0,1,2,0,0,0,1,2,1,0,0,0,2,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ]
  },
  'BLOOD WITCH':{ // pale sorceress, red hood, blood orb
    pal:{1:'#2a0818',2:'#5a1030',3:'#a81850',4:'#f0c8d8',5:'#ff2850',6:'#1a0410',7:'#ff80a0'},
    map:[
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,3,4,4,4,4,4,4,3,2,1,0,0,0,0],
      [0,0,1,3,4,4,5,4,4,5,4,4,3,1,0,0,0,0],
      [0,0,1,3,4,4,4,7,7,4,4,4,3,1,0,0,0,0],
      [0,0,0,1,4,4,4,5,5,4,4,4,1,0,0,0,0,0],
      [0,0,0,1,2,3,4,4,4,4,3,2,1,0,0,0,0,0],
      [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,5,0,0],
      [0,1,2,2,3,3,3,5,5,3,3,3,2,2,5,5,5,0],
      [0,1,2,3,3,3,5,5,5,5,3,3,3,2,5,5,0,0],
      [0,1,2,3,3,3,3,5,5,3,3,3,3,2,1,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
      [0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0],
    ]
  },
  'IRON COLOSSUS':{ // massive armoured automaton, glowing core
    pal:{1:'#3a4450',2:'#5a6a7a',3:'#8aa0b4',4:'#c0d4e4',5:'#40d8ff',6:'#1a2028',7:'#7090a8'},
    map:[
      [0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,0,0],
      [0,1,2,2,1,1,2,2,2,2,1,1,2,2,1,0,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,1,2,3,4,3,3,3,3,3,3,4,3,2,1,0,0,0],
      [0,1,2,3,3,3,6,6,6,6,3,3,3,2,1,0,0,0],
      [0,1,2,3,3,6,5,5,5,5,6,3,3,2,1,0,0,0],
      [1,3,2,3,3,6,5,4,4,5,6,3,3,2,3,1,0,0],
      [1,3,3,2,3,3,6,6,6,6,3,3,2,3,3,1,0,0],
      [1,3,3,2,2,3,3,3,3,3,3,2,2,3,3,1,0,0],
      [0,1,3,3,2,3,5,5,5,5,3,2,3,3,1,0,0,0],
      [0,1,2,3,3,3,5,4,4,5,3,3,3,2,1,0,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,1,2,2,1,2,2,2,2,1,2,2,1,0,0,0,0],
      [0,0,1,2,2,1,0,0,0,0,1,2,2,1,0,0,0,0],
      [0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0],
    ]
  },
  'SHADOW LORD':{ // wreathed in darkness, violet voidfire eyes
    pal:{1:'#0a0618',2:'#1a1030',3:'#2e1a52',4:'#6a3ac8',5:'#b070ff',6:'#04020c',7:'#e0c0ff'},
    map:[
      [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
      [0,1,2,1,0,0,1,1,1,1,0,0,1,2,1,0,0,0],
      [0,1,2,2,1,1,2,2,2,2,1,1,2,2,1,0,0,0],
      [0,1,2,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0,0,0],
      [0,0,1,3,3,5,5,3,3,5,5,3,3,1,0,0,0,0],
      [0,0,1,3,3,5,4,3,3,4,5,3,3,1,0,0,0,0],
      [0,0,1,2,3,3,3,7,7,3,3,3,2,1,0,0,0,0],
      [0,1,2,2,3,3,3,3,3,3,3,3,2,2,1,0,0,0],
      [0,1,2,3,3,4,3,3,3,3,4,3,3,2,1,0,0,0],
      [0,1,2,3,4,4,4,3,3,4,4,4,3,2,1,0,0,0],
      [0,0,1,2,3,4,3,4,4,3,4,3,2,1,0,0,0,0],
      [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0],
    ]
  },
  'VOID DRAGON':{ // colossal winged wyrm, void-red, blazing maw
    pal:{1:'#3a0808',2:'#7a1010',3:'#c81818',4:'#ff4020',5:'#ffd040',6:'#180404',7:'#ff8030'},
    map:[
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
      [2,1,0,0,0,1,1,1,1,1,1,0,0,0,0,1,2,0],
      [3,2,1,1,1,2,2,2,2,2,2,1,1,1,1,2,3,0],
      [4,3,2,2,2,3,5,3,3,5,3,2,2,2,2,3,4,0],
      [0,4,3,3,3,3,3,3,3,3,3,3,3,3,3,4,0,0],
      [0,0,3,3,3,7,3,4,4,3,7,3,3,3,0,0,0,0],
      [0,1,2,3,3,3,4,4,4,4,3,3,3,2,1,0,0,0],
      [1,2,3,3,3,4,4,5,5,4,4,3,3,3,2,1,0,0],
      [2,3,3,3,4,4,5,5,5,5,4,4,3,3,3,2,0,0],
      [3,2,3,3,3,4,4,4,4,4,4,3,3,3,2,3,0,0],
      [4,3,2,3,3,3,7,3,3,7,3,3,3,2,3,4,0,0],
      [0,4,3,2,3,3,3,3,3,3,3,3,2,3,4,0,0,0],
      [0,0,1,2,2,6,3,3,3,3,6,2,2,1,0,0,0,0],
      [0,0,1,2,0,0,1,6,6,1,0,0,2,1,0,0,0,0],
      [0,0,0,0,0,0,1,6,6,1,0,0,0,0,0,0,0,0],
    ]
  },
};

// Fallback: generic monster sprite for types without custom sprites
const GENERIC_MON_SPRITE=[
  [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
  [0,1,2,2,2,3,3,3,3,3,3,2,2,1,0,0,0,0],
  [0,1,2,2,3,5,3,3,3,5,3,3,2,1,0,0,0,0],
  [0,1,2,2,3,3,3,4,4,3,3,3,2,1,0,0,0,0],
  [0,1,2,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0],
  [0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,1,6,6,6,6,6,6,6,1,0,0,0,0,0,0],
  [0,0,1,6,6,2,6,6,6,2,6,6,1,0,0,0,0,0],
  [0,1,6,6,2,0,2,6,6,2,0,2,6,1,0,0,0,0],
  [0,0,1,6,0,0,2,6,6,2,0,0,6,1,0,0,0,0],
  [0,0,0,0,0,0,1,6,6,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,6,0,0,6,1,0,0,0,0,0,0,0],
];

// Item sprite dots
function drawItemSprite(ix,iy,it){
  let px2=ix*TW,py2=iy*TH;
  // Glow aura for rare items
  if(it.rare>=2){
    let gc=RARE_COLORS[it.rare]||'#ffffff';
    let pulse=0.15+Math.sin(animT*3+ix+iy)*0.1;
    ctx.fillStyle=gc.replace('#','rgba(').replace(/(..)(..)(..)$/,(_,r,g,b)=>`${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},${pulse})`);
    ctx.fillRect(px2-2,py2-2,TW+4,TH+4);
  }
  // Sheet sprites for the common pickups (CC0 0x72 pack)
  if(sheetReady){
    let bob=Math.sin(animT*3+ix*1.7+iy)*1.5;
    let nm=null;
    if(it.type==='gold')nm='coin';
    else if(it.type==='potion')nm=(/mana|blue/i.test(it.name||'')?'flask_blue':/elixir|yellow/i.test(it.name||'')?'flask_big_red':'flask_red');
    else if(it.type==='weapon')nm=(it.rare>=3?'weapon_golden_sword':/staff|wand/i.test(it.name||'')?'weapon_red_magic_staff':/hammer|mace/i.test(it.name||'')?'weapon_hammer':'weapon_regular_sword');
    if(nm&&SPR[nm]){
      let s=SPR[nm];
      let dw=it.type==='gold'?TW*0.55:TW*(s[2]/16)*0.85;
      // soft ground shadow
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.beginPath();ctx.ellipse(px2+TW/2,py2+TH-2,TW*0.28,TH*0.10,0,0,Math.PI*2);ctx.fill();
      if(drawSheet(nm,px2+TW/2,py2+TH-2+bob,dw,{phase:(ix+iy)%4}))return;
    }
  }
  // Item background gem
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(px2+2,py2+2,TW-4,TH-4);
  // Main color fill based on type
  let shapeCol=it.col||'#ffffff';
  ctx.fillStyle=shapeCol;
  if(it.type==='weapon'){
    // Sword shape
    ctx.fillRect(px2+8,py2+2,2,12);ctx.fillRect(px2+5,py2+7,8,2);ctx.fillRect(px2+7,py2+12,4,2);
  } else if(it.type==='armor'){
    // Shield shape
    ctx.fillRect(px2+4,py2+3,10,8);ctx.fillRect(px2+5,py2+11,8,4);ctx.fillRect(px2+6,py2+14,6,2);
  } else if(it.type==='ring'){
    // Ring circle
    ctx.fillStyle='transparent';ctx.strokeStyle=shapeCol;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(px2+TW/2,py2+TH/2,5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=shapeCol;ctx.fillRect(px2+7,py2+2,4,3);
  } else if(it.type==='amulet'){
    // Diamond
    ctx.beginPath();ctx.moveTo(px2+TW/2,py2+3);ctx.lineTo(px2+TW-3,py2+TH/2);
    ctx.lineTo(px2+TW/2,py2+TH-3);ctx.lineTo(px2+3,py2+TH/2);ctx.closePath();ctx.fill();
  } else if(it.type==='potion'){
    // Potion bottle
    ctx.fillRect(px2+7,py2+2,4,2);ctx.fillRect(px2+6,py2+4,6,2);
    ctx.fillRect(px2+5,py2+6,8,8);ctx.fillRect(px2+6,py2+14,6,2);
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(px2+6,py2+7,2,4);
  } else {
    // Gold coin
    ctx.fillStyle='#e8c840';ctx.beginPath();ctx.arc(px2+TW/2,py2+TH/2,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#c0a020';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('$',px2+TW/2,py2+TH/2+1);
  }
  // Legendary shimmer
  if(it.rare===3){
    ctx.fillStyle=`rgba(255,200,50,${0.2+Math.sin(animT*4)*0.15})`;
    ctx.fillRect(px2,py2,TW,TH);
  }
  if(it.rare===4){
    ctx.fillStyle=`rgba(255,50,50,${0.2+Math.sin(animT*3)*0.15})`;
    ctx.fillRect(px2,py2,TW,TH);
  }
}

// ── TORCH LIGHTING SYSTEM ──
let torchCache=null,torchFrame=-1;
function buildLightMap(){
  if(torchFrame===turn)return torchCache;
  torchFrame=turn;
  let C=cols(),R=rows();
  let lm=new Float32Array(C*R);
  // Player light source (flicker is uniform across the radius — no left/right bias)
  let flicker=0.9+Math.sin(animT*7)*0.06+Math.cos(animT*5)*0.05;
  for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){
    let tx=player.x+dx,ty=player.y+dy;
    if(!inB(tx,ty))continue;
    let dist=Math.sqrt(dx*dx+dy*dy);
    let val=Math.max(0,1-dist/7)*flicker;
    lm[ty*C+tx]=Math.max(lm[ty*C+tx],val);
  }
  torchCache=lm;
  return lm;
}

function getLightAt(x,y){
  let lm=buildLightMap();
  let C=cols();
  return lm[y*C+x]||0;
}

