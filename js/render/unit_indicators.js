// ===== РЕНДЕР: ОБЩИЕ ИНДИКАТОРЫ ЮНИТА =====
// Всё, что рисуется поверх/вокруг любой модели юнита одинаково:
// радиус атаки, базовая тень, маркеры артиллерии, полоски перезарядки/HP/БК/топлива,
// рамка выделения и подпись при наведении.
import { COLORS } from '../constants.js';
import { drawVehicleBody } from './units_common.js';

export function drawUnit(ctx, u, cam, selected, hovered, G) {
    const x = u.x - cam.x;
    const y = u.y - cam.y;
    if (x < -40 || x > ctx.canvas.width + 40 || y < -40 || y > ctx.canvas.height + 40) return;

    const col = COLORS[u.faction];
    const sz = u.size;

    // Attack range circle (only when hovered or selected)
    if ((hovered || selected.includes(u.id)) && u.range > 0) {
        ctx.beginPath();
        ctx.arc(x, y, u.range, 0, Math.PI * 2);
        ctx.strokeStyle = col.a + '80';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col.a + '20';
        ctx.fill();
    }

    // Save context for rotation
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u.direction || 0);

    // Shadow (not rotated)
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, sz * 0.5, sz * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotate for unit drawing
    ctx.translate(x, y);
    ctx.rotate(u.direction || 0);

    // Сама модель юнита (пехота/техника) — по типам, см. units_common.js
    drawVehicleBody(ctx, u, sz, col);

    ctx.restore();

    // Draw selection and faction indicators (not rotated)
    if (u.isArtillery && !u.isMortar) {
        // Маркер ствольной артиллерии: ★ у wardens, ▲ у colonials
        if (u.faction === 'wardens') {
            ctx.fillStyle = '#60a5fa';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★', x, y - sz * 0.5);
        } else {
            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.moveTo(x, y - sz * 0.6);
            ctx.lineTo(x - 4, y - sz * 0.45);
            ctx.lineTo(x + 4, y - sz * 0.45);
            ctx.closePath();
            ctx.fill();
        }
    } else if (u.type === 'warden_artillery') {
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', x, y - sz * 0.5);
    } else if (u.type === 'colonial_artillery') {
        ctx.fillStyle = '#4ade80'; // зелёный маркер артиллерии колонистов
        ctx.beginPath();
        ctx.moveTo(x, y - sz * 0.6);
        ctx.lineTo(x - 4, y - sz * 0.45);
        ctx.lineTo(x + 4, y - sz * 0.45);
        ctx.closePath();
        ctx.fill();
    }

    // Reload bar (under unit) - always visible
    if (u.cd > 0) {
        const reloadProgress = Math.min(1, (u.gameTime - u.lastAtk) / u.cd);
        const barWidth = sz * 1.5;
        const barHeight = 6;
        const barY = y + sz / 2 + 10;

        ctx.fillStyle = '#000000';
        ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);

        const reloadColor = reloadProgress >= 1 ? '#22c55e' : '#fbbf24';
        ctx.fillStyle = reloadColor;
        ctx.fillRect(x - barWidth / 2, barY, barWidth * reloadProgress, barHeight);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
    }

    if (selected.includes(u.id)) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, sz / 2 + 6, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (u.hp < u.maxHp) {
        const pct = u.hp / u.maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(x - sz / 2, y - sz / 2 - 8, sz, 3);
        ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(x - sz / 2, y - sz / 2 - 8, sz * pct, 3);
    }

    // Полоски БК и топлива (всегда видны)
    if (u.ammo !== undefined && u.maxAmmo > 0) {
        const barWidth = sz * 1.2;
        const barHeight = 3;
        const barY = y + sz / 2 + 18;

        // БК (оранжевый)
        const ammoPct = u.ammo / u.maxAmmo;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(x - barWidth / 2, barY, barWidth * ammoPct, barHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);

        // Топливо (синий)
        const fuelPct = u.fuel / u.maxFuel;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - barWidth / 2, barY + 5, barWidth, barHeight);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x - barWidth / 2, barY + 5, barWidth * fuelPct, barHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - barWidth / 2, barY + 5, barWidth, barHeight);
    }

    // Подпись техники при наведении (для вражеской техники)
    if (hovered && u.faction !== G.faction) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x - 50, y - sz / 2 - 30, 100, 18);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 50, y - sz / 2 - 30, 100, 18);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.label || u.type, x, y - sz / 2 - 21);
    }
}
