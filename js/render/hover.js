// ===== РЕНДЕР: HOVER / ПОДСВЕТКИ ПРИ НАВЕДЕНИИ =====
// Поиск объекта под курсором и отрисовка радиусов обороны укреплений/городов.
import { dist } from '../constants.js';

export function getHoveredBuilding(G, cam) {
    const mx = G.mousePos.x + cam.x;
    const my = G.mousePos.y + cam.y;
    for (const b of G.buildings) {
        if (b.type && b.type.startsWith('bunker_')) {
            const sz = b.type === 'bunker_light' ? 30 : b.type === 'bunker_medium' ? 38 : 46;
            if (Math.abs(b.x - mx) <= sz / 2 + 4 && Math.abs(b.y - my) <= sz / 2 + 4) return b;
        }
    }
    return null;
}

export function getHoveredCapturePoint(G, cam) {
    const mx = G.mousePos.x + cam.x;
    const my = G.mousePos.y + cam.y;
    for (const cp of G.cps) {
        if (cp.owner !== 'neutral' && dist(cp.x, cp.y, mx, my) <= 30) return cp;
    }
    return null;
}

export function drawDefenseRangeCircle(ctx, x, y, radius, color, label) {
    if (radius <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color.replace('ALPHA', '0.08');
    ctx.fill();
    ctx.strokeStyle = color.replace('ALPHA', '0.7');
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - radius - 6);
    }
}

export function drawDefenseHoverHighlight(ctx, G, cam) {
    const hb = getHoveredBuilding(G, cam);
    if (hb) {
        const x = hb.x - cam.x;
        const y = hb.y - cam.y;
        const col = COLORS[hb.faction] || COLORS.neutral;
        // Радиус обстрела бункера
        drawDefenseRangeCircle(ctx, x, y, hb.range || 0, 'rgba(251,191,36,ALPHA)', `Бункер: радиус ${hb.range || 0}`);
        // Прочность
        ctx.fillStyle = col.p;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${Math.max(0, Math.floor(hb.hp))}/${hb.maxHp}`, x, y + 40);
    }

    const hcp = getHoveredCapturePoint(G, cam);
    if (hcp) {
        const x = hcp.x - cam.x;
        const y = hcp.y - cam.y;
        // Территория города
        drawDefenseRangeCircle(ctx, x, y, hcp.radius, 'rgba(96,165,250,ALPHA)', null);
        // Радиус обороны территории
        const stats = (typeof G.getTerritoryDefenseStats === 'function')
            ? G.getTerritoryDefenseStats(hcp.defenseLevel || 0)
            : { range: [0, 120, 150, 180][hcp.defenseLevel || 0] || 0 };
        if (stats.range > 0) {
            drawDefenseRangeCircle(ctx, x, y, stats.range, 'rgba(251,191,36,ALPHA)', `Оборона ур.${hcp.defenseLevel || 0}: радиус ${stats.range}`);
        }
        // Очки прочности обороны
        if (typeof G.getCityDefenseDisplayInfo === 'function') {
            const dinfo = G.getCityDefenseDisplayInfo(hcp);
            if (dinfo) {
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                if (dinfo.broken) {
                    ctx.fillStyle = '#ef4444';
                    ctx.fillText(`Прочность: 0 — оборона сломлена!`, x, y + hcp.radius + 16);
                } else {
                    ctx.fillStyle = '#22c55e';
                    ctx.fillText(`Прочность обороны: ${dinfo.integrity}`, x, y + hcp.radius + 16);
                }
            }
        }
    }
}

export function getHoveredUnit(G, cam) {
    const mx = G.mousePos.x + cam.x;
    const my = G.mousePos.y + cam.y;
    
    for (const u of G.units) {
        const dx = u.x - mx;
        const dy = u.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < u.size) {
            return u;
        }
    }
    return null;
}
