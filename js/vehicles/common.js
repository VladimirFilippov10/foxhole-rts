// ===== ОБЩЕЕ ДЛЯ ТЕХНИКИ =====
// Списки типов, помощники по видам юнитов и множители урона.
// Этот файл не импортирует классы — чтобы не создавать циклических
// зависимостей (классы импортируют Vehicle из ./vehicle.js).

// Все виды ствольной артиллерии (для проверок по типу)
export const ARTILLERY_TYPES = [
    'warden_artillery120', 'warden_artillery150',
    'colonial_artillery120', 'colonial_artillery150',
];

// Юнит — ствольная артиллерия? (учитывает старые типы из сохранений)
export function isArtilleryUnit(u) {
    if (!u) return false;
    if (ARTILLERY_TYPES.includes(u.type)) return true;
    return u.type === 'warden_artillery' || u.type === 'colonial_artillery';
}

// ===== Помощники по видам пехоты =====
export const INFANTRY_TYPES = [
    'rifleman', 'mg_gunner', 'grenadier', 'sniper',
    'assualt_varden', 'smuggler_varden', 'poacher_colonist',
    'medic_varden', 'medic_colonist',
];
// Пехота, доступная для производства каждой фракции.
// Снайпер — общий тип ('sniper'), класс выбирается по фракции:
//   wardens → SniperVarden, colonials → SniperColonist.
// Гранатомётчик/Гренадер — один тип 'grenadier' с разными классами и статами:
//   wardens → GrenadierVarden (короткий мощный залп),
//   colonials → GrenadierColonist (дальше бросает, радиус взрыва больше).
// Пулемётчик (mg_gunner) — единый класс MgGunner для обеих фракций.
export const FACTION_INFANTRY = {
    wardens:   ['rifleman', 'mg_gunner', 'grenadier', 'sniper',
                'assualt_varden', 'smuggler_varden', 'medic_varden'],
    colonials: ['rifleman', 'mg_gunner', 'grenadier', 'sniper',
                'assualt_varden', 'poacher_colonist', 'medic_colonist'],
};

// Юнит — пехота? (новый флаг isInfantry + обратная совместимость со старым
// типом 'infantry' из сохранений/скриптов)
export function isInfUnit(u) {
    if (!u) return false;
    return u.isInfantry === true || u.type === 'infantry' || INFANTRY_TYPES.includes(u.type);
}

// Логистика (не считается боевой техникой ни у игрока, ни у ИИ)
export const LOGISTICS_TYPES = ['truck', 'fuel_truck', 'engineer', 'flatbed', 'medic_truck', 'construction_truck', 'fire_truck'];
export function isLogisticsUnit(u) {
    return !!u && LOGISTICS_TYPES.includes(u.type);
}

// Боевая техника (всё, что не пехота и не логистика; артиллерия тоже идёт
// в зачёт как «техника поддержки»)
export function isTechUnit(u) {
    if (!u || u.hp <= 0) return false;
    if (isInfUnit(u)) return false;
    return !isLogisticsUnit(u);
}

// Юнит — техника? Всё, что производится во вкладке «🚗 Техника»
// (TAB_TYPES.vehicles в main.js): тяжёлые и лёгкие боевые машины обеих
// фракций. Используется для бонуса обороны +15% урона по технике (уровень 3).
// Миномёты-поддержка (hoplite, devitt_mmr) и артиллерия техникой не считаются.
// ВАЖНО: noble_widow тоже относится к технике (вкладка «🚗 Техника») —
// раньше её не было в списке, из-за чего бонусы «по технике» (урон обороны)
// на неё не действовали.
export const TECHNIC_VEHICLE_TYPES = [
    'king_spire', 'devitt', 'silverhand', 'gallagher_highwayman', 'niska', 'gallagher_outlaw',
    'noble_widow',
    'hatchet', 'scorpion', 'nemesis', 'falchion', 'javelin', 'spatha', 'talos'
];

// Множитель урона обороны (бункеры и территория 3 уровня) по технике.
const DEFENSE_VS_TECH_MULT = 1.3;

// Собственный бонус Noble Widow «по технике»: +25% к базовому урону (x1.25).
const NOBLE_WIDOW_VS_TECH_MULT = 1.25;

export function isTechVehicle(u) {
    if (!u) return false;
    // Пехота/логистика/арта техникой не считаются
    if (isInfUnit(u)) return false;
    return TECHNIC_VEHICLE_TYPES.includes(u.type);
}

// Оборона (укрепления/территории) — урон по технике с коэффициентом x1.3.
export function getDefenseDamageVsTech(baseDamage, target) {
    if (!isTechVehicle(target)) return baseDamage;
    return Math.round(baseDamage * DEFENSE_VS_TECH_MULT);
}

// Noble Widow: если цель — техника противника, урон = базовый dmg * 1.25.
// Возвращает итоговый урон (для остальных юнитов/целей — без изменений).
export function getUnitAttackDamage(attacker, target, baseDamage) {
    let damage = baseDamage;
    if (attacker && attacker.type === 'noble_widow' && isTechVehicle(target)) {
        damage = damage * NOBLE_WIDOW_VS_TECH_MULT;
    }
    return damage;
}
