// ===== ПЕХОТА =====
// Все виды пехоты обеих фракций. Базовый класс InfantryBase наследуется от
// Vehicle (см. ./vehicle.js). Чтобы добавить новый вид пехоты: создайте класс
// здесь и зарегистрируйте его в createInfantry() внизу файла + в типах в ./common.js.

import { Vehicle } from './vehicle.js';

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
        this.cd = 120;
        this.label = 'Стрелок';
    }
}

export class InfantryColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('rifleman', faction, x, y);
        this.hp = this.maxHp = 30;
        this.dmg = 6;
        this.range = 120;
        this.spd = 0.55; // Очень медленно
        this.cd = 100;
        this.label = 'Стрелок';
    }
}

export class AssualtVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('assualt_varden', faction, x, y);
        this.hp = this.maxHp = 45;
        this.dmg = 5;
        this.range = 110;
        this.spd = 0.6; // Очень медленно
        this.cd = 50;
        this.label = 'Штурмовик';
    }
}

export class AssualtColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('assualt_varden', faction, x, y);
        this.hp = this.maxHp = 50;
        this.dmg = 6;
        this.range = 90;
        this.spd = 0.7; // Очень медленно
        this.cd = 60;
        this.label = 'Штурмовик';
    }
}

export class smuggler extends InfantryBase { //контрабандист
    constructor(faction, x, y) {
        super('smuggler_varden', faction, x, y);
        this.hp = this.maxHp = 60;
        this.dmg = 20;
        this.range = 140;
        this.spd = 0.7; // Очень медленно
        this.cd = 140;
        this.label = 'Контробандист';
    }
}

export class poacher extends InfantryBase { // браконьер
    constructor(faction, x, y) {
        super('poacher_colonist', faction, x, y);
        this.hp = this.maxHp = 40;
        this.dmg = 35;
        this.range = 190;
        this.spd = 0.7; // Очень медленно
        this.cd = 350;
        this.label = 'Браконьер';
    }
}

export class MedicVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('medic_varden', faction, x, y);
        this.hp = this.maxHp = 30;
        this.dmg = 2;
        this.range = 110;
        this.spd = 0.5; // Очень медленно
        this.cd = 60;
        this.label = 'Медик';
        this.isMedic = true;
        this.healRate = 0.15;       // 0.15 HP за тик (~9 HP в секунду)
        this.healRange = 80;        // Радиус лечения в пикселях
        this.healInterval = 60;     // Лечит раз в секунду (60 тиков)
        this.lastHealTime = 0;
        this.cargoType = 'med';
        this.cargoCapacity = 100;
        this.currentCargo = 100;
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
        this.spd = 0.45; // Очень медленно
        this.cd = 50;
        this.label = 'Медик';
        this.isMedic = true;
        this.healRate = 0.15;       // 0.15 HP за тик (~9 HP в секунду)
        this.healRange = 80;        // Радиус лечения в пикселях
        this.healInterval = 60;     // Лечит раз в секунду (60 тиков)
        this.lastHealTime = 0;
        this.cargoType = 'med';
        this.cargoCapacity = 100;
        this.currentCargo = 100;
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
        this.hp = this.maxHp = 65;      // крепче стрелка — держит оборону
        this.dmg = 10;                   // небольшой урон...
        this.range = 130;                // ...зато короткая дистанция
        this.spd = 0.2;                // почти неподвижен — позиционная роль
        this.cd = 40;                   // очень скорострельный пулемёт
        this.antiInfantry = true;       // эффективен против пехоты
        this.infantryMultiplier = 1.5;  // x2 урона по пехоте
        this.label = 'Пулемётчик';
    }
}

export class SniperVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('sniper', faction, x, y);
        this.hp = this.maxHp = 20;      // хрупкий
        this.dmg = 45;                  // высокий одиночный урон
        this.range = 300;               // стреляет с дальней дистанции
        this.spd = 0.4;                // чуть быстрее обычной пехоты — доходит до позиции
        this.cd = 900;                  // редкие, но точные выстрелы
        this.label = 'Снайпер';
    }
}

export class SniperColonist extends InfantryBase {
    constructor(faction, x, y) {
        super('sniper', faction, x, y);
        this.hp = this.maxHp = 30;      // хрупкий
        this.dmg = 35;                  // высокий одиночный урон
        this.range = 250;               // стреляет с дальней дистанции
        this.spd = 0.5;                // чуть быстрее обычной пехоты — доходит до позиции
        this.cd = 700;                  // редкие, но точные выстрелы
        this.label = 'Снайпер';
    }
}

// Гранатомётчик — наступательная пехота: средний DPS и AoE-урон по
// скоплениям вражеской пехоты (гранаты задевают всех в радиусе).
export class GrenadierVarden extends InfantryBase {
    constructor(faction, x, y) {
        super('grenadier', faction, x, y);
        this.hp = this.maxHp = 60;
        this.dmg = 65;
        this.range = 110;
        this.spd = 0.8;
        this.cd = 250;
        this.grenadeLauncher = true;    // AoE по пехоте вокруг цели (game.js)
        this.grenadeRadius = 15;
        this.label = 'Гранатомётчик';
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
        this.grenadeLauncher = true;    // AoE по пехоте вокруг цели (game.js)
        this.grenadeRadius = 30;
        this.label = 'Гренадер';
    }
}

// ===== WARDENS VEHICLES =====

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
            return new MgGunner(faction, x, y);
        case 'grenadier':
            return isWardens ? new GrenadierVarden(faction, x, y)
                             : new GrenadierColonist(faction, x, y);
        case 'sniper':
            return isWardens ? new SniperVarden(faction, x, y)
                             : new SniperColonist(faction, x, y);

        // ===== НОВАЯ ПЕХОТА =====
        case 'assualt_varden':
        case 'assualt_colonist':
            // тип assualt_varden — общий; класс выбираем по фракции
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

export { createInfantry };
