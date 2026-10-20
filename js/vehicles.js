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
        this.gameTime = 0;
        this.direction = 0;
        this.lastHitDmg = 0;
        this.game = null;
        this.hp = 100;
        this.maxHp = 100;
        this.dmg = 10;
        this.range = 100;
        this.spd = 1.0;
        this.cd = 60;
        this.size = 20;
        this.label = 'Vehicle';
        this.armor = 0;
        this.tracked = false;

        // Система БК и топлива
        this.ammo = SUPPLY_SYSTEM.maxAmmo;
        this.maxAmmo = SUPPLY_SYSTEM.maxAmmo;
        this.fuel = SUPPLY_SYSTEM.maxFuel;
        this.maxFuel = SUPPLY_SYSTEM.maxFuel;

        // ===== ТУМАН ВОЙНЫ: базовые значения (переопределяются в наследниках) =====
        this.stealth = 20;          // скрытность
        this.detectRange = 80;      // радиус обнаружения
        this.visibilityRange = 0;   // кэш радиуса видимости (считается в game.js)
        this.visionBase = 100;      // "обзор" — база для процентов detectRange
    }

    takeDamage(dmg, src = null, game = null) {
        const d = Number(dmg);
        if (!Number.isFinite(d) || d <= 0) return;

        let effective = d;

        if (src && src.armorPierce) {
            const pa = Number(src.armorPierce);
            const tArmor = Math.max(0, Number(this.armor) || 0);
            const half = pa / 2;
            let mult;
            if (tArmor >= pa) mult = 0.5;
            else if (tArmor >= half) mult = 1.0;
            else mult = 1 + (half - tArmor) / half;
            effective = d * mult;
        }

        const armor = Number(this.armor) || 0;
        let finalDamage = Math.max(1, effective - armor);
        const G = game || this.game;

        // Бонус обороны города
        if (G && typeof G.getCityDefenseBonus === 'function') {
            const bonus = G.getCityDefenseBonus(this);
            if (bonus > 0) {
                finalDamage = Math.max(1, Math.floor(finalDamage * (1 - bonus)));
            }
        }

        // Бонус укрытия (только при включённом тумане войны + в кустах)
        if (G && typeof G.getConcealDefenseBonus === 'function') {
            const cb = G.getConcealDefenseBonus(this);
            if (cb > 0) {
                finalDamage = Math.max(1, Math.floor(finalDamage * (1 - cb)));
            }
        }

        this.hp -= finalDamage;
        this.lastHitDmg = finalDamage;
    }

    canAttack() {
        if (this.isArtillery) return this.ammo >= SUPPLY_SYSTEM.artilleryAmmoConsumption;
        return this.ammo >= SUPPLY_SYSTEM.ammoConsumption;
    }

    useAmmo() {
        const cost = this.isArtillery ? SUPPLY_SYSTEM.artilleryAmmoConsumption
                                      : SUPPLY_SYSTEM.ammoConsumption;
        this.ammo = Math.max(0, this.ammo - cost);
    }

    useFuel() {
        if (this.isInfantry) return;
        this.fuel = Math.max(0, this.fuel - SUPPLY_SYSTEM.fuelConsumption);
    }

    canMove() {
        if (this.isInfantry) return true;
        return this.fuel > 0;
    }

    regenerateAtBase(gameTime) {
        const interval = SUPPLY_SYSTEM.baseRegenInterval || 100;
        if (gameTime !== undefined) {
            if (this._lastBaseRegen === undefined) this._lastBaseRegen = gameTime;
            if (gameTime - this._lastBaseRegen < interval) return;
            this._lastBaseRegen = gameTime;
        }
        const pct = SUPPLY_SYSTEM.baseRegenPercent ?? 0.01;
        if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * pct);
        if (this.ammo < this.maxAmmo) this.ammo = Math.min(this.maxAmmo, this.ammo + this.maxAmmo * pct);
        if (this.fuel < this.maxFuel) this.fuel = Math.min(this.maxFuel, this.fuel + this.maxFuel * pct);
    }
}

// Вспомогательный throttled-тик пополнения логистики на базе
function baseRegenTick(unit, gameTime, interval) {
    const iv = interval || SUPPLY_SYSTEM.baseRegenInterval || 100;
    if (gameTime !== undefined) {
        if (unit._lastLogisticsRegen === undefined) unit._lastLogisticsRegen = gameTime;
        if (gameTime - unit._lastLogisticsRegen < iv) return false;
        unit._lastLogisticsRegen = gameTime;
    }
    return true;
}

// ===== ИНФАНТЕРИЯ (базовый класс) =====
// По умолчанию пехота получает скрытность 20 и обнаружение 80.
// Наследники переопределяют значения, если нужны другие ТТХ.
export class InfantryBase extends Vehicle {
    constructor(type, faction, x, y) {
        super(type, faction, x, y);
        this.isInfantry = true;
        this.size = 8;
        this.spd = 0.5;
        this.maxFuel = 0;
        this.fuel = 0;
        this.stealth = 20;
        this.detectRange = 80;
        this.visionBase = 100;
    }
}

export class InfantryVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('rifleman', faction, x, y);
        this.hp = this.maxHp = 35;
        this.dmg = 8;
        this.range = 130;
        this.spd = 0.5;
        this.cd = 120;
        this.label = 'Стрелок';
        this.stealth = 20;
        this.detectRange = 80;
        this.visionBase = 100;
    }
}

export class InfantryColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('rifleman', faction, x, y);
        this.hp = this.maxHp = 30;
        this.dmg = 6;
        this.range = 120;
        this.spd = 0.55;
        this.cd = 100;
        this.label = 'Стрелок';
        this.stealth = 20;
        this.detectRange = 80;
        this.visionBase = 100;
    }
}

export class AssualtVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('assualt_varden', faction, x, y);
        this.hp = this.maxHp = 45;
        this.dmg = 5;
        this.range = 110;
        this.spd = 0.6;
        this.cd = 50;
        this.label = 'Штурмовик';
        this.stealth = 15;
        this.detectRange = 90;
        this.visionBase = 110;
    }
}

export class AssualtColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('assualt_varden', faction, x, y);
        this.hp = this.maxHp = 50;
        this.dmg = 6;
        this.range = 90;
        this.spd = 0.7;
        this.cd = 60;
        this.label = 'Штурмовик';
        this.stealth = 15;
        this.detectRange = 90;
        this.visionBase = 110;
    }
}

// Контрабандист — элитный разведчик wardens.
// Обзор 180, обнаружение = обзор (без штрафа).
export class smuggler extends InfantryBase {
    constructor(faction, x, y) {
        super('smuggler_varden', faction, x, y);
        this.hp = this.maxHp = 60;
        this.dmg = 20;
        this.range = 140;
        this.spd = 0.7;
        this.cd = 140;
        this.label = 'Контрабандист';
        this.stealth = 40;
        this.visionBase = 180;
        this.detectRange = 140;
    }
}

// Браконьер — элитный стрелок colonials.
// Обзор 190, обнаружение = обзор −10% = 171 → округляем до 170.
export class poacher extends InfantryBase {
    constructor(faction, x, y) {
        super('poacher_colonist', faction, x, y);
        this.hp = this.maxHp = 40;
        this.dmg = 35;
        this.range = 190;
        this.spd = 0.7;
        this.cd = 350;
        this.label = 'Браконьер';
        this.stealth = 50;
        this.visionBase = 190;
        this.detectRange = Math.round(this.visionBase * 0.9); // −10% = 171
    }
}

export class MedicVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('medic_varden', faction, x, y);
        this.hp = this.maxHp = 30;
        this.dmg = 2;
        this.range = 110;
        this.spd = 0.5;
        this.cd = 60;
        this.label = 'Медик';
        this.isMedic = true;
        this.healRate = 0.15;
        this.healRange = 80;
        this.healInterval = 60;
        this.lastHealTime = 0;
        this.cargoType = 'med';
        this.cargoCapacity = 100;
        this.currentCargo = 100;
        this.stealth = 30;
        this.detectRange = 80;
        this.visionBase = 100;
    }
    healUnit(targetUnit) {
        if (!targetUnit || typeof targetUnit !== 'object') return 0;
        if (targetUnit.isInfantry !== true && targetUnit.type !== 'infantry') return 0;
        const hp = Number(targetUnit.hp);
        const maxHp = Number(targetUnit.maxHp);
        if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
        if (hp >= maxHp - 0.5) return 0;
        const amount = Math.min(this.healRate, maxHp - hp);
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        targetUnit.hp = hp + amount;
        return amount;
    }
}

export class MedicColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('medic_colonist', faction, x, y);
        this.hp = this.maxHp = 25;
        this.dmg = 4;
        this.range = 110;
        this.spd = 0.45;
        this.cd = 50;
        this.label = 'Медик';
        this.isMedic = true;
        this.healRate = 0.15;
        this.healRange = 80;
        this.healInterval = 60;
        this.lastHealTime = 0;
        this.cargoType = 'med';
        this.cargoCapacity = 100;
        this.currentCargo = 100;
        this.stealth = 20;
        this.detectRange = 80;
        this.visionBase = 100;
    }
    healUnit(targetUnit) {
        if (!targetUnit || typeof targetUnit !== 'object') return 0;
        if (targetUnit.isInfantry !== true && targetUnit.type !== 'infantry') return 0;
        const hp = Number(targetUnit.hp);
        const maxHp = Number(targetUnit.maxHp);
        if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
        if (hp >= maxHp - 0.5) return 0;
        const amount = Math.min(this.healRate, maxHp - hp);
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        targetUnit.hp = hp + amount;
        return amount;
    }
}

export class MgGunner extends InfantryBase {
    constructor(faction, x, y) {
        super('mg_gunner', faction, x, y);
        this.hp = this.maxHp = 65;
        this.dmg = 10;
        this.range = 130;
        this.spd = 0.2;
        this.cd = 40;
        this.antiInfantry = true;
        this.infantryMultiplier = 1.5;
        this.label = 'Пулемётчик';
        this.stealth = 15;
        this.detectRange = 80;
        this.visionBase = 120;
    }
}

// Снайпер Wardens. Обзор 225, обнаружение = обзор −20% = 180.
export class SniperVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('sniper', faction, x, y);
        this.hp = this.maxHp = 20;
        this.dmg = 45;
        this.range = 300;
        this.spd = 0.4;
        this.cd = 900;
        this.label = 'Снайпер';
        this.stealth = 100;
        this.visionBase = 225;
        this.detectRange = Math.round(this.visionBase * 0.8); // −20% = 180
    }
}

// Снайпер Colonials. Чуть слабее, обнаружение тоже −20% от обзора 225 → 180.
export class SniperColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('sniper', faction, x, y);
        this.hp = this.maxHp = 30;
        this.dmg = 35;
        this.range = 250;
        this.spd = 0.5;
        this.cd = 700;
        this.label = 'Снайпер';
        this.stealth = 100;
        this.visionBase = 225;
        this.detectRange = Math.round(this.visionBase * 0.8); // −20% = 180
    }
}

export class GrenadierVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('grenadier', faction, x, y);
        this.hp = this.maxHp = 60;
        this.dmg = 65;
        this.range = 110;
        this.spd = 0.8;
        this.cd = 250;
        this.grenadeLauncher = true;
        this.grenadeRadius = 15;
        this.label = 'Гранатомётчик';
        this.stealth = 18;
        this.detectRange = 90;
        this.visionBase = 110;
    }
}

export class GrenadierColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('grenadier', faction, x, y);
        this.hp = this.maxHp = 50;
        this.dmg = 40;
        this.range = 120;
        this.spd = 0.9;
        this.cd = 200;
        this.grenadeLauncher = true;
        this.grenadeRadius = 30;
        this.label = 'Гренадер';
        this.stealth = 18;
        this.detectRange = 90;
        this.visionBase = 110;
    }
}

// ===== WARDENS VEHICLES =====

// King Spire — разведывательный танк
export class KingSpire extends Vehicle {
    constructor(faction, x, y) {
        super('king_spire', faction, x, y);
        this.hp = this.maxHp = 150;
        this.dmg = 18;
        this.range = 140;
        this.spd = 1.3;
        this.offRoadSpd = 1.0;
        this.cd = 50;
        this.size = 20;
        this.armor = 25;
        this.label = 'King Spire';
        this.tracked = true;
        this.revealRadius = 120;
        this.crew = 2;
        // Разведчик: видит лучше обычной техники
        this.visionBase = Math.round(this.range * 1.5); // 168
        this.detectRange = Math.round(this.range * 1.2); // 112
        this.stealth = 50;
    }
}

// Noble Widow — ПТ-техника (повышенная маскировка)
export class NobleWidow extends Vehicle {
    constructor(faction, x, y) {
        super('noble_widow', faction, x, y);
        this.hp = this.maxHp = 420;
        this.dmg = 150;
        this.range = 250;
        this.spd = 0.2;
        this.offRoadSpd = 0.15;
        this.cd = 700;
        this.size = 28;
        this.armor = 70;
        this.label = 'Noble Widow';
        this.tracked = true;
        this.crew = 4;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.8);
        this.ammo = this.maxAmmo;
        // ПТ: обнаружение = range × 0.9 (видимость всё равно 1.2×range)
        this.visionBase = Math.round(this.range * 1.2); // 300
        this.detectRange = Math.round(this.range * 0.9); // 225
        this.stealth = 60;
    }
}

// Devitt Mk. III — лёгкий танк
export class Devitt extends Vehicle {
    constructor(faction, x, y) {
        super('devitt', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 45;
        this.range = 150;
        this.spd = 1.6;
        this.offRoadSpd = 1.1;
        this.cd = 290;
        this.size = 22;
        this.armor = 40;
        this.label = 'Devitt Mk.III';
        this.tracked = true;
        this.crew = 3;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
        this.visionBase = Math.round(this.range * 1.2); // 180
        this.detectRange = Math.round(this.range * 0.8); // 120
        this.stealth = 15;
    }
}


// Devitt MMR — миномёт (поддержка)
export class DevittMMR extends Vehicle {
    constructor(faction, x, y) {
        super('devitt_mmr', faction, x, y);
        this.hp = this.maxHp = 160;
        this.dmg = 25;
        this.range = 240;
        this.minRange = 90;
        this.spd = 1.1;
        this.offRoadSpd = 1.0;
        this.cd = 300;
        this.size = 22;
        this.armor = 30;
        this.label = 'Devitt MMR';
        this.tracked = true;
        this.crew = 3;
        this.isMortar = true;
        this.aoe = true;
        this.aoeRadius = 30;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
        // Поддержка: видимость 100 (фикс), обнаружение обычное
        this.visionBase = 100;
        this.detectRange = Math.round(this.range * 0.8); // 192
        this.stealth = 35;
    }
}

export class Nona extends Vehicle {
    constructor(faction, x, y) {
        super('nona', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 75;
        this.range = 350;
        this.minRange = 50;
        this.spd = 1.2;
        this.offRoadSpd = 1.0;
        this.cd = 300;
        this.size = 22;
        this.armor = 25;
        this.label = 'Devitt MMR';
        this.tracked = true;
        this.crew = 3;
        this.isMortar = true;
        this.aoe = true;
        this.aoeRadius = 50;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.8);
        this.ammo = this.maxAmmo;
        this.visionBase = 150;
        this.detectRange = 145;
        this.stealth = 50;
    }
}

// Silverhand Mk. IV — штурмовой танк
export class Silverhand extends Vehicle {
    constructor(faction, x, y) {
        super('silverhand', faction, x, y);
        this.hp = this.maxHp = 310;
        this.dmg = 85;
        this.range = 170;
        this.spd = 1.1;
        this.offRoadSpd = 1.1;
        this.cd = 500;
        this.size = 28;
        this.armor = 50;
        this.label = 'Silverhand Mk.IV';
        this.tracked = true;
        this.crew = 4;
        this.dualGun = true;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
        this.visionBase = Math.round(this.range * 1.2); // 204
        this.detectRange = Math.round(this.range * 0.8); // 136
        this.stealth = 3;
    }
}

// Gallagher Highwayman — крейсерский танк (буст)
export class GallagherHighwayman extends Vehicle {
    constructor(faction, x, y) {
        super('gallagher_highwayman', faction, x, y);
        this.hp = this.maxHp = 295;
        this.dmg = 35;
        this.range = 165;
        this.spd = 1.7;
        this.offRoadSpd = 1.2;
        this.boostSpd = 2.8;
        this.cd = 60;
        this.size = 24;
        this.armor = 45;
        this.label = 'Gallagher Highwayman';
        this.tracked = true;
        this.crew = 3;
        this.canBoost = true;
        this.boosting = false;
        this.boostFuelCost = 0.5;
        this.maxFuel = Math.round(SUPPLY_SYSTEM.maxFuel * 3);
        this.fuel = this.maxFuel;
        this.visionBase = Math.round(this.range * 1.2); // 198
        this.detectRange = Math.round(this.range * 0.8); // 132
        this.stealth = 5;
    }
    activateBoost() {
        if (this.fuel > 20 && !this.boosting) {
            this.boosting = true;
            this.spd = this.boostSpd;
        }
    }
    deactivateBoost() {
        this.boosting = false;
        this.spd = 1.7;
    }
}

// Gallagher Outlaw — тяжёлый крейсер (буст)
export class GallagherOutlaw extends Vehicle {
    constructor(faction, x, y) {
        super('gallagher_outlaw', faction, x, y);
        this.hp = this.maxHp = 370;
        this.dmg = 45;
        this.range = 190;
        this.spd = 1.5;
        this.offRoadSpd = 1.2;
        this.boostSpd = 2.8;
        this.cd = 150;
        this.size = 26;
        this.armor = 30;
        this.label = 'Gallagher Outlaw Mk. II';
        this.tracked = true;
        this.crew = 3;
        this.canBoost = true;
        this.boosting = false;
        this.boostFuelCost = 0.5;
        this.maxFuel = Math.round(SUPPLY_SYSTEM.maxFuel * 3);
        this.fuel = this.maxFuel;
        this.visionBase = Math.round(this.range * 1.2); // 228
        this.detectRange = Math.round(this.range * 0.8); // 152
        this.stealth = 5;
    }
    activateBoost() {
        if (this.fuel > 20 && !this.boosting) {
            this.boosting = true;
            this.spd = this.boostSpd;
        }
    }
    deactivateBoost() {
        this.boosting = false;
        this.spd = 1.5;
    }
}

// Niska APC
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
        this.tracked = true;
        this.visionBase = Math.round(this.range * 1.2); // 180
        this.detectRange = Math.round(this.range * 0.8); // 120
        this.stealth = 35;
    }
}

// Niska Blinder — ПТ/разведка с высокой маскировкой
export class NiskaBlinder extends Vehicle {
    constructor(faction, x, y) {
        super('niska_blinder', faction, x, y);
        this.hp = this.maxHp = 320;
        this.dmg = 100;
        this.range = 190;
        this.spd = 1.5;
        this.cd = 500;
        this.size = 22;
        this.armor = 25;
        this.label = 'Niska Blinder';
        this.tracked = true;
        // ПТ: обнаружение −10% от обзора, скрытность как у ПТ
        this.visionBase = Math.round(this.range * 1.2); // 228
        this.detectRange = Math.round(this.range * 0.9); // 171
        this.stealth = 45;
    }
}

// ===== COLONIALS VEHICLES =====

export class Hatchet extends Vehicle {
    constructor(faction, x, y) {
        super('hatchet', faction, x, y);
        this.hp = this.maxHp = 195;
        this.dmg = 45;
        this.range = 160;
        this.spd = 1.3;
        this.offRoadSpd = 1.1;
        this.cd = 350;
        this.size = 22;
        this.armor = 30;
        this.label = 'H-5 Hatchet';
        this.tracked = true;
        this.crew = 3;
        this.extraFuel = 25;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
        this.visionBase = Math.round(this.range * 1.2); // 192
        this.detectRange = Math.round(this.range * 0.8); // 128
        this.stealth = 10;
    }
}

export class pelekys extends Vehicle {
    constructor(faction, x, y) {
        super('pelekys', faction, x, y);
        this.hp = this.maxHp = 175;
        this.dmg = 110;
        this.range = 190;
        this.spd = 1.3;
        this.offRoadSpd = 1.1;
        this.cd = 500;
        this.size = 20;
        this.armor = 15;
        this.label = 'H-10 Pelekys';
        this.tracked = true;
        this.crew = 3;
        this.extraFuel = 25;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
        this.visionBase = Math.round(this.range * 1.2); // 192
        this.detectRange = Math.round(this.range * 0.9); // 128
        this.stealth = 35;
    }
}

export class Scorpion extends Vehicle {
    constructor(faction, x, y) {
        super('scorpion', faction, x, y);
        this.hp = this.maxHp = 330;
        this.dmg = 15;
        this.range = 130;
        this.spd = 0.7;
        this.offRoadSpd = 0.9;
        this.cd = 50;
        this.size = 22;
        this.armor = 20;
        this.label = 'HC-2 Scorpion';
        this.tracked = true;
        this.crew = 3;
        this.revealRadius = 120;
        this.antiInfantry = true;
        this.infantryMultiplier = 2.5;
        this.visionBase = Math.round(this.range * 1.2); // 156
        this.detectRange = Math.round(this.range * 0.8); // 104
        this.stealth = 40;
    }
}

// Nemesis — ПТ-танк (повышенная маскировка, −10% обнаружение)
export class Nemesis extends Vehicle {
    constructor(faction, x, y) {
        super('nemesis', faction, x, y);
        this.hp = this.maxHp = 365;
        this.dmg = 110;
        this.range = 190;
        this.spd = 1.3;
        this.offRoadSpd = 0.7;
        this.cd = 400;
        this.size = 28;
        this.armor = 50;
        this.label = '90T-v Nemesis';
        this.tracked = true;
        this.crew = 4;
        this.grenadeLauncher = true;
        this.grenadeRadius = 40;
        // ПТ: обнаружение −10% от обзора, скрытность как у ПТ
        this.visionBase = Math.round(this.range * 1.2); // 228
        this.detectRange = Math.round(this.range * 0.9); // 171
        this.stealth = 50;
    }
}

export class Falchion extends Vehicle {
    constructor(faction, x, y) {
        super('falchion', faction, x, y);
        this.hp = this.maxHp = 400;
        this.dmg = 65;
        this.range = 150;
        this.spd = 0.8;
        this.cd = 460;
        this.size = 26;
        this.armor = 35;
        this.label = 'Falchion';
        this.tracked = true;
        this.visionBase = Math.round(this.range * 1.2); // 180
        this.detectRange = Math.round(this.range * 0.8); // 120
        this.stealth = 10;
    }
}

export class Spatha extends Vehicle {
    constructor(faction, x, y) {
        super('spatha', faction, x, y);
        this.hp = this.maxHp = 560;
        this.dmg = 80;
        this.range = 180;
        this.spd = 0.7;
        this.cd = 500;
        this.size = 26;
        this.armor = 70;
        this.label = 'Spatha';
        this.tracked = true;
        this.visionBase = Math.round(this.range * 1.2); // 216
        this.detectRange = Math.round(this.range * 0.8); // 144
        this.stealth = 5;
    }
}

// Talos — ПТ-техника (тяжёлый штурмовик, тоже считается ПТ по вашей просьбе? — по умолчанию НЕТ).
// В списке ПТ — только те, что вы назвали: Niska Blinder, Noble Widow, Nemesis.
// Talos оставлен обычной техникой (0.8).
export class Talos extends Vehicle {
    constructor(faction, x, y) {
        super('talos', faction, x, y);
        this.hp = this.maxHp = 350;
        this.dmg = 105;
        this.range = 150;
        this.spd = 0.5;
        this.cd = 800;
        this.size = 26;
        this.armor = 45;
        this.label = 'Talos';
        this.tracked = true;
        this.armorPierce = 70;
        this.visionBase = Math.round(this.range * 1.2); // 180
        this.detectRange = Math.round(this.range * 0.8); // 120
        this.stealth = 5;
    }
}

// Javelin — БТР колонистов
export class Javelin extends Vehicle {
    constructor(faction, x, y) {
        super('javelin', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 7;
        this.range = 140;
        this.spd = 1.65;
        this.cd = 65;
        this.size = 20;
        this.armor = 25;
        this.label = 'Javelin APC';
        this.tracked = true;
        this.visionBase = Math.round(this.range * 1.2); // 168
        this.detectRange = Math.round(this.range * 0.8); // 112
        this.stealth = 20;
    }
}

// Hoplite — миномёт (поддержка)
export class Hoplite extends Vehicle {
    constructor(faction, x, y) {
        super('hoplite', faction, x, y);
        this.hp = this.maxHp = 150;
        this.dmg = 25;
        this.range = 180;
        this.minRange = 80;
        this.spd = 1.3;
        this.cd = 150;
        this.size = 20;
        this.armor = 15;
        this.label = 'Hoplite Mortar';
        this.tracked = true;
        this.isMortar = true;
        this.aoe = true;
        this.aoeRadius = 30;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
        // Поддержка: видимость 100
        this.visionBase = 100;
        this.detectRange = Math.round(this.range * 0.8); // 144
        this.stealth = 40;
    }
}

// ===== ARTILLERY (фракционная) =====

// Wardens 120 мм
export class WardenArtillery120 extends Vehicle {
    constructor(faction, x, y) {
        super('warden_artillery120', faction, x, y);
        this.hp = this.maxHp = 100;
        this.dmg = 60;
        this.range = 600;
        this.minRange = 100;
        this.spd = 0.6;
        this.cd = 400;
        this.size = 24;
        this.armor = 25;
        this.label = 'Warden Artillery 120mm';
        this.aoe = true;
        this.aoeRadius = 65;
        this.tracked = true;
        this.isArtillery = true;
        this.isMortar = true;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
        // Артиллерия: видимость 100 (фикс), обнаружение обычное
        this.visionBase = 100;
        this.detectRange = Math.round(this.range * 0.8);
        this.stealth = 40;
    }
}

// Wardens 150 мм
export class WardenArtillery150mm extends Vehicle {
    constructor(faction, x, y) {
        super('warden_artillery150', faction, x, y);
        this.hp = this.maxHp = 80;
        this.dmg = 95;
        this.range = 550;
        this.minRange = 180;
        this.spd = 0.3;
        this.cd = 550;
        this.size = 24;
        this.armor = 30;
        this.label = 'Warden Artillery 150mm';
        this.aoe = true;
        this.aoeRadius = 100;
        this.tracked = true;
        this.isArtillery = true;
        this.isMortar = true;
        this.visionBase = 100;
        this.detectRange = Math.round(this.range * 0.8);
        this.stealth = 40;
    }
}

// Colonials 150 мм
export class ColonialArtillery150mm extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_artillery150', faction, x, y);
        this.hp = this.maxHp = 90;
        this.dmg = 85;
        this.range = 550;
        this.minRange = 150;
        this.spd = 0.5;
        this.cd = 450;
        this.size = 22;
        this.armor = 15;
        this.label = 'Colonial Artillery 150mm';
        this.aoe = true;
        this.aoeRadius = 80;
        this.tracked = true;
        this.isArtillery = true;
        this.isMortar = true;
        this.visionBase = 100;
        this.detectRange = Math.round(this.range * 0.8);
        this.stealth = 40;
    }
}

// Colonials 120 мм
export class ColonialArtillery120mm extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_artillery120', faction, x, y);
        this.hp = this.maxHp = 60;
        this.dmg = 55;
        this.range = 400;
        this.minRange = 60;
        this.spd = 0.7;
        this.cd = 400;
        this.size = 22;
        this.armor = 15;
        this.label = 'Colonial Artillery 120mm';
        this.aoe = true;
        this.aoeRadius = 45;
        this.tracked = true;
        this.isArtillery = true;
        this.isMortar = true;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
        this.visionBase = 100;
        this.detectRange = Math.round(this.range * 0.8);
        this.stealth = 40;
    }
}

const WardenArtillery = WardenArtillery150mm;
const ColonialArtillery = ColonialArtillery150mm;

export const ARTILLERY_TYPES = [
    'warden_artillery120', 'warden_artillery150',
    'colonial_artillery120', 'colonial_artillery150',
];

export function isArtilleryUnit(u) {
    if (!u) return false;
    if (ARTILLERY_TYPES.includes(u.type)) return true;
    return u.type === 'warden_artillery' || u.type === 'colonial_artillery';
}

// ===== LOGISTICS VEHICLES =====

// ===== РАЗВЕДЫВАТЕЛЬНЫЕ МАШИНЫ =====
export class WardenScoutCar extends Vehicle {
    constructor(faction, x, y) {
        super('warden_scout_car', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 0; // Не может атаковать
        this.range = 0;
        this.spd = 2.2; // Очень быстрая
        this.cd = 0;
        this.size = 18;
        this.armor = 10;
        this.label = 'Warden Recon Car';
        this.tracked = false;
        this.stealth = 150; // Очень хорошая маскировка
        this.visionBase = 280; // Хороший обзор
        this.detectRange = 170; 
    }
}

export class ColonialScoutCar extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_scout_car', faction, x, y);
        this.hp = this.maxHp = 110;
        this.dmg = 0;
        this.range = 0;
        this.spd = 2.4; // Чуть быстрее
        this.cd = 0;
        this.size = 18;
        this.armor = 5;
        this.label = 'Colonial Recon Car';
        this.tracked = false;
        this.stealth = 160; // Еще лучше маскировка
        this.visionBase = 240; 
        this.detectRange = 160;
    }
}

// ===== ПЕХОТА-РАЗВЕДЧИК =====
export class ScoutInfantry extends InfantryBase {
    constructor(faction, x, y) {
        super('scout_infantry', faction, x, y);
        this.hp = this.maxHp = 25;
        this.dmg = 0; // Не может атаковать
        this.range = 0;
        this.spd = 0.8; // Быстрее обычной пехоты
        this.cd = 0;
        this.label = 'Разведчик';
        this.size = 5;
        // По ТЗ: обзор на 30% меньше машины (200 * 0.7 = 140)
        this.visionBase = 180; 
        this.detectRange = 50; // Пока идет пешком, виден с 50
        
        // Маскировка
        this.stealth = 80;
        // Спец. свойства для кустов (обрабатываются в game.js)
        this.isScoutInfantry = true; 
    }
}

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
        // Логистика не воюет — но должна как-то видеть. Дадим скромные параметры.
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
    }
    healUnit(targetUnit) {
        if (!targetUnit || typeof targetUnit !== 'object') return 0;
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
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.5;
        this.cd = 0;
        this.size = 22;
        this.armor = 2;
        this.label = 'Грузовик';
        this.cargoType = 'ammo';
        this.cargoCapacity = SUPPLY_SYSTEM.truckCapacity;
        this.currentCargo = SUPPLY_SYSTEM.truckCapacity;
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
    }
    supplyAmmo(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.ammo < targetUnit.maxAmmo) {
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxAmmo - targetUnit.ammo,
                40
            );
            targetUnit.ammo += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
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
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
    }
    supplyFuel(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.fuel < targetUnit.maxFuel) {
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxFuel - targetUnit.fuel,
                350
            );
            targetUnit.fuel += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
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

export class Engineer extends Vehicle {
    constructor(faction, x, y) {
        super('engineer', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 0;
        this.range = 0;
        this.spd = 1.1;
        this.cd = 0;
        this.size = 24;
        this.armor = 3;
        this.label = 'Инженерная машина';
        this.repairRange = 100;
        this.cargoType = 'repair';
        this.cargoCapacity = SUPPLY_SYSTEM.engineerCapacity;
        this.currentCargo = SUPPLY_SYSTEM.engineerCapacity;
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
    }
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

// ===== СТРОИТЕЛЬНАЯ ТЕХНИКА =====
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
        this.cargoType = 'construction';
        this.cargoCapacity = 400;
        this.currentCargo = 400;
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
    }
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
        this.label = 'Пожарная машина';
        this.tracked = false;
        this.cargoType = 'water';
        this.cargoCapacity = 300;
        this.currentCargo = 300;
        this.healRange = 150;
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
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
        this.stealth = 50;
        this.visionBase = 80;
        this.detectRange = 60;
    }
    supplyArtillery(targetUnit) {
        if (this.currentCargo > 0 && targetUnit.ammo < targetUnit.maxAmmo) {
            const amount = Math.min(
                this.currentCargo,
                targetUnit.maxAmmo - targetUnit.ammo,
                30
            );
            targetUnit.ammo += amount;
            this.currentCargo -= amount;
            return amount;
        }
        return 0;
    }
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

// ===== Фабрика пехоты =====
function createInfantry(type, faction, x, y) {
    const isWardens = faction === 'wardens';
    switch (type) {
        case 'rifleman':
        case 'infantry':
            return isWardens ? new InfantryVarden(faction, x, y)
                             : new InfantryColonist(faction, x, y);
        case 'mg_gunner':
            return new MgGunner(faction, x, y);
        case 'grenadier':
            return isWardens ? new GrenadierVarden(faction, x, y)
                             : new GrenadierColonist(faction, x, y);
        case 'sniper':
            return isWardens ? new SniperVarden(faction, x, y)
                             : new SniperColonist(faction, x, y);
        case 'assualt_varden':
        case 'assualt_colonist':
            return isWardens ? new AssualtVarden(faction, x, y)
                             : new AssualtColonist(faction, x, y);
        case 'smuggler_varden':
            return new smuggler(faction, x, y);
        case 'poacher_colonist':
            return new poacher(faction, x, y);
        case 'medic_varden':
            return new MedicVarden(faction, x, y);
        case 'medic_colonist':
            return new MedicColonist(faction, x, y);
        default:
            return null;
    }
}

export const AT_VEHICLE_TYPES = ['niska_blinder', 'noble_widow', 'nemesis'];

export function applyVehicleVisibilityStats(u) {
    if (!u || isInfUnit(u)) return;
    const rng = Number(u.range) || 0;
    const isAT = AT_VEHICLE_TYPES.includes(u.type);

    if (!Number.isFinite(u.visionBase) || u.visionBase === 100) {
        // Не перезаписываем уже настроенные 100 (у артиллерии/поддержки).
        // Ставим «обзор» только если это «дефолтное» значение.
        if (u.visionBase === 100 && (u.aoe || u.isArtillery || u.isMortar)) {
            // оставить 100
        } else {
            u.visionBase = Math.round(rng * 1.2);
        }
    }
    if (!Number.isFinite(u.detectRange) || u.detectRange === 80) {
        u.detectRange = Math.round(rng * (isAT ? 0.9 : 0.8));
    }
    if (!Number.isFinite(u.stealth) || u.stealth === 20) {
        u.stealth = isAT ? 80 : 40;
    }
    if (!Number.isFinite(u.visibilityRange) || u.visibilityRange === 0) {
        u.visibilityRange = (u.aoe || u.isArtillery || u.isMortar)
            ? 100 : u.visionBase;
    }
}

export function createVehicle(type, faction, x, y) {
    const inf = createInfantry(type, faction, x, y);
    if (inf) return inf;

    const map = {
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

         warden_scout_car: WardenScoutCar,
        colonial_scout_car: ColonialScoutCar, 
    };
    const creator = map[type];
    if (!creator) {
        const v = new Vehicle(type, faction, x, y);
        applyVehicleVisibilityStats(v);
        return v;
    }
    const inst = new creator(faction, x, y);
    applyVehicleVisibilityStats(inst);
    return inst;
}

// Доступная техника по фракциям
export const FACTION_VEHICLES = {
    wardens: ['king_spire', 'devitt', 'devitt_mmr', 'silverhand', 'noble_widow',
              'gallagher_highwayman', 'niska', 'warden_artillery150',
              'warden_artillery120', 'truck', 'fuel_truck', 'engineer',
              'flatbed', 'gallagher_outlaw', 'niska_blinder', 'medic_truck',
              'construction_truck', 'fire_truck', 'warden_scout_car'],
    colonials: ['hatchet', 'scorpion', 'nemesis', 'falchion', 'talos', 'javelin',
                'hoplite', 'colonial_artillery150', 'colonial_artillery120',
                'truck', 'fuel_truck', 'engineer', 'flatbed', 'spatha',
                'medic_truck', 'god_loader', 'construction_truck', 'fire_truck', 'colonial_scout_car'],
};

// ===== Помощники по видам пехоты =====
export const INFANTRY_TYPES = [
    'rifleman', 'mg_gunner', 'grenadier', 'sniper',
    'assualt_varden', 'smuggler_varden', 'poacher_colonist',
    'medic_varden', 'medic_colonist',
    'scout_infantry' // <-- ДОБАВЛЕНО
];

export const FACTION_INFANTRY = {
    wardens:   ['rifleman', 'mg_gunner', 'grenadier', 'sniper',
                'assualt_varden', 'smuggler_varden', 'medic_varden',
                'scout_infantry'], // <-- ДОБАВЛЕНО
    colonials: ['rifleman', 'mg_gunner', 'grenadier', 'sniper',
                'assualt_varden', 'poacher_colonist', 'medic_colonist',
                'scout_infantry'], // <-- ДОБАВЛЕНО
};

export function isInfUnit(u) {
    if (!u) return false;
    return u.isInfantry === true || u.type === 'infantry' || INFANTRY_TYPES.includes(u.type);
}

export const LOGISTICS_TYPES = ['truck', 'fuel_truck', 'engineer', 'flatbed',
                                'medic_truck', 'construction_truck', 'fire_truck'];
export function isLogisticsUnit(u) {
    return !!u && LOGISTICS_TYPES.includes(u.type);
}

export function isTechUnit(u) {
    if (!u || u.hp <= 0) return false;
    if (isInfUnit(u)) return false;
    return !isLogisticsUnit(u);
}

export const TECHNIC_VEHICLE_TYPES = [
    'king_spire', 'devitt', 'silverhand', 'gallagher_highwayman', 'niska',
    'gallagher_outlaw', 'noble_widow',
    'hatchet', 'scorpion', 'nemesis', 'falchion', 'javelin', 'spatha', 'talos'
];

const DEFENSE_VS_TECH_MULT = 1.3;
const NOBLE_WIDOW_VS_TECH_MULT = 1.25;

export function isTechVehicle(u) {
    if (!u) return false;
    if (isInfUnit(u)) return false;
    return TECHNIC_VEHICLE_TYPES.includes(u.type);
}

export function getDefenseDamageVsTech(baseDamage, target) {
    if (!isTechVehicle(target)) return baseDamage;
    return Math.round(baseDamage * DEFENSE_VS_TECH_MULT);
}

export function getUnitAttackDamage(attacker, target, baseDamage) {
    let damage = baseDamage;
    if (attacker && attacker.type === 'noble_widow' && isTechVehicle(target)) {
        damage = damage * NOBLE_WIDOW_VS_TECH_MULT;
    }
    return damage;
}