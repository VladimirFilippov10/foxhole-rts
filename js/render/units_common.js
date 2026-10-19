// ===== РЕНДЕР: ОБЩАЯ ОТРИСОВКА ЮНИТОВ =====
// Базовый корпус техники, диспетчер по типам и общие индикаторы
// (перезарядка, HP, БК/топливо, подпись при наведении).
// Реестр UNIT_DRAWERS — точка расширения: добавьте свою функцию отрисовки
// нового типа сюда, и она будет вызываться автоматически.
import { isInfUnit } from '../vehicles/index.js';
import { drawInfantry } from './units_infantry.js';
import { drawdevitt, drawking_spire, drawsilverhand, drawgallagher_outlaw, drawgallagher_highwayman, drawniska, drawniska_blinder, drawdevitt_mmr, drawnoble_widow } from './units_warden.js';
import { drawhatchet, drawscorpion, drawnemesis, drawfalchion, drawspatha, drawjavelin, drawhoplite, drawtalos } from './units_colonial.js';
import { drawgod_loader, drawwarden_artillery120, drawwarden_artillery150, drawcolonial_artillery120, drawcolonial_artillery150 } from './units_artillery.js';
import { drawtruck, drawfuel_truck, drawengineer, drawflatbed, drawmedic_truck, drawconstruction_truck, drawfire_truck } from './units_logistics.js';

export const UNIT_DRAWERS = {
    devitt: drawdevitt,
    king_spire: drawking_spire,
    silverhand: drawsilverhand,
    gallagher_outlaw: drawgallagher_outlaw,
    gallagher_highwayman: drawgallagher_highwayman,
    niska: drawniska,
    niska_blinder: drawniska_blinder,
    devitt_mmr: drawdevitt_mmr,
    noble_widow: drawnoble_widow,
    hatchet: drawhatchet,
    scorpion: drawscorpion,
    nemesis: drawnemesis,
    falchion: drawfalchion,
    spatha: drawspatha,
    javelin: drawjavelin,
    hoplite: drawhoplite,
    talos: drawtalos,
    god_loader: drawgod_loader,
    warden_artillery120: drawwarden_artillery120,
    warden_artillery150: drawwarden_artillery150,
    colonial_artillery120: drawcolonial_artillery120,
    colonial_artillery150: drawcolonial_artillery150,
    truck: drawtruck,
    fuel_truck: drawfuel_truck,
    engineer: drawengineer,
    flatbed: drawflatbed,
    medic_truck: drawmedic_truck,
    construction_truck: drawconstruction_truck,
    fire_truck: drawfire_truck,
};

// Отрисовка «тела» юнита. Вызывается из renderer.drawUnit внутри сохранённого
// контекста, повёрнутого к центру и направлению юнита.
export function drawVehicleBody(ctx, u, sz, col) {
    // Пехота — отдельная ветка
    if (isInfUnit(u)) {
        drawInfantry(ctx, u, sz, col);
        return;
    }

    // Vehicle body (centered at 0,0) — базовый прямоугольник для всех машин
    ctx.fillStyle = col.p;
    ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.65);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz / 2, -sz / 3, sz, sz * 0.65);

    drawdevitt(ctx, u, sz, col);
    drawking_spire(ctx, u, sz, col);
    drawsilverhand(ctx, u, sz, col);
    drawgallagher_outlaw(ctx, u, sz, col);
    drawgallagher_highwayman(ctx, u, sz, col);
    drawniska(ctx, u, sz, col);
    drawniska_blinder(ctx, u, sz, col);
    drawdevitt_mmr(ctx, u, sz, col);
    drawnoble_widow(ctx, u, sz, col);
    drawhatchet(ctx, u, sz, col);
    drawscorpion(ctx, u, sz, col);
    drawnemesis(ctx, u, sz, col);
    drawfalchion(ctx, u, sz, col);
    drawspatha(ctx, u, sz, col);
    drawjavelin(ctx, u, sz, col);
    drawhoplite(ctx, u, sz, col);
    drawtalos(ctx, u, sz, col);
    drawgod_loader(ctx, u, sz, col);
    drawwarden_artillery120(ctx, u, sz, col);
    drawwarden_artillery150(ctx, u, sz, col);
    drawcolonial_artillery120(ctx, u, sz, col);
    drawcolonial_artillery150(ctx, u, sz, col);
    drawtruck(ctx, u, sz, col);
    drawfuel_truck(ctx, u, sz, col);
    drawengineer(ctx, u, sz, col);
    drawflatbed(ctx, u, sz, col);
    drawmedic_truck(ctx, u, sz, col);
    drawconstruction_truck(ctx, u, sz, col);
    drawfire_truck(ctx, u, sz, col);
}
