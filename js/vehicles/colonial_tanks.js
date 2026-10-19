// ===== ТАНКИ ФРАКЦИИ COLONIALS =====
// Боевые машины колонистов (Hatchet, Scorpion, Nemesis, Falchion, Spatha,
// Talos, Javelin, Hoplite). Для добавления новой техники Colonials: создайте
// класс здесь и зарегистрируйте его в createVehicle() в ./index.js.

import { Vehicle } from './vehicle.js';
import { SUPPLY_SYSTEM } from '../constants.js';

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

