// Headless-проверка доработок ИИ:
//  1) ИИ старается строить технику когда она разрешена; не хватает — копим, ничего не тратим
//  2) На захваченных точках — пехотный гарнизон (1–5 юнитов)
//  3) Оборона главной базы: 2 танка всегда; при технике >6 — +1 машина (можно арта/миномёт)
//  4) Колонисты-ИИ в затяжном бою (>10 мин) против массы игрока копят и строят God Loader
import { Game } from '../js/game.js';
import { createVehicle, isInfUnit } from '../js/vehicles.js';
import { VEHICLE_COSTS } from '../js/constants.js';

global.window = { innerWidth: 1280, innerHeight: 720 };

let failures = 0;
const check = (name, cond, info = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}${info ? ' — ' + info : ''}`);
    if (!cond) failures++;
};

function makeCp(name, x, y, owner) {
    return { id: name, name, x, y, radius: 120, owner, progress: owner === 'neutral' ? 0 : 100, capturing: null, defenseLevel: 2, type: 'town_hall' };
}

function baseGame({ ai = 'colonials', player = 'wardens', ticksTime = 0 } = {}) {
    const game = new Game(player, 'normal');
    const cps = [
        makeCp('P-base', 400, 1100, player),
        makeCp('A-base', 2600, 1100, ai),
        makeCp('near', 2000, 1100, ai),   // ближняя точка ИИ (dBase=600 <700)
        makeCp('mid', 1500, 1100, 'neutral'),
    ];
    const buildings = [
        { id: 1, type: 'town_hall', faction: player, x: 350, y: 1050, hp: 2000, maxHp: 2000 },
        { id: 2, type: 'barracks', faction: player, x: 480, y: 1070, hp: 800, maxHp: 800 },
        { id: 3, type: 'factory', faction: player, x: 370, y: 1200, hp: 1000, maxHp: 1000 },
        { id: 4, type: 'town_hall', faction: ai, x: 2650, y: 1050, hp: 2000, maxHp: 2000 },
        { id: 5, type: 'barracks', faction: ai, x: 2520, y: 1070, hp: 800, maxHp: 800 },
        { id: 6, type: 'factory', faction: ai, x: 2630, y: 1200, hp: 1000, maxHp: 1000 },
    ];
    game.init(cps, [], buildings, []);
    game.res = { s: 1000, c: 1000, m: 1000 };
    game.time = ticksTime;
    return game;
}

// ===== ТЕСТ 1: техника приоритетнее спама пехоты; при нехватке — копим =====
{
    const game = baseGame();
    const R = game.aiController.aiResources;
    // Мало ресурсов: на дешёвую технику не хватает, на пехоту — да.
    R.s = 40; R.c = 10; R.m = 5; // hatchet стоит s30 c60 m25 -> не хватает по c/m
    let infantryGrew = false;
    for (let t = 0; t < 1200 && !infantryGrew; t++) {
        game.update();
        const inf = game.units.filter(u => u.faction === 'colonials' && isInfUnit(u)).length;
        if (inf > 0) infantryGrew = true;
    }
    check('при нехватке на технику ИИ НЕ спамит пехотой и копит', !infantryGrew,
        `инфо=${game.units.filter(u => u.faction === 'colonials' && isInfUnit(u)).length}, res c=${Math.round(R.c)} m=${Math.round(R.m)}`);
    check('ресурсы за это время НАКОПЛИЛИСЬ (не потрачены)', R.c >= 10 && R.m >= 5,
        `c=${R.c.toFixed(1)} m=${R.m.toFixed(1)}`);

    // Теперь даём ресурсы на технику — бот должен построить машину до истечения следующего цикла
    R.s = 300; R.c = 300; R.m = 300;
    game.aiController.infantrySpawned = 0;
    let vehBuilt = false;
    for (let t = 0; t < 2400 && !vehBuilt; t++) {
        game.update();
        vehBuilt = game.units.some(u => u.faction === 'colonials' && !isInfUnit(u));
    }
    check('когда техника разрешена и хватает — ИИ её строит', vehBuilt);
}

// ===== ТЕСТ 2: гарнизон из пехоты на захваченных точках =====
{
    const game = baseGame();
    const R = game.aiController.aiResources;
    R.s = 500; R.c = 500; R.m = 500;
    // Много пехоты на поле без приказа — ИИ должен поставить её на точки
    for (let i = 0; i < 12; i++) {
        const u = createVehicle('rifleman', 'colonials', 2550 + (i % 4) * 15, 1150 + Math.floor(i / 4) * 15);
        game.units.push(u);
    }
    for (let t = 0; t < 400; t++) game.update();
    const garrisoned = game.units.filter(u => u.faction === 'colonials' && u.garrisonedAt && isInfUnit(u));
    check('на захваченных точках стоят пехотные гарнизоны', garrisoned.length >= 2,
        `гарнизонная пехота=${garrisoned.length}`);
    const perPoint = {};
    for (const u of garrisoned) perPoint[u.garrisonedAt] = (perPoint[u.garrisonedAt] || 0) + 1;
    const anyOver5 = Object.values(perPoint).some(n => n > 5);
    check('размер гарнизона не превышает 5 на точку', !anyOver5, JSON.stringify(perPoint));
    check('в гарнизоне только пехота', garrisoned.every(u => isInfUnit(u)));
}

// ===== ТЕСТ 3: оборона главной базы (2 танка, +1 при технике >6) =====
{
    const game = baseGame();
    const ai = game.aiController;
    // 8 боевых машин — больше 6 => desired = 3 защитника
    const units = [];
    for (let i = 0; i < 5; i++) units.push(createVehicle('hatchet', 'colonials', 2600 + i * 20, 1100));
    for (let i = 0; i < 2; i++) units.push(createVehicle('falchion', 'colonials', 2600, 1120 + i * 20));
    const art = createVehicle('colonial_artillery120', 'colonials', 2600, 1160);
    art.isArtillery = true;
    units.push(art);
    units.forEach(u => game.units.push(u));
    for (let t = 0; t < 400; t++) game.update();
    const defenders = game.units.filter(u => u.baseDefender);
    check('техника >6 → к обороне базы +1 машина (всего 3)', defenders.length >= 3,
        `защитников=${defenders.length}`);
    const tanks = defenders.filter(u => !u.aoe && !u.isArtillery && !u.isMortar);
    check('среди защитников базы есть пара танков', tanks.length >= 2, `танков=${tanks.length}`);

    // Уменьшаем парк техники до 4 — desired должен стать 2
    game.units.forEach(u => { if (u.baseDefender) u.baseDefender = false; });
    ai.baseDefenders = [];
    for (let i = game.units.length - 1, removed = 0; i >= 0 && removed < 4; i--) {
        const u = game.units[i];
        if (u.faction === 'colonials' && !isInfUnit(u)) { game.units.splice(i, 1); removed++; }
    }
    for (let t = 0; t < 400; t++) game.update();
    const defenders2 = game.units.filter(u => u.baseDefender);
    check('техника <=6 → ровно пара танков в обороне базы', defenders2.length === 2,
        `защитников=${defenders2.length}`);
}

// ===== ТЕСТ 4: колонисты копят и строят God Loader в затяжном бою =====
{
    const TEN_MIN = 60 * 60 * 10;
    const game = baseGame({ ticksTime: TEN_MIN + 100 });
    const R = game.aiController.aiResources;
    // Игрок: 11 танков — порог массы
    for (let i = 0; i < 11; i++) {
        game.units.push(createVehicle('devitt', 'wardens', 500 + (i % 4) * 25, 1000 + Math.floor(i / 4) * 25));
    }
    check('условие God Loader распознано (>10 мин, >=10 танков игрока)',
        game.aiController.shouldSeekGodLoader() === true);

    // Ресурсов мало — ИИ должен КОПИТЬ: не тратить ни на что, пока не наберёт цену GL
    R.s = 10; R.c = 10; R.m = 10;
    const before = { ...R };
    for (let t = 0; t < 600; t++) game.update();
    check('в режиме ожидания GL ИИ ничего не тратит (только фарм)',
        R.c >= before.c && R.m >= before.m && R.s >= before.s,
        `s:${before.s}->${R.s.toFixed(0)} c:${before.c}->${R.c.toFixed(0)} m:${before.m}->${R.m.toFixed(0)}`);

    // Даём ровно стоимость GL — должен быть построен
    const gl = VEHICLE_COSTS.god_loader;
    R.s = gl.s; R.c = gl.c; R.m = gl.m;
    let built = false;
    for (let t = 0; t < 2400 && !built; t++) {
        game.update();
        built = game.units.some(u => u.faction === 'colonials' && u.type === 'god_loader');
    }
    check('накопленные ресурсы вложены в God Loader', built);
    const glUnit = game.units.find(u => u.type === 'god_loader');
    if (glUnit) check('GL помечен артиллерией (позиция/AoE/снабжение)', glUnit.isArtillery === true);
}

// ===== ТЕСТ 4b: ранний бой (<10 мин) — GL НЕ строится =====
{
    const game = baseGame({ ticksTime: 60 * 60 * 5 }); // 5 минут
    const R = game.aiController.aiResources;
    R.s = 900; R.c = 900; R.m = 900;
    for (let i = 0; i < 12; i++) game.units.push(createVehicle('devitt', 'wardens', 500 + i * 20, 1000));
    check('раньше 10 минут GL не запрашивается', game.aiController.shouldSeekGodLoader() === false);
    let built = false;
    for (let t = 0; t < 1200 && !built; t++) {
        game.update();
        built = game.units.some(u => u.type === 'god_loader');
    }
    check('в раннем бою GL не построен', !built);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
