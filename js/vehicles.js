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
    


    takeDamage(dmg, src = null) {
        // ===== ФИКС ПРИЧИН ПОВРЕЖДЕНИЯ КООРДИНАТ (источник №2) =====
        // Если урон/броня пришли повреждёнными (NaN/undefined), HP юнита
        // превращался в NaN — дальше по цепочке (сепарация расталкивала
        // «мёртвых» с NaN-координатами, ИИ выдавал приказы к ним) x/y тоже
        // становились NaN и юнит «исчезал» (в консоли: [GAME][FIX]
        // Повреждены координаты). Теперь HP не может стать NaN.
        const d = Number(dmg);
        if (!Number.isFinite(d)) return;
        let effective = d;
        // ===== УНИКАЛЬНАЯ МЕХАНИКА «Talos» (armorPierce): бронепробитие =====
        // Talos наносит урон с учётом брони ЦЕЛИ (своей armorPierce), а не
        // вычитанием собственной брони: чем НИЖЕ броня цели — тем БОЛЬШЕ
        // коэффициент урона (прогрессионно). Порог = armorPierce (70):
        //   броня >= 70          → коэффициент 0.5 (урон вдвое слабее)
        //   35 <= броня < 70     → коэффициент 1.0
        //   0 <= броня < 35      → от 1.0 до 3.0 прогрессивно (броня 0 → x3)
        if (src && src.armorPierce) {
            const pa = Number(src.armorPierce);
            const srcArmor = Number(this.armor);
            const tArmor = Math.max(0, Number.isFinite(srcArmor) ? srcArmor : 0);
            const half = pa / 2; // 35 при пороге 70
            let mult;
            if (tArmor >= pa) mult = 0.5;
            else if (tArmor >= half) mult = 1.0;
            else mult = 1 + (half - tArmor) / half; // 1 → 3 прогрессивно
            effective = d * mult;
        }
        const a2 = Number(this.armor);
        this.hp -= Math.max(1, effective - (Number.isFinite(a2) ? a2 : 0));
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
// заполнения каждый тик (фикс «бессмертные юниты» / «мгновенный ремонт»).
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
// Все виды пехоты считаются «пехотой» (isInfantry = true): проходят сквозь
// здания, не попадают в лимит техники и корректно обрабатываются игрой,
// ИИ и рендером. Разные виды — разные характеристики и роли:
//   rifleman     — обычная стрелковая пехота (универсальная, идёт в атаку)
//   mg_gunner    — пулемётчик: дешёвый DPS, короткая дальность — ОСНОВА ОБОРОНЫ
//   sniper       — снайпер: большая дальность и урон, мало HP — высылается к
//                  захваченным противником точкам (1 снайпер на 1 город)
export class InfantryBase extends Vehicle {
    constructor(type, faction, x, y) {
        super(type, faction, x, y);
        this.isInfantry = true;
        this.size = 8;
        this.spd = 0.5;
        // Пехоте топливо не нужно (убрано для баланса/логики): полоска топлива
        // у неё не рисуется, возврат на базу по «пустому баку» не срабатывает.
        this.maxFuel = 0;
        this.fuel = 0;
    }
}

export class InfantryVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('rifleman', faction, x, y);
        this.hp = this.maxHp = 35;
        this.dmg = 8;
        this.range = 130;
        this.spd = 0.5; // Очень медленно
        this.cd = 90;
        this.label = 'Стрелок';
    }
}

export class InfantryColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('rifleman', faction, x, y);
        this.hp = this.maxHp = 30;
        this.dmg = 6;
        this.range = 120;
        this.spd = 0.65; // Очень медленно
        this.cd = 70;
        this.label = 'Стрелок';
    }
}

export class MgGunner extends InfantryBase {
    constructor(faction, x, y) {
        super('mg_gunner', faction, x, y);
        this.hp = this.maxHp = 45;      // крепче стрелка — держит оборону
        this.dmg = 10;                   // небольшой урон...
        this.range = 95;                // ...зато короткая дистанция
        this.spd = 0.2;                // почти неподвижен — позиционная роль
        this.cd = 30;                   // очень скорострельный пулемёт
        this.antiInfantry = true;       // эффективен против пехоты
        this.infantryMultiplier = 2.0;  // x2 урона по пехоте
        this.label = 'Пулемётчик';
    }
}

export class SniperVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('sniper', faction, x, y);
        this.hp = this.maxHp = 20;      // хрупкий
        this.dmg = 45;                  // высокий одиночный урон
        this.range = 260;               // стреляет с дальней дистанции
        this.spd = 0.4;                // чуть быстрее обычной пехоты — доходит до позиции
        this.cd = 950;                  // редкие, но точные выстрелы
        this.label = 'Снайпер';
    }
}

export class SniperColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('sniper', faction, x, y);
        this.hp = this.maxHp = 30;      // хрупкий
        this.dmg = 35;                  // высокий одиночный урон
        this.range = 230;               // стреляет с дальней дистанции
        this.spd = 0.5;                // чуть быстрее обычной пехоты — доходит до позиции
        this.cd = 800;                  // редкие, но точные выстрелы
        this.label = 'Снайпер';
    }
}

// Гранатомётчик — наступательная пехота: средний DPS и AoE-урон по
// скоплениям вражеской пехоты (гранаты задевают всех в радиусе).
export class GrenadierVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('grenadier', faction, x, y);
        this.hp = this.maxHp = 40;
        this.dmg = 60;
        this.range = 45;
        this.spd = 0.5;
        this.cd = 200;
        this.grenadeLauncher = true;    // AoE по пехоте вокруг цели (game.js)
        this.grenadeRadius = 15;
        this.label = 'Гранатомётчик';
    }
}

export class GrenadierColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('grenadier', faction, x, y);
        this.hp = this.maxHp = 40;
        this.dmg = 25;
        this.range = 70;
        this.spd = 0.5;
        this.cd = 250;
        this.grenadeLauncher = true;    // AoE по пехоте вокруг цели (game.js)
        this.grenadeRadius = 25;
        this.label = 'Гренадер';
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

export class NobleWidow extends Vehicle {
    constructor(faction, x, y) {
        super('noble_widow', faction, x, y);
        this.hp = this.maxHp = 420;
        this.dmg = 150; // Тяжёлые пушки
        this.range = 250;
        this.spd = 0.2; // 7.75 м/с нормализовано
        this.offRoadSpd = 0.15; // 5.42 м/с
        this.cd = 700; // Тяжелые пушки
        this.size = 28;
        this.armor = 70;
        this.label = 'Noble Widow';
        this.tracked = true;
        this.crew = 4;
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.8);
        this.ammo = this.maxAmmo;
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
        // БАЛАНС: урон > 40 → БК в два раза меньше (было 100)
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
    }
}

// Devitt MMR — миномётная версия (поддержка/AoE). Отдельный тип 'devitt_mmr',
// чтобы ИИ и рендер отличали её от обычного лёгкого танка Devitt.
export class DevittMMR extends Vehicle {
    constructor(faction, x, y) {
        super('devitt_mmr', faction, x, y);
        this.hp = this.maxHp = 160;
        this.dmg = 25;
        this.range = 240;
        this.minRange = 90; // миномёт: не стреляет в упор
        this.spd = 1.1;
        this.offRoadSpd = 1.0;
        this.cd = 300;
        this.size = 22;
        this.armor = 30;
        this.label = 'Devitt MMR';
        this.tracked = true;
        this.crew = 3;
        this.isMortar = true; // поддержка: обрабатывается как артиллерия
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 30;
        // БК порезан на 30% для баланса (было 100)
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
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
        // БАЛАНС: урон > 40 → БК в два раза меньше (было 100)
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
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

// Gallagher Outlaw Mk. II — тяжёлый крейсер на базе Highwayman:
// усиленное орудие (45 урона), броня 30, дальность 190, буст.
// ФИКС: раньше класс вызывал super('gallagher_highwayman', ...) — из-за этого
// createVehicle('gallagher_outlaw') возвращал обычный Highwayman (тип не
// совпадал ни с VEHICLE_COSTS, ни с моделью рендера).
export class GallagherOutlaw extends Vehicle {
    constructor(faction, x, y) {
        super('gallagher_outlaw', faction, x, y);
        this.hp = this.maxHp = 370;
        this.dmg = 45; // Усиленное спаренное орудие
        this.range = 190;
        this.spd = 1.5;
        this.offRoadSpd = 1.2;
        this.boostSpd = 2.8; // Ускорение с бустом
        this.cd = 150;
        this.size = 26; // Чуть крупнее Highwayman
        this.armor = 30;
        this.label = 'Gallagher Outlaw Mk. II';
        this.tracked = true;
        this.crew = 3;
        this.canBoost = true; // Может использовать буст
        this.boosting = false;
        this.boostFuelCost = 0.5;
    }

    activateBoost() {
        if (this.fuel > 20 && !this.boosting) {
            this.boosting = true;
            this.spd = this.boostSpd;
        }
    }

    deactivateBoost() {
        this.boosting = false;
        this.spd = 1.5; // Возврат к базовой скорости Outlaw
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
        // БАЛАНС: урон > 40 → БК в два раза меньше (было 100)
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
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
        this.dmg = 110; // 68мм пушка + гранатомет
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
        this.hp = this.maxHp = 400;
        this.dmg = 65;
        this.range = 150;
        this.spd = 0.8;
        this.cd = 460;
        this.size = 26;
        this.armor = 35;
        this.label = 'Falchion';
        this.tracked = true; // Гусеничный танк
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
        this.tracked = true; // Гусеничный танк
    }
}

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
        this.tracked = true; // Гусеничный танк
        this.armorPierce = 70; // порог бронепробития (см. takeDamage)
    }
}


// Javelin — БТР колонистов (обычная бронетехника, вкладка «Техника»)
export class Javelin extends Vehicle {
    constructor(faction, x, y) {
        super('javelin', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 7;
        this.range = 140;
        this.spd = 1.65; // Самый быстрый
        this.cd = 65;
        this.size = 20;
        this.armor = 25;
        this.label = 'Javelin APC';
        this.tracked = true; // Гусеничный БТР
    }
}

// Hoplite — миномётная поддержка колонистов (вкладка «Поддержка»).
// Обрабатывается ИИ как артиллерия (AoE-урон), а не как бронетехника.
export class Hoplite extends Vehicle {
    constructor(faction, x, y) {
        super('hoplite', faction, x, y);
        this.hp = this.maxHp = 150;
        this.dmg = 25;
        this.range = 180;
        this.minRange = 80; // миномёт: не стреляет в упор
        this.spd = 1.3;
        this.cd = 150;
        this.size = 20;
        this.armor = 15;
        this.label = 'Hoplite Mortar';
        this.tracked = true; // Гусеничная база
        this.isMortar = true; // поддержка: обрабатывается как артиллерия
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 30; // Большой радиус поражения
        // БК порезан на 30% для баланса (было 100)
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
    }
}

// ===== ARTILLERY (фракционная) =====
// Канонические типы юнитов (совпадают с ключами VEHICLE_COSTS):
//   wardens:   warden_artillery120 / warden_artillery150
//   colonials: colonial_artillery120 / colonial_artillery150
// Обратная совместимость со старыми сохранениями/скриптами:
//   'warden_artillery' / 'warden_artillery_150' → 150 мм Wardens
//   'colonial_artillery' / 'colonial_artillery_150' → 150 мм Colonials
//   'colonial_artillery_120' → 120 мм Colonials
// Все арты помечаются флагами isArtillery/isMortar — так их находит ИИ
// (unitCategory + manageArtillery) и игра (AoE-логика, снабжение flatbed).
export class WardenArtillery120 extends Vehicle {
    constructor(faction, x, y) {
        super('warden_artillery120', faction, x, y);
        this.hp = this.maxHp = 100; // Живучесть выше, чем у 150 мм
        this.dmg = 60;
        this.range = 600; // Дальность 600
        this.minRange = 100; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.6; // Медленная, но подвижнее 150 мм
        this.cd = 400; // ~6.7 секунд при 60 FPS
        this.size = 24;
        this.armor = 25;
        this.label = 'Warden Artillery 120mm';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 65; // Радиус поражения
        this.tracked = true; // Гусеничная артиллерия
        this.isArtillery = true; // ствольная артиллерия (ведение огня через manageArtillery)
        this.isMortar = true;  // категоризация ИИ: «артиллерия», а не бронетехника
        // БАЛАНС: БК у 120 мм в два раза меньше, чем у 150 мм
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.5);
        this.ammo = this.maxAmmo;
    }
}

export class WardenArtillery150mm extends Vehicle {
    constructor(faction, x, y) {
        super('warden_artillery150', faction, x, y);
        this.hp = this.maxHp = 80; // Хуже живучесть
        this.dmg = 95; // Больше урона
        this.range = 550; // Дальность 550
        this.minRange = 180; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.3; // Очень медленная
        this.cd = 550; // ~9 секунд при 60 FPS
        this.size = 24;
        this.armor = 30;
        this.label = 'Warden Artillery 150mm';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 100; // Большой радиус поражения
        this.tracked = true; // Гусеничная артиллерия
        this.isArtillery = true;
        this.isMortar = true;
    }
}

export class ColonialArtillery150mm extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_artillery150', faction, x, y);
        this.hp = this.maxHp = 90; // Чуть лучше живучесть
        this.dmg = 85; // Немного меньше урона
        this.range = 550; // Дальность 550
        this.minRange = 150; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.5; // Быстрее варденской
        this.cd = 450; // ~7.5 секунд при 60 FPS
        this.size = 22;
        this.armor = 15; // Немного брони
        this.label = 'Colonial Artillery 150mm';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 80; // Средний радиус поражения
        this.tracked = true; // Гусеничная артиллерия
        this.isArtillery = true;
        this.isMortar = true;
    }
}

export class ColonialArtillery120mm extends Vehicle {
    constructor(faction, x, y) {
        super('colonial_artillery120', faction, x, y);
        this.hp = this.maxHp = 60; // Хрупкая
        this.dmg = 55; // Немного меньше урона
        this.range = 400; // Дальность 400
        this.minRange = 60; // Минимальная дальность - не может стрелять в упор
        this.spd = 0.7; // Быстрая
        this.cd = 400; // ~6.7 секунд при 60 FPS
        this.size = 22;
        this.armor = 15; // Немного брони
        this.label = 'Colonial Artillery 120mm';
        this.aoe = true; // Area of Effect attack
        this.aoeRadius = 45; // Средний радиус поражения
        this.tracked = true; // Гусеничная артиллерия
        this.isArtillery = true;
        this.isMortar = true;
        // БК порезан на 30% для баланса (было 100)
        this.maxAmmo = Math.round(SUPPLY_SYSTEM.maxAmmo * 0.7);
        this.ammo = this.maxAmmo;
    }
}

// Алиасы старых типов (сохранения/тесты): 'warden_artillery' → 150 мм,
// 'colonial_artillery' → 150 мм. Модель остаётся старой для 150 мм.
const WardenArtillery = WardenArtillery150mm;
const ColonialArtillery = ColonialArtillery150mm;

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
                60 // Скорость пополнения (за тик) — бак наполняется полностью
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
        // ===== ФИКС NaN-КООРДИНАТ: защита от «битого» ремонта =====
        // Раньше сюда мог попасть targetUnit с повреждёнными данными (hp = NaN
        // из-за битого урона) или вызов без цели. Арифметика min(NaN, ...) = NaN
        // портила hp/груз инженера, дальше ИИ/сепарация считали dist() от битых
        // значений и юниты получали tx/ty = NaN — в консоли мелькали строки
        // «[GAME][FIX] Повреждены координаты у devitt/vabjo36kt1». Теперь все
        // входящие значения валидируются, а результат ремонта никогда не может
        // стать NaN. (Поле lastResupplyTick здесь НЕ записывается — оно нигде
        // не инициализировано и раньше рождало NaN-арифметику в логистике.)
        if (!targetUnit || typeof targetUnit !== 'object') return 0;
        const cargo = Number(this.currentCargo);
        if (!Number.isFinite(cargo) || cargo <= 0) return 0;
        const hp = Number(targetUnit.hp);
        const maxHp = Number(targetUnit.maxHp);
        if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
        if (hp >= maxHp - 0.5) return 0;

        const amount = Math.min(
            Number(SUPPLY_SYSTEM.engineerRepairRate) || 0,
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

// Фабрика пехоты: выбирает класс по виду пехоты И фракции.
//   wardens   — «...Varden»   (Стрелок / Пулемётчик / Снайпер / Гранатомётчик)
//   colonials — «...Colonist» (Стрелок / Пулемётчик / Снайпер / Гренадер)
// Пулемётчик один на обе фракции (MgGunner).
function createInfantry(type, faction, x, y) {
    const isWardens = faction === 'wardens';
    switch (type) {
        case 'rifleman':
        case 'infantry':
            return isWardens ? new InfantryVarden(faction, x, y)
                             : new InfantryColonist(faction, x, y);
        case 'mg_gunner':
            return new MgGunner(faction, x, y);          // общий для обеих фракций
        case 'grenadier':
            return isWardens ? new GrenadierVarden(faction, x, y)
                             : new GrenadierColonist(faction, x, y);
        case 'sniper':
            return isWardens ? new SniperVarden(faction, x, y)
                             : new SniperColonist(faction, x, y);
        default:
            return null;
    }
}

export function createVehicle(type, faction, x, y) {
    // Пехота создаётся с учётом фракции (у каждой свои виды в названии класса)
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
    };
    const creator = map[type];
    if (!creator) return new Vehicle(type, faction, x, y);
    return new creator(faction, x, y);
}

// Доступная техника по фракциям
export const FACTION_VEHICLES = {
    wardens: ['king_spire', 'devitt', 'devitt_mmr', 'silverhand', 'noble_widow', 'gallagher_highwayman', 'niska', 'warden_artillery150', 'warden_artillery120', 'truck', 'fuel_truck', 'engineer', 'flatbed', 'gallagher_outlaw'],
    colonials: ['hatchet', 'scorpion', 'nemesis', 'falchion', 'talos', 'javelin', 'hoplite', 'colonial_artillery150', 'colonial_artillery120', 'truck', 'fuel_truck', 'engineer', 'flatbed', 'spatha'],
};

// ===== Помощники по видам пехоты =====
export const INFANTRY_TYPES = ['rifleman', 'mg_gunner', 'grenadier', 'sniper'];

// Пехота, доступная для производства каждой фракции.
// Снайпер — общий тип ('sniper'), класс выбирается по фракции:
//   wardens → SniperVarden, colonials → SniperColonist.
// Гранатомётчик/Гренадер — один тип 'grenadier' с разными классами и статами:
//   wardens → GrenadierVarden (короткий мощный залп),
//   colonials → GrenadierColonist (дальше бросает, радиус взрыва больше).
// Пулемётчик (mg_gunner) — единый класс MgGunner для обеих фракций.
export const FACTION_INFANTRY = {
    wardens:   ['rifleman', 'mg_gunner', 'grenadier', 'sniper'],
    colonials: ['rifleman', 'mg_gunner', 'grenadier', 'sniper'],
};

// Юнит — пехота? (новый флаг isInfantry + обратная совместимость со старым
// типом 'infantry' из сохранений/скриптов)
export function isInfUnit(u) {
    if (!u) return false;
    return u.isInfantry === true || u.type === 'infantry' || INFANTRY_TYPES.includes(u.type);
}

// Логистика (не считается боевой техникой ни у игрока, ни у ИИ)
export const LOGISTICS_TYPES = ['truck', 'fuel_truck', 'engineer', 'flatbed'];
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
export const TECHNIC_VEHICLE_TYPES = [
    'king_spire', 'devitt', 'silverhand', 'gallagher_highwayman', 'niska', 'gallagher_outlaw',
    'hatchet', 'scorpion', 'nemesis', 'falchion', 'javelin', 'spatha'
];

export function isTechVehicle(u) {
    if (!u) return false;
    // Пехота/логистика/арта техникой не считаются
    if (isInfUnit(u)) return false;
    return TECHNIC_VEHICLE_TYPES.includes(u.type);
}
