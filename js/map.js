// ===== DEADLANDS MAP DATA =====
import { gridToPos, letterToCol } from './constants.js';

// Locations based on exact Foxhole Deadlands description
// Grid: A-L (cols 0-11), rows 1-15 (0-14)
export const LOCATIONS = [
    // Northern part (rows 1-4)
    { name: "Callahan's Pass", col: 11, row: 0, type: 'label' }, // L1
    { name: 'Crumbling Passage', col: 2, row: 1, type: 'hex' }, // C2
    { name: 'Waystation', col: 4, row: 1, type: 'hex' }, // E2
    { name: 'The Iron Road', col: 7, row: 1, type: 'resource' }, // H2
    { name: "Callahan's Cache", col: 9, row: 1, type: 'base' }, // J2
    { name: 'The Spine', col: 1, row: 2, type: 'base' }, // B3
    { name: "Iron's End", col: 5, row: 2, type: 'medical' }, // F3
    { name: 'The Boneyards', col: 9, row: 2, type: 'workshop' }, // J3
    { name: 'Mandible Crossroads', col: 0, row: 3, type: 'label' }, // A4
    { name: 'Marrow Chapse', col: 2, row: 3, type: 'hex' }, // C4
    { name: 'The Iron Passage', col: 5, row: 3, type: 'label' }, // F4
    { name: 'Border Thicket', col: 7, row: 3, type: 'label' }, // H4
    { name: 'Border Concourse', col: 9, row: 3, type: 'hex' }, // J4
    
    // Central upper (rows 5-6)
    { name: 'Crosspoint', col: 2, row: 4, type: 'hex' }, // C5
    { name: 'The Plaza', col: 4, row: 4, type: 'medical' }, // E5
    { name: 'Pommel Annex', col: 5, row: 4, type: 'hex' }, // F5
    { name: 'The Blade', col: 7, row: 4, type: 'workshop' }, // H5
    { name: "Callahan's Belt", col: 9, row: 4, type: 'base' }, // J5
    { name: 'Catpal Trail', col: 1, row: 5, type: 'settlement' }, // B6
    { name: 'The Crossing', col: 5, row: 5, type: 'medical' }, // F6 (at river)
    { name: 'Bunker Entrance', col: 9, row: 5, type: 'bunker' }, // J6
    
    // River area (rows 7-9)
    { name: 'Tarsal Pathway', col: 1, row: 6, type: 'workshop' }, // B7
    { name: 'Abandoned Ward', col: 3, row: 6, type: 'label' }, // D7
    { name: 'Waterfoot Gap', col: 4, row: 6, type: 'label' }, // E7 (river bend)
    { name: "Callahan's Boot", col: 6, row: 6, type: 'workshop' }, // G7
    { name: 'The Steppes', col: 9, row: 6, type: 'label' }, // J7
    { name: 'Outpost', col: 9, row: 7, type: 'hex' }, // J8
    { name: 'Cemetery Junction', col: 3, row: 7, type: 'label' }, // D8
    { name: 'Liberation Point', col: 1, row: 8, type: 'settlement' }, // B9
    { name: 'Sunhaven Gateway', col: 3, row: 8, type: 'hex' }, // D9
    { name: "Hope's Causeway", col: 6, row: 8, type: 'settlement' }, // G9
    
    // Southern part (rows 10-12)
    { name: 'Overgrown Pasture', col: 1, row: 9, type: 'label' }, // B10
    { name: 'Salvation Road', col: 2, row: 9, type: 'label' }, // C10
    { name: 'Flooded Fields', col: 3, row: 9, type: 'label' }, // D10
    { name: 'The Pits', col: 5, row: 9, type: 'building' }, // F10
    { name: 'Brine Glen', col: 9, row: 9, type: 'settlement' }, // J10
    { name: 'Jaspar Farm', col: 2, row: 10, type: 'label' }, // C11
    { name: "Sun's Hollow", col: 1, row: 11, type: 'player_base' }, // B12
    { name: 'The Salt Trail', col: 2, row: 11, type: 'hex' }, // C12
    { name: 'The Salt Farms', col: 5, row: 11, type: 'settlement' }, // F12
    { name: 'The Salt March', col: 7, row: 11, type: 'hex' }, // H12
    
    // Deep south (rows 13-15)
    { name: 'The Great March', col: 3, row: 12, type: 'label' }, // D13
    { name: 'Path to the Sun', col: 1, row: 13, type: 'label' }, // B14
];

// Capture points (important locations)
export const CAPTURE_POINTS = [
    { name: "Sun's Hollow", col: 1, row: 11, radius: 90, owner: 'wardens' }, // B12 - Wardens base
    { name: 'The Spine', col: 1, row: 2, radius: 70, owner: 'neutral' }, // B3
    { name: "Callahan's Cache", col: 9, row: 1, radius: 70, owner: 'neutral' }, // J2
    { name: 'The Plaza', col: 4, row: 4, radius: 70, owner: 'neutral' }, // E5
    { name: "Callahan's Belt", col: 9, row: 4, radius: 70, owner: 'neutral' }, // J5
    { name: 'Liberation Point', col: 1, row: 8, radius: 70, owner: 'neutral' }, // B9
    { name: "Hope's Causeway", col: 6, row: 8, radius: 70, owner: 'neutral' }, // G9
    { name: 'The Salt Farms', col: 5, row: 11, radius: 70, owner: 'neutral' }, // F12
    { name: 'Brine Glen', col: 9, row: 9, radius: 70, owner: 'neutral' }, // J10
    { name: 'The Salt March', col: 7, row: 11, radius: 90, owner: 'colonials' }, // H12 - Colonials base
];

// Resource mines
export const RESOURCE_POINTS = [
    { name: 'Iron Mine', col: 7, row: 1, radius: 50, type: 'materials' }, // H2
    { name: 'Copper Deposit', col: 2, row: 3, radius: 50, type: 'components' }, // C4
    { name: 'Coal Seam', col: 3, row: 6, radius: 50, type: 'supplies' }, // D7
    { name: 'Gold Vein', col: 6, row: 6, radius: 50, type: 'components' }, // G7
    { name: 'Salt Deposit', col: 2, row: 10, radius: 50, type: 'materials' }, // C11
    { name: 'Silver Lode', col: 3, row: 12, radius: 50, type: 'supplies' }, // D13
];

// River path (winding through rows 6-10)
export const RIVER_POINTS = [
    gridToPos(1, 5),  // B6
    gridToPos(2, 6),  // C7
    gridToPos(3, 6.5), // D7-8
    gridToPos(4, 6),  // E7
    gridToPos(5, 6.5), // F7-8
    gridToPos(6, 7),  // G8
    gridToPos(7, 7.5), // H8-9
    gridToPos(8, 8),  // I9
    gridToPos(9, 8.5), // J9-10
    gridToPos(10, 9), // K10
    gridToPos(11, 9.5), // L10-11
];

// Roads connecting locations
export const ROADS = [
    // Northern main road
    [1, 2], [2, 3], [3, 5], [5, 6], // B3-C2-E2-H2
    [5, 8], [8, 9], // H2-J2-J3
    // Right side road
    [8, 17], [17, 19], [19, 28], // J2-J5-J6-J10
    // Left side road
    [1, 15], [15, 23], [23, 30], // B3-B6-B9-Sun's Hollow
    // Central connections
    [3, 13], [13, 14], // E2-E5-F5
    [14, 16], [16, 21], // F5-F6-F10
    [6, 16], // F3-F6
    // Southern connections
    [23, 29], [29, 31], // B9-B12-C12
    [31, 32], [32, 33], // C12-F12-H12
    [28, 32], // J10-F12
];

// Bridges (where roads cross river)
export const BRIDGES = [
    gridToPos(5, 5.5), // F6 - The Crossing
    gridToPos(9, 5.5), // J6 - Bunker area
];

// Convert to world coordinates
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
