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
    
    // River area (rows 7-9)
    { name: 'Tarsal Pathway', col: 1, row: 6, type: 'workshop' },
    { name: 'Abandoned Ward', col: 3, row: 6, type: 'label' },
    { name: 'Waterfoot Gap', col: 4, row: 6, type: 'ford' },
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
    { name: 'Flooded Fields', col: 3, row: 9, type: 'water_zone' },
    { name: 'The Pits', col: 5, row: 9, type: 'building' },
    { name: 'Brine Glen', col: 9, row: 9, type: 'settlement' },
    { name: 'Jaspar Farm', col: 2, row: 10, type: 'label' },
    { name: 'Concrete Shallows', col: 2, row: 10, type: 'water_zone' },
    { name: 'The Salt Trail', col: 2, row: 11, type: 'hex' },
    { name: 'The Salt Farms', col: 5, row: 11, type: 'settlement' },
    { name: 'The Salt March', col: 7, row: 11, type: 'hex' },
    
    // Deep south (rows 13-15)
    { name: 'The Great March', col: 3, row: 12, type: 'label' },
    { name: 'Path to the Sun', col: 1, row: 13, type: 'label' },
];

// Capture points
export const CAPTURE_POINTS = [
    { name: "Callahan Gate", col: 1, row: 2, radius: 100, owner: 'wardens' }, // The Spine - Wardens base
    { name: "Callahan's Cache", col: 9, row: 1, radius: 70, owner: 'neutral' },
    { name: 'The Plaza', col: 4, row: 4, radius: 70, owner: 'neutral' },
    { name: "Callahan's Belt", col: 9, row: 4, radius: 70, owner: 'neutral' },
    { name: 'Catpal Trail', col: 1, row: 5, radius: 70, owner: 'neutral' },
    { name: 'Liberation Point', col: 1, row: 8, radius: 70, owner: 'neutral' },
    { name: "Hope's Causeway", col: 6, row: 8, radius: 70, owner: 'neutral' },
    { name: 'The Salt Farms', col: 5, row: 11, radius: 70, owner: 'neutral' },
    { name: 'Brine Glen', col: 9, row: 9, radius: 70, owner: 'neutral' },
    { name: 'The Salt March', col: 7, row: 11, radius: 100, owner: 'colonials' }, // Colonials base
];

// Resource mines
export const RESOURCE_POINTS = [
    { name: 'Iron Mine', col: 7, row: 1, radius: 50, type: 'materials' },
    { name: 'Copper Deposit', col: 2, row: 3, radius: 50, type: 'components' },
    { name: 'Coal Seam', col: 3, row: 6, radius: 50, type: 'supplies' },
    { name: 'Gold Vein', col: 6, row: 6, radius: 50, type: 'components' },
    { name: 'Salt Deposit', col: 2, row: 10, radius: 50, type: 'materials' },
    { name: 'Silver Lode', col: 3, row: 12, radius: 50, type: 'supplies' },
];

// Main river - winding with loop in center
export const RIVER_POINTS = [
    gridToPos(0.5, 5.5),  // Enters from left at B6
    gridToPos(1.5, 5.8),  // B6-C6
    gridToPos(2.5, 6.2),  // C6-D6
    gridToPos(3.5, 6.5),  // D6-E6
    gridToPos(4.5, 6.8),  // E6-F6 (The Crossing)
    gridToPos(5.0, 7.2),  // F7 - starts curving down
    gridToPos(5.5, 7.8),  // F8 - loop down
    gridToPos(6.0, 8.2),  // G8 - bottom of loop
    gridToPos(6.5, 8.0),  // G8 - coming back up
    gridToPos(7.0, 7.5),  // H7-H8
    gridToPos(7.5, 7.8),  // H8 - Hope's Causeway area
    gridToPos(8.0, 8.2),  // I8-I9
    gridToPos(8.5, 8.5),  // I9-J9
    gridToPos(9.0, 8.8),  // J9
    gridToPos(9.5, 9.0),  // J9-J10
    gridToPos(10.0, 9.2), // K10
    gridToPos(10.5, 9.5), // K10-L10
    gridToPos(11.5, 9.8), // Exits right at L10-L11
];

// Water zones (flooded areas)
export const WATER_ZONES = [
    { x: gridToPos(3, 9).x, y: gridToPos(3, 9).y, radius: 80, name: 'Flooded Fields' },
    { x: gridToPos(2, 10).x, y: gridToPos(2, 10).y, radius: 60, name: 'Concrete Shallows' },
];

// Bridges and fords
export const BRIDGES = [
    { x: gridToPos(5, 5.5).x, y: gridToPos(5, 5.5).y, name: 'The Crossing', type: 'bridge' },
    { x: gridToPos(6, 8).x, y: gridToPos(6, 8).y, name: "Hope's Causeway", type: 'bridge' },
    { x: gridToPos(1, 5.5).x, y: gridToPos(1, 5.5).y, name: 'Catpal Trail', type: 'bridge' },
    { x: gridToPos(4.5, 7).x, y: gridToPos(4.5, 7).y, name: 'Waterfoot Gap', type: 'ford' },
];

// Roads - more winding paths
export const ROADS = [
    // Northern main road (winding)
    { from: [1, 2], to: [2, 1.5], curve: 0.3 },
    { from: [2, 1.5], to: [4, 1.2], curve: 0.2 },
    { from: [4, 1.2], to: [5, 2], curve: 0.4 },
    { from: [5, 2], to: [7, 1.5], curve: 0.3 },
    { from: [7, 1.5], to: [9, 1], curve: 0.2 },
    { from: [9, 1], to: [9, 2], curve: 0.1 },
    
    // Right side road
    { from: [9, 2], to: [9, 4], curve: 0.2 },
    { from: [9, 4], to: [9, 5], curve: 0.1 },
    { from: [9, 5], to: [9, 6], curve: 0.3 },
    { from: [9, 6], to: [9, 9], curve: 0.2 },
    
    // Left side road
    { from: [1, 2], to: [1, 5], curve: 0.2 },
    { from: [1, 5], to: [1, 8], curve: 0.3 },
    { from: [1, 8], to: [1, 11], curve: 0.2 },
    
    // Central connections
    { from: [4, 1.2], to: [4, 4], curve: 0.3 },
    { from: [4, 4], to: [5, 4], curve: 0.1 },
    { from: [5, 4], to: [5, 5], curve: 0.2 },
    { from: [5, 2], to: [5, 4], curve: 0.4 },
    
    // Southern connections
    { from: [1, 8], to: [2, 9], curve: 0.3 },
    { from: [2, 9], to: [2, 11], curve: 0.2 },
    { from: [2, 11], to: [5, 11], curve: 0.3 },
    { from: [5, 11], to: [7, 11], curve: 0.2 },
    { from: [9, 9], to: [5, 11], curve: 0.4 },
];

// City zones with buildings (for rendering)
export const CITY_ZONES = [
    { col: 1, row: 2, radius: 120, buildings: 12 }, // Callahan Gate (large)
    { col: 9, row: 1, radius: 80, buildings: 8 },
    { col: 4, row: 4, radius: 80, buildings: 8 },
    { col: 9, row: 4, radius: 80, buildings: 8 },
    { col: 1, row: 5, radius: 70, buildings: 6 },
    { col: 1, row: 8, radius: 70, buildings: 6 },
    { col: 6, row: 8, radius: 70, buildings: 6 },
    { col: 5, row: 11, radius: 70, buildings: 6 },
    { col: 9, row: 9, radius: 70, buildings: 6 },
    { col: 7, row: 11, radius: 120, buildings: 12 }, // Salt March (large)
];

// Trees (scattered across map)
export const TREES = [];
for (let i = 0; i < 200; i++) {
    const x = Math.random() * 3000;
    const y = Math.random() * 2250;
    // Avoid water and cities
    let valid = true;
    for (const cp of RIVER_POINTS) {
        if (Math.sqrt((x - cp.x) ** 2 + (y - cp.y) ** 2) < 50) { valid = false; break; }
    }
    if (valid) TREES.push({ x, y, size: 8 + Math.random() * 6 });
}

// Grass patches
export const GRASS_PATCHES = [];
for (let i = 0; i < 100; i++) {
    GRASS_PATCHES.push({
        x: Math.random() * 3000,
        y: Math.random() * 2250,
        radius: 20 + Math.random() * 30,
    });
}

export function getLocationsInWorld() {
    return LOCATIONS.map(loc => ({
        ...loc,
        x: loc.col * 250 + 125,
        y: loc.row * 150 + 75,
    }));
}

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
