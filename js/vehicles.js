// ===== VEHICLE CLASS HIERARCHY =====
// Wardens: Gallagher, Devitt, Niska
// Colonials: Falchion, Hatchet, Hoplite

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
        
        this.hp = 100;
        this.maxHp = 100;
        this.dmg = 10;
        this.range = 100;
        this.spd = 1.0; // Замедлено
        this.cd = 60;
        this.size = 20;
        this.label = 'Vehicle';
        this.armor = 0;
    }
    
    takeDamage(dmg) {
        this.hp -= Math.max(1, dmg - this.armor);
    }
}

export class Infantry extends Vehicle {
    constructor(faction, x, y) {
        super('infantry', faction, x, y);
        this.hp = this.maxHp = 50;
        this.dmg = 8;
        this.range = 120;
        this.spd = 0.8; // Очень медленно
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
        this.dmg = 35;
        this.range = 160;
        this.spd = 1.2; // Медленный
        this.cd = 70;
        this.size = 22;
        this.armor = 5;
        this.label = 'Devitt';
    }
}

export class Gallagher extends Vehicle {
    constructor(faction, x, y) {
        super('gallagher', faction, x, y);
        this.hp = this.maxHp = 520;
        this.dmg = 65;
        this.range = 180;
        this.spd = 0.9; // Очень медленный
        this.cd = 80;
        this.size = 28;
        this.armor = 12;
        this.label = 'Gallagher 30mm';
    }
}

export class Niska extends Vehicle {
    constructor(faction, x, y) {
        super('niska', faction, x, y);
        this.hp = this.maxHp = 240;
        this.dmg = 20;
        this.range = 150;
        this.spd = 1.4;
        this.cd = 60;
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
        this.dmg = 30;
        this.range = 150;
        this.spd = 1.5; // Быстрее Wardens
        this.cd = 65;
        this.size = 20;
        this.armor = 3;
        this.label = 'Hatchet';
    }
}

export class Falchion extends Vehicle {
    constructor(faction, x, y) {
        super('falchion', faction, x, y);
        this.hp = this.maxHp = 480;
        this.dmg = 70;
        this.range = 170;
        this.spd = 1.0;
        this.cd = 75;
        this.size = 26;
        this.armor = 10;
        this.label = 'Falchion';
    }
}

export class Hoplite extends Vehicle {
    constructor(faction, x, y) {
        super('hoplite', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 18;
        this.range = 140;
        this.spd = 1.6; // Самый быстрый
        this.cd = 55;
        this.size = 20;
        this.armor = 3;
        this.label = 'Hoplite APC';
    }
}

// ===== ARTILLERY (общая) =====
export class Artillery extends Vehicle {
    constructor(faction, x, y) {
        super('artillery', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 70;
        this.range = 350;
        this.spd = 0.5; // Очень медленная
        this.cd = 120;
        this.size = 22;
        this.armor = 1;
        this.label = 'Артиллерия';
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
        artillery: Artillery,
    };
    return new (map[type] || Vehicle)(faction, x, y);
}

// Доступная техника по фракциям
export const FACTION_VEHICLES = {
    wardens: ['devitt', 'gallagher', 'niska', 'artillery'],
    colonials: ['hatchet', 'falchion', 'hoplite', 'artillery'],
};
