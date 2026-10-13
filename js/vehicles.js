// ===== VEHICLE CLASS HIERARCHY =====
// Wardens: Gallagher, Devitt, Niska
// Colonials: Falchion, Hatchet, Hoplite
// Logistics: Truck, FuelTruck, Engineer

import { SUPPLY_SYSTEM } from './constants.js';

export class Vehicle {
    constructor(type, faction, x, y) {
        this.id = 'v' + Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.faction = faction;
        this.x = x;
        this.y = y;
        this.tx = undefined;
        this.ty = undefined;
        this.lastAtk = 0;
        this.gameTime = 0; // Для расчёта перезарядки
        this.direction = 0; // Направление в радианах (0 = вправо)
        
        this.hp = 100;
        this.maxHp = 100;
        this.dmg = 10;
        this.range = 100;
        this.spd = 1.0; // Базовая скорость
        this.cd = 60;
        this.size = 20;
        this.label = 'Vehicle';
        this.armor = 0;
        this.tracked = false; // Гусеничная техника (танки, БТР, артиллерия)
        
        // Система БК и топлива
        this.ammo = SUPPLY_SYSTEM.maxAmmo;
        this.maxAmmo = SUPPLY_SYSTEM.maxAmmo;
        this.fuel = SUPPLY_SYSTEM.maxFuel;
        this.maxFuel = SUPPLY_SYSTEM.maxFuel;
    }
    
    takeDamage(dmg) {
        const applied = Math.max(1, dmg - this.armor);
        this.hp -= applied;
        // Логирование смерти юнита — чтобы видеть, кто и когда «пропал» с карты
        if (this.hp <= 0 && !this._deathLogged) {
            this._deathLogged = true;
            console.log(`[AI][UNIT] ☠️ ${this.label || this.type} (${this.faction}) уничтожен: получил ${applied} урона, позиция (${Math.round(this.x)}, ${Math.round(this.y)})`);
        }
    }
    
    canAttack() {
        return this.ammo >= SUPPLY_SYSTEM.ammoConsumption;
    }
    
    useAmmo() {
        this.ammo = Math.max(0, this.ammo - SUPPLY_SYSTEM.ammoConsumption);
    }
    
    useFuel() {
        this.fuel = Math.max(0, this.fuel - SUPPLY_SYSTEM.fuelConsumption);
    }
    
    canMove() {
        return this.fuel > 0;
    }
    
    regenerateAtBase() {
        // Автоматическое пополнение в базе
        if (this.ammo < this.maxAmmo) {
            this.ammo = Math.min(this.maxAmmo, this.ammo + SUPPLY_SYSTEM.ammoRegenRate);
        }
        if (this.fuel < this.maxFuel) {
            this.fuel = Math.min(this.maxFuel, this.fuel + SUPPLY_SYSTEM.fuelRegenRate);
        }
    }
}

export class Infantry extends Vehicle {
    constructor(faction, x, y) {
        super('infantry', faction, x, y);
        this.hp = this.maxHp = 50;
        this.dmg = 8;
        this.range = 120;
        this.spd = 0.6; // Очень медленно
        this.cd = 50;
        this.size = 8;
        this.label = 'Пехота';
    }
}

// ===== WARDENS VEHICLES =====

// King Spire Mk. I - Разведывательный танк
export class KingSpire extends Vehicle {
    constructor(faction, x, y) {
        super('king_spire', faction, x, y);
        this.hp = this.maxHp = 135; // Нормализовано из 1350
        this.dmg = 15; // 12.7мм пулемет
        this.range = 140;
        this.spd = 1.3; // 7.22 м/с нормализовано
        this.offRoadSpd = 1.0; // 5.05 м/с
        this.cd = 40; // Быстрая скорострельность пулемета
        this.size = 20;
        this.armor = 25;
        this.label = 'King Spire';
        this.tracked = true;
        this.revealRadius = 120; // Разведка (60м * 2 для масштаба)
        this.crew = 2;
    }
}

// Devitt Mk. III - Легкий танк (обновленный)
export class Devitt extends Vehicle {
    constructor(faction, x, y) {
        super('devitt', faction, x, y);
        this.hp = this.maxHp = 195; // Нормализовано из 1950
        this.dmg = 45; // 40мм пушка
        this.range = 160;
        this.spd = 1.6; // 8.27 м/с нормализовано
        this.offRoadSpd = 1.1; // 5.79 м/с
        this.cd = 290; // 40мм пушка
        this.size = 22;
        this.armor = 35;
        this.label = 'Devitt Mk.III';
        this.tracked = true;
        this.crew = 3;
    }
}

// Silverhand Mk. IV - Штурмовой танк
export class Silverhand extends Vehicle {
    constructor(faction, x, y) {
        super('silverhand', faction, x, y);
        this.hp = this.maxHp = 310; // Нормализовано из 3100
        this.dmg = 85; // 40мм + 68мм пушки
        this.range = 170;
        this.spd = 1.1; // 7.75 м/с нормализовано
        this.offRoadSpd = 1.1; // 5.42 м/с
        this.cd = 500; // Тяжелые пушки
        this.size = 28;
        this.armor = 50;
        this.label = 'Silverhand Mk.IV';
        this.tracked = true;
        this.crew = 4;
        this.dualGun = true; // Два орудия
    }
}

// Gallagher Highwayman Mk. III - Крейсерский танк
export class GallagherHighwayman extends Vehicle {
    constructor(faction, x, y) {
        super('gallagher_highwayman', faction, x, y);
        this.hp = this.maxHp = 295; // Нормализовано из 2950
        this.dmg = 35; // Спаренные 14.5мм пушки
        this.range = 165;
        this.spd = 1.7; // Высокая базовая скорость
        this.offRoadSpd = 1.2;
        this.boostSpd = 2.8; // Ускорение с бустом
        this.cd = 60; // Быстрая скорострельность
        this.size = 24;
        this.armor = 45;
        this.label = 'Gallagher Highwayman';
        this.tracked = true;
        this.crew = 3;
        this.canBoost = true; // Может использовать буст
        this.boosting = false;
        this.boostFuelCost = 0.5; // Дополнительный расход топлива при бусте
    }
    
    activateBoost() {
        if (this.fuel > 20 && !this.boosting) {
            this.boosting = true;
            this.spd = this.boostSpd;
        }
    }
    
    deactivateBoost() {
        this.boosting = false;
        this.spd = 1.7; // Возврат к базовой скорости
    }
}

export class Niska extends Vehicle {
    constructor(faction, x, y) {
        super('niska', faction, x, y);
        this.hp = this.maxHp = 260;
        this.dmg = 10;
        this.range = 150;
        this.spd = 1.8;
        this.cd = 45;
        this.size = 22;
        this.armor = 20;
        this.label = 'Niska APC';
        this.tracked = true; // Гусеничный БТР
    }
}

// ===== COLONIALS VEHICLES =====

// H-5 "Hatchet" - Легкий танк (обновленный)
export class Hatchet extends Vehicle {
    constructor(faction, x, y) {
        super('hatchet', faction, x, y);
        this.hp = this.maxHp = 195; // Нормализовано из 1950
        this.dmg = 45; // 40мм пушка
        this.range = 160;
        this.spd = 1.3; // 8.27 м/с нормализовано
        this.offRoadSpd = 1.1; // 5.79 м/с
        this.cd = 350; // 40мм пушка
        this.size = 22;
        this.armor = 5;
        this.label = 'H-5 Hatchet';
        this.tracked = true;
        this.crew = 3;
        this.extraFuel = 25; // Увеличенный топливный бак (325л vs 300л)
    }
}

// HC-2 "Scorpion" - Легкий пехотный танк
export class Scorpion extends Vehicle {
    constructor(faction, x, y) {
        super('scorpion', faction, x, y);
        this.hp = this.maxHp = 330; // Нормализовано из 3300
        this.dmg = 15; // Два 12.7мм пулемета
        this.range = 130;
        this.spd = 0.7; // Средняя скорость
        this.offRoadSpd = 0.9;
        this.cd = 50; // Очень быстрая скорострельность пулеметов
        this.size = 22;
        this.armor = 20;
        this.label = 'HC-2 Scorpion';
        this.tracked = true;
        this.crew = 3;
        this.revealRadius = 120; // Разведка
        this.antiInfantry = true; // Эффективен против пехоты
        this.infantryMultiplier = 2.5; // Урон по пехоте x2.5
    }
}

// 90T-v "Nemesis" - Штурмовой танк
export class Nemesis extends Vehicle {
    constructor(faction, x, y) {
        super('nemesis', faction, x, y);
        this.hp = this.maxHp = 365; // Нормализовано из 3650
        this.dmg = 90; // 68мм пушка + гранатомет
        this.range = 190;
        this.spd = 1.3; // 8.45 м/с нормализовано - самый быстрый штурмовой
        this.offRoadSpd = 0.7; // 5.92 м/с
        this.cd = 400; // Тяжелая пушка
        this.size = 28;
        this.armor = 50;
        this.label = '90T-v Nemesis';
        this.tracked = true;
        this.crew = 4;
        this.grenadeLauncher = true; // Гранатомет для подавления пехоты
        this.grenadeRadius = 40; // Радиус поражения гранат
    }
}

export class Falchion extends Vehicle {
    constructor(faction, x, y) {
        super('falchion', faction, x, y);
        this.hp = this.maxHp = 480;
        this.dmg = 70;
        this.range = 170;
        this.spd = 0.8;
        this.cd = 460;
        this.size = 26;
        this.armor = 50;
        this.label = 'Falchion';
        this.tracked = true; // Гусеничный танк
    }
}

export class Hoplite extends Vehicle {
    constructor(faction, x, y) {
        super('hoplite', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 7;
        this.range = 140;
        this.spd = 1.65; // Самый быстрый
        this.cd = 65;
        this.size = 20;
        this.armor = 25;
        this.label = 'Hoplite APC';
        this.tracked = true; // Гусеничный БТР
    }
}

// ===== ARTILLERY (фракционная) =====
export class WardenArtillery extends Vehicle {
    constructor(faction, x, y) {
        super('warden_artillery', faction, x, y);
        this.hp = this.maxHp = 80; // Хуже живучесть
        this.dmg = 95; // Больше урона
        this.range = 550; // Дальность 500
        this.minRange = 180; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.3; // Очень медленная
        this.cd = 520; // 8 секунд при 60 FPS
        this.size = 24;
        this.armor = 30; // Без брони
        this.label = 'Warden Artillery';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 100; // Большой радиус поражения
        this.tracked = true; // Гусеничная артиллерия
    }
}

export class ColonialArtillery extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_artillery', faction, x, y);
        this.hp = this.maxHp = 90; // Чуть лучше живучесть
        this.dmg = 65; // Немного меньше урона
        this.range = 380; // Дальность 400
        this.minRange = 150; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.7; // В 2 раза быстрее Wardens
        this.cd = 450; // 7 секунд при 60 FPS
        this.size = 22;
        this.armor = 30; // Немного брони
        this.label = 'Colonial Artillery';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 70; // Средний радиус поражения
        this.tracked = true; // Гусеничная артиллерия
    }
}

// ===== LOGISTICS VEHICLES =====
export class Truck extends Vehicle {
    constructor(faction, x, y) {
        super('truck', faction, x, y);
        this.hp = this.maxHp = 100;
        this.dmg = 0; // Без оружия
        this.range = 0;
        this.spd = 1.5; // Быстрый
        this.cd = 0;
        this.size = 22;
        this.armor = 2;
        this.label = 'Грузовик';
        this.cargoType = 'ammo'; // Тип груза
        this.cargoCapacity = SUPPLY_SYSTEM.truckCapacity;
        this.currentCargo = SUPPLY_SYSTEM.truckCapacity;
    }
    
    // Пополнение БК у другой техники
    supplyAmmo(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.ammo < targetUnit.maxAmmo) {
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxAmmo - targetUnit.ammo,
                20 // Скорость пополнения
            );
            targetUnit.ammo += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
    
    // Пополнение груза на базе
    replenishAtBase() {
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + SUPPLY_SYSTEM.logisticsReplenishRate
            );
        }
    }
}

export class FuelTruck extends Vehicle {
    constructor(faction, x, y) {
        super('fuel_truck', faction, x, y);
        this.hp = this.maxHp = 80;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.3;
        this.cd = 0;
        this.size = 24;
        this.armor = 2;
        this.label = 'Бензовоз';
        this.cargoType = 'fuel';
        this.cargoCapacity = SUPPLY_SYSTEM.fuelTruckCapacity;
        this.currentCargo = SUPPLY_SYSTEM.fuelTruckCapacity;
    }
    
    // Пополнение топлива у другой техники
    supplyFuel(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.fuel < targetUnit.maxFuel) {
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxFuel - targetUnit.fuel,
                40 // Скорость пополнения
            );
            targetUnit.fuel += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
    
    // Пополнение топлива на базе
    replenishAtBase() {
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + SUPPLY_SYSTEM.logisticsReplenishRate
            );
        }
    }
}

export class Engineer extends Vehicle {
    constructor(faction, x, y) {
        super('engineer', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.1; // Медленная
        this.cd = 0;
        this.size = 24;
        this.armor = 3;
        this.label = 'Инженерная машина';
        this.repairRange = 100; // Радиус ремонта
        this.cargoType = 'repair';
        this.cargoCapacity = SUPPLY_SYSTEM.engineerCapacity;
        this.currentCargo = SUPPLY_SYSTEM.engineerCapacity;
    }
    
    // Ремонт другой техники
    repairUnit(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.hp < targetUnit.maxHp) {
            const amount = Math.min(
                SUPPLY_SYSTEM.engineerRepairRate,
                targetUnit.maxHp - targetUnit.hp,
                this.currentCargo
            );
            targetUnit.hp += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
    
    // Пополнение материалов на базе
    replenishAtBase() {
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + SUPPLY_SYSTEM.logisticsReplenishRate
            );
        }
    }
}

// ===== FLATBED TRUCK FOR ARTILLERY (общий для обеих фракций) =====
export class Flatbed extends Vehicle {
    constructor(faction, x, y) {
        super('flatbed', faction, x, y);
        this.hp = this.maxHp = 150;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.0;
        this.cd = 0;
        this.size = 26;
        this.armor = 5;
        this.label = 'Flatbed';
        this.cargoType = 'artillery_ammo';
        this.cargoCapacity = SUPPLY_SYSTEM.flatbedCapacity;
        this.currentCargo = SUPPLY_SYSTEM.flatbedCapacity;
    }
    
    // Пополнение БК артиллерии
    supplyArtillery(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.ammo < targetUnit.maxAmmo) {
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxAmmo - targetUnit.ammo,
                30 // Большая скорость пополнения для артиллерии
            );
            targetUnit.ammo += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
    
    // Пополнение снарядов на базе
    replenishAtBase() {
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + SUPPLY_SYSTEM.logisticsReplenishRate * 1.5
            );
        }
    }
}

export function createVehicle(type, faction, x, y) {
    const map = {
        infantry: Infantry,
        // Wardens
        king_spire: KingSpire,
        devitt: Devitt,
        silverhand: Silverhand,
        gallagher_highwayman: GallagherHighwayman,
        niska: Niska,
        warden_artillery: WardenArtillery,
        // Colonials
        hatchet: Hatchet,
        scorpion: Scorpion,
        nemesis: Nemesis,
        falchion: Falchion,
        hoplite: Hoplite,
        colonial_artillery: ColonialArtillery,
        // Logistics
        truck: Truck,
        fuel_truck: FuelTruck,
        engineer: Engineer,
        flatbed: Flatbed,
    };
    const creator = map[type];
    if (!creator) return new Vehicle(type, faction, x, y);
    return new creator(faction, x, y);
}

// Доступная техника по фракциям
export const FACTION_VEHICLES = {
    wardens: ['king_spire', 'devitt', 'silverhand', 'gallagher_highwayman', 'niska', 'warden_artillery', 'truck', 'fuel_truck', 'engineer', 'flatbed'],
    colonials: ['hatchet', 'scorpion', 'nemesis', 'falchion', 'hoplite', 'colonial_artillery', 'truck', 'fuel_truck', 'engineer', 'flatbed'],
};
