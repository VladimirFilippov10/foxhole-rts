// ===== CONSTANTS & CONFIG =====
export const MAP_COLS = 12; // A-L
export const MAP_ROWS = 15; // 1-15
export const CELL_W = 250;
export const CELL_H = 150;
export const MAP_W = MAP_COLS * CELL_W; // 3000
export const MAP_H = MAP_ROWS * CELL_H; // 2250

export const COLORS = {
    wardens: { p: '#2563eb', s: '#1d4ed8', a: '#60a5fa', bg: '#1e3a5f' },
    colonials: { p: '#dc2626', s: '#b91c1c', a: '#f87171', bg: '#5f1e1e' },
    neutral: { p: '#6b7280', s: '#4b5563', a: '#9ca3af' },
};

export const VEHICLE_COSTS = {
    infantry: { s: 10, c: 0, m: 0 },
    hatchet: { s: 30, c: 20, m: 10 },
    devitt: { s: 35, c: 25, m: 12 },
    gallagher: { s: 50, c: 40, m: 30 },
    falchion: { s: 55, c: 45, m: 35 },
    niska: { s: 35, c: 25, m: 15 },
    halftrack: { s: 35, c: 25, m: 15 },
    artillery: { s: 40, c: 30, m: 20 },
};

export const BUILDING_COSTS = {
    barracks: { s: 40, c: 20, m: 20 },
    factory: { s: 50, c: 30, m: 40 },
    refinery: { s: 30, c: 15, m: 30 },
};

export function gridToPos(col, row) {
    // col: 0-11 (A-L), row: 0-14 (1-15)
    return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}

export function letterToCol(letter) {
    return letter.charCodeAt(0) - 65; // A=0, B=1, etc.
}

export function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return dist(px, py, x1 + t * dx, y1 + t * dy);
}
