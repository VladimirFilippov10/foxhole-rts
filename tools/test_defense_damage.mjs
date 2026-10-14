// Headless test: defense integrity must take damage from artillery & direct attacks
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';

global.window = { innerWidth: 1280, innerHeight: 720 };

function makeCp(name, x, y, owner, defenseLevel) {
    return { name, x, y, radius: 120, owner, progress: 100, capturing: null, defenseLevel, type: 'town_hall' };
}

function setup() {
    const game = new Game('wardens', 'normal');
    const playerBase = makeCp('P-base', 400, 1100, 'wardens', 1);
    const aiCity = makeCp('A-city', 2000, 1100, 'colonials', 1); // level 1: hp 300
    game.cps = [playerBase, aiCity];
    game.buildings = [
        { id: 1, type: 'town_hall', faction: 'wardens', x: 350, y: 1050, hp: 2000, maxHp: 2000 },
        { id: 2, type: 'town_hall', faction: 'colonials', x: 2050, y: 1050, hp: 2000, maxHp: 2000 },
    ];
    game.units = [];
    game.time = 0;
    return { game, aiCity };
}

let failures = 0;
function check(name, cond) {
    console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name);
    if (!cond) failures++;
}

// ===== TEST 1: Player artillery bombardment reduces city defense integrity =====
{
    const { game, aiCity } = setup();
    const art = createVehicle('gallagher_artillery150', 'wardens', 1600, 1100);
    art.aoeTarget = { x: aiCity.x, y: aiCity.y };
    game.units.push(art);
    const before = game.getCityDefenseIntegrity(aiCity);
    for (let i = 0; i < 900; i++) { game.update(); }
    const after = game.getCityDefenseIntegrity(aiCity);
    check(`artillery damages defense (before=${before}, after=${after})`, after < before);
}

// ===== TEST 2: AI artillery against player base reduces integrity =====
{
    const { game } = setup();
    const playerBase = game.cps[0];
    const art = createVehicle('colonial_artillery120', 'colonials', 900, 1100);
    art.aoeTarget = { x: playerBase.x, y: playerBase.y };
    game.units.push(art);
    const before = game.getCityDefenseIntegrity(playerBase);
    for (let i = 0; i < 900; i++) { game.update(); }
    const after = game.getCityDefenseIntegrity(playerBase);
    check(`AI artillery damages player defense (before=${before}, after=${after})`, after < before);
}

// ===== TEST 3: Tanks cannot enter city with intact defense =====
{
    const { game, aiCity } = setup();
    const tank = createVehicle('devitt', 'wardens', aiCity.x - 50, aiCity.y); // inside zone
    game.units.push(tank);
    for (let i = 0; i < 120; i++) { game.update(); }
    const d = Math.hypot(tank.x - aiCity.x, tank.y - aiCity.y);
    check(`tank pushed out of defended city (d=${Math.round(d)} > radius=${aiCity.radius})`, d > aiCity.radius - 5);
}

// ===== TEST 4: After defense destroyed, capture works and tanks can enter =====
{
    const { game, aiCity } = setup();
    // Destroy defense via artillery first
    const art = createVehicle('gallagher_artillery150', 'wardens', 1600, 1100);
    game.units.push(art);
    let brokenTick = -1;
    for (let i = 0; i < 6000 && brokenTick < 0; i++) {
        art.aoeTarget = { x: aiCity.x, y: aiCity.y }; // keep re-tasking (5-shot burst clears it)
        game.update();
        if (game.isCityDefenseBroken(aiCity)) brokenTick = i;
    }
    check(`defense eventually broken by sustained artillery (tick=${brokenTick})`, brokenTick >= 0);

    const tank = createVehicle('devitt', 'wardens', aiCity.x - 200, aiCity.y);
    tank.tx = aiCity.x; tank.ty = aiCity.y;
    game.units.push(tank);
    for (let i = 0; i < 600; i++) { game.update(); }
    const d = Math.hypot(tank.x - aiCity.x, tank.y - aiCity.y);
    check(`tank can enter undefended city (d=${Math.round(d)})`, d <= aiCity.radius);

    // Capture should proceed (no enemy units there)
    for (let i = 0; i < 1200; i++) { game.update(); }
    check(`city captured by player (owner=${aiCity.owner})`, aiCity.owner === 'wardens');
}

// ===== TEST 5: Integrity regen when no attackers =====
{
    const { game, aiCity } = setup();
    aiCity.defenseIntegrity = 100; // damaged state
    for (let i = 0; i < 60 * 120; i++) { game.update(); } // 2 minutes in-game
    const info = game.getCityDefenseDisplayInfo(aiCity);
    check(`defense regenerates to full (integrity=${info.integrity})`, info.integrity >= 300 - 1);
}

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
