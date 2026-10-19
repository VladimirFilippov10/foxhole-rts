// ===== ЛОГИСТИКА =====
// Вспомогательные машины: грузовик, бензовоз, инженер, платформа, медгрузовик,
// строительная машина, пожарная. Не считаются боевой техникой.
// Функция интервала пополнения на базе — baseRegenTick (из ./vehicle.js).

import { Vehicle, baseRegenTick } from './vehicle.js';
import { SUPPLY_SYSTEM } from '../constants.js';


export class MedicTruck extends Vehicle {
    constructor(faction, x, y) {
        super('medic_truck', faction, x, y);
        this.hp = this.maxHp = 110;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.1;
        this.cd = 0;
        this.size = 24;
        this.armor = 10;
        this.label = 'Скорая помощь';
        this.cargoType = 'med';
        this.cargoCapacity = SUPPLY_SYSTEM.medicTruckCapacity;
        this.currentCargo = SUPPLY_SYSTEM.medicTruckCapacity;
    }
    
    // Лечит ТОЛЬКО пехоту. Технику чинит инженер (Engineer.repairUnit).
    healUnit(targetUnit) {
        if (!targetUnit || typeof targetUnit !== 'object') return 0;
        // Защита: медик не должен лечить технику
        if (targetUnit.isInfantry !== true && targetUnit.type !== 'infantry') return 0;
        const cargo = Number(this.currentCargo);
        if (!Number.isFinite(cargo) || cargo <= 0) return 0;
        const hp = Number(targetUnit.hp);
        const maxHp = Number(targetUnit.maxHp);
        if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
        if (hp >= maxHp - 0.5) return 0;

        const amount = Math.min(
            Number(SUPPLY_SYSTEM.medicHealRate) || 0.05,
            maxHp - hp,
            cargo
        );
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        targetUnit.hp = hp + amount;
        this.currentCargo = cargo - amount;
        return amount;
    }
    
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01)
            );
        }
    }
}
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
            // ИСПРАВЛЕНИЕ: скорость за тик поднята (20 -> 40), пополнение
            // вызывается непрерывно каждым тиком — цель наполняется ДО КОНЦА
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxAmmo - targetUnit.ammo,
                40 // Скорость пополнения (за тик)
            );
            targetUnit.ammo += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
    
    // Пополнение груза на базе
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01)
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
                350 // Скорость пополнения (за тик) — бак наполняется полностью
            );
            targetUnit.fuel += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
    
    
    // Пополнение топлива на базе
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01)
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
        if (!targetUnit || typeof targetUnit !== 'object') return 0;
        const cargo = Number(this.currentCargo);
        if (!Number.isFinite(cargo) || cargo <= 0) return 0;
        const hp = Number(targetUnit.hp);
        const maxHp = Number(targetUnit.maxHp);
        if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
        if (hp >= maxHp - 0.5) return 0;

        const amount = Math.min(
            Number(SUPPLY_SYSTEM.medicHealRate) || 0,
            maxHp - hp,
            cargo
        );
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        targetUnit.hp = hp + amount;
        this.currentCargo = cargo - amount;
        return amount;
    }
    
    // Пополнение материалов на базе
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01)
            );
        }
    }
}

// ===== СТРОИТЕЛЬНАЯ ТЕХНИКА (Универсальная для обеих фракций) =====
export class ConstructionTruck extends Vehicle {
    constructor(faction, x, y) {
        super('construction_truck', faction, x, y);
        this.hp = this.maxHp = 250;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.1;
        this.cd = 0;
        this.size = 26;
        this.armor = 10;
        this.label = 'Строймашина';
        this.tracked = false;
        
        // Логистика: запас материалов для ремонта
        this.cargoType = 'construction';
        this.cargoCapacity = 400;
        this.currentCargo = 400;
    }
    
    // Пополнение запаса на базе
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01) * 2
            );
        }
    }
}

// ===== ПОЖАРНАЯ МАШИНА (Универсальная для обеих фракций) =====
export class FireTruck extends Vehicle {
    constructor(faction, x, y) {
        super('fire_truck', faction, x, y);
        this.hp = this.maxHp = 180;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.4;
        this.cd = 0;
        this.size = 26;
        this.armor = 5;
        this.label = 'Пожарная';
        this.tracked = false;
        
        // Запас воды (условный)
        this.cargoType = 'water';
        this.cargoCapacity = 300;
        this.currentCargo = 300;
        this.healRange = 150; // Радиус действия в городе
    }
    
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01) * 3
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
    replenishAtBase(gameTime) {
        if (!baseRegenTick(this, gameTime)) return;
        if (this.currentCargo < this.cargoCapacity) {
            this.currentCargo = Math.min(
                this.cargoCapacity,
                this.currentCargo + this.cargoCapacity * (SUPPLY_SYSTEM.baseRegenPercent ?? 0.01) * 1.5
            );
        }
    }
}
