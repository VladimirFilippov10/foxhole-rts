// ===== CONSTANTS & CONFIG =====
// ===== НОРМИРОВКА ПО ЧАСТОТЕ КАДРОВ (FIXSS) =====
// Игровой цикл был жёстко привязан к числу кадров: game.update() вызывался
// один раз на кадр requestAnimationFrame. На мониторах 144/240 Гц вся логика
// (движение техники, перезарядка, фарм ресурсов) выполнялась в 2-4 раза
// чаще — танки и артиллерия «летали» по карте со скоростью света.
// Теперь логика игры всегда выполняется фиксированные 60 раз в секунду
// (шаг ~16.67 мс), независимо от реального FPS. Рендер идёт каждый кадр.
export const FIXED_STEP_MS = 1000 / 60;      // длительность одного тика логики
export const MAX_STEPS_PER_FRAME = 5;        // защита от «зависания» после сворачивания вкладки

export const MAP_COLS = 12; // A-L
export const MAP_ROWS = 15; // 1-15
export const CELL_W = 250;
export const CELL_H = 150;
export const MAP_W = MAP_COLS * CELL_W; // 3000
export const MAP_H = MAP_ROWS * CELL_H; // 2250

export const COLORS = {
    wardens: { p: '#2563eb', s: '#1d4ed8', a: '#60a5fa', bg: '#1e3a5f' },
    colonials: { p: '#16a34a', s: '#15803d', a: '#4ade80', bg: '#14532d' }, // Зеленый цвет
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

// ===== ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ ИГРЫ (переключатели) =====
// В каждой группе можно выбрать ровно ОДНО значение (radio-поведение).
// Значения по умолчанию — 'classic' в обеих группах (прежняя игра «как есть»).
export const RESTRICTION_OPTIONS = [
    { id: 'classic',      name: 'Классический',   icon: '🎯', description: 'Всё оружие доступно: пехота, техника, артиллерия' },
    { id: 'infantry_only', name: 'Только пехота', icon: '🔫', description: 'Техника и артиллерия запрещены — в бою только пехота' },
    { id: 'vehicles_only', name: 'Только техника', icon: '🚗', description: 'Пехота запрещена — только боевая техника' },
    { id: 'no_artillery', name: 'Без артиллерии', icon: '🚫', description: 'Ствольная артиллерия запрещена (миномёты-поддержка остаются)' },
];

export const ECONOMY_OPTIONS = [
    { id: 'classic',    name: 'Классический', icon: '⚖️', description: 'Обычный фарм очков и снабжение: ремонт/БК/топливо доступны на базе и у логистики' },
    { id: 'attrition',  name: 'Вымирание',    icon: '📉', description: 'Фарм очков стремится к 0 со временем (чем дольше игра — тем меньше ресурсов)' },
    { id: 'scarcity',   name: 'Дефицит',      icon: '🏚️', description: 'Восстановление топлива/БК/прочности — только на главной базе (вкладка «Снабжение» недоступна)' },
];

// Настройки по умолчанию
export const DEFAULT_RESTRICTION = 'classic';
export const DEFAULT_ECONOMY = 'classic';

// ===== ЛОГИСТИКА (вкладка «Снабжение») — единый список для всех модулей =====
export const LOGISTICS_TYPES = ['truck', 'fuel_truck', 'engineer', 'flatbed'];

// ===== ЭКОНОМИКА «ВЫМИРАНИЕ» =====
// Множитель фарма падает с 1.0 до ATTRITION_MIN за ATTRITION_DECAY_TICKS
// тиков (~60 минут игры при 60 тик/с), далее остаётся на минимуме.
export const ATTRITION_START_PCT = 3600;  // ~1 мин — начало плавного спада
export const ATTRITION_DECAY_TICKS = 216000; // длительность спада (тики)
export const ATTRITION_MIN = 0.05;         // пол: фарм не исчезает полностью

// Множитель фарма «Вымирания» по времени игры (тики)
export function attritionMultiplier(time) {
    if (time <= ATTRITION_START_PCT) return 1;
    const p = Math.min(1, (time - ATTRITION_START_PCT) / ATTRITION_DECAY_TICKS);
    return Math.max(ATTRITION_MIN, 1 - p * (1 - ATTRITION_MIN));
}

// ===== ОГРАНИЧЕНИЯ ПО СОСТАВУ АРМИИ =====
// Типы ствольной артиллерии (запрещаются режимом «без артиллерии»).
// Миномётные машины поддержки (devitt_mmr, hoplite) — НЕ артиллерия.
export const BARREL_ARTILLERY_TYPES = [
    'warden_artillery120', 'warden_artillery150',
    'colonial_artillery120', 'colonial_artillery150',
    'warden_artillery', 'colonial_artillery', // старые алиасы из сохранений
];

// Пехота (базовый тип 'infantry' + виды)
export const INFANTRY_UNIT_TYPES = ['infantry', 'rifleman', 'mg_gunner', 'grenadier', 'sniper'];

// Проверка типа юнита (по строке type — работает и для объектов юнитов)
export function isInfantryTypeStr(t) { return INFANTRY_UNIT_TYPES.includes(t); }
export function isArtilleryTypeStr(t) { return BARREL_ARTILLERY_TYPES.includes(t); }
export function isLogisticsTypeStr(t) { return LOGISTICS_TYPES.includes(t); }

// ===== Главная проверка: можно ли производить/спавнить юнит данного типа =====
// в выбранном режиме ограничений. Учитывает ВСЕ настройки сразу.
// Возвращает true — разрешено, false — запрещено режимом.
export function isUnitAllowedByRestriction(type, restriction) {
    const r = restriction || DEFAULT_RESTRICTION;
    if (r === 'infantry_only') return isInfantryTypeStr(type);
    if (r === 'vehicles_only') return !isInfantryTypeStr(type);
    if (r === 'no_artillery') return !isArtilleryTypeStr(type);
    return true; // classic
}

// Запрещён ли режимом данный класс построек (казармы/завод)
export function isBuildingAllowedByRestriction(btype, restriction) {
    const r = restriction || DEFAULT_RESTRICTION;
    if (btype === 'barracks' && r === 'vehicles_only') return false;
    if (btype === 'factory' && r === 'infantry_only') return false;
    return true;
}

// ===== Единый помощник «что разрешено текущими настройками» =====
// Принимает объект игры (game) — читает game.restriction / game.economy.
// Используется и UI игрока (вкладки производства), и ИИ (ai.js).
export function getModeFlags(game) {
    const restriction = game?.restriction || DEFAULT_RESTRICTION;
    const economy = game?.economy || DEFAULT_ECONOMY;
    return {
        restriction,
        economy,
        // логистика (вкладка «Снабжение») запрещена в режиме «Дефицит»
        logisticsAllowed: economy !== 'scarcity',
        allowUnit(type) { return isUnitAllowedByRestriction(type, restriction); },
        allowBuilding(btype) { return isBuildingAllowedByRestriction(btype, restriction); },
        // Множитель фарма ресурсов с учётом экономики «Вымирание»
        farmMultiplier(time) {
            const base = GAME_MODES[game?.gameMode]?.resourceMultiplier ?? 1;
            return economy === 'attrition' ? base * attritionMultiplier(time || 0) : base;
        },
    };
}

export const VEHICLE_COSTS = {
    infantry: { s: 10, c: 0, m: 0, buildTime: 5 },      // стрелки (базовая пехота)
    rifleman: { s: 10, c: 0, m: 0, buildTime: 5 },      // то же, новое имя
    mg_gunner: { s: 25, c: 2, m: 2, buildTime: 10 },     // пулемётчик — оборона
    grenadier: { s: 25, c: 3, m: 2, buildTime: 20 },    // гранатомётчик — наступление
    sniper: { s: 30, c: 10, m: 5, buildTime: 25 },       // снайпер — дальний бой
    
    // Wardens tanks
    king_spire: { s: 40, c: 30, m: 20, buildTime: 25 }, // Разведывательный танк
    devitt: { s: 45, c: 35, m: 20, buildTime: 30 }, // Легкий танк (обновлен)
    devitt_mmr: { s: 50, c: 38, m: 15, buildTime: 35 }, // Миномётная поддержка (Devitt MMR)
    silverhand: { s: 40, c: 100, m: 40, buildTime: 30 }, // Штурмовой танк
    gallagher_highwayman: { s: 70, c: 50, m: 35, buildTime: 25 }, // Крейсерский танк
    gallagher_outlaw: {s: 50, c: 80, m: 20, buildTime: 30},
    noble_widow: {s: 60, c: 120, m: 50, buildTime: 55},
    niska: { s: 40, c: 60, m: 10, buildTime: 10 }, // БТР
    warden_artillery150: { s: 55, c: 40, m: 30, buildTime: 40 }, // Артиллерия
    warden_artillery120: { s: 55, c: 40, m: 10, buildTime: 35 }, // Артиллерия
    
    // Colonials tanks
    hatchet: { s: 30, c: 60, m: 25, buildTime: 25 }, // Легкий танк (обновлен)
    scorpion: { s: 40, c: 90, m: 30, buildTime: 20 }, // Пехотный танк
    nemesis: { s: 35, c: 80, m: 60, buildTime: 40 }, // Штурмовой танк
    falchion: { s: 55, c: 60, m: 25, buildTime: 30 }, // Средний танк
    spatha : { s: 80, c: 90, m: 40, buildTime: 30 },
    talos :{s: 70, c: 140, m: 50, buildTime: 60 },
    javelin: { s: 40, c: 30, m: 15, buildTime: 20 }, // БТР (аналог Niska)
    hoplite: { s: 35, c: 25, m: 10, buildTime: 25 }, // Миномётная поддержка (Hoplite)
    colonial_artillery: { s: 80, c: 30, m: 20, buildTime: 35 }, // Артиллерия (алиас 150 мм)
    colonial_artillery150: { s: 45, c: 30, m: 20, buildTime: 35 }, // Артиллерия 150 мм
    colonial_artillery120: { s: 30, c: 30, m: 10, buildTime: 25 }, // Артиллерия 120 мм

    // Логистика
    truck: { s: 25, c: 15, m: 5, buildTime: 10 }, // Грузовик - перевозит БК
    fuel_truck: { s: 30, c: 20, m: 5, buildTime: 12 }, // Бензовоз - перевозит топливо
    engineer: { s: 20, c: 35, m: 10, buildTime: 20 }, // Инженерная машина - ремонтирует
    flatbed: { s: 35, c: 25, m: 10, buildTime: 15 }, // Flatbed truck
};

export const BUILDING_COSTS = {
    barracks: { s: 40, c: 20, m: 20 },
    factory: { s: 50, c: 30, m: 40 },
    refinery: { s: 30, c: 15, m: 30 },
};

// Укрепления (бункеры) - одинаковые для обеих фракций
export const FORTIFICATION_COSTS = {
    // Радиусы авто-атаки увеличены x2 (построенная оборона)
    bunker_light: { s: 30, c: 20, m: 25, hp: 300, defense: 10, range: 240 },
    bunker_medium: { s: 60, c: 40, m: 50, hp: 600, defense: 20, range: 300 },
    bunker_heavy: { s: 100, c: 70, m: 80, hp: 1000, defense: 35, range: 360 },
};

// Система БК и топлива
export const SUPPLY_SYSTEM = {
    maxAmmo: 100, // Максимум БК
    maxFuel: 100, // Максимум топлива
    ammoConsumption: 0.5, // Расход БК за выстрел
    fuelConsumption: 0.01, // Расход топлива за движение (уменьшено в 10 раз)
    // ИСПРАВЛЕНИЕ «бессмертные юниты»: ремонт и пополнение БК/топлива на базе
    // теперь идут по 1% максимумов каждые 100 тиков (~1.7 сек при 60 т/с),
    // а не мгновенно. Раньше техника на базе чинилась почти моментально
    // (0.15 HP/тик + x4 к БК/топливу) и становилась фактически бессмертной.
    // ФИКС «всё равно слишком быстрое восстановление»: скорость пополнения
    // и ремонта на базе уменьшена ещё в 100 раз — интервал между «тиками
    // пополнения» увеличен со 100 до 10000 тиков (полный цикл восстановления
    // ~1 млн тиков вместо ~10000).
    baseRegenInterval: 500, // раз в 10000 тиков база восстанавливает 1% от максимума (было 100, уменьшено в 100 раз)
    baseRegenPercent: 0.01, // 1% за один «тик пополнения»
    baseSupplyRadius: 200, // Радиус пополнения в базе (увеличен со 100)
    // ВАЖНО (фикс «пополняет один раз и не полностью»): ёмкости должны быть
    // БОЛЬШЕ, чем maxHp/maxAmmo/maxFuel техники — иначе инженеру/грузовику
    // физически не хватало «заряда» даже на один полный ремонт/пополнение.
    truckCapacity: 400, // Вместимость грузовика (запас БК на несколько танков)
    fuelTruckCapacity: 400, // Вместимость бензовоза
    engineerRepairRate: 0.5, // HP/тик скорости ремонта
    engineerCapacity: 500, // Материалы: больше макс. HP самой прочной техники (480)
    flatbedCapacity: 300, // Вместимость flatbed для артиллерии
    artilleryAmmoConsumption: 5, // Расход БК артиллерией за выстрел
    logisticsReplenishRate: 2, // Скорость пополнения логистики на базе (было 0.5 — вечный возврат)
};

export function gridToPos(col, row) {
    // col: 0-11 (A-L), row: 0-14 (1-15)
    return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}

export function letterToCol(letter) {
    return letter.charCodeAt(0) - 65; // A=0, B=1, etc.
}

export function dist(x1, y1, x2, y2) {
    // ===== ФИКС NaN-КООРДИНАТ =====
    // Если хоть одна координата повреждена (NaN/Infinity), обычный sqrt даёт
    // NaN. Дальше код вида `if (dist(...) > 5)` молча даёт false и юнит
    // каждый тик перезаписывает себе x/y через битную арифметику, получая
    // новый NaN («юниты исчезают»). Возвращаем Infinity: сравнения с ним
    // однозначны (цель «бесконечно далеко» → не достать, не ехать).
    if (!Number.isFinite(x1) || !Number.isFinite(y1) ||
        !Number.isFinite(x2) || !Number.isFinite(y2)) {
        return Infinity;
    }
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return dist(px, py, x1 + t * dx, y1 + t * dy);
}
