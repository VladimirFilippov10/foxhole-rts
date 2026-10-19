// ===== ТАНКИ ФРАКЦИИ WARDENS =====
// Тяжёлые и боевые машины Wardens (King Spire, Devitt, Silverhand, Gallagher,
// Niska, Noble Widow). Для добавления новой техники Wardens: создайте класс
// здесь и зарегистрируйте его в createVehicle() в ./index.js.

import { Vehicle } from './vehicle.js';
import { SUPPLY_SYSTEM } from '../constants.js';

// King Spire Mk. I - Разведывательный танк
export class KingSpire extends Vehicle {
    constructor(faction, x, y) {
        super('king_spire', faction, x, y);
        this.hp = this.maxHp = 150; // Нормализовано из 1350
        this.dmg = 18; // 12.7мм пулемет
        this.range = 140;
        this.spd = 1.3; // 7.22 м/с нормализовано
        this.offRoadSpd = 1.0; // 5.05 м/с
        this.cd = 50; // Быстрая скорострельность пулемета
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
        this.hp = this.maxHp = 200; // Нормализовано из 1950
        this.dmg = 45; // 40мм пушка
        this.range = 150;
        this.spd = 1.6; // 8.27 м/с нормализовано
        this.offRoadSpd = 1.1; // 5.79 м/с
        this.cd = 290; // 40мм пушка
        this.size = 22;
        this.armor = 40;
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
        this.maxFuel = Math.round(SUPPLY_SYSTEM.maxFuel * 3);
        this.fuel = this.maxFuel;
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
        this.maxFuel = Math.round(SUPPLY_SYSTEM.maxFuel * 3);
        this.fuel = this.maxFuel;
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
        this.tracked = true; // Гусеничный БТР
    }
}


