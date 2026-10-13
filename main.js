'use strict';
/* ============================================================
   Foxhole RTS — 2D (canvas)
   Механики:
   - Город (ядро) с очками целостности; захват возможен только
     после уничтожения ВСЕЙ обороны.
   - Укрепления имеют очки прочности; пока они целы, вражеская
     техника НЕ МОЖЕТ заехать на территорию города (периметр).
   - Улучшение обороны занимает время.
   - Подсветка радиусов при наведении на оборону.
   - ARTY FIX: артиллерия больше не ездит кругами —
     останавливается и стреляет стоя.
   - Окно производства перетаскивается за заголовок.
   ============================================================ */

// ---------- утилиты ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const hyp = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
const angTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
function angLerp(a, b, t){ let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * t; }
let _id = 1; const nid = () => _id++;

// ---------- конфигурация ----------
const CFG = {
  world:    { w: 3400, h: 2400 },
  city:     { x: 1700, y: 1200, r: 95, integrityMax: 1000, regenPerSec: 6, captureTime: 18 },
  perimeter:{ r: 620 },            // граница территории города
  eco:      { metalRate: 11, fuelRate: 6 },
  defense:  {
    turret: { name:'Турель',         hp: 380, dmg: 16, rate: 0.85, range: 260, cost:{metal:120,fuel:40}, buildTime: 8,  size: 15 },
    aa:     { name:'Зенитная турель',hp: 460, dmg: 10, rate: 0.30, range: 300, cost:{metal:150,fuel:60}, buildTime: 10, size: 16 },
    bunker: { name:'Бункер',         hp: 950, dmg: 22, rate: 1.7,  range: 210, cost:{metal:220,fuel:90}, buildTime: 14, size: 20 },
    costUpgBase: 90,               // базовая цена улучшения (растёт с уровнем)
    upgTimePerLevel: 6,            // секунды на уровень улучшения
    upgradeHpMul: 1.25, upgradeDmgMul: 1.3, upgradeRangeAdd: 15,
  },
  units: {
    scout:    { name:'Разведчик',  hp: 90,  dmg: 4,  rate: .5,  range: 170, speed: 165, size: 9,  cost:{metal:40, fuel:15}, time: 5,  sight: 340 },
    tank:     { name:'Танк',       hp: 320, dmg: 26, rate: 1.5, range: 150, speed: 105, size: 13, cost:{metal:130,fuel:55}, time: 12, sight: 260 },
    arty:     { name:'Артиллерия', hp: 150, dmg: 55, rate: 3.2, range: 480, speed: 80,  size: 12, cost:{metal:180,fuel:80}, time: 15, sight: 520 },
    logistic:{ name:'Логист',      hp: 160, dmg: 0,  rate: 0,   range: 0,   speed: 110, size: 12, cost:{metal:90, fuel:40}, time: 8,  sight: 220 },
  },
  enemy: {
    scout:{ name:'Разведчик',    hp: 80,  dmg: 4,  rate: .5,  range: 160, speed: 150, size: 9,  reward:{metal:10,fuel:4} },
    lite: { name:'Лёгкий танк',  hp: 190, dmg: 14, rate: 1.2, range: 140, speed: 120, size: 11, reward:{metal:25,fuel:10} },
    med:  { name:'Средний танк', hp: 420, dmg: 30, rate: 1.8, range: 150, speed: 92,  size: 14, reward:{metal:45,fuel:18} },
    heav: { name:'Тяжёлый танк', hp: 900, dmg: 55, rate: 2.6, range: 160, speed: 70,  size: 17, reward:{metal:80,fuel:32} },
    spawnStart: 22, spawnMinGap: 7,
  },
  artyBarrage: { shellCount: 6, spread: 90, perShellDmg: 70, radius: 60, reload: 1.6 },
};

// ---------- состояние ----------
const S = {
  res: { metal: 400, fuel: 180 },
  time: 0,
  city: { x: CFG.city.x, y: CFG.city.y, r: CFG.city.r,
          integrity: CFG.city.integrityMax, maxIntegrity: CFG.city.integrityMax },
  defenses: [], units: [], enemies: [],
  projectiles: [], effects: [], decals: [],
  queue: [], selected: new Set(), selDefense: null, hoverId: null,
  camera: { x: CFG.city.x, y: CFG.city.y, zoom: 1 },
  captureProgress: 0, gameOver: false, victory: false,
  nextSpawn: CFG.enemy.spawnStart, wave: 0,
  mouse: { sx: 0, sy: 0, wx: 0, wy: 0 },
};

// ---------- canvas ----------
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let W = innerWidth, H = innerHeight;
function resize(){ W = innerWidth; H = innerHeight; cvs.width = W * devicePixelRatio; cvs.height = H * devicePixelRatio; }
addEventListener('resize', resize); resize();

const toWorld = (sx, sy) => ({ x: (sx - W / 2) / S.camera.zoom + S.camera.x, y: (sy - H / 2) / S.camera.zoom + S.camera.y });

// ---------- helpers ----------
const aliveDefenses = () => S.defenses.filter(d => !d.dead);
function isInsidePerimeter(x, y){ return dist2(x, y, S.city.x, S.city.y) <= CFG.perimeter.r * CFG.perimeter.r; }

// ---------- постройка / улучшение обороны ----------
const canAfford = c => S.res.metal >= c.metal && S.res.fuel >= c.fuel;
function pay(c){ S.res.metal -= c.metal; S.res.fuel -= c.fuel; refreshUI(); }

function placeDefense(type, x, y){
  const t = CFG.defense[type];
  if (!t) return false;
  if (!isInsidePerimeter(x, y)) { toast('Оборону можно ставить только на территории города', 'bad'); return false; }
  for (const d of S.defenses) if (!d.dead && hyp(d.x - x, d.y - y) < d.size + t.size + 6) { toast('Слишком близко к другой обороне', 'bad'); return false; }
  if (hyp(x - S.city.x, y - S.city.y) < S.city.r + t.size + 8) { toast('Слишком близко к ядру города', 'bad'); return false; }
  if (!canAfford(t.cost)) { toast('Недостаточно ресурсов', 'bad'); return false; }
  pay(t.cost);
  S.defenses.push({ id: nid(), kind: 'defense', type, x, y, level: 1,
    building: true, buildRemaining: t.buildTime, totalBuild: t.buildTime,
    hp: t.hp, maxHp: t.hp, cd: 0, angle: -Math.PI / 2, dead: false, flash: 0 });
  toast(t.name + ': стройка ' + t.buildTime + 'с');
  return true;
}

function upgradeDefense(d){
  if (d.dead || d.building || d.upgrading) return;
  const cost = { metal: Math.round(CFG.defense.costUpgBase * d.level), fuel: Math.round(CFG.defense.costUpgBase * 0.4 * d.level) };
  if (!canAfford(cost)) { toast('Недостаточно ресурсов для улучшения', 'bad'); return; }
  pay(cost);
  d.upgrading = true;
  d.upgRemaining = CFG.defense.upgTimePerLevel * d.level; // время апгрейда растёт с уровнем
  d.upgTotal = d.upgRemaining;
  toast('Улучшение ' + CFG.defense[d.type].name + ' -> ур.' + (d.level + 1) + ': ' + d.upgRemaining.toFixed(0) + 'с');
}

function defStats(d){
  const t = CFG.defense[d.type], L = d.level;
  return { dmg: t.dmg * Math.pow(CFG.defense.upgradeDmgMul, L - 1),
           range: t.range + CFG.defense.upgradeRangeAdd * (L - 1), rate: t.rate };
}

// ---------- производство юнитов ----------
function queueUnit(type){
  const u = CFG.units[type];
  if (!u) return;
  if (!canAfford(u.cost)) { toast('Недостаточно ресурсов', 'bad'); return; }
  pay(u.cost);
  S.queue.push({ type, remaining: u.time, total: u.time });
}
function updateQueue(dt){
  if (!S.queue.length) return;
  const q = S.queue[0];
  q.remaining -= dt;
  if (q.remaining <= 0){
    S.queue.shift();
    const a = Math.random() * TAU, r = S.city.r + 30 + Math.random() * 40;
    spawnUnit(q.type, S.city.x + Math.cos(a) * r, S.city.y + Math.sin(a) * r);
  }
}
function spawnUnit(type, x, y){
  const t = CFG.units[type];
  S.units.push({ id: nid(), kind: 'unit', owner: 'player', type, x, y,
    angle: angTo(x, y, S.city.x, S.city.y), vx: 0, vy: 0,
    hp: t.hp, maxHp: t.hp, speed: t.speed, size: t.size, dmg: t.dmg, range: t.range, rate: t.rate,
    cd: 0, target: null, order: null, repairTarget: null, barrage: null,
    muzzle: 0, flash: 0, dead: false });
}

// ---------- ИИ юнитов игрока ----------
function nearestEnemy(x, y, maxR){
  let best = null, bd = maxR * maxR;
  for (const e of S.enemies){
    if (e.dead) continue;
    const dd = dist2(x, y, e.x, e.y);
    if (dd < bd){ bd = dd; best = e; }
  }
  return best;
}

function issueOrder(ids, wx, wy, shiftBarrage){
  for (const id of ids){
    const u = S.units.find(un => un.id === id);
    if (!u) continue;
    if (shiftBarrage && u.type === 'arty'){ startBarrage(u, wx, wy); continue; }
    u.order = { x: wx, y: wy };
    u.target = null; u.repairTarget = null; u.barrage = null;
    /* FIX "ездит кругами": приказ всегда полностью переопределяет поведение */
  }
  addDecal(wx, wy, 'order');
}

function updateUnitAI(u, dt){
  u.cd = Math.max(0, u.cd - dt);
  u.muzzle = Math.max(0, u.muzzle - dt);
  u.flash = Math.max(0, u.flash - dt);

  // --- логист: чинит укрепления ---
  if (u.type === 'logistic'){
    if (!u.repairTarget || u.repairTarget.dead || u.repairTarget.hp >= u.repairTarget.maxHp){
      let best = null, bd = 1e18;
      for (const d of S.defenses){
        if (d.dead || d.building || d.hp >= d.maxHp) continue;
        const dd = dist2(u.x, u.y, d.x, d.y);
        if (dd < bd){ bd = dd; best = d; }
      }
      u.repairTarget = best;
    }
    const rt = u.repairTarget;
    if (rt){
      const need = rt.size + 26, d = hyp(rt.x - u.x, rt.y - u.y);
      if (d > need) moveToward(u, rt.x, rt.y, dt);
      else { rt.hp = Math.min(rt.maxHp, rt.hp + 30 * dt); if (Math.random() < dt * 6) addEffect(rt.x, rt.y, 'spark', '#e8b23a'); }
    } else if (u.order) moveToward(u, u.order.x, u.order.y, dt);
    return;
  }

  // --- артиллерия: режим залпа ---
  if (u.barrage){
    const b = u.barrage;
    const stopR = CFG.artyBarrage.spread + 120;   // останавливаемся ЗА ПРЕДЕЛОМ разброса
    const d = hyp(b.x - u.x, b.y - u.y);
    if (d > stopR){ moveToward(u, b.x, b.y, dt); return; }
    u.vx = 0; u.vy = 0;                            // полная остановка — никаких кругов
    u.angle = angLerp(u.angle, angTo(u.x, u.y, b.x, b.y), Math.min(1, dt * 6));
    b.timer -= dt;
    if (b.timer <= 0 && u.cd <= 0){
      fireArtyShell(u, b);
      b.left--; u.cd = CFG.artyBarrage.reload; b.timer = 0.25;
      if (b.left <= 0) u.barrage = null;
    }
    return;
  }

  // --- выбор цели ---
  if (!u.target || u.target.dead) u.target = nearestEnemy(u.x, u.y, CFG.units[u.type].sight);
  const tgt = u.target;

  if (tgt){
    const d = hyp(tgt.x - u.x, tgt.y - u.y);
    if (u.type === 'arty'){
      /* FIX: раньше арта одновременно "подъезжала/отъезжала" для держания
         дистанции и получала разталкивание — в итоге орбита вокруг цели.
         Теперь: цель в радиусе -> СТОП и огонь; иначе — прямо к цели. */
      if (d <= u.range){ u.vx = 0; u.vy = 0; }
      else moveToward(u, tgt.x, tgt.y, dt);
      u.angle = angLerp(u.angle, angTo(u.x, u.y, tgt.x, tgt.y), Math.min(1, dt * 5));
      if (d <= u.range && u.cd <= 0){ shoot(u, tgt, u.dmg); u.cd = u.rate; }
    } else {
      if (d > u.range * 0.92) moveToward(u, tgt.x, tgt.y, dt);
      else { u.vx = 0; u.vy = 0; }                  // держим позицию, без кругов
      u.angle = angLerp(u.angle, angTo(u.x, u.y, tgt.x, tgt.y), Math.min(1, dt * 8));
      if (d <= u.range && u.cd <= 0){ shoot(u, tgt, u.dmg); u.cd = u.rate; }
    }
    return;
  }

  // --- движение по приказу (прямое, без бокового смещения) ---
  if (u.order){
    const d = hyp(u.order.x - u.x, u.order.y - u.y);
    if (d < 8){ u.order = null; u.vx = 0; u.vy = 0; return; }
    moveToward(u, u.order.x, u.order.y, dt);
  }
}

function moveToward(u, tx, ty, dt){
  const dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy) || 1;
  u.vx = dx / d * u.speed; u.vy = dy / d * u.speed;
  u.angle = angLerp(u.angle, Math.atan2(dy, dx), Math.min(1, dt * 10));
}

function shoot(u, tgt, dmg){
  u.muzzle = 0.08;
  S.projectiles.push({ x: u.x + Math.cos(u.angle) * (u.size + 4), y: u.y + Math.sin(u.angle) * (u.size + 4),
    tx: tgt.x, ty: tgt.y, tgt, spd: 620, dmg, color: '#ffd166', from: 'player', life: 1.2 });
}
function fireArtyShell(u, b){
  u.muzzle = 0.15;
  const ox = b.x + (Math.random() - .5) * CFG.artyBarrage.spread * 2;
  const oy = b.y + (Math.random() - .5) * CFG.artyBarrage.spread * 2;
  S.projectiles.push({ x: u.x, y: u.y, tx: ox, ty: oy, tgt: null, spd: 300,
    dmg: CFG.artyBarrage.perShellDmg, splash: CFG.artyBarrage.radius,
    color: '#c78bff', from: 'player', life: 3, arcing: true, arcH: 90 });
  addEffect(u.x, u.y, 'muzzle', '#c78bff');
}

// ---------- ИИ укреплений ----------
function updateDefense(d, dt){
  d.flash = Math.max(0, d.flash - dt);
  if (d.building){
    d.buildRemaining -= dt;
    if (d.buildRemaining <= 0){ d.building = false; toast(CFG.defense[d.type].name + ' готово'); }
    return;
  }
  if (d.upgrading){
    d.upgRemaining -= dt;
    if (d.upgRemaining <= 0){
      d.upgrading = false; d.level++;
      d.maxHp = Math.round(CFG.defense[d.type].hp * Math.pow(CFG.defense.upgradeHpMul, d.level - 1));
      d.hp = d.maxHp;
      toast(CFG.defense[d.type].name + ': уровень ' + d.level);
    }
    return;
  }
  d.cd = Math.max(0, d.cd - dt);
  const st = defStats(d);
  let tgt = null, bd = st.range * st.range;
  for (const e of S.enemies){
    if (e.dead) continue;
    const dd = dist2(d.x, d.y, e.x, e.y);
    if (dd < bd){ bd = dd; tgt = e; }
  }
  if (tgt){
    d.angle = angLerp(d.angle, angTo(d.x, d.y, tgt.x, tgt.y), Math.min(1, dt * 7));
    if (d.cd <= 0){
      d.cd = st.rate; d.muzzle = 0.08;
      S.projectiles.push({ x: d.x + Math.cos(d.angle) * (d.size + 4), y: d.y + Math.sin(d.angle) * (d.size + 4),
        tx: tgt.x, ty: tgt.y, tgt, spd: 640, dmg: st.dmg, color: '#7fd85e', from: 'player', life: 1.2 });
    }
  }
}

// ---------- Враги ----------
function pickEnemyType(wave){
  const pool = ['scout','scout','lite'];
  if (wave >= 2) pool.push('lite','med');
  if (wave >= 4) pool.push('med','heav');
  if (wave >= 6) pool.push('heav','med');
  return pool[Math.floor(Math.random() * pool.length)];
}
function spawnEnemy(){
  const type = pickEnemyType(S.wave);
  const t = CFG.enemy[type];
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0){ x = Math.random() * CFG.world.w; y = 40; }
  else if (side === 1){ x = CFG.world.w - 40; y = Math.random() * CFG.world.h; }
  else if (side === 2){ x = Math.random() * CFG.world.w; y = CFG.world.h - 40; }
  else { x = 40; y = Math.random() * CFG.world.h; }
  S.enemies.push({ id: nid(), kind: 'unit', owner: 'enemy', type, x, y, angle: 0,
    hp: t.hp, maxHp: t.hp, speed: t.speed, size: t.size, dmg: t.dmg, range: t.range,
    rate: t.rate, cd: 0, target: null, flash: 0, muzzle: 0, dead: false });
}

function updateEnemy(e, dt){
  e.cd = Math.max(0, e.cd - dt);
  e.flash = Math.max(0, e.flash - dt);

  let tgt = null, bd = 260 * 260;
  for (const u of S.units){
    if (u.dead) continue;
    const dd = dist2(e.x, e.y, u.x, u.y);
    if (dd < bd){ bd = dd; tgt = u; }
  }
  e.target = tgt;

  let gx = S.city.x, gy = S.city.y;
  if (tgt){ gx = tgt.x; gy = tgt.y; }
  const dx = gx - e.x, dy = gy - e.y, d = hyp(dx, dy) || 1;

  // --- БАРЬЕР: пока цела оборона, вражеская техника не заезжает на территорию города ---
  let nx = e.x + dx / d * e.speed * dt, ny = e.y + dy / d * e.speed * dt;
  const blocked = aliveDefenses().length > 0;
  if (blocked){
    const pr = CFG.perimeter.r - e.size - 4;
    const outsideNow = dist2(e.x, e.y, S.city.x, S.city.y) > pr * pr;
    const wouldEnter = dist2(nx, ny, S.city.x, S.city.y) <= pr * pr;
    if (outsideNow && wouldEnter){
      // скользим вдоль границы, внутрь не пускаем
      const a = angTo(S.city.x, S.city.y, e.x, e.y);
      nx = S.city.x + Math.cos(a) * (pr + 2);
      ny = S.city.y + Math.sin(a) * (pr + 2);
      const dirSign = ((nx - S.city.x) * (e.y - S.city.y) - (ny - S.city.y) * (e.x - S.city.x)) > 0 ? 1 : -1;
      const ta = a + dirSign * 0.6;
      nx += Math.cos(ta) * e.speed * dt * 0.4;
      ny += Math.sin(ta) * e.speed * dt * 0.4;
    }
  }
  e.x = clamp(nx, 20, CFG.world.w - 20);
  e.y = clamp(ny, 20, CFG.world.h - 20);
  e.angle = angLerp(e.angle, Math.atan2(gy - e.y, gx - e.x), Math.min(1, dt * 6));

  // стрельба по юниту
  if (tgt && dist2(e.x, e.y, tgt.x, tgt.y) <= e.range * e.range && e.cd <= 0){
    e.cd = e.rate; e.muzzle = 0.08;
    S.projectiles.push({ x: e.x, y: e.y, tx: tgt.x, ty: tgt.y, tgt, spd: 600, dmg: e.dmg,
      color: '#ff6b5a', from: 'enemy', life: 1.2 });
  }
  // атака ядра: только если обороны нет ИЛИ враг уже внутри периметра
  const nearCity = dist2(e.x, e.y, S.city.x, S.city.y) <= (S.city.r + e.size + 40) ** 2;
  const canHitCity = aliveDefenses().length === 0 || isInsidePerimeter(e.x, e.y);
  if (!tgt && nearCity && canHitCity && e.cd <= 0){
    e.cd = e.rate;
    damageCity(e.dmg);
    addEffect(S.city.x + (Math.random()-.5)*S.city.r, S.city.y + (Math.random()-.5)*S.city.r, 'spark', '#ff6b5a');
  }
}

// ---------- снаряды ----------
function updateProjectiles(dt){
  for (const p of S.projectiles){
    if (p.done) continue;
    p.life -= dt;
    if (p.life <= 0){ p.done = true; continue; }
    if (p.tgt && !p.tgt.dead){ p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy);
    const step = p.spd * dt;
    if (d <= step + (p.tgt ? p.tgt.size : 6)){ p.done = true; impact(p, p.tx, p.ty); }
    else { p.x += dx / d * step; p.y += dy / d * step; p.angle = Math.atan2(dy, dx); }
  }
  S.projectiles = S.projectiles.filter(p => !p.done);
}
function impact(p, x, y){
  if (p.splash){
    addEffect(x, y, 'boom', p.color);
    if (p.from === 'player')
      for (const e of S.enemies) if (!e.dead && dist2(e.x, e.y, x, y) <= p.splash * p.splash) dealDamage(e, p.dmg);
    return;
  }
  addEffect(x, y, 'hit', p.color);
  const tgt = p.tgt;
  if (tgt && !tgt.dead) dealDamage(tgt, p.dmg);
}
function dealDamage(o, dmg){
  o.hp -= dmg; o.flash = 0.12;
  if (o.hp <= 0 && !o.dead){
    o.dead = true;
    addEffect(o.x, o.y, 'boom', o.owner === 'enemy' ? '#ff6b5a' : '#ffd166');
    if (o.kind === 'unit' && o.owner === 'enemy'){
      const rw = CFG.enemy[o.type].reward;
      S.res.metal += rw.metal; S.res.fuel += rw.fuel;
    }
    if (o.kind === 'defense') toast(CFG.defense[o.type].name + ' уничтожено!', 'bad');
  }
}
function damageCity(dmg){ S.city.integrity = Math.max(0, S.city.integrity - dmg); }

// ---------- артподготовка ----------
function startBarrage(u, x, y){
  u.barrage = { x, y, left: CFG.artyBarrage.shellCount, timer: 0 };
  u.order = null; u.target = null;
  addDecal(x, y, 'barrage');
  toast('Залп: ' + CFG.artyBarrage.shellCount + ' снарядов');
}
function triggerFVolley(){
  const artys = S.units.filter(u => u.type === 'arty' && !u.dead);
  if (!artys.length){ toast('Нет артиллерии', 'bad'); return; }
  for (const a of artys) startBarrage(a, S.mouse.wx, S.mouse.wy);
}

// ---------- эффекты/декали ----------
function addEffect(x, y, kind, color){ S.effects.push({ x, y, kind, color, t: 0, dur: kind === 'boom' ? .5 : .25 }); }
function addDecal(x, y, kind){ S.decals.push({ x, y, kind, t: 0, dur: 1.1 }); }

// ---------- захват: только при полностью уничтоженной обороне ----------
function updateCapture(dt){
  const defendersAlive = aliveDefenses().length;
  const enemyNearCore = S.enemies.some(e => !e.dead && dist2(e.x, e.y, S.city.x, S.city.y) <= (S.city.r + 60) ** 2);
  if (defendersAlive === 0 && enemyNearCore && S.city.integrity > 0){
    S.captureProgress = Math.min(CFG.city.captureTime, S.captureProgress + dt);
    if (S.captureProgress >= CFG.city.captureTime) endGame(false, 'Город захвачен: оборона была уничтожена полностью');
  } else {
    S.captureProgress = Math.max(0, S.captureProgress - dt * 2);
  }
}
function endGame(win, msg){
  if (S.gameOver) return;
  S.gameOver = true; S.victory = win;
  toast(msg, win ? 'ok' : 'bad');
}

// ---------- цикл ----------
let last = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!S.gameOver) update(dt);
  render();
  requestAnimationFrame(frame);
}
function update(dt){
  S.time += dt;
  S.res.metal += CFG.eco.metalRate * dt;
  S.res.fuel += CFG.eco.fuelRate * dt;
  if (aliveDefenses().length === 0 && S.city.integrity < S.city.maxIntegrity)
    S.city.integrity = Math.min(S.city.maxIntegrity, S.city.integrity + CFG.city.regenPerSec * dt);

  updateQueue(dt);
  for (const d of S.defenses) if (!d.dead) updateDefense(d, dt);
  for (const u of S.units) if (!u.dead){ updateUnitAI(u, dt); u.x += u.vx * dt; u.y += u.vy * dt; }
  separateUnits(dt);
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);
  updateProjectiles(dt);

  S.nextSpawn -= dt;
  if (S.nextSpawn <= 0){
    S.wave++;
    S.nextSpawn = Math.max(CFG.enemy.spawnMinGap, CFG.enemy.spawnStart - S.wave * 1.2);
    const n = 1 + Math.floor(S.wave / 3);
    for (let i = 0; i < n; i++) setTimeout(spawnEnemy, i * 800);
  }

  S.units = S.units.filter(u => !u.dead);
  S.enemies = S.enemies.filter(e => !e.dead);
  S.defenses = S.defenses.filter(d => !d.dead);
  for (const fx of S.effects) fx.t += dt;
  S.effects = S.effects.filter(fx => fx.t < fx.dur);
  for (const dc of S.decals) dc.t += dt;
  S.decals = S.decals.filter(dc => dc.t < dc.dur);

  updateCapture(dt);
  if (S.city.integrity <= 0) endGame(false, 'Ядро города разрушено');

  const zw = W / S.camera.zoom, zh = H / S.camera.zoom;
  S.camera.x = clamp(S.camera.x, zw / 2 - 200, CFG.world.w - zw / 2 + 200);
  S.camera.y = clamp(S.camera.y, zh / 2 - 200, CFG.world.h - zh / 2 + 200);

  refreshHUD();
}
function separateUnits(){
  const all = [...S.units, ...S.enemies];
  for (let i = 0; i < all.length; i++){
    const a = all[i];
    for (let j = i + 1; j < all.length; j++){
      const b = all[j];
      const rr = a.size + b.size;
      const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
      if (d > 0 && d < rr){
        const push = (rr - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
  }
}

// ---------- отрисовка ----------
function render(){
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = '#0f1318'; ctx.fillRect(0, 0, W, H);
  const z = S.camera.zoom;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-S.camera.x, -S.camera.y);
  drawGround(); drawPerimeter(); drawDecals(); drawCity(); drawDefenses();
  drawHoverRadius(); drawSelectedRadii();
  drawUnits(); drawEnemies(); drawProjectiles(); drawEffects();
  if (marquee.active) drawMarquee();
  ctx.restore();
  drawOverlayBars();
}
function drawGround(){
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1 / S.camera.zoom;
  ctx.beginPath();
  for (let x = 0; x <= CFG.world.w; x += 100){ ctx.moveTo(x, 0); ctx.lineTo(x, CFG.world.h); }
  for (let y = 0; y <= CFG.world.h; y += 100){ ctx.moveTo(0, y); ctx.lineTo(CFG.world.w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,160,120,.12)';
  ctx.strokeRect(1, 1, CFG.world.w - 2, CFG.world.h - 2);
}
function drawPerimeter(){
  const blocked = aliveDefenses().length > 0;
  ctx.save();
  ctx.setLineDash([14, 10]); ctx.lineWidth = 2.5 / S.camera.zoom;
  ctx.strokeStyle = blocked ? 'rgba(90,169,255,.55)' : 'rgba(255,107,90,.5)';
  ctx.beginPath(); ctx.arc(S.city.x, S.city.y, CFG.perimeter.r, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  if (blocked){
    ctx.fillStyle = 'rgba(90,169,255,.05)';
    ctx.beginPath(); ctx.arc(S.city.x, S.city.y, CFG.perimeter.r, 0, TAU); ctx.fill();
  }
  ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = blocked ? 'rgba(90,169,255,.75)' : 'rgba(255,107,90,.75)';
  ctx.fillText(blocked ? 'ПЕРЕМИМЕТР: проезд вражеской техники закрыт (оборона цела)'
                       : 'ПЕРЕМИМЕТР: оборона уничтожена — проезд открыт, возможен захват',
               S.city.x, S.city.y - CFG.perimeter.r - 12);
  ctx.restore();
}
function drawCity(){
  const c = S.city;
  ctx.save();
  const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.r);
  g.addColorStop(0, '#3d5a7a'); g.addColorStop(1, '#22303f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#5aa9ff'; ctx.stroke();
  ctx.fillStyle = '#cfd8e0'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ГОРОД', c.x, c.y + 5);
  if (S.captureProgress > 0){
    ctx.strokeStyle = '#ff6b5a'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (S.captureProgress / CFG.city.captureTime)); ctx.stroke();
  }
  ctx.restore();
}
function drawDefenses(){
  for (const d of S.defenses){
    const t = CFG.defense[d.type];
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = d.flash > 0 ? '#fff' : (d.building ? '#2c3a48' : '#31444f');
    ctx.strokeStyle = d.upgrading ? '#ffd166' : '#5aa9ff';
    ctx.lineWidth = 2;
    const s = t.size;
    ctx.fillRect(-s, -s, s * 2, s * 2); ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.rotate(-Math.PI / 4);
    if (!d.building){
      ctx.rotate(d.angle);
      ctx.fillStyle = '#506a7a';
      ctx.fillRect(0, -3, s + 8, 6);
      ctx.beginPath(); ctx.arc(0, 0, s * .55, 0, TAU); ctx.fill();
      ctx.rotate(-d.angle);
      if (d.muzzle > 0) d.muzzle -= 0.016;
    }
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('\u2605'.repeat(d.level), 0, -s - 8);
    if (d.building) bar(ctx, -s, -s - 6, s * 2, 4, 1 - d.buildRemaining / d.totalBuild, '#e8b23a');
    else if (d.upgrading) bar(ctx, -s, -s - 6, s * 2, 4, 1 - d.upgRemaining / d.upgTotal, '#ffd166');
    else if (d.hp < d.maxHp) bar(ctx, -s, -s - 6, s * 2, 4, d.hp / d.maxHp, d.hp / d.maxHp > .4 ? '#6fce74' : '#ff6b5a');
    ctx.restore();
  }
}
// ПОДСВЕТКА РАДИУСА при наведении на укрепление
function drawHoverRadius(){
  const d = S.defenses.find(x => x.id === S.hoverId);
  if (!d || d.dead) return;
  const st = defStats(d);
  ctx.save();
  ctx.setLineDash([8, 6]); ctx.lineWidth = 2 / S.camera.zoom;
  ctx.strokeStyle = 'rgba(127,216,94,.85)'; ctx.fillStyle = 'rgba(127,216,94,.07)';
  ctx.beginPath(); ctx.arc(d.x, d.y, st.range, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#7fd85e'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('радиус ' + Math.round(st.range) + ' \u00b7 урон ' + st.dmg.toFixed(0) + ' \u00b7 темп ' + st.rate.toFixed(2) + 'с',
               d.x, d.y - st.range - 8);
  ctx.restore();
}
// радиусы выделенных юнитов
function drawSelectedRadii(){
  for (const id of S.selected){
    const u = S.units.find(x => x.id === id);
    if (!u || u.type === 'logistic') continue;
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5 / S.camera.zoom;
    ctx.strokeStyle = u.type === 'arty' ? 'rgba(199,139,255,.6)' : 'rgba(90,169,255,.45)';
    ctx.beginPath(); ctx.arc(u.x, u.y, u.range, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}
function drawVehicle(u, color, dark){
  ctx.save();
  ctx.translate(u.x, u.y); ctx.rotate(u.angle);
  ctx.fillStyle = u.flash > 0 ? '#ffffff' : color;
  ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
  const s = u.size;
  roundRect(ctx, -s, -s * .7, s * 2, s * 1.4, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark;
  ctx.fillRect(-s, -s * .85, s * 2, s * .25);
  ctx.fillRect(-s, s * .6, s * 2, s * .25);
  ctx.fillStyle = u.flash > 0 ? '#fff' : color;
  ctx.beginPath(); ctx.arc(0, 0, s * .5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark;
  const barrelLen = u.type === 'arty' ? s * 1.9 : s * 1.3;
  ctx.fillRect(s * .3, -1.6, barrelLen, 3.2);
  if (u.muzzle > 0){
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(s * .3 + barrelLen, 0, 4.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (u.barrage){
    ctx.save();
    ctx.strokeStyle = 'rgba(199,139,255,.8)'; ctx.setLineDash([4,4]); ctx.lineWidth = 1.5 / S.camera.zoom;
    ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.barrage.x, u.barrage.y); ctx.stroke();
    ctx.restore();
  }
}
function drawUnits(){
  for (const u of S.units){
    const sel = S.selected.has(u.id);
    drawVehicle(u, sel ? '#7fc4ff' : '#5aa9ff', '#1f3a55');
    if (sel){
      ctx.strokeStyle = '#7fd85e'; ctx.lineWidth = 1.5 / S.camera.zoom;
      ctx.beginPath(); ctx.arc(u.x, u.y, u.size + 5, 0, TAU); ctx.stroke();
    }
    if (u.hp < u.maxHp) barW(ctx, u.x, u.y - u.size - 9, 22, 3.5, u.hp / u.maxHp, '#6fce74');
    if (u.type === 'logistic'){
      ctx.fillStyle = '#e8b23a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('+', u.x, u.y + 3);
    }
  }
}
function drawEnemies(){
  for (const e of S.enemies){
    drawVehicle(e, e.flash > 0 ? '#fff' : '#ff6b5a', '#5a2018');
    if (e.hp < e.maxHp) barW(ctx, e.x, e.y - e.size - 9, 22, 3.5, e.hp / e.maxHp, '#ff6b5a');
  }
}
function drawProjectiles(){
  for (const p of S.projectiles){
    ctx.save();
    if (p.arcing){
      const t = 1 - clamp(p.life / 3, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y - Math.sin(t * Math.PI) * p.arcH, 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(199,139,255,.5)'; ctx.lineWidth = 1.5 / S.camera.zoom;
      ctx.beginPath(); ctx.arc(p.tx, p.ty, 8, 0, TAU); ctx.stroke();
    } else {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(p.angle || 0) * 8, p.y - Math.sin(p.angle || 0) * 8); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawEffects(){
  for (const f of S.effects){
    const k = f.t / f.dur;
    ctx.save(); ctx.globalAlpha = 1 - k;
    if (f.kind === 'boom'){
      ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 26, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,80,.35)';
      ctx.beginPath(); ctx.arc(f.x, f.y, 4 + k * 14, 0, TAU); ctx.fill();
    } else if (f.kind === 'hit'){
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 5, 0, TAU); ctx.fill();
    } else if (f.kind === 'spark'){
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - 1.5, f.y - 1.5 - k * 8, 3, 3);
    } else if (f.kind === 'muzzle'){
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 * (1 - k), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
function drawDecals(){
  for (const d of S.decals){
    const k = d.t / d.dur;
    ctx.save(); ctx.globalAlpha = 1 - k;
    if (d.kind === 'order'){
      ctx.strokeStyle = '#7fd85e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(d.x, d.y, 6 + k * 14, 0, TAU); ctx.stroke();
    } else if (d.kind === 'barrage'){
      ctx.strokeStyle = '#c78bff'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(d.x, d.y, CFG.artyBarrage.spread, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(d.x, d.y, 10 + (1 - k) * 20, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawMarquee(){
  ctx.save();
  ctx.strokeStyle = '#7fd85e'; ctx.fillStyle = 'rgba(127,216,94,.08)'; ctx.lineWidth = 1.5 / S.camera.zoom;
  const { x1, y1, x2, y2 } = marquee;
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.restore();
}
function drawOverlayBars(){
  if (S.gameOver){
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = S.victory ? '#7fd85e' : '#ff6b5a';
    ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(S.victory ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', W / 2, H / 2 - 10);
    ctx.fillStyle = '#cfd8e0'; ctx.font = '16px sans-serif';
    ctx.fillText('Обновите страницу, чтобы начать заново', W / 2, H / 2 + 26);
  }
}
function bar(c, x, y, w, h, p, col){ c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x, y, w * clamp(p, 0, 1), h); }
function barW(c, cx, cy, w, h, p, col){ bar(c, cx - w / 2, cy, w, h, p, col); }
function roundRect(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// ---------- ввод ----------
const marquee = { active: false, x1: 0, y1: 0, x2: 0, y2: 0, shift: false };
let placingType = null; // 'turret'|'aa'|'bunker'

cvs.addEventListener('mousedown', ev => {
  if (ev.button === 2){
    const { wx, wy } = toWorld(ev.offsetX, ev.offsetY);
    if (placingType){ placeDefense(placingType, wx, wy); placingType = null; return; }
    if (S.selected.size) issueOrder([...S.selected], wx, wy, ev.shiftKey);
    return;
  }
  if (ev.button === 0){
    marquee.active = true; marquee.shift = ev.shiftKey;
    const w = toWorld(ev.offsetX, ev.offsetY);
    marquee.x1 = w.x; marquee.y1 = w.y; marquee.x2 = w.x; marquee.y2 = w.y;
  }
});
addEventListener('mousemove', ev => {
  const rect = cvs.getBoundingClientRect();
  const sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
  S.mouse.sx = sx; S.mouse.sy = sy;
  const w = toWorld(sx, sy); S.mouse.wx = w.x; S.mouse.wy = w.y;
  if (marquee.active){ marquee.x2 = w.x; marquee.y2 = w.y; }
  let hov = null;
  for (const d of S.defenses){
    if (d.dead) continue;
    if (dist2(w.x, w.y, d.x, d.y) <= (d.size + 6) ** 2){ hov = d.id; break; }
  }
  S.hoverId = hov;
  cvs.style.cursor = hov ? 'pointer' : (placingType ? 'copy' : 'crosshair');
});
addEventListener('mouseup', () => {
  if (!marquee.active) return;
  marquee.active = false;
  const x1 = Math.min(marquee.x1, marquee.x2), x2 = Math.max(marquee.x1, marquee.x2);
  const y1 = Math.min(marquee.y1, marquee.y2), y2 = Math.max(marquee.y1, marquee.y2);
  const clicked = Math.abs(x2 - x1) < 6 && Math.abs(y2 - y1) < 6;
  if (!marquee.shift) S.selected.clear();
  if (clicked){
    const d = S.defenses.find(dd => dist2(dd.x, dd.y, x2, y2) <= (dd.size + 6) ** 2);
    if (d){ S.selDefense = d.id; }
    else {
      const u = S.units.find(uu => dist2(uu.x, uu.y, x2, y2) <= (uu.size + 6) ** 2);
      if (u) S.selected.add(u.id);
      S.selDefense = null;
    }
  } else {
    for (const u of S.units) if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) S.selected.add(u.id);
    S.selDefense = null;
  }
  refreshSelInfo();
});
cvs.addEventListener('contextmenu', ev => ev.preventDefault());
cvs.addEventListener('wheel', ev => {
  ev.preventDefault();
  S.camera.zoom = clamp(S.camera.zoom * (ev.deltaY > 0 ? 0.9 : 1.1), 0.4, 2.2);
}, { passive: false });

addEventListener('keydown', ev => {
  if (ev.repeat) return;
  const k = ev.key.toLowerCase();
  if (k === '1') setPlacing('turret');
  else if (k === '2') setPlacing('aa');
  else if (k === '3') setPlacing('bunker');
  else if (k === 'f') triggerFVolley();
  else if (k === 'escape'){ placingType = null; S.selected.clear(); S.selDefense = null; refreshSelInfo(); }
  else if (ev.key === 'Delete' && S.selDefense != null){
    const d = S.defenses.find(x => x.id === S.selDefense);
    if (d && !d.dead) sellDefense(d);
  }
});
function sellDefense(d){
  d.dead = true;
  S.res.metal += Math.round(CFG.defense[d.type].cost.metal * .5);
  S.selDefense = null; refreshSelInfo(); toast('Оборона разобрана (+50% металла)');
}
function setPlacing(t){
  placingType = t;
  toast('Кликните ПКМ внутри периметра — разместить: ' + CFG.defense[t].name);
}

// ---------- UI: панель производства — ПЕРЕТАСКИВАНИЕ ОКНА ----------
const prodPanel = document.getElementById('prodPanel');
const prodHeader = document.getElementById('prodHeader');
(function makeDraggable(panel, handle){
  let drag = null;
  handle.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || ev.target.closest('#prodCollapse')) return;
    ev.preventDefault();
    const r = panel.getBoundingClientRect();
    drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, w: r.width, h: r.height };
    panel.classList.add('dragging');
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px';
  });
  addEventListener('mousemove', ev => {
    if (!drag) return;
    const x = clamp(ev.clientX - drag.dx, 0, innerWidth - drag.w);
    const y = clamp(ev.clientY - drag.dy, 0, innerHeight - 30);
    panel.style.left = x + 'px'; panel.style.top = y + 'px';
  });
  addEventListener('mouseup', () => { if (drag){ drag = null; panel.classList.remove('dragging'); } });
})(prodPanel, prodHeader);

document.getElementById('prodCollapse').addEventListener('click', () => prodPanel.classList.toggle('collapsed'));
for (const btn of document.querySelectorAll('#prodBody button[data-unit]'))
  btn.addEventListener('click', () => queueUnit(btn.dataset.unit));

// панель информации о выбранном
const selInfo = document.getElementById('selInfo'), selInfoBody = document.getElementById('selInfoBody');
function refreshSelInfo(){
  const d = S.defenses.find(x => x.id === S.selDefense);
  if (!d){
    if (S.selected.size){
      selInfo.classList.remove('hidden');
      const us = S.units.filter(u => S.selected.has(u.id));
      const by = {};
      for (const u of us) by[u.type] = (by[u.type] || 0) + 1;
      selInfoBody.innerHTML = '<div class="si-title">Юниты: ' + us.length + '</div>' +
        Object.entries(by).map(([t, n]) => '<div class="si-row"><span class="k">' + CFG.units[t].name + '</span><b>' + n + '</b></div>').join('') +
        '<div class="si-row"><span class="k">F</span><span>залп всей артиллерии в точку под курсором</span></div>';
    } else selInfo.classList.add('hidden');
    return;
  }
  selInfo.classList.remove('hidden');
  const t = CFG.defense[d.type], st = defStats(d);
  const upgCost = Math.round(CFG.defense.costUpgBase * d.level);
  const upgTime = CFG.defense.upgTimePerLevel * d.level;
  selInfoBody.innerHTML =
    '<div class="si-title">' + t.name + ' <span style="color:#ffd166">\u2605' + d.level + '</span></div>' +
    '<div class="hpbar"><i style="width:' + (d.hp / d.maxHp * 100).toFixed(0) + '%"></i></div>' +
    '<div class="si-row"><span class="k">Прочность</span><b>' + Math.ceil(d.hp) + '/' + d.maxHp + '</b></div>' +
    '<div class="si-row"><span class="k">Радиус</span><b>' + Math.round(st.range) + '</b></div>' +
    '<div class="si-row"><span class="k">Урон</span><b>' + st.dmg.toFixed(0) + '</b></div>' +
    (d.building ? '<div class="si-row"><span class="k">Стройка</span><b>' + d.buildRemaining.toFixed(1) + 'с</b></div>' : '') +
    (d.upgrading ? '<div class="si-row"><span class="k">Улучшение</span><b>' + d.upgRemaining.toFixed(1) + 'с</b></div>' : '') +
    '<div style="margin-top:6px;display:flex;gap:6px">' +
    '<button id="btnUpg" style="flex:1;padding:5px;background:#232c36;color:#cfd8e0;border:1px solid #37424f;border-radius:5px;cursor:pointer">Улучшить (' + upgCost + 'м, ' + upgTime + 'с)</button>' +
    '<button id="btnSell" style="padding:5px 8px;background:#232c36;color:#ff6b5a;border:1px solid #37424f;border-radius:5px;cursor:pointer">Снести</button></div>';
  document.getElementById('btnUpg').onclick = () => { upgradeDefense(d); refreshSelInfo(); };
  document.getElementById('btnSell').onclick = () => sellDefense(d);
}

// ---------- HUD ----------
const $ = id => document.getElementById(id);
function refreshUI(){
  $('resMetal').textContent = Math.floor(S.res.metal);
  $('resFuel').textContent = Math.floor(S.res.fuel);
  for (const [t, u] of Object.entries(CFG.units)){
    const el = $('cost-' + t);
    if (el) el.textContent = u.cost.metal + 'м ' + u.cost.fuel + 'т \u00b7 ' + u.time + 'с';
    const btn = document.querySelector('button[data-unit="' + t + '"]');
    if (btn) btn.disabled = !canAfford(u.cost);
  }
  $('queueList').textContent = S.queue.map(q => CFG.units[q.type].name + ' (' + Math.ceil(q.remaining) + 'с)').join(', ') || '\u2014';
}
function refreshHUD(){
  $('resMetal').textContent = Math.floor(S.res.metal);
  $('resFuel').textContent = Math.floor(S.res.fuel);
  const p = S.city.integrity / S.city.maxIntegrity;
  const barEl = $('integBar');
  barEl.style.width = (p * 100).toFixed(1) + '%';
  barEl.parentElement.className = 'bar big' + (p < .3 ? ' bad' : p < .6 ? ' warn' : '');
  $('integPct').textContent = Math.round(p * 100) + '%';
  $('defCount').textContent = aliveDefenses().length;
  $('enemyCount').textContent = S.enemies.length;
  const m = Math.floor(S.time / 60), sec = String(Math.floor(S.time % 60)).padStart(2, '0');
  $('timer').textContent = m + ':' + sec;
  if ((S.time * 4 | 0) !== refreshHUD._q){ refreshHUD._q = S.time * 4 | 0; refreshUI(); if (S.selDefense != null) refreshSelInfo(); }
}

// ---------- тосты ----------
const toastsEl = document.getElementById('toasts');
function toast(msg, cls){
  const el = document.createElement('div');
  el.className = 'toast ' + (cls || ''); el.textContent = msg;
  toastsEl.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2600);
}

// ---------- старт ----------
function init(){
  const ring = [ ['turret', -0.5], ['turret', 0.5], ['aa', 2.2], ['bunker', 3.6] ];
  for (const [type, a] of ring){
    const r = CFG.perimeter.r * 0.75;
    S.defenses.push({ id: nid(), kind: 'defense', type, x: S.city.x + Math.cos(a) * r, y: S.city.y + Math.sin(a) * r,
      level: 1, building: false, hp: CFG.defense[type].hp, maxHp: CFG.defense[type].hp, cd: 0, angle: a + Math.PI, dead: false, flash: 0 });
  }
  spawnUnit('scout', S.city.x + 140, S.city.y + 40);
  spawnUnit('tank', S.city.x - 140, S.city.y + 60);
  spawnUnit('arty', S.city.x, S.city.y - 160);
  spawnUnit('logistic', S.city.x + 60, S.city.y - 120);
  refreshUI();
  toast('Защищайте город! Наведите курсор на оборону, чтобы увидеть её радиус.');
  requestAnimationFrame(frame);
}
init();
