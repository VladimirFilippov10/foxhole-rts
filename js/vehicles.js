// ===== VEHICLE CLASS HIERARCHY =====

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
        this.spd = 1.5;
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
        this.spd = 1.5;
        this.cd = 50;
        this.size = 8;
        this.label = 'Пехота';
    }
}

export class LightTank extends Vehicle {
    constructor(faction, x, y) {
        super('light_tank', faction, x, y);
        this.hp = this.maxHp = 200;
        this.dmg = 25;
        this.range = 150;
        this.spd = 2.2;
        this.cd = 60;
        this.size = 20;
        this.armor = 2;
    }
}

export class Hatchet extends LightTank {
    constructor(faction, x, y) {
        super(faction, x, y);
        this.type = 'hatchet';
        this.label = 'Hatchet';
        this.hp = this.maxHp = 220;
        this.dmg = 28;
        this.spd = 2.3;
        this.armor = 3;
    }
}

export class Devitt extends LightTank {
    constructor(faction, x, y) {
        super(faction, x, y);
        this.type = 'devitt';
        this.label = 'Devitt';
        this.hp = this.maxHp = 190;
        this.dmg = 22;
        this.spd = 2.5;
        this.armor = 2;
    }
}

export class AssaultTank extends Vehicle {
    constructor(faction, x, y) {
        super('assault_tank', faction, x, y);
        this.hp = this.maxHp = 400;
        this.dmg = 45;
        this.range = 160;
        this.spd = 1.2;
        this.cd = 70;
        this.size = 26;
        this.armor = 8;
    }
}

export class Gallagher extends AssaultTank {
    constructor(faction, x, y) {
        super(faction, x, y);
        this.type = 'gallagher';
        this.label = 'Gallagher 30mm';
        this.hp = this.maxHp = 420;
        this.dmg = 50;
        this.range = 170;
        this.spd = 1.1;
        this.armor = 10;
    }
}

export class Falchion extends AssaultTank {
    constructor(faction, x, y) {
        super(faction, x, y);
        this.type = 'falchion';
        this.label = 'Falchion';
        this.hp = this.maxHp = 380;
        this.dmg = 55;
        this.range = 155;
        this.spd = 1.3;
        this.armor = 9;
    }
}

export class APC extends Vehicle {
    constructor(faction, x, y) {
        super('apc', faction, x, y);
        this.hp = this.maxHp = 180;
        this.dmg = 15;
        this.range = 140;
        this.spd = 2.0;
        this.cd = 55;
        this.size = 20;
        this.armor = 3;
    }
}

export class Niska extends APC {
    constructor(faction, x, y) {
        super(faction, x, y);
        this.type = 'niska';
        this.label = 'Niska APC';
        this.hp = this.maxHp = 200;
        this.dmg = 18;
        this.spd = 2.1;
        this.armor = 4;
    }
}

export class Halftrack extends APC {
    constructor(faction, x, y) {
        super(faction, x, y);
        this.type = 'halftrack';
        this.label = 'Halftrack';
        this.hp = this.maxHp = 170;
        this.dmg = 14;
        this.spd = 2.2;
        this.armor = 3;
    }
}

export class Artillery extends Vehicle {
    constructor(faction, x, y) {
        super('artillery', faction, x, y);
        this.hp = this.maxHp = 120;
        this.dmg = 70;
        this.range = 350;
        this.spd = 0.7;
        this.cd = 120;
        this.size = 22;
        this.armor = 1;
        this.label = 'Артиллерия';
    }
}

export function createVehicle(type, faction, x, y) {
    const map = {
        infantry: Infantry,
        hatchet: Hatchet,
        devitt: Devitt,
        gallagher: Gallagher,
        falchion: Falchion,
        niska: Niska,
        halftrack: Halftrack,
        artillery: Artillery,
    };
    return new (map[type] || Vehicle)(faction, x, y);
}
