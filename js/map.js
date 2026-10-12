// ===== DEADLANDS MAP DATA =====
import { gridToPos } from './constants.js';

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
export const CAPTURE_POINTS = [
    { name: "Callahan Gate", col: 1, row: 2, radius: 150, owner: 'wardens', defenseLevel: 0 },
    { name: "Callahan's Cache", col: 9, row: 1, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'The Plaza', col: 4, row: 4, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: "Callahan's Belt", col: 9, row: 4, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Catpal Trail', col: 1, row: 5, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Iron Hills', col: 6, row: 2, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Border Watch', col: 3, row: 7, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Liberation Point', col: 1, row: 8, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: "Hope's Causeway", col: 6, row: 8, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Crossroads', col: 4, row: 10, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'The Salt Farms', col: 5, row: 11, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Brine Glen', col: 9, row: 9, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'Eastern Outpost', col: 10, row: 6, radius: 105, owner: 'neutral', defenseLevel: 0 },
    { name: 'The Salt March', col: 7, row: 11, radius: 150, owner: 'colonials', defenseLevel: 0 },
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

// Resource mines - expanded to 10 mines
export const RESOURCE_POINTS = [
    { name: 'Iron Mine', col: 7, row: 1, radius: 50, type: 'materials' },
    { name: 'Copper Deposit', col: 2, row: 3, radius: 50, type: 'components' },
    { name: 'Coal Seam', col: 3, row: 6, radius: 50, type: 'supplies' },
    { name: 'Gold Vein', col: 6, row: 6, radius: 50, type: 'components' },
    { name: 'Salt Deposit', col: 2, row: 10, radius: 50, type: 'materials' },
    { name: 'Silver Lode', col: 3, row: 12, radius: 50, type: 'supplies' },
    { name: 'Tin Mine', col: 8, row: 3, radius: 50, type: 'materials' },
    { name: 'Oil Field', col: 5, row: 8, radius: 50, type: 'supplies' },
    { name: 'Quartz Quarry', col: 10, row: 4, radius: 50, type: 'components' },
    { name: 'Coal Deposit', col: 8, row: 10, radius: 50, type: 'supplies' },
];

// Lakes with fishing huts and docks
export const LAKES = [
    { 
        name: 'Lake Serenity', 
        col: 3, 
        row: 4, 
        radius: 80,
        huts: [
            { offsetX: -60, offsetY: -40 },
            { offsetX: 70, offsetY: 30 }
        ],
        docks: [
            { offsetX: -30, offsetY: 50 },
            { offsetX: 50, offsetY: -50 }
        ]
    },
    { 
        name: 'Mirror Lake', 
        col: 8, 
        row: 7, 
        radius: 70,
        huts: [
            { offsetX: -50, offsetY: 30 },
            { offsetX: 60, offsetY: -20 }
        ],
        docks: [
            { offsetX: 20, offsetY: 40 },
            { offsetX: -40, offsetY: -40 }
        ]
    },
    { 
        name: 'Bluewater Lake', 
        col: 5, 
        row: 13, 
        radius: 90,
        huts: [
            { offsetX: -70, offsetY: 20 },
            { offsetX: 80, offsetY: -30 }
        ],
        docks: [
            { offsetX: 40, offsetY: 50 },
            { offsetX: -50, offsetY: -50 }
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
    { col: 1, row: 2, radius: 180, buildings: 25, type: 'military' },
    { col: 9, row: 1, radius: 140, buildings: 18, type: 'cache' },
    { col: 4, row: 4, radius: 140, buildings: 18, type: 'plaza' },
    { col: 9, row: 4, radius: 140, buildings: 18, type: 'belt' },
    { col: 1, row: 5, radius: 120, buildings: 15, type: 'settlement' },
    { col: 6, row: 2, radius: 120, buildings: 15, type: 'mining' },
    { col: 3, row: 7, radius: 120, buildings: 15, type: 'border' },
    { col: 1, row: 8, radius: 120, buildings: 15, type: 'settlement' },
    { col: 6, row: 8, radius: 120, buildings: 15, type: 'causeway' },
    { col: 4, row: 10, radius: 120, buildings: 15, type: 'crossroads' },
    { col: 5, row: 11, radius: 120, buildings: 15, type: 'farms' },
    { col: 9, row: 9, radius: 120, buildings: 15, type: 'settlement' },
    { col: 10, row: 6, radius: 120, buildings: 15, type: 'outpost' },
    { col: 7, row: 11, radius: 180, buildings: 25, type: 'salt_march' },
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

// Rocks
export const ROCKS = [];
for (let i = 0; i < 80; i++) {
    const x = Math.random() * 3000;
    const y = Math.random() * 2250;
    ROCKS.push({ x, y, size: 4 + Math.random() * 6 });
}

// Grass patches
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
