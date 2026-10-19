// ===== БАЗОВЫЙ КЛАСС ЮНИТА (ТЕХНИКА) =====
// Общий класс Vehicle для всех юнитов + служебные функции логистики.
// Общие константы и списки типов — в ./common.js.

import { SUPPLY_SYSTEM } from '../constants.js';

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
        this.lastHitDmg = 0;
        this.game = null;
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
    


    takeDamage(dmg, src = null, game = null) {
        const d = Number(dmg);
        if (!Number.isFinite(d) || d <= 0) return;

        let effective = d;

        if (src && src.armorPierce) {
            const pa = Number(src.armorPierce);
            const tArmor = Math.max(0, Number(this.armor) || 0);
            const half = pa / 2; // 35 при пороге 70
            let mult;
            if (tArmor >= pa) mult = 0.5;
            else if (tArmor >= half) mult = 1.0;
            else mult = 1 + (half - tArmor) / half; // 1 → 3 прогрессивно
            effective = d * mult;
        }

        // ===== ВЫЧИТАНИЕ БРОНИ =====
        // Урон после брони (минимум 1, чтобы даже слабый выстрел наносил урон)
        const armor = Number(this.armor) || 0;
        let finalDamage = Math.max(1, effective - armor);
        const G = game || this.game;
        if (G && typeof G.getCityDefenseBonus === 'function') {
            const bonus = G.getCityDefenseBonus(this);
            if (bonus > 0) {
                finalDamage = Math.max(1, Math.floor(finalDamage * (1 - bonus)));
            }
        }
        this.hp -= finalDamage;

        // Запоминаем последний урон (для эффекта отрыва башни)
        this.lastHitDmg = finalDamage;
    }
    
    canAttack() {
        // Артиллерия расходует за выстрел artilleryAmmoConsumption снарядов
        if (this.isArtillery) return this.ammo >= SUPPLY_SYSTEM.artilleryAmmoConsumption;
        return this.ammo >= SUPPLY_SYSTEM.ammoConsumption;
    }
    
    useAmmo() {
        const cost = this.isArtillery ? SUPPLY_SYSTEM.artilleryAmmoConsumption
                                      : SUPPLY_SYSTEM.ammoConsumption;
        this.ammo = Math.max(0, this.ammo - cost);
    }
    
    useFuel() {
        // Пехота не расходует топливо (топливо — только у техники на ходу)
        if (this.isInfantry) return;
        this.fuel = Math.max(0, this.fuel - SUPPLY_SYSTEM.fuelConsumption);
    }
    
    canMove() {
        // Пехоте топливо не нужно — она всегда может двигаться
        if (this.isInfantry) return true;
        return this.fuel > 0;
    }
    
    // Пополнение HP/БК/топлива в НАШЕЙ базе.
    // ИСПРАВЛЕНИЕ «бессмертные юниты»: раньше база чинила технику почти
    // мгновенно (0.15 HP/тик + пополнение БК/топлива с множителем x4 каждый
    // тик). Теперь по правилу баланса: ремонт, пополнение БК и топлива идут
    // по 1% от максимума каждые 100 тиков (baseRegenInterval), то есть полный
    // цикл восстановления ~10000 тиков — техника на базе уязвима и не может
    // бесконечно «отсиживаться» от боя.
    regenerateAtBase(gameTime) {
        // throttle: срабатывает раз в baseRegenInterval тиков
        const interval = SUPPLY_SYSTEM.baseRegenInterval || 100;
        if (gameTime !== undefined) {
            if (this._lastBaseRegen === undefined) this._lastBaseRegen = gameTime;
            if (gameTime - this._lastBaseRegen < interval) return;
            this._lastBaseRegen = gameTime;
        }
        const pct = SUPPLY_SYSTEM.baseRegenPercent ?? 0.01; // 1% за интервал
        if (this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * pct);
        }
        if (this.ammo < this.maxAmmo) {
            this.ammo = Math.min(this.maxAmmo, this.ammo + this.maxAmmo * pct);
        }
        if (this.fuel < this.maxFuel) {
            this.fuel = Math.min(this.maxFuel, this.fuel + this.maxFuel * pct);
        }
    }
}

// Вспомогательный throttled-тик пополнения на базе: срабатывает раз в
// baseRegenInterval (100) тиков — «по 1% каждые 100 тиков» вместо мгновенного

function baseRegenTick(unit, gameTime, interval) {
    const iv = interval || SUPPLY_SYSTEM.baseRegenInterval || 100;
    if (gameTime !== undefined) {
        if (unit._lastLogisticsRegen === undefined) unit._lastLogisticsRegen = gameTime;
        if (gameTime - unit._lastLogisticsRegen < iv) return false;
        unit._lastLogisticsRegen = gameTime;
    }
    return true;
}

export { baseRegenTick };
