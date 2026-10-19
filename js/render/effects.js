// ===== РЕНДЕР: ЭФФЕКТЫ И ОВЕРЛЕИ =====
// Маркер AoE-цели, трупы, обломки техники, частицы, трассеры, засвеченные
// области разведки, индикатор режима перемещения. Анимация трупов строится на
// реальном времени (performance.now()), т.к. труп — чисто визуальный объект и
// не влияет на геймплей.
import { COLORS } from '../constants.js';

export function drawCorpse(ctx, c, cam, G) {
    const x = c.x - cam.x;
    const y = c.y - cam.y;
    if (x < -60 || x > ctx.canvas.width + 60 ||
        y < -60 || y > ctx.canvas.height + 60) return;

    // Прогресс жизни трупа (0 — только что умер, 1 — исчез)
    // и «возраст» в секундах для анимации.
    const now = performance.now() / 1000;
    const birthReal = c._bornReal !== undefined ? c._bornReal : now;
    if (c._bornReal === undefined) c._bornReal = now;
    const ageSec = now - birthReal;
    const totalSec = (c.lifetime || 36000) / 60;   // lifetime в тиках → в секундах
    const lifeT = Math.min(1, ageSec / totalSec);  // 0..1 — насколько труп «старый»

    // Базовая прозрачность: 0.8 в начале, плавно к 0.3 к концу жизни
    const baseAlpha = 0.8 - lifeT * 0.5;

    const sz = c.size;
    const col = (COLORS && COLORS[c.faction]) || COLORS.neutral;

    ctx.save();

    if (c.isInfantry) {
        // ============================================================
        // ПЕХОТА
        // ============================================================
        // 1) Пятно крови — «растекается» в первые 0.5 сек.
        const spreadT = Math.min(1, ageSec / 0.5);
        const blotR = (c._blotR || 14) * (0.3 + 0.7 * spreadT);
        ctx.globalAlpha = baseAlpha * 0.55;
        // внешний тёмно-красный ореол
        ctx.fillStyle = 'rgba(80, 15, 15, 0.85)';
        ctx.beginPath();
        ctx.ellipse(x, y + sz * 0.15, blotR, blotR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // внутреннее «свежее» пятно
        ctx.globalAlpha = baseAlpha * 0.7;
        ctx.fillStyle = 'rgba(140, 30, 30, 0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y + sz * 0.15, blotR * 0.7, blotR * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2) Силуэт лежащего — тонкие линии «руки-ноги», медленно бледнеет.
        ctx.globalAlpha = baseAlpha;
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        // туловище (по диагонали)
        ctx.moveTo(x - sz * 0.45, y - sz * 0.1);
        ctx.lineTo(x + sz * 0.35, y + sz * 0.15);
        // «рука» 1
        ctx.moveTo(x - sz * 0.25, y - sz * 0.35);
        ctx.lineTo(x + sz * 0.05, y + sz * 0.25);
        // «рука» 2
        ctx.moveTo(x - sz * 0.05, y - sz * 0.3);
        ctx.lineTo(x - sz * 0.35, y + sz * 0.2);
        // «нога»
        ctx.moveTo(x + sz * 0.1, y + sz * 0.2);
        ctx.lineTo(x + sz * 0.35, y - sz * 0.05);
        ctx.stroke();

        // 3) Голова (тёмный кружок в «вершине» фигуры)
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(x - sz * 0.45, y - sz * 0.1, sz * 0.18, 0, Math.PI * 2);
        ctx.fill();

        // 4) Маленький «крестик» над трупом — только первые 30% жизни
        if (lifeT < 0.3) {
            ctx.globalAlpha = baseAlpha * (1 - lifeT / 0.3);
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x + sz * 0.6, y - sz * 0.55);
            ctx.lineTo(x + sz * 0.6, y - sz * 0.2);
            ctx.moveTo(x + sz * 0.45, y - sz * 0.375);
            ctx.lineTo(x + sz * 0.75, y - sz * 0.375);
            ctx.stroke();
        }
    } else {
        // ============================================================
        // ТЕХНИКА
        // ============================================================
        // 1) Тёмное пятно «гари» под корпусом (растекается в первую секунду).
        const spreadT = Math.min(1, ageSec / 1.0);
        const blotR = (c._blotR || 26) * (0.4 + 0.6 * spreadT);
        ctx.globalAlpha = baseAlpha * 0.5;
        ctx.fillStyle = 'rgba(15, 10, 5, 0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y + sz * 0.25, blotR, blotR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2) Сгоревший корпус (тёмный, чуть повёрнут к direction).
        ctx.globalAlpha = baseAlpha;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(c.direction || 0);
        // тень-подложка
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-sz * 0.55, -sz * 0.4, sz * 1.1, sz * 0.8);
        // корпус
        ctx.fillStyle = '#231f1a';
        ctx.fillRect(-sz * 0.5, -sz * 0.3, sz, sz * 0.6);
        ctx.strokeStyle = '#0a0805';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-sz * 0.5, -sz * 0.3, sz, sz * 0.6);
        // «обгоревшая» башня / рубка
        ctx.fillStyle = '#15110c';
        ctx.beginPath();
        ctx.arc(-sz * 0.05, -sz * 0.05, sz * 0.22, 0, Math.PI * 2);
        ctx.fill();
        // трещины — рваные линии
        ctx.strokeStyle = '#0a0503';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.4, -sz * 0.1);
        ctx.lineTo(-sz * 0.15, sz * 0.15);
        ctx.moveTo(sz * 0.15, -sz * 0.25);
        ctx.lineTo(sz * 0.35, sz * 0.15);
        ctx.moveTo(-sz * 0.25, sz * 0.2);
        ctx.lineTo(sz * 0.2, sz * 0.25);
        ctx.stroke();
        ctx.restore();

        // 3) ДЫМ — 3 «клуба», каждый дрейфует/пульсирует со своим ритмом.
        // Клубы поднимаются ВВЕРХ и медленно рассеиваются.
        const smokeCount = 3;
        for (let i = 0; i < smokeCount; i++) {
            const seed = (c._seed || 0) + i * 1.7;
            // «высота» клуба: со временем поднимается всё выше и выше
            const rise = (ageSec * (0.5 + i * 0.15)) % 4;   // 0..4 (модуль — цикл)
            const drift = Math.sin(now * 0.7 + seed) * sz * 0.15;
            const puffR = sz * (0.18 + i * 0.04) * (1 + 0.3 * Math.sin(now * 2 + seed));
            const puffX = x - sz * 0.15 + i * sz * 0.12 + drift;
            const puffY = y - sz * 0.3 - rise * sz * 0.4;
            const puffAlpha = baseAlpha * (0.45 - i * 0.1) * (1 - rise / 5);
            if (puffAlpha <= 0) continue;
            ctx.globalAlpha = puffAlpha;
            // тёмно-серый дым с лёгким коричневым оттенком гари
            const g = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffR);
            g.addColorStop(0, 'rgba(60, 55, 50, 0.9)');
            g.addColorStop(1, 'rgba(60, 55, 50, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4) ОГОНЬ — мерцает 5 сек после смерти, потом исчезает.
        const fireAlive = c._fireUntil && c._fireUntil > 0;
        // c._fireUntil — тик игры (game.time), а не real-time, поэтому
        // переводим: считаем, что fire живёт первые 5 сек реального времени.
        if (ageSec < 5) {
            const fade = Math.max(0, 1 - ageSec / 5);   // 1 → 0 за 5 сек
            const flicker = 0.6 + 0.4 * Math.abs(Math.sin(now * 9 + (c._seed || 0)));
            const fireR = sz * 0.28 * flicker;
            // 3 языка пламени с мерцанием
            const positions = [
                { dx: -sz * 0.15, dy: -sz * 0.15 },
                { dx: sz * 0.1,   dy: -sz * 0.2 },
                { dx: 0,          dy: -sz * 0.05 },
            ];
            for (let i = 0; i < positions.length; i++) {
                const p = positions[i];
                const phase = now * (6 + i) + (c._seed || 0) + i;
                const scale = 0.7 + 0.3 * Math.abs(Math.sin(phase));
                const fx = x + p.dx;
                const fy = y + p.dy;
                const fr = fireR * scale;
                // внутренний жёлтый
                ctx.globalAlpha = fade * 0.9;
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.moveTo(fx, fy - fr);
                ctx.quadraticCurveTo(fx + fr * 0.6, fy - fr * 0.2, fx, fy + fr * 0.3);
                ctx.quadraticCurveTo(fx - fr * 0.6, fy - fr * 0.2, fx, fy - fr);
                ctx.fill();
                // внешний оранжевый
                ctx.globalAlpha = fade * 0.7;
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.moveTo(fx, fy - fr * 1.3);
                ctx.quadraticCurveTo(fx + fr * 0.9, fy - fr * 0.1, fx, fy + fr * 0.5);
                ctx.quadraticCurveTo(fx - fr * 0.9, fy - fr * 0.1, fx, fy - fr * 1.3);
                ctx.fill();
            }
            // «свечение» вокруг огня
            const grd = ctx.createRadialGradient(x, y - sz * 0.1, 0, x, y - sz * 0.1, sz * 0.6);
            grd.addColorStop(0, `rgba(255, 180, 80, ${0.25 * fade})`);
            grd.addColorStop(1, 'rgba(255, 180, 80, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(x, y - sz * 0.1, sz * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 5) Мелкие обломки-искры (для антуража) — 1-2 точки, мерцают.
        if (ageSec < 8) {
            const fade = Math.max(0, 1 - ageSec / 8);
            for (let i = 0; i < 2; i++) {
                const seed = (c._seed || 0) + i * 3.1;
                const px = x + Math.sin(now * 1.3 + seed) * sz * 0.4;
                const py = y + Math.cos(now * 1.7 + seed) * sz * 0.3;
                ctx.globalAlpha = fade * (0.5 + 0.5 * Math.abs(Math.sin(now * 5 + seed)));
                ctx.fillStyle = i === 0 ? '#fbbf24' : '#fb923c';
                ctx.beginPath();
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    ctx.restore();
}

// Маркер цели артиллерии (круг, прицел, линия от ствола, счётчик выстрелов).
// Вызывается из render() для каждого юнита после отрисовки его модели.
export function drawAoETarget(ctx, u, cam) {
                if (u.aoe && u.aoeTarget) {
            const tx = u.aoeTarget.x - cam.x;
            const ty = u.aoeTarget.y - cam.y;
            
            // Draw target circle with spread indicator
            ctx.beginPath();
            ctx.arc(tx, ty, u.aoeRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.fill();
            
            // Draw crosshair
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - 20, ty);
            ctx.lineTo(tx + 20, ty);
            ctx.moveTo(tx, ty - 20);
            ctx.lineTo(tx, ty + 20);
            ctx.stroke();
            
            // Draw spread indicator (random spread area)
            const spread = 30;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(tx, ty, spread, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw shots fired counter
            if (u.shotsFired !== undefined) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${u.shotsFired}/5`, tx, ty - 25);
            }
            
            // Draw line from artillery to target
            const ux = u.x - cam.x;
            const uy = u.y - cam.y;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(ux, uy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.setLineDash([]);
        }
}

// Обломки (отлетевшие башни, горящие куски, взрывы).
export function drawDebris(ctx, G, cam) {
        G.debris.forEach(d => {
            const x = d.x - cam.x;
            const y = d.y - cam.y;
            
            // 1. Взрыв (расширяющийся круг)
            if (d.type === 'explosion') {
                const p = d.life / d.maxLife; // 1 -> 0
                const r = (1 - p) * 60;
                ctx.globalAlpha = p;
                ctx.fillStyle = '#ff6600';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = p * 0.5;
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            
            // 2. Отлетевшая башня
                     // 2. Отлетевшая башня
            if (d.type === 'turret') {
                ctx.save();
                ctx.translate(x, y);
                // ctx.rotate(d.angle); // УБРАЛИ ВРАЩЕНИЕ
                
                const col = COLORS[d.faction];
                const sz = d.size || 20;
                
                // Башня (круг)
                ctx.fillStyle = '#2a2a2a';
                ctx.beginPath();
                ctx.arc(0, 0, sz * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = col.s;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Ствол (погнутый)
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(sz * 0.6, sz * 0.1);
                ctx.stroke();
                
                ctx.restore();
                
                // Дым из башни (если ещё дымит)
                if (Math.random() < 0.05) {
                    G.particles.push({
                        x: d.x, y: d.y, vx: (Math.random()-0.5)*0.5, vy: -1,
                        life: 20, maxLife: 20, color: '#333', size: 3
                    });
                }
            }
            
            // 3. Горящие обломки
            if (d.type === 'fire_debris') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(d.angle);
                // Сам обломок (тёмный)
                ctx.fillStyle = '#222';
                ctx.fillRect(-d.size/2, -d.size/2, d.size, d.size);
                // Огонь на обломке
                if (d.life > 120) { // Горит первые 8 секунд из 10
                    ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#fde047';
                    ctx.beginPath();
                    ctx.arc(0, -d.size, d.size*0.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        });
}

// Частицы (дым, искры).
export function drawParticles(ctx, G, cam) {
    G.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - cam.x, p.y - cam.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Трассеры пуль/снарядов.
export function drawTracers(ctx, G, cam) {
    G.tracers.forEach(tracer => {
        const alpha = tracer.life / tracer.maxLife;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = tracer.color;
        ctx.lineWidth = tracer.width;
        ctx.lineCap = 'round';
        
        // Draw tracer line
        ctx.beginPath();
        ctx.moveTo(tracer.fromX - cam.x, tracer.fromY - cam.y);
        ctx.lineTo(tracer.currentX - cam.x, tracer.currentY - cam.y);
        ctx.stroke();
        
        // Draw bright head
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tracer.currentX - cam.x, tracer.currentY - cam.y, tracer.width * 0.8, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Засвеченные области от танков-разведчиков.
export function drawRevealedAreas(ctx, G, cam) {
    if (G.revealedAreas && G.revealedAreas.length > 0) {
        G.revealedAreas.forEach(area => {
            if (area.faction === G.faction) {
                const alpha = Math.max(0, 1 - (G.time - area.time) / 180);
                ctx.globalAlpha = alpha * 0.15;
                ctx.fillStyle = '#60a5fa';
                ctx.beginPath();
                ctx.arc(area.x - cam.x, area.y - cam.y, area.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = alpha * 0.4;
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
        ctx.globalAlpha = 1;
    }
}

// Индикатор режима перемещения (круг под курсором).
export function drawMoveModeIndicator(ctx, G) {
    if (G.moveMode) {
        ctx.strokeStyle = '#fbbf2480';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(G.mousePos.x, G.mousePos.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
