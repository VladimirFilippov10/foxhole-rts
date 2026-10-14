// ===== SABLEPORT MAP DATA =====
// Песчаная карта с гексовой сеткой: Aeyrie Bay на западе, Lake Serenity на
// северо-востоке, каменное пятно Sableport в центре.
// База варденов — самый северный город (Talonsfort), база колонистов —
// самый южный город (Barronhome).
import { gridToPos } from './constants.js';

// Grid: A-L (cols 0-11), rows 1-15 (0-14)
export const LOCATIONS = [
    // Northern part
    { name: 'Slumbering Meadow', col: 3, row: 0, type: 'label' },
    { name: 'Talonsfort', col: 2, row: 1, type: 'base' },           // база варденов (север)
    { name: 'Riven Downs', col: 8, row: 1, type: 'resource' },
    { name: 'Cinderwick', col: 5, row: 2, type: 'castle' },
    { name: 'Groggy Pinion', col: 0, row: 2, type: 'label' },
    { name: 'Wormskive', col: 11, row: 2, type: 'label' },

    // Western shore (Aeyrie Bay)
    { name: 'Aeyrie Bay', col: 1, row: 4, type: 'settlement' },
    { name: 'The Whetstone', col: 2, row: 5, type: 'workshop' },
    { name: 'Glimmerhaven', col: 1, row: 7, type: 'castle' },
    { name: "Light's End", col: 1, row: 10, type: 'settlement' },

    // Central region (Sableport stone field)
    { name: 'Waspwood', col: 4, row: 5, type: 'label' },
    { name: 'Sableport', col: 5, row: 6, type: 'castle' },
    { name: 'Creeping Drought', col: 6, row: 7, type: 'label' },
    { name: 'Lye Fields', col: 3, row: 9, type: 'label' },

    // Eastern region
    { name: 'The Pendant', col: 9, row: 5, type: 'castle' },
    { name: "The Robin's Nest", col: 10, row: 8, type: 'castle' },
    { name: "Lord's Cellar", col: 10, row: 13, type: 'resource' },

    // Southern part
    { name: 'Barronhome', col: 8, row: 12, type: 'base' },          // база колонистов (юг)
    { name: 'Simmerset', col: 4, row: 13, type: 'label' },
];

// Capture points. ВАЖНО: индекс 0 — база варденов (самый северный город),
// индекс 13 — база колонистов (самый южный город); main.js опирается на эти
// индексы при старте матча.
export const CAPTURE_POINTS = [
    { name: 'Talonsfort', col: 2, row: 1, radius: 150, owner: 'wardens', defenseLevel: 0 },       // 0 — самый северный город (база варденов)
    { name: 'Riven Downs', col: 8, row: 1, radius: 105, owner: 'neutral', defenseLevel: 0 },      // 1
    { name: 'Cinderwick', col: 5, row: 2, radius: 120, owner: 'neutral', defenseLevel: 0 },       // 2
    { name: 'The Whetstone', col: 2, row: 5, radius: 105, owner: 'neutral', defenseLevel: 0 },    // 3
    { name: 'Aeyrie Bay', col: 1, row: 4, radius: 105, owner: 'neutral', defenseLevel: 0 },       // 4
    { name: 'Glimmerhaven', col: 1, row: 7, radius: 105, owner: 'neutral', defenseLevel: 0 },     // 5
    { name: 'Waspwood', col: 4, row: 5, radius: 105, owner: 'neutral', defenseLevel: 0 },         // 6
    { name: 'Sableport', col: 5, row: 6, radius: 120, owner: 'neutral', defenseLevel: 0 },        // 7 — центр карты
    { name: 'The Pendant', col: 9, row: 5, radius: 105, owner: 'neutral', defenseLevel: 0 },      // 8
    { name: "The Robin's Nest", col: 10, row: 8, radius: 105, owner: 'neutral', defenseLevel: 0 },// 9
    { name: "Light's End", col: 1, row: 10, radius: 105, owner: 'neutral', defenseLevel: 0 },     // 10
    { name: 'Lye Fields', col: 3, row: 9, radius: 105, owner: 'neutral', defenseLevel: 0 },       // 11
    { name: "Lord's Cellar", col: 10, row: 13, radius: 105, owner: 'neutral', defenseLevel: 0 },  // 12
    { name: 'Barronhome', col: 8, row: 12, radius: 150, owner: 'colonials', defenseLevel: 0 },    // 13 — самый южный город (база колонистов)
];

// Функция для получения точек захвата с гарантированной инициализацией defenseLevel
export function getCapturePointsInWorld() {
    return CAPTURE_POINTS.map((cp, i) => ({
        id: 'cp' + i,
        name: cp.name,
        x: cp.col * 250 + 125,
        y: cp.row * 150 + 75,
        radius: cp.radius,
        owner: cp.owner,
        progress: cp.owner === 'neutral' ? 0 : 100,
        capturing: null,
        defenseLevel: cp.defenseLevel || 0, // Гарантируем инициализацию
    }));
}

// Resource mines — 10 шахт, раскиданы по всей карте
export const RESOURCE_POINTS = [
    { name: 'Iron Mine', col: 8, row: 1, radius: 50, type: 'materials' },       // Riven Downs
    { name: 'Copper Deposit', col: 2, row: 5, radius: 50, type: 'components' }, // The Whetstone
    { name: 'Coal Seam', col: 1, row: 7, radius: 50, type: 'supplies' },        // Glimmerhaven
    { name: 'Gold Vein', col: 5, row: 6, radius: 50, type: 'components' },      // Sableport (центр)
    { name: 'Salt Deposit', col: 1, row: 10, radius: 50, type: 'materials' },   // Light's End
    { name: 'Silver Lode', col: 4, row: 13, radius: 50, type: 'supplies' },     // Simmerset
    { name: 'Tin Mine', col: 5, row: 2, radius: 50, type: 'materials' },        // Cinderwick
    { name: 'Oil Field', col: 9, row: 5, radius: 50, type: 'supplies' },        // The Pendant
    { name: 'Quartz Quarry', col: 10, row: 8, radius: 50, type: 'components' }, // Robin's Nest
    { name: 'Stone Quarry', col: 8, row: 12, radius: 50, type: 'materials' },   // Barronhome
];

// Озёра: Aeyrie Bay (слева снизу) и Lake Serenity (правый верхний угол)
export const LAKES = [
    {
        name: 'Aeyrie Bay',
        col: 0,
        row: 9,
        radius: 160,
        huts: [
            { offsetX: -40, offsetY: -60 },
            { offsetX: 90, offsetY: 40 }
        ],
        docks: [
            { offsetX: 40, offsetY: 70 },
            { offsetX: 100, offsetY: -30 }
        ]
    },
    {
        name: 'Lake Serenity',
        col: 10,
        row: 0,
        radius: 120,
        huts: [
            { offsetX: -70, offsetY: 40 },
            { offsetX: 30, offsetY: 70 }
        ],
        docks: [
            { offsetX: -40, offsetY: 80 },
            { offsetX: 60, offsetY: 40 }
        ]
    }
];


// ===== TERRAIN (стиль карты Sableport) =====
// Песчаная карта с гексовой сеткой. Координаты — в мировых пикселях
// (мир 3000x2250).
export const MAP_STYLE = 'sableport';

// Каменное пятно (Sableport / Creeping Drought) — тёмная «застывшая лава»
export const STONE_PATCHES = [
    { x: 1375, y: 975, rx: 430, ry: 260, rot: -0.15, color: '#4b4a4d', label: 'Sableport' },
    { x: 1560, y: 1120, rx: 180, ry: 90, rot: 0.4, color: '#55535a', label: 'Creeping Drought' },
];

// Тёмно-бежевые пятна — возвышенности/леса (Waspwood, Groggy Pinion)
export const DARK_PATCHES = [
    { x: 1125, y: 825, rx: 260, ry: 150, rot: 0.2, color: '#a68d63', label: 'Waspwood' },
    { x: 300, y: 420, rx: 240, ry: 140, rot: -0.3, color: '#ab9268', label: 'Groggy Pinion' },
];

// Извилистые русла/овраги (тёмно-серые линии вокруг камня и Waspwood)
export const GULLIES = [
    [ { x: 700, y: 700 }, { x: 950, y: 850 }, { x: 1150, y: 820 }, { x: 1350, y: 950 } ],
    [ { x: 1600, y: 850 }, { x: 1800, y: 1000 }, { x: 1950, y: 1200 }, { x: 1900, y: 1450 } ],
    [ { x: 900, y: 1300 }, { x: 1100, y: 1200 }, { x: 1250, y: 1300 }, { x: 1500, y: 1260 } ],
];

// Мелководье — светлые «ореолы» вокруг глубокой воды
export const SHALLOWS = [
    { lakeCol: 0, lakeRow: 9, scale: 1.45 },
    { lakeCol: 10, lakeRow: 0, scale: 1.4 },
];

// Rivers removed for now - terrain is open
export const RIVER_POINTS = [];
export const WATER_ZONES = [];
export const BRIDGES = [];

// Дороги: красные — главные артерии, белые — второстепенные связи.
// Тип дороги влияет на отрисовку (renderer.drawRoads) и на скорость юнитов
// (game.isOnRoad учитывает обе сети).
export const ROADS = [
    // ===== Красная главная дорога: Talonsfort -> Cinderwick -> Riven Downs (горизонталь на севере)
    { from: [2, 1], to: [5, 2], curve: 0.15, kind: 'main' },
    { from: [5, 2], to: [8, 1], curve: -0.15, kind: 'main' },

    // Красная главная дорога: правый край вниз до Barronhome и Lord's Cellar
    { from: [8, 1], to: [9, 5], curve: 0.2, kind: 'main' },
    { from: [9, 5], to: [10, 8], curve: 0.15, kind: 'main' },
    { from: [10, 8], to: [8, 12], curve: 0.2, kind: 'main' },
    { from: [8, 12], to: [10, 13], curve: 0.15, kind: 'main' },

    // Красная главная дорога: юг — огибает Barronhome снизу и идёт к центру
    { from: [8, 12], to: [4, 13], curve: -0.25, kind: 'main' },
    { from: [4, 13], to: [3, 9], curve: 0.2, kind: 'main' },
    { from: [3, 9], to: [5, 6], curve: 0.15, kind: 'main' },

    // ===== Белые второстепенные дороги (паутинка) =====
    // Север — связки
    { from: [2, 1], to: [1, 4], curve: 0.2, kind: 'secondary' },
    { from: [8, 1], to: [10, 0], curve: 0.2, kind: 'secondary' },   // к Lake Serenity
    { from: [5, 2], to: [4, 5], curve: 0.1, kind: 'secondary' },
    { from: [5, 2], to: [9, 5], curve: 0.3, kind: 'secondary' },   // Cinderwick -> Pendant (северная перемычка)

    // Запад — береговая линия
    { from: [1, 4], to: [2, 5], curve: 0.1, kind: 'secondary' },
    { from: [2, 5], to: [1, 7], curve: 0.2, kind: 'secondary' },
    { from: [1, 7], to: [1, 10], curve: 0.15, kind: 'secondary' },
    { from: [1, 10], to: [3, 9], curve: 0.2, kind: 'secondary' },

    // Центр — вокруг Sableport
    { from: [4, 5], to: [5, 6], curve: 0.1, kind: 'secondary' },
    { from: [5, 6], to: [6, 7], curve: 0.1, kind: 'secondary' },
    { from: [6, 7], to: [3, 9], curve: 0.25, kind: 'secondary' },
    { from: [2, 5], to: [4, 5], curve: 0.15, kind: 'secondary' },

    // Восток — связки
    { from: [9, 5], to: [5, 6], curve: 0.25, kind: 'secondary' },   // Pendant <-> Sableport
    { from: [10, 8], to: [6, 7], curve: 0.2, kind: 'secondary' },   // Robin's Nest <-> центр
    { from: [10, 13], to: [4, 13], curve: 0.2, kind: 'secondary' }, // южная поперечина

    // Юг — подход к Barronhome с запада
    { from: [1, 10], to: [8, 12], curve: 0.3, kind: 'secondary' },
];

// City zones with detailed buildings
export const CITY_ZONES = [
    { col: 2, row: 1, radius: 180, buildings: 25, type: 'military' },    // Talonsfort (база варденов)
    { col: 8, row: 1, radius: 120, buildings: 15, type: 'cache' },       // Riven Downs
    { col: 5, row: 2, radius: 140, buildings: 18, type: 'castle' },      // Cinderwick
    { col: 1, row: 4, radius: 120, buildings: 15, type: 'settlement' },  // Aeyrie Bay
    { col: 2, row: 5, radius: 120, buildings: 15, type: 'workshop' },    // The Whetstone
    { col: 1, row: 7, radius: 120, buildings: 15, type: 'castle' },      // Glimmerhaven
    { col: 4, row: 5, radius: 110, buildings: 14, type: 'forest' },      // Waspwood
    { col: 5, row: 6, radius: 140, buildings: 18, type: 'castle' },      // Sableport (центр)
    { col: 9, row: 5, radius: 120, buildings: 15, type: 'castle' },      // The Pendant
    { col: 10, row: 8, radius: 120, buildings: 15, type: 'castle' },     // Robin's Nest
    { col: 1, row: 10, radius: 120, buildings: 15, type: 'settlement' }, // Light's End
    { col: 3, row: 9, radius: 110, buildings: 12, type: 'farms' },       // Lye Fields
    { col: 10, row: 13, radius: 110, buildings: 12, type: 'cellar' },    // Lord's Cellar
    { col: 8, row: 12, radius: 180, buildings: 25, type: 'walled_city' },// Barronhome (база колонистов)
];

// Trees (more variety) - avoid lakes
export const TREES = [];
for (let i = 0; i < 300; i++) {
    const x = Math.random() * 3000;
    const y = Math.random() * 2250;

    // Check if tree would be on a lake
    let onLake = false;
    for (const lake of LAKES) {
        const lakeX = lake.col * 250 + 125;
        const lakeY = lake.row * 150 + 75;
        const dist = Math.sqrt((x - lakeX) ** 2 + (y - lakeY) ** 2);
        if (dist < lake.radius + 20) {
            onLake = true;
            break;
        }
    }

    if (!onLake) {
        const type = Math.random() < 0.7 ? 'pine' : 'oak';
        TREES.push({ x, y, size: 10 + Math.random() * 8, type });
    }
}

// Bushes
export const BUSHES = [];
for (let i = 0; i < 150; i++) {
    const x = Math.random() * 3000;
    const y = Math.random() * 2250;
    BUSHES.push({ x, y, size: 5 + Math.random() * 5 });
}

// Rocks — чаще всего вокруг каменного пятна Sableport
export const ROCKS = [];
for (let i = 0; i < 80; i++) {
    let x, y;
    if (i % 2 === 0) {
        // Половина камней — вокруг центрального «озера застывшей лавы»
        const ang = Math.random() * Math.PI * 2;
        const rad = 260 + Math.random() * 220;
        x = 1375 + Math.cos(ang) * rad;
        y = 975 + Math.sin(ang) * rad * 0.6;
    } else {
        x = Math.random() * 3000;
        y = Math.random() * 2250;
    }
    ROCKS.push({ x, y, size: 4 + Math.random() * 6 });
}

// Grass patches — на песчаной карте это тёмные бежевые пятна (леса/возвышенности)
export const GRASS_PATCHES = [];
for (let i = 0; i < 120; i++) {
    GRASS_PATCHES.push({
        x: Math.random() * 3000,
        y: Math.random() * 2250,
        radius: 25 + Math.random() * 35,
    });
}

export function getLocationsInWorld() {
    return LOCATIONS.map(loc => ({
        ...loc,
        x: loc.col * 250 + 125,
        y: loc.row * 150 + 75,
    }));
}

export function getResourcePointsInWorld() {
    return RESOURCE_POINTS.map((rp, i) => ({
        id: 'mine' + i,
        name: rp.name,
        x: rp.col * 250 + 125,
        y: rp.row * 150 + 75,
        radius: rp.radius,
        owner: 'neutral',
        progress: 0,
        type: rp.type,
    }));
}
