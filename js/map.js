// ===== DEADLANDS MAP DATA =====
// ВАЖНО: все координаты карты вычисляются через CELL_W/CELL_H/MAP_W/MAP_H из
// constants.js. В режиме графики «Классический» они увеличены ×2 (карта
// 6000×4500), а радиусы объектов и их количество умножаются на GM (масштаб)
// и DET (множитель детализации) соответственно.
import { CELL_W, CELL_H, MAP_W, MAP_H, getGraphicsScale } from './constants.js';

const GM = getGraphicsScale();          // 1 = минимализм, 2 = классический (карта ×2)
const DET = GM;                         // множитель плотности деталей (объектов на карте)

// Сетка → мировые координаты центра клетки
const gx = col => col * CELL_W + CELL_W / 2;
const gy = row => row * CELL_H + CELL_H / 2;

// Grid: A-L (cols 0-11), rows 1-15 (0-14)
export const LOCATIONS = [
    // Northern part (rows 1-4)
    { name: "Callahan's Pass", col: 11, row: 0, type: 'label' },
    { name: 'Crumbling Passage', col: 2, row: 1, type: 'hex' },
    { name: 'Waystation', col: 4, row: 1, type: 'hex' },
    { name: 'The Iron Road', col: 7, row: 1, type: 'resource' },
    { name: "Callahan's Cache", col: 9, row: 1, type: 'base' },
    { name: 'The Spine', col: 1, row: 2, type: 'base' },
    { name: "Iron's End", col: 5, row: 2, type: 'medical' },
    { name: 'The Boneyards', col: 9, row: 2, type: 'workshop' },
    { name: 'Mandible Crossroads', col: 0, row: 3, type: 'label' },
    { name: 'Marrow Chapse', col: 2, row: 3, type: 'hex' },
    { name: 'The Iron Passage', col: 5, row: 3, type: 'label' },
    { name: 'Border Thicket', col: 7, row: 3, type: 'label' },
    { name: 'Border Concourse', col: 9, row: 3, type: 'hex' },
    
    // Central upper (rows 5-6)
    { name: 'Crosspoint', col: 2, row: 4, type: 'hex' },
    { name: 'The Plaza', col: 4, row: 4, type: 'medical' },
    { name: 'Pommel Annex', col: 5, row: 4, type: 'hex' },
    { name: 'The Blade', col: 7, row: 4, type: 'workshop' },
    { name: "Callahan's Belt", col: 9, row: 4, type: 'base' },
    { name: 'Catpal Trail', col: 1, row: 5, type: 'settlement' },
    { name: 'The Crossing', col: 5, row: 5, type: 'bridge' },
    { name: 'Bunker Entrance', col: 9, row: 5, type: 'bunker' },
    
    // Central area (rows 7-9)
    { name: 'Tarsal Pathway', col: 1, row: 6, type: 'workshop' },
    { name: 'Abandoned Ward', col: 3, row: 6, type: 'label' },
    { name: 'Central Crossing', col: 4, row: 6, type: 'crossing' },
    { name: "Callahan's Boot", col: 6, row: 6, type: 'workshop' },
    { name: 'The Steppes', col: 9, row: 6, type: 'label' },
    { name: 'Outpost', col: 9, row: 7, type: 'hex' },
    { name: 'Cemetery Junction', col: 3, row: 7, type: 'label' },
    { name: 'Liberation Point', col: 1, row: 8, type: 'settlement' },
    { name: 'Sunhaven Gateway', col: 3, row: 8, type: 'hex' },
    { name: "Hope's Causeway", col: 6, row: 8, type: 'bridge' },
    
    // Southern part (rows 10-12)
    { name: 'Overgrown Pasture', col: 1, row: 9, type: 'label' },
    { name: 'Salvation Road', col: 2, row: 9, type: 'label' },
    { name: 'Flooded Fields', col: 3, row: 9, type: 'label' },
    { name: 'The Pits', col: 5, row: 9, type: 'building' },
    { name: 'Brine Glen', col: 9, row: 9, type: 'settlement' },
    { name: 'Jaspar Farm', col: 2, row: 10, type: 'label' },
    { name: 'Concrete Shallows', col: 2, row: 10, type: 'label' },
    { name: 'The Salt Trail', col: 2, row: 11, type: 'hex' },
    { name: 'The Salt Farms', col: 5, row: 11, type: 'settlement' },
    { name: 'The Salt March', col: 7, row: 11, type: 'hex' },
    
    // Deep south (rows 13-15)
    { name: 'The Great March', col: 3, row: 12, type: 'label' },
    { name: 'Path to the Sun', col: 1, row: 13, type: 'label' },
];

// Capture points - увеличенные радиусы для более медленной игры
// Базовые радиусы (минимализм); в классическом режиме умножаются на GM (×2)
export const CAPTURE_POINTS = [
    { name: "Callahan Gate", col: 1, row: 2, radius: 150 * GM, owner: 'wardens', defenseLevel: 0 },
    { name: "Callahan's Cache", col: 9, row: 1, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'The Plaza', col: 4, row: 4, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: "Callahan's Belt", col: 9, row: 4, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Catpal Trail', col: 1, row: 5, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Iron Hills', col: 6, row: 2, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Border Watch', col: 3, row: 7, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Liberation Point', col: 1, row: 8, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: "Hope's Causeway", col: 6, row: 8, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Crossroads', col: 4, row: 10, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'The Salt Farms', col: 5, row: 11, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Brine Glen', col: 9, row: 9, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'Eastern Outpost', col: 10, row: 6, radius: 105 * GM, owner: 'neutral', defenseLevel: 0 },
    { name: 'The Salt March', col: 7, row: 11, radius: 150 * GM, owner: 'colonials', defenseLevel: 0 },
];

// Функция для получения точек захвата с гарантированной инициализацией defenseLevel
export function getCapturePointsInWorld() {
    return CAPTURE_POINTS.map((cp, i) => ({
        id: 'cp' + i,
        name: cp.name,
        x: gx(cp.col),
        y: gy(cp.row),
        radius: cp.radius,
        owner: cp.owner,
        progress: cp.owner === 'neutral' ? 0 : 100,
        capturing: null,
        defenseLevel: cp.defenseLevel || 0, // Гарантируем инициализацию
    }));
}

// Resource mines - expanded to 10 mines
export const RESOURCE_POINTS = [
    { name: 'Iron Mine', col: 7, row: 1, radius: 50 * GM, type: 'materials' },
    { name: 'Copper Deposit', col: 2, row: 3, radius: 50 * GM, type: 'components' },
    { name: 'Coal Seam', col: 3, row: 6, radius: 50 * GM, type: 'supplies' },
    { name: 'Gold Vein', col: 6, row: 6, radius: 50 * GM, type: 'components' },
    { name: 'Salt Deposit', col: 2, row: 10, radius: 50 * GM, type: 'materials' },
    { name: 'Silver Lode', col: 3, row: 12, radius: 50 * GM, type: 'supplies' },
    { name: 'Tin Mine', col: 8, row: 3, radius: 50 * GM, type: 'materials' },
    { name: 'Oil Field', col: 5, row: 8, radius: 50 * GM, type: 'supplies' },
    { name: 'Quartz Quarry', col: 10, row: 4, radius: 50 * GM, type: 'components' },
    { name: 'Coal Deposit', col: 8, row: 10, radius: 50 * GM, type: 'supplies' },
];

// Lakes with fishing huts and docks
export const LAKES = [
    { 
        name: 'Lake Serenity', 
        col: 3, 
        row: 4, 
        radius: 80 * GM,
        huts: [
            { offsetX: -60 * GM, offsetY: -40 * GM },
            { offsetX: 70 * GM, offsetY: 30 * GM }
        ],
        docks: [
            { offsetX: -30 * GM, offsetY: 50 * GM },
            { offsetX: 50 * GM, offsetY: -50 * GM }
        ]
    },
    { 
        name: 'Mirror Lake', 
        col: 8, 
        row: 7, 
        radius: 70 * GM,
        huts: [
            { offsetX: -50 * GM, offsetY: 30 * GM },
            { offsetX: 60 * GM, offsetY: -20 * GM }
        ],
        docks: [
            { offsetX: 20 * GM, offsetY: 40 * GM },
            { offsetX: -40 * GM, offsetY: -40 * GM }
        ]
    },
    { 
        name: 'Bluewater Lake', 
        col: 5, 
        row: 13, 
        radius: 90 * GM,
        huts: [
            { offsetX: -70 * GM, offsetY: 20 * GM },
            { offsetX: 80 * GM, offsetY: -30 * GM }
        ],
        docks: [
            { offsetX: 40 * GM, offsetY: 50 * GM },
            { offsetX: -50 * GM, offsetY: -50 * GM }
        ]
    }
];

// Rivers removed for now - terrain is open
export const RIVER_POINTS = [];
export const WATER_ZONES = [];
export const BRIDGES = [];

// Roads - expanded network for new cities
export const ROADS = [
    // Northern route
    { from: [1, 2], to: [2, 1.5], curve: 0.3 },
    { from: [2, 1.5], to: [4, 1.2], curve: 0.2 },
    { from: [4, 1.2], to: [5, 2], curve: 0.4 },
    { from: [5, 2], to: [6, 2], curve: 0.2 },
    { from: [6, 2], to: [7, 1.5], curve: 0.3 },
    { from: [7, 1.5], to: [9, 1], curve: 0.2 },
    
    // Eastern route
    { from: [9, 1], to: [9, 2], curve: 0.1 },
    { from: [9, 2], to: [9, 4], curve: 0.2 },
    { from: [9, 4], to: [10, 6], curve: 0.3 },
    { from: [10, 6], to: [9, 9], curve: 0.4 },
    
    // Western route
    { from: [1, 2], to: [1, 5], curve: 0.2 },
    { from: [1, 5], to: [1, 8], curve: 0.3 },
    { from: [1, 8], to: [1, 11], curve: 0.2 },
    
    // Central connections
    { from: [4, 1.2], to: [4, 4], curve: 0.3 },
    { from: [4, 4], to: [5, 4], curve: 0.1 },
    { from: [5, 2], to: [5, 4], curve: 0.4 },
    { from: [3, 7], to: [4, 4], curve: 0.3 },
    { from: [3, 7], to: [1, 8], curve: 0.2 },
    { from: [6, 8], to: [4, 10], curve: 0.3 },
    { from: [6, 8], to: [10, 6], curve: 0.4 },
    
    // Southern route
    { from: [1, 8], to: [2, 9], curve: 0.3 },
    { from: [2, 9], to: [4, 10], curve: 0.2 },
    { from: [4, 10], to: [5, 11], curve: 0.3 },
    { from: [5, 11], to: [7, 11], curve: 0.2 },
    { from: [9, 9], to: [8, 10], curve: 0.2 },
    { from: [8, 10], to: [7, 11], curve: 0.3 },
];

// City zones with detailed buildings - expanded for new cities
export const CITY_ZONES = [
    { col: 1, row: 2, radius: 180 * GM, buildings: 25, type: 'military' },
    { col: 9, row: 1, radius: 140 * GM, buildings: 18, type: 'cache' },
    { col: 4, row: 4, radius: 140 * GM, buildings: 18, type: 'plaza' },
    { col: 9, row: 4, radius: 140 * GM, buildings: 18, type: 'belt' },
    { col: 1, row: 5, radius: 120 * GM, buildings: 15, type: 'settlement' },
    { col: 6, row: 2, radius: 120 * GM, buildings: 15, type: 'mining' },
    { col: 3, row: 7, radius: 120 * GM, buildings: 15, type: 'border' },
    { col: 1, row: 8, radius: 120 * GM, buildings: 15, type: 'settlement' },
    { col: 6, row: 8, radius: 120 * GM, buildings: 15, type: 'causeway' },
    { col: 4, row: 10, radius: 120 * GM, buildings: 15, type: 'crossroads' },
    { col: 5, row: 11, radius: 120 * GM, buildings: 15, type: 'farms' },
    { col: 9, row: 9, radius: 120 * GM, buildings: 15, type: 'settlement' },
    { col: 10, row: 6, radius: 120 * GM, buildings: 15, type: 'outpost' },
    { col: 7, row: 11, radius: 180 * GM, buildings: 25, type: 'salt_march' },
];

// ===== ПРИРОДА (деревья/кусты/камни/трава) =====
// В «Классическом» режиме: территория ×4 (карта ×2), количество объектов ×4
// (DET^2 — плотность на единицу площади сохраняется как детализация), а их
// размеры умножаются на GM — объекты крупнее и детальнее при том же зуме.
const rnd = (() => {
    // Детерминированный генератор (mulberry32): карта природы одинакова между
    // перезапусками в одном режиме графики.
    let t = 0x9e3779b9 ^ (GM * 0x85ebca6b);
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
})();

// Trees (more variety) - avoid lakes
export const TREES = [];
for (let i = 0; i < 300 * DET * DET; i++) {
    const x = rnd() * MAP_W;
    const y = rnd() * MAP_H;

    // Check if tree would be on a lake
    let onLake = false;
    for (const lake of LAKES) {
        const lakeX = gx(lake.col);
        const lakeY = gy(lake.row);
        const d = Math.sqrt((x - lakeX) ** 2 + (y - lakeY) ** 2);
        if (d < lake.radius + 20 * GM) {
            onLake = true;
            break;
        }
    }

    if (!onLake) {
        const r = rnd();
        const type = r < 0.5 ? 'pine' : r < 0.8 ? 'oak' : (GM > 1 ? 'birch' : 'oak');
        TREES.push({ x, y, size: (10 + rnd() * 8) * GM, type });
    }
}

// Bushes
export const BUSHES = [];
for (let i = 0; i < 150 * DET * DET; i++) {
    BUSHES.push({ x: rnd() * MAP_W, y: rnd() * MAP_H, size: (5 + rnd() * 5) * GM });
}

// Rocks
export const ROCKS = [];
for (let i = 0; i < 80 * DET * DET; i++) {
    ROCKS.push({ x: rnd() * MAP_W, y: rnd() * MAP_H, size: (4 + rnd() * 6) * GM });
}

// Grass patches
export const GRASS_PATCHES = [];
for (let i = 0; i < 120 * DET * DET; i++) {
    GRASS_PATCHES.push({
        x: rnd() * MAP_W,
        y: rnd() * MAP_H,
        radius: (25 + rnd() * 35) * GM,
    });
}

export function getLocationsInWorld() {
    return LOCATIONS.map(loc => ({
        ...loc,
        x: gx(loc.col),
        y: gy(loc.row),
    }));
}

export function getResourcePointsInWorld() {
    return RESOURCE_POINTS.map((rp, i) => ({
        id: 'mine' + i,
        name: rp.name,
        x: gx(rp.col),
        y: gy(rp.row),
        radius: rp.radius,
        owner: 'neutral',
        progress: 0,
        type: rp.type,
    }));
}
