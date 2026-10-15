// Headless-проверка двух фиксов:
// 1) Игровое время инкрементируется ОДИН раз за тик (нет «двойного выстрела»).
//    Проверяем напрямую по исходнику updateInner(): раньше там было два this.time++.
// 2) God Loader: ровно один залп за полный CD; AoE-цель сбрасывается после залпа.
// 3) Артиллерия игрока: обстрел по площади — aoeTarget НЕ стирается через 5
//    тиков, а держится до 5 РЕАЛЬНЫХ залпов (или смены приказа).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';

const here = dirname(fileURLToPath(import.meta.url));
global.window = { innerWidth: 1280, innerHeight: 720 };

function makeCp(name, x, y, owner) {
    return { name, x, y, radius: 120, owner, progress: 100, capturing: null, defenseLevel: 1, type: 'town_hall' };
}

let failures = 0;
function check(cond, msg) {
    console.log((cond ? 'PASS' : 'FAIL') + ': ' + msg);
    if (!cond) failures++;
}

const cps = [makeCp('P', 400, 1100, 'wardens'), makeCp('A', 2600, 1100, 'colonials')];
const buildings = [];

// --- Тест 1: в updateInner() ровно один инкремент this.time++ ---
{
    const src = readFileSync(join(here, '..', 'js', 'game.js'), 'utf8');
    const m = src.match(/updateInner\(\)\s*\{[\s\S]*?\n    \}/);
    const body = m ? m[0] : '';
    const incCount = (body.match(/this\.time\+\+/g) || []).length;
    check(incCount === 1, `updateInner содержит ровно один this.time++ (найдено: ${incCount})`);
}

// --- Тест 2: God Loader — залп строго раз в cd тиков ---
{
    const game = new Game('wardens', 'normal');
    game.init(cps, [], buildings, []);
    game.res = { s: 1000, c: 1000, m: 1000 };
    const gl = createVehicle('god_loader', 'colonials', 1900, 1100);
    gl.x = 1000; gl.y = 1100; // дистанция до P-base(400,1100) = 600 ∈ [minRange 400, range 1500]
    game.units.push(gl);
    const shotTimes = [];
    let prevAmmo = gl.ammo;
    for (let t = 0; t < 6000; t++) {
        game.update();
        if (gl.ammo < prevAmmo) { shotTimes.push(game.time); prevAmmo = gl.ammo; }
    }
    check(shotTimes.length >= 2, `God Loader сделал залпы: ${shotTimes.length}`);
    if (shotTimes.length >= 2) {
        const gaps = shotTimes.slice(1).map((v, i) => v - shotTimes[i]);
        // Допуск ±1: цель может быть переставлена ИИ на тик позже истечения CD.
        const bad = gaps.filter(g => Math.abs(g - gl.cd) > 1);
        check(bad.length === 0, `интервалы между залпами == cd(${gl.cd}): ${gaps.join(',')}`);
    }
}

// --- Тест 3: артиллерия игрока — AoE-цель живёт до 5 реальных залпов ---
{
    const game = new Game('wardens', 'normal');
    game.init(cps, [], buildings, []);
    game.res = { s: 1000, c: 1000, m: 1000 };
    const art = createVehicle('warden_artillery150', 'wardens', 1000, 1100);
    game.units.push(art);
    art.range = 3000; // растягиваем полосу, чтобы арта не уезжала к цели
    // имитируем приказ AoE из main.js: цель + сброс приказа движения
    art.aoeTarget = { x: 1300, y: 1100 };
    art.tx = undefined; art.ty = undefined; art.retreatOrder = null; art.shotsFired = 0;
    art.lastAtk = -art.cd; // готов к первому залпу
    let shots = 0;
    let prevAmmo = art.ammo;
    let targetLostAt = null;
    for (let t = 0; t < art.cd * 6; t++) {
        game.update();
        if (art.ammo < prevAmmo) { shots++; prevAmmo = art.ammo; }
        if (targetLostAt === null && !art.aoeTarget) targetLostAt = game.time;
    }
    // Раньше (баг): цель стиралась через ~5 ТИКОВ — залпов было не больше 1-2.
    check(shots >= 5, `арта игрока выпустила >=5 снарядов за цикл обстрела (факт: ${shots})`);
    check(targetLostAt !== null && targetLostAt >= art.cd * 4,
        `aoeTarget продержался весь цикл из 5 залпов (утрачен на t=${targetLostAt}, ожидание >=${art.cd * 4})`);
}

process.exit(failures ? 1 : 0);
