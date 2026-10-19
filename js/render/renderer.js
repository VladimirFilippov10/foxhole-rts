// ===== RENDERER (ГЛАВНЫЙ ФАЙЛ РЕНДЕРА) =====
// Каркас кадра: порядок слоёв и вызовы модулей.
// Структура папки js/render/:
//   map_terrain.js     — ландшафт (трава, озёра, дороги, мосты, зоны городов, камни, кусты, деревья)
//   map_structures.js  — сооружения (точки захвата, укрепления, шахты, здания)
//   city_houses.js     — городские дома (горят/разрушаются)
//   units_common.js    — базовый корпус техники + диспетчер отрисовки по типам (UNIT_DRAWERS)
//   units_infantry.js  — пехота
//   units_warden.js    — танки Wardens
//   units_colonial.js  — танки Colonials
//   units_artillery.js — артиллерия обеих фракций
//   units_logistics.js — логистика / тех. машины
//   unit_indicators.js — общие индикаторы юнита (HP, перезарядка, БК/топливо, выделение)
//   effects.js         — трупы, обломки, частицы, трассеры, AoE-маркеры, разведка
//   hover.js           — поиск объекта под курсором, подсветка радиусов обороны
//   minimap.js         — миникарта
import { ROADS, CITY_ZONES, TREES, BUSHES, ROCKS, GRASS_PATCHES, LAKES } from '../map.js';

import { drawGrassPatches, drawLakes, drawRoads, drawCityZones, drawRocks, drawBushes, drawTrees } from './map_terrain.js';
import { drawCapturePoint, drawMine, drawBuilding } from './map_structures.js';
import { drawCityHouses } from './city_houses.js';
import { drawUnit } from './unit_indicators.js';
import { drawCorpse, drawAoETarget, drawDebris, drawParticles, drawTracers, drawRevealedAreas, drawMoveModeIndicator } from './effects.js';
import { getHoveredUnit, drawDefenseHoverHighlight } from './hover.js';
import { drawMinimap } from './minimap.js';

export function render(ctx, G, canvas) {
    const cam = G.cam;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background - green terrain with variation
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#5a7a4a');
    gradient.addColorStop(0.5, '#4a6a3a');
    gradient.addColorStop(1, '#5a7a4a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ландшафт
    drawGrassPatches(ctx, cam, canvas);
    drawLakes(ctx, LAKES, cam, canvas);
    drawRoads(ctx, ROADS, cam);
    drawCityZones(ctx, CITY_ZONES, cam);
    drawRocks(ctx, ROCKS, cam, canvas);
    drawBushes(ctx, BUSHES, cam, canvas);
    drawTrees(ctx, TREES, cam, canvas);

    // Сооружения
    G.cps.forEach(cp => drawCapturePoint(ctx, cp, cam));
    G.mines.forEach(mine => drawMine(ctx, mine, cam));
    G.buildings.forEach(b => drawBuilding(ctx, b, cam));

    // ===== ДОМА ГОРОДОВ (горят, разрушаются) =====
    G.cps.forEach(cp => {
        if (cp.houses) drawCityHouses(ctx, cp, cam, G);
    });

    // Трупы
    if (G.corpses) G.corpses.forEach(c => drawCorpse(ctx, c, cam, G));

    // Юниты
    const hoveredUnit = getHoveredUnit(G, cam);
    G.units.forEach(u => {
        drawUnit(ctx, u, cam, G.selected, hoveredUnit === u, G);

        // Draw AoE target if set
        if (u.aoe && u.aoeTarget) {
            drawAoETarget(ctx, u, cam);
        }
    });

    // Эффекты
    drawDebris(ctx, G, cam);
    drawParticles(ctx, G, cam);
    drawTracers(ctx, G, cam);
    drawRevealedAreas(ctx, G, cam);
    drawMoveModeIndicator(ctx, G);

    // Minimap
    drawMinimap(ctx, G, canvas);

    // Подсветка радиусов обороны при наведении на укрепление/город
    drawDefenseHoverHighlight(ctx, G, cam);
}
