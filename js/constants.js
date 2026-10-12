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

// Game modes with different resource generation rates
export const GAME_MODES = {
    realism: {
        name: 'Реализм',
        description: 'Медленный фарм ресурсов, долгая игра',
        icon: '🎯',
        resourceMultiplier: 0.3, // 30% от стандартного
        startingResources: { s: 100, c: 50, m: 40 },
    },
    normal: {
        name: 'Обычный',
        description: 'Стандартный темп игры',
        icon: '⚖️',
        resourceMultiplier: 1.0,
        startingResources: { s: 200, c: 100, m: 80 },
    },
    fast: {
        name: 'Быстрый бой',
        description: 'Ускоренный фарм, быстрая игра',
        icon: '⚡',
        resourceMultiplier: 2.5, // 250% от стандартного
        startingResources: { s: 400, c: 200, m: 150 },
    },
};

export const VEHICLE_COSTS = {
    infantry: { s: 10, c: 0, m: 0, buildTime: 5 },
    devitt: { s: 35, c: 25, m: 15, buildTime: 15 },
    gallagher: { s: 60, c: 45, m: 35, buildTime: 25 },
    niska: { s: 40, c: 30, m: 20, buildTime: 18 },
    hatchet: { s: 30, c: 20, m: 10, buildTime: 12 },
    falchion: { s: 55, c: 40, m: 30, buildTime: 22 },
    hoplite: { s: 35, c: 25, m: 15, buildTime: 16 },
    warden_artillery: { s: 55, c: 40, m: 30, buildTime: 30 },
    colonial_artillery: { s: 45, c: 30, m: 20, buildTime: 28 },
    // Логистика
    truck: { s: 25, c: 15, m: 10, buildTime: 10 }, // Грузовик - перевозит БК
    fuel_truck: { s: 30, c: 20, m: 15, buildTime: 12 }, // Бензовоз - перевозит топливо
    engineer: { s: 40, c: 30, m: 25, buildTime: 20 }, // Инженерная машина - ремонтирует
    // Flatbed для артиллерии
    duna: { s: 35, c: 25, m: 20, buildTime: 15 }, // Wardens flatbed
    hauler: { s: 35, c: 25, m: 20, buildTime: 15 }, // Colonials flatbed
};

export const BUILDING_COSTS = {
    barracks: { s: 40, c: 20, m: 20 },
    factory: { s: 50, c: 30, m: 40 },
    refinery: { s: 30, c: 15, m: 30 },
};

// Укрепления (бункеры) - одинаковые для обеих фракций
export const FORTIFICATION_COSTS = {
    bunker_light: { s: 30, c: 20, m: 25, hp: 300, defense: 10, range: 120 },
    bunker_medium: { s: 60, c: 40, m: 50, hp: 600, defense: 20, range: 150 },
    bunker_heavy: { s: 100, c: 70, m: 80, hp: 1000, defense: 35, range: 180 },
};

// Система БК и топлива
export const SUPPLY_SYSTEM = {
    maxAmmo: 100, // Максимум БК
    maxFuel: 100, // Максимум топлива
    ammoConsumption: 0.5, // Расход БК за выстрел
    fuelConsumption: 0.1, // Расход топлива за движение
    ammoRegenRate: 0.05, // Скорость восстановления БК в базе
    fuelRegenRate: 0.08, // Скорость восстановления топлива в базе
    truckCapacity: 50, // Вместимость грузовика (ограниченный запас БК)
    fuelTruckCapacity: 60, // Вместимость бензовоза (ограниченный запас топлива)
    engineerRepairRate: 0.2, // Скорость ремонта инженерной машиной
    engineerCapacity: 80, // Вместимость инженерной машины (ограниченный запас материалов)
    flatbedCapacity: 100, // Вместимость flatbed для артиллерии
    artilleryAmmoConsumption: 5, // Расход БК артиллерией за выстрел
    logisticsReplenishRate: 0.5, // Скорость пополнения логистики на базе
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
