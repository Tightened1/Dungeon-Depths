// ══ COMBAT ══
// All damage scales with level: +4% per level, so Lv10=+40%, Lv20=+80% etc.
// This keeps early abilities balanced and makes progression feel meaningful.
// ── BOSS BULWARK ──
// No single hit may remove more than 35% of a boss's max HP. Burst builds
// (Legendary Edge, Death Mark, stealth Backstab, Heavenly Bolt stacks) stay
// devastating against everything else, but can never delete a boss outright.
// Single point for ENEMY damage to the player. Honors debug god mode.
// (Self-inflicted ability costs like Sacrifice Strike intentionally bypass this.)
function applyPlayerDamage(dmg){
  if(player._godmode)return 0;
  return dmg;
}

function bossCap(m,dmg){
  if(m&&m.isBoss&&dmg>m.mhp*0.35){
    addLog('The '+m.name+' endures the blow!',7);
    return Math.ceil(m.mhp*0.35);
  }
  return dmg;
}
// Single choke-point for ability damage: applies the bulwark, then deals it.
// Use for every direct-damage ability so no spec can bypass the boss cap.
function hurt(m,dmg){let d=bossCap(m,dmg);m.hp-=d;return d;}

// ── IRON WILL ──
// "Cannot die while above 15 HP": a hit may reduce you TO the floor but not
// through it — only while you're currently above it. At/below the floor you
// are mortal again, so you can still be finished off. (Previously this clamped
// every hit to leave 1 HP regardless of total, which was unintended immortality.)
const IRON_WILL_FLOOR=15;
function ironWillClamp(dmg){
  if(!player.ironWill)return dmg;
  if(player.hp<=IRON_WILL_FLOOR)return dmg;            // already at/below floor → mortal
  return Math.min(dmg, player.hp-IRON_WILL_FLOOR);     // can't be taken below the floor
}

function lvlScale(){
  let base=1+(player.level-1)*0.025;
  let pts=Object.values(player.treeNodes||{}).reduce((s,v)=>s+v,0);
  return base+pts*0.04;
}
function calcDmg(a,d){return Math.max(1,Math.floor((a*lvlScale())-Math.max(0,d)+rnd(-1,2)))}

function moveMons(){
  let lavaSet=new Set((G.lava||[]).map(l=>l.x+','+l.y));
  monsters.forEach(m=>{
    if(m.hp<=0||m._dead)return;
    if(lavaSet.has(m.x+','+m.y)){m.hp-=2;if(m.hp<=0){killMon(m);return}}
    // Permanent fire-pool hazards burn monsters too
    let _hz=hazardAt(m.x,m.y);
    if(_hz&&_hz.type==='fire'){m.hp-=2;if(m.hp<=0){killMon(m);return}}
    if(m.poison>0){
      let poisonDmg=m.poison+(player.pandemic||0);
      m.hp-=poisonDmg;m.poison=Math.max(0,m.poison-1);
      if(m.hp<=0){
        // Pandemic: poisoned enemies explode on death
        if(player.pandemic){monsters.forEach(o=>{if(o!==m&&o.hp>0&&Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=1)o.hp-=player.pandemic})}
        killMon(m);return;
      }
    }
    if(m.stun>0){m.stun--;return}
    // Minion AI: seek and attack nearest non-minion enemy
    if(m.isMinion){
      // Tick despawn timer
      if(m.turnsLeft!==undefined){
        m.turnsLeft--;
        if(m.turnsLeft<=0){
          // Despawn: restore reserved HP
          if(m.reservedHP){player.hp=Math.min(player.mhp,player.hp+m.reservedHP)}
          addLog(m.name+' despawns. HP restored.',9);
          m._dead=true;return;
        }
        if(m.turnsLeft===10)addLog(m.name+' will despawn in 10 turns!',7);
      }
      // Max range check — don't hunt beyond maxRange tiles from player
      let distToPlayer=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);
      let maxRange=m.maxRange||10;
      let target=null,bestDist=999;
      monsters.forEach(e=>{
        if(e.hp<=0||e._dead||e.isMinion)return;
        let dp=Math.abs(e.x-player.x)+Math.abs(e.y-player.y);
        if(dp>maxRange)return; // only chase enemies near player
        let d=Math.abs(e.x-m.x)+Math.abs(e.y-m.y);
        if(d<bestDist){bestDist=d;target=e}
      });
      if(target&&bestDist===1){
        // Attack
        let dmg=Math.max(1,calcDmg(m.atk+(player.minionBonus||0),target.def));
        target.hp-=dmg;
        spawnP(target.x,target.y,m.col);
        addLog(m.name+' hits '+target.name+' -'+dmg,9);
        if(target.hp<=0){addLog(m.name+' slays '+target.name+'!',9);killMon(target)}
      } else if(target){
        // Move toward target — try multiple directions to avoid getting stuck
        let dx=target.x-m.x,dy=target.y-m.y;
        let moved=false;
        // Try primary direction first, then secondary, then diagonals
        let dirs=[];
        if(Math.abs(dx)>=Math.abs(dy)){dirs=[[Math.sign(dx),0],[0,Math.sign(dy)],[Math.sign(dx),Math.sign(dy)],[0,-Math.sign(dy)],[-Math.sign(dx),0]]}
        else{dirs=[[0,Math.sign(dy)],[Math.sign(dx),0],[Math.sign(dx),Math.sign(dy)],[-Math.sign(dx),0],[0,-Math.sign(dy)]]}
        for(let d of dirs){if(d[0]===0&&d[1]===0)continue;if(mvM(m,m.x+d[0],m.y+d[1])){moved=true;break}}
      } else if(distToPlayer>2){
        // Follow player if no enemies nearby
        let dx=player.x-m.x,dy=player.y-m.y;
        let dirs=[];
        if(Math.abs(dx)>=Math.abs(dy)){dirs=[[Math.sign(dx),0],[0,Math.sign(dy)],[Math.sign(dx),Math.sign(dy)]]}
        else{dirs=[[0,Math.sign(dy)],[Math.sign(dx),0],[Math.sign(dx),Math.sign(dy)]]}
        for(let d of dirs){if(d[0]===0&&d[1]===0)continue;if(mvM(m,m.x+d[0],m.y+d[1]))break}
      }
      return;
    }
    let dx=player.x-m.x,dy=player.y-m.y;
    let dist=Math.abs(dx)+Math.abs(dy);
    // Elite: Frenzied — surges in power once wounded below half HP
    if(m.elite==='frenzied'&&!m._frenzyOn&&m.hp<m.mhp*0.5){
      m._frenzyOn=true;m.atk=Math.floor(m.atk*1.6);m.spd=(m.spd||1)+1;
      addLog(m.name+' goes berserk!',2);spawnP(m.x,m.y,'#ff5050','boss');
    }
    let sightRange=(m.sight||6)+(player.abyssalCurse?4:0);
    let see=Math.sqrt(dx*dx+dy*dy)<=sightRange&&G.vis[m.y]&&G.vis[m.y][m.x];
    if(!see&&!m.isBoss)return;
    if(m.stun>0){m.stun--;return;}
    // Spider Thread: adjacent enemies are slowed every other turn
    if(player.spiderThread&&dist===1&&!m._spiderSlowed){m._spiderSlowed=true;m.stun=1;return;}
    if(m._spiderSlowed)m._spiderSlowed=false;

    // ── Multi-step movement (Demon=2, Dragon=3) ──
    if((m.spd||1)>1&&dist>1){
      let steps=(m.spd||1)-1;
      for(let _s=0;_s<steps;_s++){
        let sdx=player.x-m.x,sdy=player.y-m.y;
        if(Math.abs(sdx)+Math.abs(sdy)<=1)break;
        let sdirs=Math.abs(sdx)>=Math.abs(sdy)?[[Math.sign(sdx),0],[0,Math.sign(sdy)]]:[[0,Math.sign(sdy)],[Math.sign(sdx),0]];
        let mv2=false;for(let sd of sdirs){if(mvM(m,m.x+sd[0],m.y+sd[1])){mv2=true;break}}
        if(!mv2)break;
      }
      // Recalc after extra steps
      dx=player.x-m.x;dy=player.y-m.y;dist=Math.abs(dx)+Math.abs(dy);
    }

    // ── Ranged attacks (Vampire, Lich, Dragon + bosses) ──
    let rng=m.rangeAtk||(m.isBoss&&m.bossAbil?6:0);
    if(rng&&dist>1&&dist<=rng&&!(m.isBoss)&&hasLOS(m.x,m.y,player.x,player.y)&&Math.random()<0.4){
      let rdmg=Math.max(1,Math.floor(m.atk*0.7)-Math.floor(effStat('def')*0.5));
      if(player.cloakActive&&rdmg>0){addLog('Phantom Cloak absorbs '+m.name+'!',5);player.cloakActive=false;rdmg=0;}
      if(player.mirrorActive&&rdmg>0){player.mirrorActive=false;player.mirrorBroken=true;}
      else if(player.mirrorBroken&&rdmg>0)rdmg*=2;
      if(player.thornCrown)rdmg=Math.floor(rdmg*1.15);
      rdmg+=(player.dmgTaken||0);
      if(player.dmgTakenPct)rdmg=Math.floor(rdmg*(1+player.dmgTakenPct));
      if(player.sanctuary>0)rdmg=Math.min(1,rdmg);
      rdmg=ironWillClamp(rdmg);
      let rcol=m.drainHp?'#cc44cc':m.raisesDead?'#5a8aaa':'#e84a4a';
      spawnAnim('fireball',m.x,m.y,player.x,player.y,rcol);
      player.hp=Math.max(0,player.hp-applyPlayerDamage(rdmg));
      if(m.drainHp&&rdmg>0)m.hp=Math.min(m.mhp||999,m.hp+m.drainHp);
      if(player.reflectFlat&&rdmg>0)m.hp-=player.reflectFlat;
      if(player.thornCrown&&rdmg>0)m.hp-=Math.floor(rdmg*0.3);
      triggerAffix('onHit',m);
      addLog(m.name+' ranged attack -'+rdmg,2);
      if(m.hp<=0)killMon(m);
      return;
    }

    // ── Lich raises skeletons ──
    if(m.raisesDead&&dist>1&&Math.random()<0.18&&!(m._raiseCd>0)){
      let pos=findEmptyNear(m.x,m.y);
      if(pos){
        let sk={...MTYPES.find(mo=>mo.name==='Skeleton'),x:pos.x,y:pos.y,id:Math.random(),stun:0,poison:0};
        sk.mhp=sk.hp;monsters.push(sk);
        spawnAnim('fireball',m.x,m.y,pos.x,pos.y,'#5a8aaa');
        addLog('Lich raises a Skeleton!',2);
        m._raiseCd=8;
      }
    }
    if(m._raiseCd>0)m._raiseCd--;

    // ── Boss special abilities (with proper cooldown) ──
    if(m._bossCd>0)m._bossCd--;
    if(m.isBoss&&m.bossAbil&&!m._bossCd&&Math.random()<0.35){
      m._bossCd=4;
      let bdmg=0;
      if(m.bossAbil==='raise_dead'){
        let pos=findEmptyNear(m.x,m.y);
        if(pos){let sk={...MTYPES.find(mo=>mo.name==='Skeleton'),x:pos.x,y:pos.y,id:Math.random(),stun:0,poison:0};sk.mhp=sk.hp;monsters.push(sk);addLog(m.name+': RAISES THE DEAD!',7);}
      } else if(m.bossAbil==='blood_missile'&&dist<=8){
        bdmg=Math.max(1,Math.floor(m.atk*0.85)-Math.floor(effStat('def')*0.4));
        if(player.sanctuary>0)bdmg=Math.min(1,bdmg);
        bdmg=ironWillClamp(bdmg);
        spawnAnim('fireball',m.x,m.y,player.x,player.y,'#cc44cc');
        player.hp=Math.max(0,player.hp-applyPlayerDamage(bdmg));
        m.hp=Math.min(m.mhp,m.hp+Math.floor(bdmg/2));
        if(bdmg>0)triggerShake(6,8);
        addLog(m.name+': BLOOD MISSILE -'+bdmg+'! (heals self)',7);
      } else if(m.bossAbil==='shockwave'&&dist<=3){
        bdmg=Math.max(1,Math.floor(m.atk*0.6));
        if(player.sanctuary>0)bdmg=Math.min(1,bdmg);
        bdmg=ironWillClamp(bdmg);
        player.hp=Math.max(0,player.hp-applyPlayerDamage(bdmg));
        if(bdmg>0)triggerShake(7,8);
        addLog(m.name+': SHOCKWAVE -'+bdmg+'!',7);
      } else if(m.bossAbil==='shadow_nova'&&dist<=5){
        bdmg=Math.max(1,Math.floor(m.atk*0.75)-Math.floor(effStat('def')*0.3));
        if(player.sanctuary>0)bdmg=Math.min(1,bdmg);
        bdmg=ironWillClamp(bdmg);
        player.hp=Math.max(0,player.hp-applyPlayerDamage(bdmg));
        if(bdmg>0)triggerShake(6,8);
        if(!(player.stunImmune))player.stun=2;
        addLog(m.name+': SHADOW NOVA -'+bdmg+(player.stunImmune?'!':' STUNNED!'),7);
      } else if(m.bossAbil==='void_breath'&&dist<=7){
        bdmg=Math.max(1,Math.floor(m.atk*0.9)-Math.floor(effStat('def')*0.35));
        if(player.sanctuary>0)bdmg=Math.min(1,bdmg);
        bdmg=ironWillClamp(bdmg);
        spawnAnim('fireball',m.x,m.y,player.x,player.y,'#ff3333');
        player.hp=Math.max(0,player.hp-applyPlayerDamage(bdmg));
        if(bdmg>0)triggerShake(8,10);
        addLog(m.name+': VOID BREATH -'+bdmg+'!',7);
      }
      if(bdmg>0){if(player.reflectFlat)m.hp-=player.reflectFlat;if(player.thornCrown)m.hp-=Math.floor(bdmg*0.3);if(m.hp<=0)killMon(m);}
      return; // used turn on special ability
    }

    // Check for an adjacent minion to attack
    let adjMinion=monsters.find(mn=>mn.isMinion&&!mn._dead&&mn.hp>0&&Math.abs(mn.x-m.x)+Math.abs(mn.y-m.y)===1);
    if(dist===1){
      if(player.shielded>0||player.ghost>0)return;
      let dodgeChance=player.stoneFleshed?0:(player.dodge||0);
      if(dodgeChance>0&&Math.random()*100<dodgeChance){
        addLog('You dodge '+m.name+'!',9);
        if(player.momentumBonus){player.momBuff=(player.momBuff||0)+player.momentumBonus;setTimeout(()=>{player.momBuff=Math.max(0,(player.momBuff||0)-player.momentumBonus)},0)}
        return;
      }
      let baseDmg=Math.max(0,calcDmg(m.atk,effStat('def')));
      // Relic: thorn crown — take 15% more
      if(player.thornCrown)baseDmg=Math.floor(baseDmg*1.15);
      // Relic: void crystal / dmgTaken flat bonus
      baseDmg+=player.dmgTaken||0;
      // Relics that increase damage taken (Betrayer Ring, etc.)
      if(player.dmgTakenPct)baseDmg=Math.floor(baseDmg*(1+player.dmgTakenPct));
      // Relic: phantom cloak — first hit absorbed
      if(player.cloakActive&&baseDmg>0){addLog('Phantom Cloak absorbs the hit!',5);player.cloakActive=false;baseDmg=0}
      // Relic: mirror curse — double dmg after first hit
      if(player.mirrorActive&&baseDmg>0){player.mirrorActive=false;player.mirrorBroken=true}
      else if(player.mirrorBroken&&baseDmg>0)baseDmg*=2;
      // Relic: iron will — cannot die above 15 HP
      baseDmg=ironWillClamp(baseDmg);
      if(player.sanctuary>0)baseDmg=Math.min(1,baseDmg);
      if(player.sacredVow>0&&player.sacredVow>=baseDmg){player.sacredVow-=baseDmg;baseDmg=0}
      let dmg=baseDmg;
      if(player.taunt)dmg=Math.floor(dmg*Math.max(0.1,1-player.taunt*0.3));
      if(player.divineFavor&&Math.random()<0.2)dmg=0;
      if(player.vengeance)player.vengeanceDmg=(player.vengeanceDmg||0)+dmg;
      if(player.reflectFlat&&m.hp>0&&dmg>0)m.hp-=player.reflectFlat;
      // Relic: thorn crown — reflect 30% of incoming
      if(player.thornCrown&&m.hp>0&&dmg>0){let ref=Math.floor(dmg*0.3);m.hp-=ref}
      triggerAffix('onHit',m);
      player.hp-=applyPlayerDamage(dmg);
      if(dmg>0){
        // Impact feedback scaled to how hard the hit was
        let frac=dmg/Math.max(1,player.mhp);
        triggerShake(m.isBoss?7:Math.min(8,3+dmg*0.5), m.isBoss?9:7);
        triggerHitFlash(Math.min(0.7,0.25+frac*1.4));
        spawnFloatNum('-'+dmg, player.x, player.y, m.isBoss?'#ff8855':'#ff5555', m.isBoss||frac>0.2);
      }
      if(m.isBoss)spawnP(player.x,player.y,'#ff4444','boss');
      else spawnP(player.x,player.y,'#e85a5a');
      if(m.drainHp&&dmg>0){m.hp=Math.min((m.mhp||99),m.hp+m.drainHp);addLog(m.name+' drains '+m.drainHp+' HP!',2);}
      // Elite: Leeching — recovers HP equal to part of the damage dealt
      if(m.elite==='leeching'&&dmg>0){let heal=Math.max(1,Math.floor(dmg*0.6));m.hp=Math.min(m.mhp,m.hp+heal);spawnP(m.x,m.y,'#cc55cc')}
      addLog(dmg>0?m.name+' hits -'+dmg:m.name+' misses!',m.isBoss?7:2);
    } else if(adjMinion){
      // Enemy attacks adjacent minion
      let dmg=Math.max(1,calcDmg(m.atk,adjMinion.def));
      adjMinion.hp-=dmg;
      spawnP(adjMinion.x,adjMinion.y,'#e85a5a');
      addLog(m.name+' attacks '+adjMinion.name+' -'+dmg+' ('+Math.max(0,adjMinion.hp)+'/'+adjMinion.mhp+')',2);
      if(adjMinion.hp<=0){
        addLog(adjMinion.name+' was destroyed!',2);
        if(adjMinion.reservedHP)player.hp=Math.min(player.mhp,player.hp+adjMinion.reservedHP);
        adjMinion._dead=true;
      }
    } else {
      if(Math.abs(dx)>=Math.abs(dy)){if(!mvM(m,m.x+(dx>0?1:-1),m.y))mvM(m,m.x,m.y+(dy>0?1:-1))}
      else{if(!mvM(m,m.x,m.y+(dy>0?1:-1)))mvM(m,m.x+(dx>0?1:-1),m.y)}
    }
  });
}

function mvM(m,nx,ny){
  if(!inB(nx,ny)||G.tiles[ny][nx]==='#')return false;
  if((G.iceWall||[]).some(w=>w.x===nx&&w.y===ny))return false;
  if(monsters.some(o=>o.x===nx&&o.y===ny&&o.hp>0&&o!==m))return false;
  if(nx===player.x&&ny===player.y)return false;
  m.x=nx;m.y=ny;return true;
}

function tryMove(ent,nx,ny){
  if(ent===player&&(player.stun||0)>0){addLog('Stunned! Cannot move.',2);return false;}
  // Secret wall bump detection
  if(ent===player&&inB(nx,ny)&&G.tiles[ny][nx]==='#'){
    let sw=(G.secretWalls||[]).find(w=>w.x===nx&&w.y===ny&&!w.found);
    if(sw){
      sw.found=true;
      G.tiles[sw.y][sw.x]='.'; // reveal passage
      addLog('✦ A SECRET PASSAGE crumbles open!',3);
      // Stock the room with loot
      let sr=(G.secretRooms||[]).find(r=>r.idx===sw.s&&!r.stocked);
      if(sr){
        sr.stocked=true;
        // Secret rooms now offer a choice of 3 relics (no item loot)
        let owned=new Set((player.relics||[]).map(r=>r.id));
        let avail=ALL_RELICS.filter(r=>!owned.has(r.id));
        avail.sort(()=>Math.random()-0.5);
        let choice=avail.slice(0,3);
        if(choice.length&&typeof showRelicChoice==='function'){
          addLog('✦ A hidden shrine offers you a relic!',3);
          setTimeout(()=>{
            showRelicChoice(choice,()=>{fov();updateUI();drawAll();updateRelicPanel()});
            let sub=document.getElementById('relic-subtitle');if(sub)sub.textContent='Secret shrine — choose one relic';
          },300);
        } else {
          addLog('✦ A hidden shrine — but its relics are all yours already.',3);
        }
        fov();drawAll();
      }
    }
    return false;
  }
  if(!inB(nx,ny)||G.tiles[ny][nx]==='#')return false;
  let mon=monsters.find(m=>m.x===nx&&m.y===ny&&m.hp>0);
  if(mon){
    if(mon.isMinion){
      // Swap positions — player walks through minion
      mon.x=ent.x;mon.y=ent.y;
      ent.x=nx;ent.y=ny;
      return true;
    }
    atkMon(mon);return true;
  }
  if(monsters.some(m=>m.x===nx&&m.y===ny&&m.hp>0))return false;
  // Walk into an unopened chest to open it (player only)
  if(ent===player){
    let ch=(typeof chestAt==='function')&&chestAt(nx,ny);
    if(ch){ openChest(ch); return true; } // opening consumes the turn; player stays put
  }
  ent.x=nx;ent.y=ny;return true;
}

function killMon(m){
  if(m._dead)return;m._dead=true;
  if(!m.isBoss&&!m.isMinion){floorKills++;totalKills++;}
  spawnP(m.x,m.y,m.col,'death');
  // Satisfying death pop — shockwave + shard shatter
  spawnAnim('death',m.x,m.y,m.x,m.y,m.isBoss?'#ffcc44':(m.col||'#ffffff'),m.isBoss);
  if(m.isBoss)triggerShake(8,12);
  updateAnims();
  if(m.isBoss){
    // ── FINAL BOSS: victory! ──
    if(m.isFinal||m.name==='GOD DEMON'){
      bossActive=false;
      triggerShake(12,20);
      try{localStorage.setItem('dd_prestige_unlocked','1')}catch(e){}
      prestigeUnlocked=true;
      victoryWin=true; gameOver=true;
      addLog('★ THE GOD DEMON FALLS! YOU HAVE CONQUERED THE DEPTHS! ★',7);
      addLog('★ PRESTIGE CLASS UNLOCKED — choose it on the title screen! ★',7);
      clearSave();
      if(typeof lbOnDeath==='function')lbOnDeath(); // a win is leaderboard-worthy too
      drawAll();
      return;
    }
    bossesKilled++;
    const DIFF_CURVE=[1,1.25,1.5,1.8,2.1,2.45];
    diffScale=DIFF_CURVE[Math.min(bossesKilled,DIFF_CURVE.length-1)];
    let loot=genBossLoot(m.bossRef,player.cls);
    let bossRoom=G.rooms[Math.floor(G.rooms.length/2)];
    let slots=[];
    for(let ly=bossRoom.y;ly<bossRoom.y+bossRoom.h;ly++)
      for(let lx=bossRoom.x;lx<bossRoom.x+bossRoom.w;lx++)
        if(G.tiles[ly][lx]==='.'&&!(lx===m.x&&ly===m.y))slots.push({x:lx,y:ly});
    slots.sort(()=>Math.random()-0.5);
    loot.x=slots[0]?slots[0].x:bossRoom.cx;loot.y=slots[0]?slots[0].y:bossRoom.cy;
    items.push(loot);
    G.stairX=bossRoom.cx;G.stairY=bossRoom.cy;G.tiles[bossRoom.cy][bossRoom.cx]='>';
    // Merchant in a room that is NOT the start room and NOT the stairs room.
    let mRoom=G.rooms.find(rm=>rm!==G.rooms[0]&&!(rm.cx===G.stairX&&rm.cy===G.stairY))||G.rooms[Math.max(0,G.rooms.length-1)];
    let mmx=mRoom.cx,mmy=mRoom.cy;
    if(mmx===G.stairX&&mmy===G.stairY)mmx=mRoom.x;
    G.merchant={x:mmx,y:mmy};
    bossActive=false;
    merchantItems=genMerchantStock();
    addLog('BOSS SLAIN! Class loot dropped! Merchant arrived!',7);
    addLog('Enemies now x'+diffScale.toFixed(1)+' stronger!',2);
    addLog('ENTER on > stairs, ENTER on M merchant',3);
    if(m.specialLoot){let li=mkItem(WEAPONS,'weapon','weapon',3);li.x=bossRoom.cx+1;li.y=bossRoom.cy;items.push(li)}
    // Lich fragment curse
    if(player.lichFragment){player.mhp=Math.max(10,player.mhp-15);player.hp=Math.min(player.hp,player.mhp);addLog('Lich Fragment: -15 Max HP!',2)}
    // Show relic choice after a short delay
    setTimeout(()=>{
      let pool=pickRelicPool(3);
      if(pool.length>0)showRelicChoice(pool,()=>{fov();updateUI();drawAll()});
    },400);
  } else {
    addLog('Slain '+m.name+'! +'+m.xp+'xp +'+m.gold+'g',3);
    // Elite: Volatile — detonates on death, damaging the player and nearby foes
    if(m.elite==='volatile'){
      spawnAnim('explosion',m.x,m.y,m.x,m.y,'#ff8a3a');
      spawnP(m.x,m.y,'#ff8a3a','death');
      let ex=Math.max(3,Math.floor(m.atk*0.8));
      if(Math.abs(player.x-m.x)<=1&&Math.abs(player.y-m.y)<=1){
        let ed=ex; if(player.sanctuary>0)ed=Math.min(1,ed); ed=ironWillClamp(ed);
        player.hp=Math.max(0,player.hp-applyPlayerDamage(ed));triggerShake(7,9);triggerHitFlash(0.5);
        spawnFloatNum('-'+ed,player.x,player.y,'#ff8a3a',true);
        addLog(m.name+' explodes! -'+ed,2);
      } else addLog(m.name+' explodes!',2);
      monsters.forEach(o=>{if(o!==m&&o.hp>0&&!o._dead&&Math.abs(o.x-m.x)<=1&&Math.abs(o.y-m.y)<=1){o.hp-=ex;if(o.hp<=0)o._dead=true}});
    }
    // Legendary weapons drop ONLY from elites, at 10%
    if(m.elite&&Math.random()<0.10){
      let li=mkItem(WEAPONS,'weapon','weapon',3);li.x=m.x;li.y=m.y;items.push(li);floorItemsFound++;
      addLog('✦ LEGENDARY weapon drops from the '+(m.eliteName||'elite')+'!',8);
    }
    if(m.specialLoot&&Math.random()<0.4){
      let t=['weapon','armor','ring','amulet'][rnd(0,3)];
      let pools={weapon:WEAPONS,armor:ARMORS,ring:RINGS,amulet:AMULETS};
      let li=mkItem(pools[t],t,t,3);li.x=m.x;li.y=m.y;items.push(li);
      addLog('Legendary drop from '+m.name+'!',8);
    }
    if(player.epidemic){monsters.filter(o=>Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=1&&o.hp>0).forEach(o=>o.poison=(o.poison||0)+3)}
    if(player.deathSurge){monsters.forEach(o=>{if(Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=2&&o.hp>0)o.hp-=6});spawnAnim('explosion',m.x,m.y,m.x,m.y,'#55cc88')}
    if(player.soulSiphon&&(player.soulStack||0)<30)player.soulStack=Math.min(30,(player.soulStack||0)+2);
    if(player.soulJar){player.soulCharges=(player.soulCharges||0)+1;if(player.soulCharges>=5){player.hp=player.mhp;player.soulCharges=0;addLog('Soul Jar: fully healed!',6)}}
    if(player.soulHarvest)player.hp=Math.min(player.mhp,player.hp+player.soulHarvest);
    if(player.plague){monsters.filter(o=>Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=1&&o.hp>0).forEach(o=>o.poison=(o.poison||0)+3)}
  }
  player.xp+=m.xp*(player.xpMult||1);player.gold+=(m.isBoss||player.noGoldDrops)?0:m.gold;
  spawnFloatNum('💀',m.x,m.y,'#c9a227',false);
  if(player.wpnLifesteal)player.hp=Math.min(player.mhp,player.hp+player.wpnLifesteal);
  if(player.stealthed>0&&player.markedHeal)player.hp=Math.min(player.mhp,player.hp+player.markedHeal);
  triggerAffix('onKill');
  // Relic kill effects
  if(player.bountyGold&&!m.isBoss)player.gold+=player.bountyGold;
  if(player.lanternHeal&&!m.isBoss){let lh=Math.floor(player.lanternHeal*(player.healMult!==undefined?player.healMult:1));player.hp=Math.min(player.mhp,player.hp+lh);}
  if(player.killSplash&&!m.isBoss){monsters.forEach(o=>{if(o!==m&&!o._dead&&o.hp>0&&Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=1)o.hp-=Math.floor(effStat('atk')*0.4)});spawnAnim('explosion',m.x,m.y,m.x,m.y,'#e87a3a')}
  if(player.killHpLoss&&!m.isBoss)player.hp=Math.max(1,player.hp-player.killHpLoss);
  if(player.resonantCore&&!m.isBoss){let cur=player.resonantStack||0;if(cur<15){player.resonantStack=(cur+1);}}
  if(m.isBoss&&player.warTrophy)player.atk+=10;
  if(player.endlessFury){let b=player.abilities.find(a=>a.name==='Berserker');if(b&&b.cd>0)b.cd=0}
  if(player.infectChance)monsters.filter(o=>Math.abs(o.x-m.x)+Math.abs(o.y-m.y)<=1&&o.hp>0).forEach(o=>o.poison=(o.poison||0)+player.infectChance);
  lvlUp();
}

function atkMon(m){
  let atk=effStat('atk')+(player.resonantStack||0);
  player.momBuff=0;
  let mult=player.berserk?2:1;
  if(player.disguise&&player.disguisedAtk)atk=Math.max(atk,player.disguisedAtk);
  if(player.legendaryEdge){mult=5;player.legendaryEdge=false}
  if(player.sacrificeStrike){mult=5;player.hp=Math.max(1,player.hp-20);player.sacrificeStrike=false;addLog('Sacrifice Strike! (-20HP)',2)}
  if(player.vengeanceDmg){atk+=player.vengeanceDmg;player.vengeanceDmg=0}
  if(m.stun>0&&player.deepFreeze)mult*=1+0.75*player.deepFreeze;
  if(m.isBoss){atk+=(player.smiteBonus||0);let has=Object.values(player.eq||{}).some(it=>it&&it.affixes&&it.affixes.some(af=>af.id==='smiteevil'));if(has)atk+=10}
  if(m.poison>0&&player.venomFangs)mult*=1+0.5*player.venomFangs;
  let manaburn=Object.values(player.eq||{}).some(it=>it&&it.affixes&&it.affixes.some(af=>af.id==='manaburn'))?4:0;
  manaburn+=(player.armorPierce||0);
  // Phantom edge: 30% double, 30% half
  if(player.phantomEdge){let r=Math.random();if(r<0.30)mult*=2;else if(r<0.60)mult*=0.5}
  let stealthMult=player.stealthed>0?(1+(player.silentStep||0)):1;
  let deathmarkHit=player.deathMark;if(deathmarkHit){mult=999;player.deathMark=false}
  let dmg=calcDmg(atk*mult*stealthMult,Math.max(0,m.def-manaburn));
  if(player.dmgMult)dmg=Math.floor(dmg*player.dmgMult); // Betrayer Ring etc. — outgoing damage boost
  if(fpMode)fpSwing=1; // first-person weapon swing
  // Elite: Shielded — first few hits are largely absorbed
  if(m.elite==='shielded'&&m.shieldHits>0){
    m.shieldHits--;
    spawnAnim('ice',player.x,player.y,m.x,m.y,'#7ad0ff');
    dmg=Math.max(1,Math.floor(dmg*0.15));
    addLog('Shield absorbs the blow! ('+m.shieldHits+' left)',8);
  }
  dmg=bossCap(m,dmg);
  m.hp-=dmg;
  spawnP(m.x,m.y,m.isBoss?'#ffaa33':'#c8e85a',m.isBoss?'boss':'hit');
  spawnAnim('slash',player.x,player.y,m.x,m.y,'#c8e85a');
  addLog('Hit '+m.name+' -'+dmg+' ('+Math.max(0,m.hp)+'/'+m.mhp+')',m.isBoss?8:1);
  if(player.doubleStrike&&Math.random()*100<player.doubleStrike){let d2=bossCap(m,calcDmg(atk,m.def));m.hp-=d2;addLog('Double Strike! -'+d2,1)}
  if(player.infectChance)m.poison=(m.poison||0)+player.infectChance;
  // Relic: cursed blade — hurt self too
  if(player.cursedBlade){let cc=player.cursedBladeCost||3;player.hp=Math.max(1,player.hp-cc);addLog('Cursed Blade bites! -'+cc+' HP',2)}
  // Relic: leech ring — steal 5 HP on hit
  if(player.leechRing){player.hp=Math.min(player.mhp,player.hp+5)}
  // Relic: thunder charm — 15% stun
  if(player.thunderCharm&&Math.random()*100<player.thunderCharm&&m.hp>0){m.stun=(m.stun||0)+1;addLog('Thunder Charm! Stunned!',4)}
  if(m.hp<=0)killMon(m);
}

function lvlUp(){
  let needed=player.level*10;
  if(player.xp>=needed){
    player.xp-=needed;player.level++;
    let hpGain=player.hpGrowth||5;
    player.mhp+=hpGain;player.hp=Math.min(player.hp+hpGain,player.mhp);player.atk++;player.def++;
    if(player.level%3===0){player.skillPts=(player.skillPts||0)+1;addLog('Skill point earned! [T] to spend',8)}
    addLog('LEVEL UP! Lv'+player.level,3);
    let cls=CLASSES.find(cl=>cl.name===player.cls);
    if(cls){
      if(player.level===7&&!player.abilities.find(a=>a.name===cls.lvl7Abil.name)){
        player.abilities.push({...cls.lvl7Abil,cd:0});
        addLog('NEW ABILITY ['+player.abilities.length+']: '+cls.lvl7Abil.name+'!',8);
      }
      if(player.level===15&&!player.abilities.find(a=>a.name===cls.lvl15Abil.name)){
        player.abilities.push({...cls.lvl15Abil,cd:0});
        addLog('ULTIMATE ['+player.abilities.length+']: '+cls.lvl15Abil.name+'!',8);
      }
    }
    lvlUp();
  }
}

function findEmptyNear(x,y){for(let r=1;r<=3;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){let nx=x+dx,ny=y+dy;if(inB(nx,ny)&&G.tiles[ny][nx]!=='#'&&!monsters.some(m=>m.x===nx&&m.y===ny&&m.hp>0))return{x:nx,y:ny}}return{x,y}}
function getNodeRank(n){return(player.treeNodes&&player.treeNodes[n])||0}
// A monster is a valid ranged target only if alive, visible, AND in line of sight
// (no wall between it and the player). Stops shooting through walls/corners.
function canTarget(m){return canTarget(m)&&hasLOS(player.x,player.y,m.x,m.y)}

// ══ ABILITIES ══
function useAbility(idx){
  if(gameOver||invOpen||merchOpen||treeOpen||relicOpen)return;
  let ab=player.abilities[idx];
  if(!ab||ab.cd>0){addLog('Not ready!',2);return}
  let atk=effStat('atk'),adm=abilDmgMult(),did=false;
  if(spellFails(ab)){addLog(ab.name+' fizzles! ('+spellFailChance()+'% fail)',2);ab.cd=Math.max(1,Math.floor(ab.max/2));doTurn();return}
  // Fireball scales with tree rank
  if(ab.name==='Fireball'){
    let fr=getNodeRank('Fireball'),fdm=(0.6+fr*0.7)*adm;
    let near=null,nd=999;monsters.forEach(m=>{if(canTarget(m)){let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<nd){nd=d;near=m}}});
    let cx=near?near.x:player.x+2,cy=near?near.y:player.y;
    spawnAnim('fireball',player.x,player.y,cx,cy,'#e87a3a');
    let h=0,dbl=Object.values(player.eq||{}).some(it=>it&&it.affixes&&it.affixes.some(af=>af.id==='fireballdouble'));
    let doHit=()=>{monsters.forEach(m=>{if(Math.abs(m.x-cx)<=1&&Math.abs(m.y-cy)<=1&&m.hp>0){let d=hurt(m,calcDmg(atk*fdm+(player.combustion||0),m.def));h++;spawnP(m.x,m.y,'#e87a3a','death');if(m.hp<=0)killMon(m)}})};
    doHit();if(dbl)doHit();
    setTimeout(()=>spawnAnim('explosion',cx,cy,cx,cy,'#e87a3a'),200);
    addLog('FIREBALL rank'+fr+': '+h+' hit!',2);did=true;
  }
  else if(ab.name==='Long Shot'){
    let rng=(ab.range||6)+(player.rangedBonus||0);
    let near=null,nd=999;monsters.forEach(m=>{if(canTarget(m)){let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<=rng&&d<nd){nd=d;near=m}}});
    if(!near){addLog('No target in range!',2);return}
    spawnAnim('fireball',player.x,player.y,near.x,near.y,'#cce85a');
    let rmult=2.2*(1+(player.rangedBonus||0)*0.06);
    let crit=(player.deadeye&&Math.random()*100<player.deadeye);
    let d=hurt(near,calcDmg(atk*rmult*adm,near.def)*(crit?2:1));
    addLog((crit?'Long Shot CRIT -':'Long Shot -')+d,crit?4:1);
    if(near.hp<=0)killMon(near);did=true;
  }
  else if(ab.name==='Multi Shot'){
    let rng=(ab.range||5)+(player.rangedBonus||0);
    let near=null,nd=999;monsters.forEach(m=>{if(canTarget(m)){let dd=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(dd<=rng&&dd<nd){nd=dd;near=m}}});
    if(!near){addLog('No target in range!',2);return}
    let dirx=Math.sign(near.x-player.x), diry=Math.sign(near.y-player.y);
    if(dirx===0&&diry===0)diry=-1;
    let hits=monsters.filter(m=>canTarget(m)&&Math.sign(m.x-player.x)===dirx&&Math.sign(m.y-player.y)===diry&&(Math.abs(m.x-player.x)+Math.abs(m.y-player.y))<=rng)
                     .sort((a,b)=>(Math.abs(a.x-player.x)+Math.abs(a.y-player.y))-(Math.abs(b.x-player.x)+Math.abs(b.y-player.y)))
                     .slice(0,3);
    let rmult=1.0*(1+(player.rangedBonus||0)*0.06);
    hits.forEach(m=>{spawnAnim('fireball',player.x,player.y,m.x,m.y,'#aadd55');let crit=(player.deadeye&&Math.random()*100<player.deadeye);let d=hurt(m,calcDmg(atk*rmult*adm,m.def)*(crit?2:1));if(m.hp<=0)killMon(m)});
    addLog('Multi Shot hits '+hits.length+'!',4);did=true;
  }
  else if(ab.name==='Cataclysm'){
    let h=0,r=3;
    monsters.forEach(m=>{if(m.hp>0&&Math.abs(m.x-player.x)<=r&&Math.abs(m.y-player.y)<=r){let d=hurt(m,calcDmg(atk*4*adm,m.def));h++;spawnP(m.x,m.y,'#ffcc33','death');if(m.hp<=0)killMon(m)}});
    spawnAnim('explosion',player.x,player.y,player.x,player.y,'#ffcc33');
    triggerShake(8,12);
    addLog('CATACLYSM! '+h+' enemies seared!',7);did=true;
  }
  else if(ab.name==='Magic Missile'){
    let near=null,nd=999;monsters.forEach(m=>{if(canTarget(m)){let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<=(ab.range||2)&&d<nd){nd=d;near=m}}});
    if(!near){addLog('No target in range!',2);return}
    spawnAnim('fireball',player.x,player.y,near.x,near.y,'#c85ae8');
    let d=hurt(near,calcDmg(atk*1.2*adm,near.def));addLog('Magic Missile -'+d,1);if(near.hp<=0)killMon(near);did=true;
  }
  else if(ab.name==='Chain Lightning'){
    let targets=[],src={x:player.x,y:player.y};
    for(let i=0;i<3;i++){
      let avail=monsters.filter(m=>m.hp>0&&!targets.includes(m)&&Math.abs(m.x-src.x)+Math.abs(m.y-src.y)<=5);
      if(!avail.length)break;
      avail.sort((a,b)=>Math.abs(a.x-src.x)+Math.abs(a.y-src.y)-(Math.abs(b.x-src.x)+Math.abs(b.y-src.y)));
      let t=avail[0];targets.push(t);
      spawnAnim('lightning',src.x,src.y,t.x,t.y,'#e8e850');
      let d=hurt(t,calcDmg(atk*1.5*adm+(player.staticBonus||0),t.def));if(t.hp<=0)killMon(t);src=t;
    }
    addLog('Chain Lightning: '+targets.length+' struck!',3);did=true;
  }
  else if(ab.name==='Frost Bolt'){
    let near=null,nd=999;monsters.forEach(m=>{if(canTarget(m)){let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<=5&&d<nd){nd=d;near=m}}});
    if(!near){addLog('No target!',2);return}
    spawnAnim('ice',player.x,player.y,near.x,near.y,'#5aaae8');
    let d=hurt(near,calcDmg(atk*2.5*adm,near.def));near.stun=2;addLog('Frost Bolt: '+near.name+' frozen -'+d,4);if(near.hp<=0)killMon(near);did=true;
  }
  else if(ab.name==='Blizzard'){
    let h=0;monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=2&&Math.abs(m.y-player.y)<=2&&m.hp>0){let d=hurt(m,calcDmg(atk*1.5*adm,m.def));m.stun=3;h++;spawnP(m.x,m.y,'#5aaae8');if(m.hp<=0)killMon(m)}});
    spawnAnim('explosion',player.x,player.y,player.x,player.y,'#5aaae8');addLog('BLIZZARD: '+h+' frozen!',4);did=true;
  }
  else if(ab.name==='Lightning Storm'){
    let h=0;monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=3&&Math.abs(m.y-player.y)<=3&&m.hp>0){spawnAnim('lightning',player.x,player.y,m.x,m.y,'#e8e850');let d=hurt(m,calcDmg(atk*2*adm+(player.staticBonus||0),m.def));h++;if(m.hp<=0)killMon(m)}});
    addLog('LIGHTNING STORM: '+h+' struck!',3);did=true;
  }
  else if(ab.name==='Heavenly Bolt'||ab.name==='Smite'){
    let best=null,bestD=999;monsters.forEach(m=>{let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<=ab.range&&m.hp>0&&d<bestD){best=m;bestD=d}});
    if(!best){addLog('No target in range!',2);return}
    spawnAnim('lightning',player.x,player.y,best.x,best.y,'#ffe050');
    let d=bossCap(best,calcDmg(atk*(ab.name==='Heavenly Bolt'?4:2.5)*adm+(player.staticBonus||0),best.def));best.hp-=d;
    addLog(ab.name+': -'+d+'!',7);if(best.hp<=0)killMon(best);did=true;
  }
  else if(ab.name==='Meteor'){
    let near=null,nd=999;monsters.forEach(m=>{if(canTarget(m)){let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<nd){nd=d;near=m}}});
    let cx=near?near.x:player.x,cy=near?near.y:player.y-3;
    spawnAnim('explosion',cx,cy,cx,cy,'#e87a3a');let h=0;
    monsters.forEach(m=>{if(Math.abs(m.x-cx)<=1&&Math.abs(m.y-cy)<=1&&m.hp>0){let d=hurt(m,calcDmg(atk*5*adm,m.def));h++;if(m.hp<=0)killMon(m)}});
    addLog('METEOR: '+h+' obliterated!',2);did=true;
  }
  else if(ab.name==='Ice Wall'){
    G.iceWall=G.iceWall||[];for(let i=-1;i<=1;i++){let wx=player.x+i,wy=player.y-1;if(inB(wx,wy))G.iceWall.push({x:wx,y:wy,turns:4})}
    addLog('Ice Wall raised!',4);did=true;
  }
  else if(ab.name==='Lava Flow'){
    G.lava=G.lava||[];let dir=player.x<cols()/2?1:-1;
    for(let i=0;i<4;i++)G.lava.push({x:player.x+dir*i,y:player.y,turns:6});
    addLog('Lava Flow!',7);did=true;
  }
  else if(ab.name==='Shield Bash'){
    let adj=monsters.filter(m=>Math.abs(m.x-player.x)+Math.abs(m.y-player.y)===1&&m.hp>0);
    if(!adj.length){addLog('No adjacent enemy!',2);return}
    adj.forEach(m=>{let d=hurt(m,calcDmg(atk*1.5,m.def));m.stun=2;spawnAnim('slash',player.x,player.y,m.x,m.y,'#5aaae8');addLog('Shield Bash: '+m.name+' stunned!',4);if(m.hp<=0)killMon(m)});did=true;
  }
  else if(ab.name==='Berserker'){player.berserk=2+(player.eq&&Object.values(player.eq).some(it=>it&&it.affixes&&it.affixes.some(af=>af.id==='warshout'))?1:0);addLog('BERSERKER RAGE!',2);did=true;}
  else if(ab.name==='War Cry'){player.atkBuff=5;player.atkBuffTurns=3;addLog('WAR CRY! +5 ATK 3 turns!',8);did=true;}
  else if(ab.name==='Battle Cry'){
    let h=0;for(let i=0;i<=3;i++)for(let dy=-1;dy<=1;dy++){let m=monsters.find(mo=>mo.x===player.x+i&&mo.y===player.y+dy&&mo.hp>0);if(m){let d=hurt(m,calcDmg(atk,m.def));h++;if(m.hp<=0)killMon(m)}}
    addLog('Battle Cry: '+h+' hit!',7);did=true;
  }
  else if(ab.name==='Whirlwind'){
    let h=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let m=monsters.find(mo=>mo.x===player.x+dx&&mo.y===player.y+dy&&mo.hp>0);if(m){let d=hurt(m,calcDmg(atk*adm,m.def));h++;spawnAnim('slash',player.x,player.y,m.x,m.y,'#e8a05a');if(m.hp<=0)killMon(m)}}
    addLog('WHIRLWIND: '+h+' enemies!',7);did=true;
  }
  else if(ab.name==='Titan Form'){player.shielded=1;player.hp=Math.min(player.mhp,player.hp+20);addLog('TITAN FORM! +20HP immune!',6);did=true;}
  else if(ab.name==='Legendary Edge'){player.legendaryEdge=true;addLog('Legendary Edge: next hit=5x!',8);did=true;}
  else if(ab.name==='Backstab'){
    let mn=monsters.find(m=>Math.abs(m.x-player.x)+Math.abs(m.y-player.y)<=1&&m.hp>0);
    if(!mn){addLog('No adjacent target!',2);return}
    let sm=player.stealthed>0?(1+(player.silentStep||0)):1;
    let d=bossCap(mn,calcDmg(atk*3*adm*sm,mn.def));mn.hp-=d;
    spawnAnim('shadow',player.x,player.y,mn.x,mn.y,'#7ae870');addLog('BACKSTAB -'+d+'!',1);if(mn.hp<=0)killMon(mn);did=true;
  }
  else if(ab.name==='Shadowstep'){
    let ep=[];for(let y=0;y<rows();y++)for(let x=0;x<cols();x++)if(G.tiles[y][x]!=='#'&&!monsters.some(m=>m.x===x&&m.y===y&&m.hp>0)&&G.vis[y][x])ep.push({x,y});
    if(!ep.length){addLog('Nowhere!',2);return}
    let t=ep[rnd(0,ep.length-1)];player.x=t.x;player.y=t.y;addLog('Shadowstep!',4);did=true;
  }
  else if(ab.name==='Poison Strike'){
    let mn=monsters.find(m=>Math.abs(m.x-player.x)+Math.abs(m.y-player.y)<=1&&m.hp>0);
    if(!mn){addLog('No adj!',2);return}
    let d=calcDmg(atk,mn.def);mn.hp-=d;mn.poison=(mn.poison||0)+3+(player.poisonBonus||0);
    spawnAnim('poison',player.x,player.y,mn.x,mn.y,'#44cc44');addLog('Poison Strike! poisoned!',9);if(mn.hp<=0)killMon(mn);did=true;
  }
  else if(ab.name==='Toxic Cloud'||ab.name==='Rot Cloud'){
    let h=0;monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=2&&Math.abs(m.y-player.y)<=2&&m.hp>0){m.poison=(m.poison||0)+4+(player.poisonBonus||0);h++}});
    spawnAnim('poison',player.x,player.y,player.x,player.y,'#44cc44');addLog('Poison cloud: '+h+' poisoned!',9);did=true;
  }
  else if(ab.name==='Death Mark'){player.deathMark=true;addLog('Death Mark: next hit slays! (bosses endure, taking massive damage)',5);did=true;}
  else if(ab.name==='Shadow Walk'){player.stealthed=3;player.ghost=3;addLog('Shadow Walk: unseen 3 turns!',5);did=true;}
  else if(ab.name==='Ghost Form'){player.ghost=2;player.shielded=2;addLog('Ghost Form: untargetable!',5);did=true;}
  else if(ab.name==='Disguise'){
    let near=monsters.find(m=>canTarget(m));
    if(!near){addLog('No visible enemy!',2);return}
    player.disguise=5;player.disguisedAtk=near.atk;addLog('Disguised as '+near.name+'!',5);did=true;
  }
  else if(ab.name==='Arcane Surge'){player.arcaneSurge=2;addLog('ARCANE SURGE: 3x spell dmg!',5);did=true;}
  else if(ab.name==='Time Stop'){monsters.forEach(m=>{m.stun=(m.stun||0)+3});addLog('TIME STOP! All stunned 3 turns!',5);did=true;}
  else if(ab.name==='Blink'){
    let ep=[];for(let y=0;y<rows();y++)for(let x=0;x<cols();x++)if(G.tiles[y][x]!=='#'&&!monsters.some(m=>m.x===x&&m.y===y&&m.hp>0))ep.push({x,y});
    let t=ep[rnd(0,ep.length-1)];player.x=t.x;player.y=t.y;addLog('Blink!',5);did=true;
  }
  else if(ab.name==='Heal'){
    let a=12+player.level*2;player.hp=Math.min(player.mhp,player.hp+a);
    spawnAnim('holy',player.x,player.y,player.x,player.y,'#ffe8aa');addLog('Healed +'+a+' HP',6);did=true;
  }
  else if(ab.name==='Holy Nova'){
    let h=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let m=monsters.find(mo=>mo.x===player.x+dx&&mo.y===player.y+dy&&mo.hp>0);if(m){let d=hurt(m,calcDmg(atk*1.5+(player.holyBonus||0),m.def));h++;spawnAnim('holy',player.x,player.y,m.x,m.y,'#ffe8aa');if(m.hp<=0)killMon(m)}}
    addLog('HOLY NOVA: '+h+' hit!',6);did=true;
  }
  else if(ab.name==='Divine Shield'){player.shielded=2;addLog('Divine Shield!',6);did=true;}
  else if(ab.name==='Sanctuary'){player.sanctuary=2;addLog('Sanctuary: dmg=1 for 2 turns!',6);did=true;}
  else if(ab.name==='Sacred Vow'){player.sacredVow=45;addLog('Sacred Vow: absorb 45 dmg!',6);did=true;}
  else if(ab.name==='Radiance'){
    let h=0;monsters.forEach(m=>{if(canTarget(m)){m.stun=Math.max(m.stun||0,3);m.blind=3;h++}});
    addLog('Radiance: '+h+' enemies blinded for 3 turns!',6);did=true;
  }
  else if(ab.name==='Holy Bolt'){
    let best=null,bestD=999;monsters.forEach(m=>{let d=Math.abs(m.x-player.x)+Math.abs(m.y-player.y);if(d<=4&&m.hp>0&&d<bestD){best=m;bestD=d}});
    if(!best){addLog('No target!',2);return}
    spawnAnim('holy',player.x,player.y,best.x,best.y,'#ffe8aa');
    let d=hurt(best,calcDmg(atk*3+(player.holyBonus||0),best.def));addLog('Holy Bolt -'+d,6);if(best.hp<=0)killMon(best);did=true;
  }
  else if(ab.name==='Sacred Ground'){
    player.sacredGround={x:player.x,y:player.y,r:1,turns:4};
    spawnAnim('holy',player.x,player.y,player.x,player.y,'#ffe8aa');addLog('Sacred Ground!',6);did=true;
  }
  else if(ab.name==='Ancient Power'){player.atkBuff=6;player.defBuff=6;player.atkBuffTurns=5;player.defBuffTurns=5;addLog('Ancient Power: +6ATK/DEF 5 turns!',6);did=true;}
  else if(ab.name==='Transcendence'){player.transcendence=1;addLog('Transcendence: cannot die 1 turn!',5);did=true;}
  else if(ab.name==='Holy Wrath'){
    let h=0;monsters.forEach(m=>{if(G.vis[m.y]&&G.vis[m.y][m.x]&&m.hp>0){spawnAnim('holy',player.x,player.y,m.x,m.y,'#ffe050');let d=hurt(m,calcDmg(atk*5*adm,m.def));h++;if(m.hp<=0)killMon(m)}});
    addLog('HOLY WRATH: '+h+' smited!',7);did=true;
  }
  else if(ab.name==='Blessed Strike'){
    let adj=monsters.filter(m=>Math.abs(m.x-player.x)+Math.abs(m.y-player.y)===1&&m.hp>0);
    if(!adj.length){addLog('No adj!',2);return}
    adj.forEach(m=>{let d=hurt(m,calcDmg(atk+5,m.def));spawnAnim('holy',player.x,player.y,m.x,m.y,'#ffe8aa');if(m.hp<=0)killMon(m)});addLog('Blessed Strike!',6);did=true;
  }
  else if(ab.name==='Lay on Hands'){player.hp=Math.min(player.mhp,player.hp+20);spawnAnim('holy',player.x,player.y,player.x,player.y,'#ffe8aa');addLog('Lay on Hands: +20HP!',6);did=true;}
  else if(ab.name==='Judgement'){
    let adj=monsters.filter(m=>Math.abs(m.x-player.x)+Math.abs(m.y-player.y)===1&&m.hp>0);
    if(!adj.length){addLog('No adj!',2);return}
    let m=adj[0];let cdBon=Object.values(player.eq||{}).some(it=>it&&it.affixes&&it.affixes.some(af=>af.id==='judgmentday'))?2:0;
    let d=hurt(m,calcDmg(atk*2+(player.smiteBonus||0),m.def));m.stun=2;
    spawnAnim('holy',player.x,player.y,m.x,m.y,'#ffe050');addLog('Judgement: -'+d+' stunned!',7);if(m.hp<=0)killMon(m);
    if(cdBon>0)ab.cd=Math.max(0,(ab.cd||0)-cdBon);did=true;
  }
  else if(ab.name==='Crusader Charge'){
    let dir=1,h=0;
    for(let i=1;i<=3;i++){let tx=player.x+dir*i,ty=player.y;if(!inB(tx,ty)||G.tiles[ty][tx]==='#')break;let m=monsters.find(mo=>mo.x===tx&&mo.y===ty&&mo.hp>0);if(m){let d=hurt(m,calcDmg(atk,m.def));h++;if(m.hp<=0)killMon(m)}player.x=tx}
    addLog('Crusader Charge! '+h+' foes!',8);did=true;
  }
  else if(ab.name==='Sacrifice Strike'){player.sacrificeStrike=true;addLog('Sacrifice Strike ready!',2);did=true;}
  else if(ab.name==='Soul Drain'){
    let adj=monsters.filter(m=>Math.abs(m.x-player.x)+Math.abs(m.y-player.y)===1&&m.hp>0);
    if(!adj.length){addLog('No adj!',2);return}
    let m=adj[0];let drain=Math.min(m.hp,8+player.level);m.hp-=drain;player.hp=Math.min(player.mhp,player.hp+drain);
    spawnAnim('shadow',m.x,m.y,player.x,player.y,'#55cc88');addLog('Soul Drain: stole '+drain+'HP!',9);if(m.hp<=0)killMon(m);did=true;
  }
  else if(ab.name==='Bone Shield'){player.shielded=3;addLog('Bone Shield: +6DEF 3 turns!',9);did=true;}
  else if(ab.name==='Corpse Burst'){
    let h=0;monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=2&&Math.abs(m.y-player.y)<=2&&m.hp>0){let d=hurt(m,calcDmg(atk*2*adm,m.def));h++;spawnP(m.x,m.y,'#55cc88','death');if(m.hp<=0)killMon(m)}});
    spawnAnim('explosion',player.x,player.y,player.x,player.y,'#55cc88');addLog('Corpse Burst: '+h+'!',9);did=true;
  }
  else if(ab.name==='Lich Form'){player.shielded=3;player.lichForm=3;addLog('LICH FORM: immune+dmg aura!',9);did=true;}
  else if(ab.name==='Raise Skeleton'||ab.name==='Summon Vampire'||ab.name==='Raise Dragon'){
    // Enforce minion cap — default 1, +1 per Army of Bones rank
    let activeMinions=monsters.filter(m=>m.isMinion&&!m._dead&&m.hp>0).length;
    let maxMinions=player.maxMinions||2;
    if(activeMinions>=maxMinions){
      addLog('Minion limit reached! ('+activeMinions+'/'+maxMinions+') Unlock Army of Bones to raise more.',2);
      return;
    }
    let reservePct=ab.name==='Summon Vampire'?0.20:ab.name==='Raise Skeleton'?0.12:0;
    let reserveAmt=Math.floor(player.mhp*reservePct);
    if(player.hp<=reserveAmt+5){addLog('Not enough HP to summon!',2);return}
    let tier=ab.name==='Raise Dragon'?9:ab.name==='Summon Vampire'?4:3; // 3=Skeleton, 4=Vampire, 9=Dragon
    let mt={...MTYPES[tier]};
    // Spawn in FRONT of the player (the way they're facing); fall back to any nearby tile.
    let fc=FACINGS[player.facing||0];
    let fx=player.x+fc.dx, fy=player.y+fc.dy;
    let slot;
    if(inB(fx,fy)&&G.tiles[fy][fx]!=='#'&&!monsters.some(m=>m.x===fx&&m.y===fy&&m.hp>0)) slot={x:fx,y:fy};
    else slot=findEmptyNear(player.x,player.y);
    let sc=1+floor*0.1;
    mt.x=slot.x;mt.y=slot.y;
    mt.hp=Math.floor(mt.hp*sc+(player.minionBonus||0));mt.mhp=mt.hp;
    mt.atk=Math.floor(mt.atk*sc);mt.def=Math.floor(mt.def*sc);
    mt.id=Math.random();mt.stun=0;mt.poison=0;mt.isMinion=true;
    mt.reservedHP=reserveAmt;
    mt.turnsLeft=40;
    mt.sight=8;
    mt.maxRange=10;
    player.hp=Math.max(1,player.hp-reserveAmt);
    monsters.push(mt);
    addLog('Summoned '+mt.name+'! ('+( activeMinions+1)+'/'+maxMinions+') Reserves '+(reservePct*100).toFixed(0)+'% HP. Despawns in 80 turns.',9);
    did=true;
  }
  else if(ab.name==='Death Nova'){
    if(player.hp<=15){addLog('Not enough HP!',2);return}
    player.hp-=15;let h=0;
    monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=2&&Math.abs(m.y-player.y)<=2&&m.hp>0){let d=hurt(m,calcDmg(atk*3,m.def));h++;if(m.hp<=0)killMon(m)}});
    spawnAnim('explosion',player.x,player.y,player.x,player.y,'#9a3a9a');addLog('Death Nova: '+h+'! (-15HP)',5);did=true;
  }
  else if(ab.name==='Soul Storm'){
    let charges=player.soulCharges||0;let h=0;
    monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=3&&Math.abs(m.y-player.y)<=3&&m.hp>0){let d=hurt(m,calcDmg(atk+charges*3,m.def));h++;spawnP(m.x,m.y,'#cc88ff');if(m.hp<=0)killMon(m)}});
    player.soulCharges=0;addLog('Soul Storm('+charges+'): '+h+'!',5);did=true;
  }
  else if(ab.name==='Rot Cloud'){
    let h=0;monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=2&&Math.abs(m.y-player.y)<=2&&m.hp>0){m.poison=(m.poison||0)+5+(player.poisonBonus||0);h++}});
    spawnAnim('poison',player.x,player.y,player.x,player.y,'#aaff77');addLog('Rot Cloud: '+h+' poisoned!',9);did=true;
  }
  else{addLog(ab.name+' triggered!',0);did=true;}
  if(did){
    if(fpMode)fpSwing=1; // first-person weapon swing on cast
    ab.cd=ab.max-(player.cdReduction||0);ab.cd=Math.max(0,ab.cd);
    if(player.abilHpCost&&player.abilHpCost>0)player.hp=Math.max(1,player.hp-player.abilHpCost);
    // Chaos Gem 10% self-damage
    if(player.chaosGem&&Math.random()<0.10){let sd=Math.floor(effStat('atk')*0.5);player.hp=Math.max(1,player.hp-sd);addLog('Chaos Gem backfires! -'+sd+' HP',2);}
    doTurn()
  }
}
window.useAbility=useAbility;

// ══ TURN ══
function doTurn(){
  turn++;
  if(player.stun>0){player.stun--;fov();updateUI();drawAll();return} // player is stunned
  if(player.berserk>0)player.berserk--;
  if(player.shielded>0)player.shielded--;
  if(player.stealthed>0){player.stealthed--;if(player.stealthed===0)player.ghost=0}
  if(player.ghost>0)player.ghost--;
  if(player.arcaneSurge>0)player.arcaneSurge--;
  if(player.disguise>0){player.disguise--;if(player.disguise===0)player.disguisedAtk=0}
  if(player.lichForm>0){player.lichForm--;if(player.lichForm>0){let d=calcDmg(effStat('atk')*2,0);monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=3&&m.hp>0&&!m.isMinion)m.hp-=d})}}
  if(player.transcendence>0){player.transcendence--;player._transc=true}else player._transc=false;
  if(player.atkBuffTurns>0){player.atkBuffTurns--;if(player.atkBuffTurns<=0)player.atkBuff=0}
  if(player.defBuffTurns>0){player.defBuffTurns--;if(player.defBuffTurns<=0)player.defBuff=0}
  if(player.sanctuary>0)player.sanctuary--;
  if(player.tempDef>0)player.tempDef=Math.max(0,player.tempDef-2);
  G.iceWall=(G.iceWall||[]).filter(w=>{w.turns--;return w.turns>0});
  G.lava=(G.lava||[]).filter(l=>{l.turns--;return l.turns>0});
  if(player.sacredGround){
    player.sacredGround.turns--;
    if(player.sacredGround.turns>0&&Math.abs(player.x-player.sacredGround.x)<=1&&Math.abs(player.y-player.sacredGround.y)<=1)
      player.hp=Math.min(player.mhp,player.hp+1);
    if(player.sacredGround.turns<=0)player.sacredGround=null;
  }
  player.abilities.forEach(a=>{if(a.cd>0)a.cd--});
  triggerAffix('onTurn');
  // Relic per-turn effects
  if(player.doomSeal)player.hp=Math.max(1,player.hp-5);
  monsters=monsters.filter(m=>m.hp>0&&!m._dead);
  // ── Environmental hazards underfoot ──
  let hz=hazardAt(player.x,player.y);
  if(hz){
    if(hz.type==='spike'&&hz.armed){
      if(player.trapDisarm){hz.armed=false;hz.sprung=true;addLog('⚙ You deftly disarm the trap!',6);spawnP(player.x,player.y,'#88cc88','hit');}
      else{
      hz.armed=false;hz.sprung=true; // becomes a visible, spent trap
      let dmg=Math.max(4,6+floor*2);
      if(player.sanctuary>0)dmg=Math.min(1,dmg);
      dmg=ironWillClamp(dmg);
      if(player.floatStep){dmg=0;addLog('You float over hidden spikes!',6)}
      else{player.hp=Math.max(0,player.hp-applyPlayerDamage(dmg));triggerShake(6,8);triggerHitFlash(0.45);
        spawnFloatNum('-'+dmg,player.x,player.y,'#ff5555',true);spawnP(player.x,player.y,'#cccccc','hit');
        addLog('Spike trap! -'+dmg,2);}
      }
    } else if(hz.type==='fire'){
      let dmg=Math.max(2,3+Math.floor(floor*0.8));
      if(player.sanctuary>0)dmg=Math.min(1,dmg);
      if(player.fireImmune){dmg=0}
      dmg=ironWillClamp(dmg);
      if(dmg>0){player.hp=Math.max(0,player.hp-applyPlayerDamage(dmg));triggerHitFlash(0.3);
        spawnFloatNum('-'+dmg,player.x,player.y,'#ff8a3a');spawnP(player.x,player.y,'#ff8a3a');
        addLog('Burning! -'+dmg,2);}
    }
  }
  moveMons();
  monsters=monsters.filter(m=>m.hp>0&&!m._dead);
  let it=items.find(i=>i.x===player.x&&i.y===player.y);
  if(it){
    if(it.type==='gold'){player.gold+=it.gold;addLog('+'+it.gold+'g!',3);items=items.filter(i=>i!==it)}
    else if(it.type==='potion'){
      let potCount=(player.inventory||[]).filter(i=>i.type==='potion').length;
      if(potCount>=5){addLog('Potion bag full! (max 5)',0)}
      else{if(it.type==='potion'||!player.inventory.some(inv=>inv.name===it.name)){player.inventory.push(it);items=items.filter(i=>i!==it);floorItemsFound++;addLog('Found: '+it.name+'!')}else{addLog('Already carrying '+it.name+'.',0)}}
    }
    else{if(!player.inventory.some(inv=>inv.name===it.name)){player.inventory.push(it);items=items.filter(i=>i!==it);addLog('Found: '+it.name+'!')}else addLog('Already have '+it.name,0)}
  }
  let onStair=G.tiles[player.y]&&G.tiles[player.y][player.x]==='>';
  let onMerch=G.merchant&&player.x===G.merchant.x&&player.y===G.merchant.y;
  if(onStair&&!player.atStair){addLog('ENTER to descend',3);player.atStair=true}
  else if(onMerch&&!player.atMerch){addLog('ENTER to visit Merchant (M)',8);player.atMerch=true}
  else if(!onStair&&!onMerch){player.atStair=false;player.atMerch=false}
  if(player.hp<=0){
    if(player._transc){player.hp=1;addLog('Transcendence saves you!',5)}
    else if(player.undyingEmber&&!player._emberUsed){
      player._emberUsed=true;player.hp=Math.floor(player.mhp*0.3);
      player.mhp=Math.max(10,player.mhp-30);
      player.hp=Math.min(player.hp,player.mhp);
      addLog('Undying Ember: Revived at 30% HP! (-30 Max HP)',6);
    }
    else if(player.martyr&&!player._martyrUsed){
      player._martyrUsed=true;player.hp=1;
      monsters.forEach(m=>{if(Math.abs(m.x-player.x)<=4&&!m.isMinion){if(m.isBoss){m.hp-=bossCap(m,m.mhp)}else m.hp=-999}});
      monsters=monsters.filter(m=>m.hp>0&&!m._dead);
      spawnAnim('explosion',player.x,player.y,player.x,player.y,'#e8c840');
      addLog('MARTYR! Death explosion! Revived at 1HP!',2);
    } else{
      if(player.warTrophy)player.atk=Math.max(1,player.atk-5);
      gameOver=true;addLog('YOU DIED...',2);clearSave();if(typeof lbOnDeath==='function')lbOnDeath()}
  }
  fov();updateUI();drawAll();updateAnims();
  saveGame();
}

function nextFloor(){
  let onMerch=G.merchant&&player.x===G.merchant.x&&player.y===G.merchant.y;
  let onStair=G.tiles[player.y]&&G.tiles[player.y][player.x]==='>';
  if(onMerch){openMerch();return}
  if(!onStair){addLog('Find the stairs (>) or Merchant (M)!',2);return}
  floor++;bossFloor=(floor%5===0);
  // Relic floor-start healing
  if(player.floorHeal){let fh=Math.floor(player.floorHeal*(player.healMult!==undefined?player.healMult:1));player.hp=Math.min(player.mhp,player.hp+fh);addLog('Relic: +'+fh+' HP (floor start)',6);}
  // Reset per-floor relic states
  if(player.phantomCloak)player.cloakActive=true;
  if(player.mirrorCurse){player.mirrorActive=true;player.mirrorBroken=false;}
  if(player.runicGamble&&bossFloor){player.atk=player.runicBaseAtk||CLASSES.find(c=>c.name===player.cls).atk;player.def=player.runicBaseDef||CLASSES.find(c=>c.name===player.cls).def;addLog('Runic Gamble: ATK/DEF reset to class base!',2);}

  // Floor summary flash
  let summaryEl=document.getElementById('floor-summary');
  if(summaryEl&&(floorKills>0||floorItemsFound>0)){
    summaryEl.textContent='Floor '+(floor-1)+' — '+floorKills+' kills · '+floorItemsFound+' items found';
    summaryEl.classList.add('show');
    setTimeout(()=>summaryEl.classList.remove('show'),2800);
  }
  floorKills=0;floorItemsFound=0;
  let _theme=getFloorTheme();
  addLog(bossFloor?'⚠ BOSS FLOOR '+floor+'!':'-- Floor '+floor+' — '+_theme.name+' --',bossFloor?7:3);
  // Floor intro card
  let introEl=document.getElementById('floor-intro');
  if(introEl){
    introEl.classList.toggle('boss',bossFloor);
    introEl.querySelector('.fi-depth').textContent=bossFloor?'BOSS FLOOR · '+floor:'FLOOR '+floor;
    introEl.querySelector('.fi-name').textContent=bossFloor?'⚔ '+( (bossOrder[Math.max(0,Math.min(Math.floor((floor-1)/5)-1,bossOrder.length-1))]||{}).name||'The Boss' )+' ⚔':_theme.name;
    introEl.classList.add('show');
    clearTimeout(introEl._t);
    introEl._t=setTimeout(()=>introEl.classList.remove('show'),2400);
  }
  // Despawn minions and restore reserved HP before changing floor
  monsters.filter(m=>m.isMinion&&!m._dead).forEach(m=>{
    if(m.reservedHP)player.hp=Math.min(player.mhp,player.hp+m.reservedHP);
  });
  mkDungeon();let rm=G.rooms[0];player.x=rm.cx;player.y=rm.cy;player.atStair=false;player.atMerch=false;
  mkMonsters();mkItems();fov();updateUI();drawAll();
  saveGame();
}

