// ===== ТЕХНИКА: ГЛАВНЫЙ (ОБЩИЙ) ФАЙЛ =====
// Точка входа для всех, кому нужны юниты. Здесь собрано общее:
//   - базовый класс Vehicle и фабрику createVehicle(type, faction, x, y);
//   - списки типов по фракциям (FACTION_VEHICLES / FACTION_INFANTRY);
//   - помощники по видам юнитов (isInfUnit, isTechVehicle, ...).
// Сами классы разделены по типам юнитов:
//   ./vehicle.js        — базовый класс Vehicle (общие поля/методы)
//   ./common.js         — общие константы и функции-помощники
//   ./infantry.js       — пехота обеих фракций
//   ./warden_tanks.js   — танки Wardens
//   ./colonial_tanks.js — танки Colonials
//   ./artillery.js      — артиллерия обеих фракций
//   ./logistics.js      — логистика (грузовики, бензовозы, инженер и т.д.)
//
// КАК ДОБАВИТЬ НОВЫЙ ЮНИТ:
//   1. Создайте класс в подходящем файле (например warden_tanks.js),
//      унаследовав его от Vehicle: constructor(faction, x, y) { super('тип', ...) ... }
//   2. Зарегистрируйте тип в VEHICLE_CREATORS ниже.
//   3. Добавьте тип в FACTION_VEHICLES (или FACTION_INFANTRY + createInfantry
//      для пехоты) и при необходимости в TECHNIC_VEHICLE_TYPES в common.js.

import { Vehicle } from './vehicle.js';
import { createInfantry } from './infantry.js';
import {
    KingSpire, NobleWidow, Devitt, DevittMMR, Silverhand,
    GallagherHighwayman, GallagherOutlaw, Niska, NiskaBlinder,
} from './warden_tanks.js';
import {
    Hatchet, Scorpion, Nemesis, Falchion, Spatha, Talos, Javelin, Hoplite,
} from './colonial_tanks.js';
import {
    WardenArtillery120, WardenArtillery150mm,
    ColonialArtillery150mm, ColonialArtillery120mm,
} from './artillery.js';
import {
    MedicTruck, Truck, FuelTruck, Engineer,
    ConstructionTruck, FireTruck, Flatbed,
} from './logistics.js';

// Реестр «тип -> класс» для боевой техники и логистики.
// Пехота создаётся отдельно через createInfantry() (см. ./infantry.js).
const VEHICLE_CREATORS = {
    // Wardens
    king_spire: KingSpire,
    devitt: Devitt,
    devitt_mmr: DevittMMR,
    silverhand: Silverhand,
    gallagher_highwayman: GallagherHighwayman,
    gallagher_outlaw: GallagherOutlaw,
    niska: Niska,
    niska_blinder: NiskaBlinder,
    noble_widow: NobleWidow,
    warden_artillery120: WardenArtillery120,
    warden_artillery150: WardenArtillery150mm,
    warden_artillery: WardenArtillery150mm,
    // Colonials
    hatchet: Hatchet,
    scorpion: Scorpion,
    nemesis: Nemesis,
    falchion: Falchion,
    spatha: Spatha,
    talos: Talos,
    javelin: Javelin,
    hoplite: Hoplite,
    colonial_artillery120: ColonialArtillery120mm,
    colonial_artillery150: ColonialArtillery150mm,
    colonial_artillery: ColonialArtillery150mm,
    // Logistics
    truck: Truck,
    fuel_truck: FuelTruck,
    engineer: Engineer,
    flatbed: Flatbed,
    medic_truck: MedicTruck,
    construction_truck: ConstructionTruck,
    fire_truck: FireTruck,
};

export function createVehicle(type, faction, x, y) {
    // Пехота создаётся с учётом фракции (у каждой свои виды в названии класса)
    const inf = createInfantry(type, faction, x, y);
    if (inf) return inf;

    const creator = VEHICLE_CREATORS[type];
    if (!creator) return new Vehicle(type, faction, x, y);
    return new creator(faction, x, y);
}

// Доступная техника по фракциям
export const FACTION_VEHICLES = {
    wardens: ['king_spire', 'devitt', 'devitt_mmr', 'silverhand', 'noble_widow', 'gallagher_highwayman', 'niska', 'warden_artillery150', 'warden_artillery120', 'truck', 'fuel_truck', 'engineer', 'flatbed', 'gallagher_outlaw','niska_blinder', 'medic_truck', 'construction_truck', 'fire_truck'],
    colonials: ['hatchet', 'scorpion', 'nemesis', 'falchion', 'talos', 'javelin', 'hoplite', 'colonial_artillery150', 'colonial_artillery120', 'truck', 'fuel_truck', 'engineer', 'flatbed', 'spatha', 'medic_truck', 'god_loader', 'construction_truck', 'fire_truck'],
};

// Общие помощники и списки типов (реэкспорт — чтобы потребители работали
// с одним импортом './vehicles.js' как раньше)
export {
    ARTILLERY_TYPES, isArtilleryUnit,
    INFANTRY_TYPES, FACTION_INFANTRY, isInfUnit,
    LOGISTICS_TYPES, isLogisticsUnit, isTechUnit,
    TECHNIC_VEHICLE_TYPES, isTechVehicle,
    getDefenseDamageVsTech, getUnitAttackDamage,
} from './common.js';

// Базовый класс — на случай, если нужен напрямую (проверки instanceof и т.п.)
export { Vehicle } from './vehicle.js';
