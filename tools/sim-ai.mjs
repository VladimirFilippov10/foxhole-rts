// Headless simulation to verify AI + artillery behavior (no DOM needed)
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';
import { getCapturePointsInWorld } from '../js/map.js';

global.window = { innerWidth: 1280, innerHeight: 720 };

function makeCp(name, x, y, owner) {
    return { name, x, y, radius: 120, owner, progress: 0, capturing: null, defenseLevel: 2, type: 'town_hall' };
}

function run({ withPlayerUnits, ticks, realMap }) {
    const game = new Game('wardens', 'normal');

    let cps;
    if (realMap) {
        cps = getCapturePointsInWorld();
        cps[0].owner = 'wardens'; cps[0].progress = 100;   // Callahan Gate
        cps[13].owner = 'colonials'; cps[13].progress = 100; // The Salt March
    } else {
        const playerBase = makeCp('P-base', 400, 1100, 'wardens');
        const aiBase = makeCp('A-base', 2600, 1100, 'colonials');
        const mid = makeCp('mid', 1500, 1100, 'neutral');
        cps = [playerBase, aiBase, mid];
    }

    const buildings = [];
    const pb = realMap ? cps[0] : { x: 400, y: 1100 };
    const ab = realMap ? cps[13] : { x: 2600, y: 1100 };
    buildings.push({ id: 1, type: 'town_hall', faction: 'wardens', x: pb.x - 50, y: pb.y - 50, hp: 2000, maxHp: 2000 });
    buildings.push({ id: 2, type: 'barracks', faction: 'wardens', x: pb.x + 80, y: pb.y - 30, hp: 800, maxHp: 800 });
    buildings.push({ id: 3, type: 'factory', faction: 'wardens', x: pb.x - 30, y: pb.y + 100, hp: 1000, maxHp: 1000 });
    buildings.push({ id: 4, type: 'town_hall', faction: 'colonials', x: ab.x + 50, y: ab.y - 50, hp: 2000, maxHp: 2000 });
    buildings.push({ id: 5, type: 'barracks', faction: 'colonials', x: ab.x - 80, y: ab.y - 30, hp: 800, maxHp: 800 });
    buildings.push({ id: 6, type: 'factory', faction: 'colonials', x: ab.x + 30, y: ab.y + 100, hp: 1000, maxHp: 1000 });

    const units = [];
    if (withPlayerUnits) {
        for (let i = 0; i < 6; i++) {
            units.push(createVehicle('infantry', 'wardens', 1500 + i * 15, 1100 + i * 10));
        }
        units.push(createVehicle('warden_artillery', 'wardens', 1400, 1100));
    }

    game.init(cps, [], buildings, units);
    game.res = { s: 1000, c: 1000, m: 1000 };
    game.aiController.aiResources.s = 500;
    game.aiController.aiResources.c = 400;
    game.aiController.aiResources.m = 300;

    let artilleryEverSpawned = 0;
    let lastArtCount = 0;
    const events = [];
    for (let t = 0; t < ticks; t++) {
        game.update();
        const arts = game.units.filter(u => u.faction === 'colonials' && u.aoe);
        if (arts.length > lastArtCount) {
            events.push(`t=${game.time}: AI artillery count ${lastArtCount}->${arts.length} (spawned)`);
            artilleryEverSpawned += arts.length - lastArtCount;
        }
        if (arts.length < lastArtCount) {
            events.push(`t=${game.time}: AI artillery count ${lastArtCount}->${arts.length} (LOST)`);
        }
        lastArtCount = arts.length;
    }

    const aiUnits = game.units.filter(u => u.faction === 'colonials');
    const arts = aiUnits.filter(u => u.aoe);
    const moving = aiUnits.filter(u => u.tx !== undefined);
    console.log(`--- sim(withPlayerUnits=${withPlayerUnits}, ticks=${ticks}) ---`);
    console.log(`AI units total: ${aiUnits.length}, infantry: ${aiUnits.filter(u=>u.type==='infantry').length}, vehicles: ${aiUnits.filter(u=>u.type!=='infantry').length}`);
    console.log(`AI artillery spawned ever: ${artilleryEverSpawned}, alive now: ${arts.length}, with aoeTarget now: ${arts.filter(a=>a.aoeTarget).length}`);
    console.log(`AI units with move orders: ${moving.length}`);
    console.log(`tracers now: ${game.tracers.length}`);
    console.log(`player units alive: ${game.units.filter(u=>u.faction==='wardens').length}`);
    events.slice(0, 30).forEach(e => console.log('  event:', e));
}

run({ realMap: true, withPlayerUnits: false, ticks: 30000 });
run({ realMap: true, withPlayerUnits: true, ticks: 30000 });
run({ withPlayerUnits: true, ticks: 12000 });
