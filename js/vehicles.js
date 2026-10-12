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
        this.spd = 1.0; // Замедлено
        this.cd = 60;
        this.size = 20;
        this.label = 'Vehicle';
        this.armor = 0;
        
        // Система БК и топлива
        this.ammo = SUPPLY_SYSTEM.maxAmmo;
        this.maxAmmo = SUPPLY_SYSTEM.maxAmmo;
        this.fuel = SUPPLY_SYSTEM.maxFuel;
        this.maxFuel = SUPPLY_SYSTEM.maxFuel;
    }
    
    takeDamage(dmg) {
        this.hp -= Math.max(1, dmg - this.armor);
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
export class Devitt extends Vehicle {
    constructor(faction, x, y) {
        super('devitt', faction, x, y);
        this.hp = this.maxHp = 280;
        this.dmg = 50;
        this.range = 160;
        this.spd = 1.0; // Медленный
        this.cd = 380;
        this.size = 22;
        this.armor = 5;
        this.label = 'Devitt';
    }
}

export class Gallagher extends Vehicle {
    constructor(faction, x, y) {
        super('gallagher', faction, x, y);
        this.hp = this.maxHp = 520;
        this.dmg = 30;
        this.range = 180;
        this.spd = 1.7; // Очень медленный
        this.cd = 250;
        this.size = 28;
        this.armor = 25;
        this.label = 'Gallagher 30mm';
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
        this.armor = 4;
        this.label = 'Niska APC';
    }
}

// ===== COLONIALS VEHICLES =====
export class Hatchet extends Vehicle {
    constructor(faction, x, y) {
        super('hatchet', faction, x, y);
        this.hp = this.maxHp = 220;
        this.dmg = 50;
        this.range = 150;
        this.spd = 1.2; // Быстрее Wardens
        this.cd = 430;
        this.size = 20;
        this.armor = 3;
        this.label = 'Hatchet';
    }
}

export class Falchion extends Vehicle {
    constructor(faction, x, y) {
        super('falchion', faction, x, y);
        this.hp = this.maxHp = 480;
        this.dmg = 60;
        this.range = 170;
        this.spd = 1.0;
        this.cd = 400;
        this.size = 26;
        this.armor = 10;
        this.label = 'Falchion';
    }
}

export class Hoplite extends Vehicle {
    constructor(faction, x, y) {
        super('hoplite', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 5;
        this.range = 140;
        this.spd = 1.6; // Самый быстрый
        this.cd = 50;
        this.size = 20;
        this.armor = 3;
        this.label = 'Hoplite APC';
    }
}

// ===== ARTILLERY (фракционная) =====
export class WardenArtillery extends Vehicle {
    constructor(faction, x, y) {
        super('warden_artillery', faction, x, y);
        this.hp = this.maxHp = 100; // Хуже живучесть
        this.dmg = 85; // Больше урона
        this.range = 500; // Дальность 500
        this.minRange = 150; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.3; // Очень медленная
        this.cd = 480; // 8 секунд при 60 FPS
        this.size = 24;
        this.armor = 0; // Без брони
        this.label = 'Warden Artillery';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 80; // Большой радиус поражения
    }
}

export class ColonialArtillery extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_artillery', faction, x, y);
        this.hp = this.maxHp = 110; // Чуть лучше живучесть
        this.dmg = 75; // Немного меньше урона
        this.range = 400; // Дальность 400
        this.minRange = 120; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.6; // В 2 раза быстрее Wardens
        this.cd = 420; // 7 секунд при 60 FPS
        this.size = 22;
        this.armor = 1; // Немного брони
        this.label = 'Colonial Artillery';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 70; // Средний радиус поражения
    }
}

// ===== LOGISTICS VEHICLES =====
export class Truck extends Vehicle {
    constructor(faction, x, y) {
        super('truck', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 0; // Без оружия
        this.range = 0;
        this.spd = 1.8; // Быстрый
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
        this.hp = this.maxHp = 140;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.6;
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
                25 // Скорость пополнения
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
        this.hp = this.maxHp = 160;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.2; // Медленная
        this.cd = 0;
        this.size = 24;
        this.armor = 3;
        this.label = 'Инженерная машина';
        this.repairRange = 80; // Радиус ремонта
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
        this.spd = 1.5;
        this.cd = 0;
        this.size = 26;
        this.armor = 2;
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
        devitt: Devitt,
        gallagher: Gallagher,
        niska: Niska,
        hatchet: Hatchet,
        falchion: Falchion,
        hoplite: Hoplite,
        warden_artillery: WardenArtillery,
        colonial_artillery: ColonialArtillery,
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
    wardens: ['devitt', 'gallagher', 'niska', 'warden_artillery', 'truck', 'fuel_truck', 'engineer', 'flatbed'],
    colonials: ['hatchet', 'falchion', 'hoplite', 'colonial_artillery', 'truck', 'fuel_truck', 'engineer', 'flatbed'],
};
