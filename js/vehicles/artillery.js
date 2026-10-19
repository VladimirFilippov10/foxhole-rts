// ===== АРТИЛЛЕРИЯ =====
// Ствольная артиллерия обеих фракций (120/150 мм). Алиасы старых типов
// ('warden_artillery'/'colonial_artillery' → 150 мм) сохранены.

import { Vehicle } from './vehicle.js';
import { SUPPLY_SYSTEM } from '../constants.js';

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
