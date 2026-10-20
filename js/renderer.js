// ===== RENDERER =====
import { COLORS, dist, getModeFlags } from './constants.js';
import { ROADS, CITY_ZONES, TREES, BUSHES, ROCKS, GRASS_PATCHES, LAKES } from './map.js';
import { isInfUnit } from './vehicles.js';
let globalFogCanvas = null;
let globalFogCtx = null;

function getFogCanvas(w, h) {
    if (!globalFogCanvas) {
        globalFogCanvas = document.createElement('canvas');
        globalFogCtx = globalFogCanvas.getContext('2d');
    }
    if (globalFogCanvas.width !== w || globalFogCanvas.height !== h) {
        globalFogCanvas.width = w;
        globalFogCanvas.height = h;
    }
    return { canvas: globalFogCanvas, ctx: globalFogCtx };
}

export function render(ctx, G, canvas) {
    const cam = G.cam;

    // ===== ТУМАН ВОЙНЫ: объявляем ДО отрисовки =====
    const fogEnabled = G.fogEnabled === true;
    const visibleSet = G.visibleEnemyIds;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background - green terrain with variation
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#5a7a4a');
    gradient.addColorStop(0.5, '#4a6a3a');
    gradient.addColorStop(1, '#5a7a4a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grass patches
    drawGrassPatches(ctx, cam, canvas);

    // Lakes with fishing huts and docks
    drawLakes(ctx, LAKES, cam, canvas);

    // Roads - winding with curves
    drawRoads(ctx, ROADS, cam);

    // City zones with detailed buildings
    drawCityZones(ctx, CITY_ZONES, cam);

    // Rocks
    drawRocks(ctx, ROCKS, cam, canvas);

    // Bushes
    drawBushes(ctx, BUSHES, cam, canvas);

    // Trees
    drawTrees(ctx, TREES, cam, canvas);

    // Capture points
    G.cps.forEach(cp => drawCapturePoint(ctx, cp, cam));

    // Resource mines
    G.mines.forEach(mine => drawMine(ctx, mine, cam));

    // ===== ТУМАН ВОЙНЫ: рисуем ПОВЕРХ карты, но ПОД юнитами/зданиями =====
    drawFogOverlay(ctx, G, cam, canvas);
    const visibleBuildings = G.visibleEnemyBuildings;

G.buildings.forEach(b => {
        const isEnemy = b.faction !== G.faction;
        const hidden = fogEnabled && isEnemy &&
            (!visibleBuildings || !visibleBuildings.has(b.id));
        drawBuilding(ctx, b, cam);
        if (hidden) {
            const bx = b.x - cam.x;
            const by = b.y - cam.y;
            const sz = b.type === 'town_hall' ? 48
                     : (b.type === 'factory' || b.type === 'barracks' || b.type === 'refinery') ? 38
                     : (b.type && b.type.startsWith('bunker_light')) ? 30
                     : (b.type && b.type.startsWith('bunker_medium')) ? 38
                     : (b.type && b.type.startsWith('bunker_heavy')) ? 46
                     : 38;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(bx - sz / 2 - 2, by - sz / 2 - 2, sz + 4, sz + 4);
        }
    });

    // ===== ДОМА ГОРОДОВ (горят, разрушаются) =====
    G.cps.forEach(cp => {
        if (cp.houses) drawCityHouses(ctx, cp, cam, G);
    });

    // Units
    if (G.corpses) G.corpses.forEach(c => drawCorpse(ctx, c, cam));

    const hoveredUnit = getHoveredUnit(G, cam);
    
    G.units.forEach(u => {
        // Врага показываем только если он в зоне видимости. Своих — ВСЕГДА.
        const isEnemy = u.faction !== G.faction;
        if (fogEnabled && isEnemy) {
            if (!visibleSet || !visibleSet.has(u.id)) return;
        }
        drawUnit(ctx, u, cam, G.selected, hoveredUnit === u, G);
                // ===== Область обстрела РСЗО =====
        if (u.isRSZO && u.aoeTarget) {
            const tx = u.aoeTarget.x - cam.x;
            const ty = u.aoeTarget.y - cam.y;
            const r = u.rocketSpreadRadius || 90;

            // Пунктирный круг разброса
            ctx.beginPath();
            ctx.arc(tx, ty, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(239,68,68,0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Заливка области
            ctx.fillStyle = 'rgba(239,68,68,0.08)';
            ctx.fill();

            // Перекрестие
            ctx.strokeStyle = 'rgba(239,68,68,0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tx - 14, ty);
            ctx.lineTo(tx + 14, ty);
            ctx.moveTo(tx, ty - 14);
            ctx.lineTo(tx, ty + 14);
            ctx.stroke();

            // Линия от установки к центру области
            ctx.strokeStyle = 'rgba(239,68,68,0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(u.x - cam.x, u.y - cam.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        // Draw AoE target if set
        if (u.aoe && u.aoeTarget && !u.isRSZO) {
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
    });
    // ===== ОБЛОМКИ (Отлетевшие башни и горящие куски) =====
    if (G.debris) {
        G.debris.forEach(d => {
            const x = d.x - cam.x;
            const y = d.y - cam.y;
                        // ===== ГОРЯЩИЙ ЯЩИК =====
            if (d.type === 'crate') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(d.angle);

                // Тень
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(-8 + 2, -8 + 2, 16, 16);

                // Сам ящик (дерево)
                ctx.fillStyle = '#8b4513';
                ctx.fillRect(-8, -8, 16, 16);
                ctx.strokeStyle = '#3a1a05';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-8, -8, 16, 16);

                // Крестовина (X)
                ctx.strokeStyle = '#5a2a0a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
                ctx.moveTo(8, -8);  ctx.lineTo(-8, 8);
                ctx.stroke();

                // Огонь сверху (мигает)
                const flicker = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 100 + d.x));
                const fireH = 8 * flicker;
                ctx.fillStyle = Math.random() > 0.5 ? '#fde047' : '#f97316';
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.quadraticCurveTo(4, -8 - fireH * 0.5, 0, -8 - fireH);
                ctx.quadraticCurveTo(-4, -8 - fireH * 0.5, 0, -8);
                ctx.fill();

                // Красная подсветка-«фитиль» когда скоро рванёт
                if (d.fuse < 30) {
                    ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + 0.4 * Math.sin(performance.now() / 50)})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, 14, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }

            // ===== ВОДЯНАЯ ЛУЖА =====
            if (d.type === 'water_puddle') {
                const alpha = Math.min(1, d.life / d.maxLife) * 0.5;
                const g = ctx.createRadialGradient(x, y, 0, x, y, d.radius);
                g.addColorStop(0, `rgba(96, 165, 250, ${alpha})`);
                g.addColorStop(0.6, `rgba(59, 130, 246, ${alpha * 0.7})`);
                g.addColorStop(1, 'rgba(59, 130, 246, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(x, y, d.radius, d.radius * 0.65, 0, 0, Math.PI * 2);
                ctx.fill();

                // Блики на воде
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
                ctx.lineWidth = 1;
                for (let i = 0; i < 2; i++) {
                    const phase = performance.now() / 400 + i;
                    const rr = d.radius * 0.4;
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(phase) * rr, y + Math.sin(phase * 0.7) * rr * 0.5, 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // ===== ПОЛОВИНКА ФЛЭТБЕДА =====
            if (d.type === 'flatbed_half') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(d.angle);

                const sz = d.size;
                // Тень
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(-sz * 0.3 + 2, -sz * 0.25 + 2, sz * 0.55, sz * 0.5);

                // Половина кузова (тёмный металл)
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(-sz * 0.3, -sz * 0.25, sz * 0.55, sz * 0.5);
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-sz * 0.3, -sz * 0.25, sz * 0.55, sz * 0.5);

                // Снаряды торчат из обломков
                ctx.fillStyle = '#fbbf24';
                for (let i = 0; i < 2; i++) {
                    ctx.fillRect(-sz * 0.15 + i * sz * 0.15, -sz * 0.1, sz * 0.06, sz * 0.25);
                }

                // Огонь на обломке
                if (d.life > 200) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#fde047';
                    ctx.beginPath();
                    ctx.arc(0, -sz * 0.15, sz * 0.15, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
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
            if (d.type === 'turret') {
                ctx.save();
                ctx.translate(x, y);
                // ctx.rotate(d.angle); // УБРАЛИ ВРАЩЕНИЕ
                
                const col = COLORS[d.faction] || COLORS.neutral;
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
    // Particles
    G.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - cam.x, p.y - cam.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Tracers
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
        // ===== РАКЕТЫ РСЗО =====
    if (G.rockets && G.rockets.length > 0) {
        G.rockets.forEach(rk => {
            const x = rk.x - cam.x;
            const y = rk.y - cam.y;
            if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;

            const ang = Math.atan2(rk.vy, rk.vx);
            const lifeRatio = rk.life / rk.maxLife;

            // Дымный след (затухающий)
            ctx.globalAlpha = 0.35 * lifeRatio;
            for (let i = 1; i <= 3; i++) {
                const sx = x - Math.cos(ang) * i * 6;
                const sy = y - Math.sin(ang) * i * 6;
                const sr = 3 + i * 1.5;
                const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                g.addColorStop(0, 'rgba(180,180,180,0.7)');
                g.addColorStop(1, 'rgba(180,180,180,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }

            // Огненный шлейф
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = Math.random() > 0.5 ? '#fde047' : '#f97316';
            ctx.beginPath();
            ctx.arc(x - Math.cos(ang) * 4, y - Math.sin(ang) * 4, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Корпус ракеты (поворот)
            ctx.globalAlpha = 1;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);

            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(-8, -2, 14, 4);
            // Нос (красный)
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(6, -2);
            ctx.lineTo(11, 0);
            ctx.lineTo(6, 2);
            ctx.closePath();
            ctx.fill();
            // Стабилизаторы
            ctx.fillStyle = '#64748b';
            ctx.fillRect(-8, -4, 3, 2);
            ctx.fillRect(-8, 2, 3, 2);

            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }
    // Revealed areas (from scout tanks)
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

    // Move mode indicator
    if (G.moveMode) {
        ctx.strokeStyle = '#fbbf2480';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(G.mousePos.x, G.mousePos.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Minimap
    drawMinimap(ctx, G, canvas);

    // Подсветка радиусов обороны при наведении на укрепление/город
    drawDefenseHoverHighlight(ctx, G, cam);
}

// Поиск укрепления (бункера) под курсором
function getHoveredBuilding(G, cam) {
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

function getHoveredCapturePoint(G, cam) {
    const mx = G.mousePos.x + cam.x;
    const my = G.mousePos.y + cam.y;
    for (const cp of G.cps) {
        if (cp.owner !== 'neutral' && dist(cp.x, cp.y, mx, my) <= 30) return cp;
    }
    return null;
}

function drawDefenseRangeCircle(ctx, x, y, radius, color, label) {
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

function drawDefenseHoverHighlight(ctx, G, cam) {
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

function getHoveredUnit(G, cam) {
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

function drawGrassPatches(ctx, cam, canvas) {
    GRASS_PATCHES.forEach(patch => {
        const x = patch.x - cam.x;
        const y = patch.y - cam.y;
        if (x < -100 || x > canvas.width + 100 || y < -100 || y > canvas.height + 100) return;

        // Gradient grass
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, patch.radius);
        gradient.addColorStop(0, 'rgba(120, 140, 80, 0.4)');
        gradient.addColorStop(0.7, 'rgba(100, 120, 60, 0.2)');
        gradient.addColorStop(1, 'rgba(80, 100, 40, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, patch.radius, patch.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawLakes(ctx, lakes, cam, canvas) {
    lakes.forEach(lake => {
        const centerX = lake.col * 250 + 125;
        const centerY = lake.row * 150 + 75;
        const x = centerX - cam.x;
        const y = centerY - cam.y;
        
        if (x < -200 || x > canvas.width + 200 || y < -200 || y > canvas.height + 200) return;
        
        // Draw lake water with irregular shape
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, lake.radius);
        gradient.addColorStop(0, 'rgba(70, 130, 180, 0.8)');
        gradient.addColorStop(0.7, 'rgba(100, 149, 237, 0.6)');
        gradient.addColorStop(1, 'rgba(135, 206, 235, 0.4)');
        ctx.fillStyle = gradient;
        
        // Create irregular lake shape using multiple points
        ctx.beginPath();
        const points = 12;
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            // Add variation to radius for irregular shape
            const variation = 0.8 + Math.sin(angle * 3 + lake.col) * 0.2 + Math.cos(angle * 2 + lake.row) * 0.15;
            const radiusX = lake.radius * variation;
            const radiusY = lake.radius * 0.7 * (1 + Math.sin(angle * 2 + lake.col * 2) * 0.2);
            const px = x + Math.cos(angle) * radiusX;
            const py = y + Math.sin(angle) * radiusY;
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                // Use quadratic curves for smooth shape
                const prevAngle = ((i - 1) / points) * Math.PI * 2;
                const midAngle = (prevAngle + angle) / 2;
                const midVariation = 0.8 + Math.sin(midAngle * 3 + lake.col) * 0.2 + Math.cos(midAngle * 2 + lake.row) * 0.15;
                const midRadiusX = lake.radius * midVariation * 1.1;
                const midRadiusY = lake.radius * 0.7 * (1 + Math.sin(midAngle * 2 + lake.col * 2) * 0.2) * 1.1;
                const cpx = x + Math.cos(midAngle) * midRadiusX;
                const cpy = y + Math.sin(midAngle) * midRadiusY;
                ctx.quadraticCurveTo(cpx, cpy, px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw water ripples with irregular shape
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let r = 1; r <= 3; r++) {
            ctx.beginPath();
            const scale = r / 4;
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const variation = 0.8 + Math.sin(angle * 3 + lake.col) * 0.2 + Math.cos(angle * 2 + lake.row) * 0.15;
                const radiusX = lake.radius * variation * scale;
                const radiusY = lake.radius * 0.7 * (1 + Math.sin(angle * 2 + lake.col * 2) * 0.2) * scale;
                const px = x + Math.cos(angle) * radiusX;
                const py = y + Math.sin(angle) * radiusY;
                
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw fishing huts
        lake.huts.forEach(hut => {
            const hutX = x + hut.offsetX;
            const hutY = y + hut.offsetY;
            
            // Hut shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(hutX - 9, hutY - 9, 20, 20);
            
            // Hut body
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(hutX - 10, hutY - 10, 20, 20);
            
            // Hut roof
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.moveTo(hutX - 12, hutY - 10);
            ctx.lineTo(hutX, hutY - 20);
            ctx.lineTo(hutX + 12, hutY - 10);
            ctx.closePath();
            ctx.fill();
            
            // Door
            ctx.fillStyle = '#4a2511';
            ctx.fillRect(hutX - 3, hutY, 6, 10);
        });
        
        // Draw docks
        lake.docks.forEach(dock => {
            const dockX = x + dock.offsetX;
            const dockY = y + dock.offsetY;
            
            // Dock planks
            ctx.fillStyle = '#a0522d';
            ctx.fillRect(dockX - 15, dockY - 3, 30, 6);
            
            // Dock posts
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(dockX - 15, dockY - 8, 3, 16);
            ctx.fillRect(dockX + 12, dockY - 8, 3, 16);
            
            // Dock ropes
            ctx.strokeStyle = '#d2691e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dockX - 13, dockY - 5);
            ctx.lineTo(dockX + 13, dockY - 5);
            ctx.stroke();
        });
        
        // Lake name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lake.name, x, y - lake.radius - 10);
    });
}

function drawRoads(ctx, roads, cam) {
    roads.forEach(road => {
        const fromX = road.from[0] * 250 + 125;
        const fromY = road.from[1] * 150 + 75;
        const toX = road.to[0] * 250 + 125;
        const toY = road.to[1] * 150 + 75;
        
        // Road shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 28;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        // Add curve
        const midX = (fromX + toX) / 2 + (toY - fromY) * road.curve;
        const midY = (fromY + toY) / 2 - (toX - fromX) * road.curve;
        
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road base
        ctx.strokeStyle = '#5a4a35';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road surface
        ctx.strokeStyle = '#7a6a55';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road markings
        ctx.strokeStyle = '#8a7a65';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        ctx.setLineDash([]);
    });
}

function drawBridges(ctx, bridges, cam) {
    bridges.forEach(br => {
        const x = br.x - cam.x;
        const y = br.y - cam.y;
        
        // Bridge shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x - 37, y - 16, 74, 32);
        
        // Bridge structure
        ctx.fillStyle = '#6a5a45';
        ctx.fillRect(x - 35, y - 14, 70, 28);
        
        // Bridge planks
        ctx.strokeStyle = '#5a4a35';
        ctx.lineWidth = 1;
        for (let i = -30; i < 35; i += 5) {
            ctx.beginPath();
            ctx.moveTo(x + i, y - 14);
            ctx.lineTo(x + i, y + 14);
            ctx.stroke();
        }
        
        // Bridge details
        ctx.strokeStyle = '#4a3a25';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 35, y - 14, 70, 28);
        
        // Railings
        ctx.fillStyle = '#4a3a25';
        ctx.fillRect(x - 35, y - 16, 70, 3);
        ctx.fillRect(x - 35, y + 13, 70, 3);
        
        // Railing posts
        for (let i = -30; i <= 30; i += 10) {
            ctx.fillRect(x + i, y - 18, 2, 5);
            ctx.fillRect(x + i, y + 13, 2, 5);
        }
        
        // Bridge name
        ctx.fillStyle = '#d1d5db';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(br.name, x, y - 22);
    });
}

function drawCityZones(ctx, zones, cam) {
    zones.forEach(zone => {
        const centerX = zone.col * 250 + 125;
        const centerY = zone.row * 150 + 75;
        
        // Ground texture for city
        ctx.fillStyle = 'rgba(90, 80, 70, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX - cam.x, centerY - cam.y, zone.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Streets (lighter paths)
        ctx.strokeStyle = 'rgba(120, 110, 100, 0.5)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(centerX - cam.x, centerY - cam.y, zone.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw buildings in city
        for (let i = 0; i < zone.buildings; i++) {
            const angle = (Math.PI * 2 * i) / zone.buildings + (i * 0.3);
            const dist = zone.radius * (0.3 + (i % 3) * 0.2);
            const bx = centerX + Math.cos(angle) * dist - cam.x;
            const by = centerY + Math.sin(angle) * dist - cam.y;
            
            drawDetailedBuilding(ctx, bx, by, zone.type, i);
        }
    });
}

function drawDetailedBuilding(ctx, x, y, type, index) {
    // Building shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x - 7, y - 7, 16, 16);
    
    // More variety in buildings based on type and index
    const buildingVariation = index % 5; // 5 different variations
    
    // Different building types
    if (type === 'military' || type === 'cache') {
        // Military buildings - darker, fortified
        if (buildingVariation === 0) {
            // Bunker style
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(x - 10, y - 8, 20, 16);
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 10, y - 8, 20, 16);
            // Slits
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x - 6, y - 2, 2, 4);
            ctx.fillRect(x + 4, y - 2, 2, 4);
        } else if (buildingVariation === 1) {
            // Watchtower
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(x - 6, y - 12, 12, 24);
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 6, y - 12, 12, 24);
            // Top platform
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(x - 8, y - 14, 16, 3);
            // Window
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 2, y - 6, 4, 3);
        } else if (buildingVariation === 2) {
            // Armory
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(x - 12, y - 10, 24, 20);
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 12, y - 10, 24, 20);
            // Reinforced door
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(x - 3, y, 6, 10);
            ctx.strokeStyle = '#1a1a1a';
            ctx.strokeRect(x - 3, y, 6, 10);
        } else if (buildingVariation === 3) {
            // Barracks
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(x - 14, y - 8, 28, 16);
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 14, y - 8, 28, 16);
            // Multiple windows
            ctx.fillStyle = '#fbbf24';
            for (let i = -10; i <= 10; i += 6) {
                ctx.fillRect(x + i, y - 4, 3, 3);
            }
        } else {
            // Command center
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(x - 11, y - 11, 22, 22);
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 11, y - 11, 22, 22);
            // Antenna
            ctx.strokeStyle = '#5a5a5a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y - 11);
            ctx.lineTo(x, y - 18);
            ctx.stroke();
            // Red light
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y - 18, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'settlement' || type === 'farms') {
        // Residential buildings - warmer colors
        if (buildingVariation === 0) {
            // Small house
            ctx.fillStyle = '#8b7355';
            ctx.fillRect(x - 8, y - 8, 16, 16);
            ctx.strokeStyle = '#6b5335';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 8, y - 8, 16, 16);
            // Pitched roof
            ctx.fillStyle = '#a0522d';
            ctx.beginPath();
            ctx.moveTo(x - 10, y - 8);
            ctx.lineTo(x, y - 14);
            ctx.lineTo(x + 10, y - 8);
            ctx.closePath();
            ctx.fill();
            // Window and door
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 4, y - 4, 3, 3);
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x + 1, y + 2, 4, 6);
        } else if (buildingVariation === 1) {
            // Two-story house
            ctx.fillStyle = '#9b8365';
            ctx.fillRect(x - 9, y - 12, 18, 24);
            ctx.strokeStyle = '#7b6345';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 9, y - 12, 18, 24);
            // Floor divider
            ctx.strokeStyle = '#6b5335';
            ctx.beginPath();
            ctx.moveTo(x - 9, y);
            ctx.lineTo(x + 9, y);
            ctx.stroke();
            // Windows
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 5, y - 8, 3, 3);
            ctx.fillRect(x + 2, y - 8, 3, 3);
            ctx.fillRect(x - 5, y + 4, 3, 3);
            ctx.fillRect(x + 2, y + 4, 3, 3);
        } else if (buildingVariation === 2) {
            // Cottage
            ctx.fillStyle = '#7a6a5a';
            ctx.fillRect(x - 10, y - 7, 20, 14);
            ctx.strokeStyle = '#5a4a3a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 10, y - 7, 20, 14);
            // Thatched roof
            ctx.fillStyle = '#8b7355';
            ctx.beginPath();
            ctx.moveTo(x - 12, y - 7);
            ctx.lineTo(x, y - 13);
            ctx.lineTo(x + 12, y - 7);
            ctx.closePath();
            ctx.fill();
            // Chimney
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x + 5, y - 15, 3, 5);
            // Door
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x - 2, y + 1, 4, 6);
        } else if (buildingVariation === 3) {
            // Barn
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(x - 12, y - 10, 24, 20);
            ctx.strokeStyle = '#6b3513';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 12, y - 10, 24, 20);
            // Barn door
            ctx.fillStyle = '#5a2a0a';
            ctx.fillRect(x - 4, y, 8, 10);
            // Hay loft window
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 2, y - 6, 4, 3);
        } else {
            // Shop
            ctx.fillStyle = '#9b8365';
            ctx.fillRect(x - 10, y - 9, 20, 18);
            ctx.strokeStyle = '#7b6345';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 10, y - 9, 20, 18);
            // Awning
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x - 11, y - 2, 22, 3);
            // Display window
            ctx.fillStyle = '#87ceeb';
            ctx.fillRect(x - 7, y + 2, 14, 6);
            ctx.strokeStyle = '#5a4a3a';
            ctx.strokeRect(x - 7, y + 2, 14, 6);
        }
    } else if (type === 'plaza') {
        // Plaza buildings - elegant
        if (buildingVariation === 0) {
            // Town hall
            ctx.fillStyle = '#a08968';
            ctx.fillRect(x - 12, y - 12, 24, 24);
            ctx.strokeStyle = '#806948';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 12, y - 12, 24, 24);
            // Columns
            ctx.fillStyle = '#c0a988';
            ctx.fillRect(x - 10, y - 8, 2, 16);
            ctx.fillRect(x + 8, y - 8, 2, 16);
            // Pediment
            ctx.fillStyle = '#b09978';
            ctx.beginPath();
            ctx.moveTo(x - 13, y - 12);
            ctx.lineTo(x, y - 18);
            ctx.lineTo(x + 13, y - 12);
            ctx.closePath();
            ctx.fill();
        } else if (buildingVariation === 1) {
            // Church/Temple
            ctx.fillStyle = '#9b8365';
            ctx.fillRect(x - 10, y - 10, 20, 20);
            ctx.strokeStyle = '#7b6345';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 10, y - 10, 20, 20);
            // Steeple
            ctx.fillStyle = '#8b7355';
            ctx.beginPath();
            ctx.moveTo(x - 3, y - 10);
            ctx.lineTo(x, y - 20);
            ctx.lineTo(x + 3, y - 10);
            ctx.closePath();
            ctx.fill();
            // Cross
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y - 20);
            ctx.lineTo(x, y - 24);
            ctx.moveTo(x - 2, y - 22);
            ctx.lineTo(x + 2, y - 22);
            ctx.stroke();
        } else if (buildingVariation === 2) {
            // Market
            ctx.fillStyle = '#8b7355';
            ctx.fillRect(x - 14, y - 8, 28, 16);
            ctx.strokeStyle = '#6b5335';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 14, y - 8, 28, 16);
            // Open front
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x - 12, y - 4, 24, 12);
            // Goods
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x - 6, y + 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(x, y + 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(x + 6, y + 2, 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (buildingVariation === 3) {
            // Inn/Tavern
            ctx.fillStyle = '#7a6a5a';
            ctx.fillRect(x - 11, y - 11, 22, 22);
            ctx.strokeStyle = '#5a4a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 11, y - 11, 22, 22);
            // Sign
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(x - 6, y - 14, 12, 3);
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 6px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🍺', x, y - 11);
            // Windows
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 7, y - 6, 4, 4);
            ctx.fillRect(x + 3, y - 6, 4, 4);
            // Door
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x - 3, y + 3, 6, 8);
        } else {
            // Fountain/Statue
            ctx.fillStyle = '#6b7280';
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Water
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();
            // Statue
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(x - 2, y - 8, 4, 8);
            ctx.beginPath();
            ctx.arc(x, y - 10, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'mining') {
        // Mining buildings
        if (buildingVariation === 0) {
            // Mine entrance
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath();
            ctx.arc(x, y + 5, 10, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.arc(x, y + 5, 7, Math.PI, 0);
            ctx.fill();
            // Support beams
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 10, y + 5);
            ctx.lineTo(x - 10, y - 5);
            ctx.moveTo(x + 10, y + 5);
            ctx.lineTo(x + 10, y - 5);
            ctx.moveTo(x - 10, y - 5);
            ctx.lineTo(x + 10, y - 5);
            ctx.stroke();
        } else if (buildingVariation === 1) {
            // Smelter
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x - 10, y - 8, 20, 16);
            ctx.strokeStyle = '#3a2a1a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 10, y - 8, 20, 16);
            // Chimney
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x + 5, y - 15, 4, 10);
            // Smoke
            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.beginPath();
            ctx.arc(x + 7, y - 18, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 9, y - 22, 2, 0, Math.PI * 2);
            ctx.fill();
            // Fire glow
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x - 3, y, 6, 4);
        } else {
            // Storage building
            ctx.fillStyle = '#6a5a4a';
            ctx.fillRect(x - 12, y - 10, 24, 20);
            ctx.strokeStyle = '#4a3a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 12, y - 10, 24, 20);
            // Crates
            ctx.fillStyle = '#8b7355';
            ctx.fillRect(x - 8, y + 2, 6, 6);
            ctx.fillRect(x, y + 2, 6, 6);
            ctx.fillRect(x - 4, y - 4, 6, 6);
        }
    } else if (type === 'border' || type === 'outpost') {
        // Border/Outpost buildings
        if (buildingVariation === 0) {
            // Guard tower
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(x - 5, y - 15, 10, 30);
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 5, y - 15, 10, 30);
            // Platform
            ctx.fillStyle = '#6a6a6a';
            ctx.fillRect(x - 8, y - 18, 16, 3);
            // Window
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 2, y - 10, 4, 3);
        } else {
            // Wall segment
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(x - 15, y - 5, 30, 10);
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 15, y - 5, 30, 10);
            // Battlements
            for (let i = -12; i <= 12; i += 6) {
                ctx.fillStyle = '#5b6270';
                ctx.fillRect(x + i, y - 8, 4, 3);
            }
        }
    } else {
        // Default buildings with variety
        if (buildingVariation === 0) {
            ctx.fillStyle = '#7a6a5a';
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.strokeStyle = '#5a4a3a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 9, y - 9, 18, 18);
            ctx.fillStyle = '#8a7a6a';
            ctx.fillRect(x - 10, y - 10, 20, 3);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 4, y - 3, 3, 3);
            ctx.fillRect(x + 2, y - 3, 3, 3);
        } else if (buildingVariation === 1) {
            ctx.fillStyle = '#8b7355';
            ctx.fillRect(x - 8, y - 10, 16, 20);
            ctx.strokeStyle = '#6b5335';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 8, y - 10, 16, 20);
            ctx.fillStyle = '#a0522d';
            ctx.beginPath();
            ctx.moveTo(x - 9, y - 10);
            ctx.lineTo(x, y - 15);
            ctx.lineTo(x + 9, y - 10);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x - 2, y + 2, 4, 8);
        } else {
            ctx.fillStyle = '#6a5a4a';
            ctx.fillRect(x - 10, y - 8, 20, 16);
            ctx.strokeStyle = '#4a3a2a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 10, y - 8, 20, 16);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 6, y - 4, 3, 3);
            ctx.fillRect(x + 3, y - 4, 3, 3);
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x - 2, y + 2, 4, 6);
        }
    }
}

function drawRocks(ctx, rocks, cam, canvas) {
    rocks.forEach(rock => {
        const x = rock.x - cam.x;
        const y = rock.y - cam.y;
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
        
        // Rock shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + rock.size * 0.5, rock.size * 0.8, rock.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Rock body
        ctx.fillStyle = '#6a6a6a';
        ctx.beginPath();
        ctx.ellipse(x, y, rock.size, rock.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Rock highlight
        ctx.fillStyle = '#7a7a7a';
        ctx.beginPath();
        ctx.ellipse(x - rock.size * 0.3, y - rock.size * 0.3, rock.size * 0.5, rock.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawBushes(ctx, bushes, cam, canvas) {
    bushes.forEach(bush => {
        const x = bush.x - cam.x;
        const y = bush.y - cam.y;
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
        
        // Bush shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x + 1, y + bush.size * 0.5, bush.size * 0.8, bush.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Bush body
        ctx.fillStyle = '#4a6a3a';
        ctx.beginPath();
        ctx.arc(x, y, bush.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Bush highlight
        ctx.fillStyle = '#5a7a4a';
        ctx.beginPath();
        ctx.arc(x - bush.size * 0.3, y - bush.size * 0.3, bush.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawTrees(ctx, trees, cam, canvas) {
    trees.forEach(tree => {
        const x = tree.x - cam.x;
        const y = tree.y - cam.y;
        
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
        
        // Tree shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + tree.size * 0.8, tree.size * 0.7, tree.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (tree.type === 'pine') {
            // Pine tree - triangular
            ctx.fillStyle = '#3a5a2a';
            ctx.beginPath();
            ctx.moveTo(x, y - tree.size);
            ctx.lineTo(x - tree.size * 0.6, y + tree.size * 0.3);
            ctx.lineTo(x + tree.size * 0.6, y + tree.size * 0.3);
            ctx.closePath();
            ctx.fill();
            
            // Trunk
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x - 2, y + tree.size * 0.3, 4, tree.size * 0.4);
            
            // Highlight
            ctx.fillStyle = '#4a6a3a';
            ctx.beginPath();
            ctx.moveTo(x, y - tree.size * 0.7);
            ctx.lineTo(x - tree.size * 0.3, y);
            ctx.lineTo(x + tree.size * 0.3, y);
            ctx.closePath();
            ctx.fill();
        } else {
            // Oak tree - round
            // Trunk
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x - 3, y, 6, tree.size * 0.6);
            
            // Canopy
            ctx.fillStyle = '#4a6a3a';
            ctx.beginPath();
            ctx.arc(x, y - tree.size * 0.3, tree.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Canopy highlights
            ctx.fillStyle = '#5a7a4a';
            ctx.beginPath();
            ctx.arc(x - tree.size * 0.3, y - tree.size * 0.4, tree.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#6a8a5a';
            ctx.beginPath();
            ctx.arc(x + tree.size * 0.2, y - tree.size * 0.2, tree.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawCapturePoint(ctx, cp, cam) {
    const x = cp.x - cam.x;
    const y = cp.y - cam.y;
    const col = cp.owner === 'neutral' ? COLORS.neutral : COLORS[cp.owner];
    
    // Zone circle
    ctx.beginPath();
    ctx.arc(x, y, cp.radius, 0, Math.PI * 2);
    ctx.fillStyle = col.p + '15';
    ctx.fill();
    ctx.strokeStyle = col.p + '80';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Defense level indicator (if owned and has defense)
    if (cp.owner !== 'neutral' && cp.defenseLevel > 0) {
        // Draw defense range circle (радиусы x2 — см. getTerritoryDefenseStats)
        const stats = [
            { range: 0 },
            { range: 240 },
            { range: 300 },
            { range: 360 },
        ];
        const defRange = stats[cp.defenseLevel].range;
        
        ctx.beginPath();
        ctx.arc(x, y, defRange, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw visual fortifications based on level
        // ===== НОВОЕ: передаём долю прочности для визуальной деградации =====
        const maxHp = cp._defMaxHp || 0;
        const integrity = maxHp > 0
            ? Math.max(0, Math.min(1, (cp.defenseHp || 0) / maxHp))
            : 1;
        drawFortifications(ctx, x, y, cp.defenseLevel, col, integrity);
    }
    
    // Capture progress
    if (cp.capturing) {
        const cCol = COLORS[cp.capturing];
        ctx.beginPath();
        ctx.arc(x, y, cp.radius * 0.6, -Math.PI / 2, -Math.PI / 2 + (cp.progress / 100) * Math.PI * 2);
        ctx.strokeStyle = cCol.a;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    
    // Flag
    ctx.fillStyle = col.p;
    ctx.fillRect(x - 2, y - 18, 4, 24);
    ctx.fillStyle = col.a;
    ctx.fillRect(x + 2, y - 18, 14, 9);
    
    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cp.name, x, y - cp.radius - 10);
}

function drawFortifications(ctx, x, y, level, col, integrity = 1) {
    // ===== СЛОМЛЕННАЯ ОБОРОНА: только обугленные руины =====
    if (integrity <= 0) {
        ctx.fillStyle = 'rgba(40, 20, 10, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a1a0a';
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = 45;
            ctx.fillRect(x + Math.cos(a) * r - 3, y + Math.sin(a) * r - 3, 6, 6);
        }
        const now = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + now * 0.3;
            const fx = x + Math.cos(a) * 30;
            const fy = y + Math.sin(a) * 30;
            const fr = 4 + Math.sin(now * 6 + i) * 2;
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(fx, fy - fr);
            ctx.lineTo(fx - fr * 0.5, fy + fr * 0.4);
            ctx.lineTo(fx + fr * 0.5, fy + fr * 0.4);
            ctx.closePath();
            ctx.fill();
        }
        return;
    }

    // Доля пропускаемых элементов по прочности
    let skipRate = 0;
    if (integrity > 0.75) skipRate = 0;
    else if (integrity > 0.5) skipRate = 0.25;
    else if (integrity > 0.25) skipRate = 0.5;
    else skipRate = 0.75;

    // Дым при повреждениях
    if (integrity <= 0.5) {
        const now = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + now * 0.5;
            const r = 40;
            const sx = x + Math.cos(a) * r;
            const sy = y + Math.sin(a) * r;
            const sr = 8 + Math.sin(now * 2 + i) * 3;
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
            g.addColorStop(0, `rgba(40, 40, 40, ${integrity < 0.25 ? 0.5 : 0.3})`);
            g.addColorStop(1, 'rgba(40, 40, 40, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Level 1: Sandbags and small barriers
    if (level >= 1) {
        // More sandbags in defensive positions
        const sandbagPositions = [
            // Main perimeter
            { angle: 0, dist: 45 },
            { angle: Math.PI / 4, dist: 45 },
            { angle: Math.PI / 2, dist: 45 },
            { angle: Math.PI * 3 / 4, dist: 45 },
            { angle: Math.PI, dist: 45 },
            { angle: Math.PI * 5 / 4, dist: 45 },
            { angle: Math.PI * 3 / 2, dist: 45 },
            { angle: Math.PI * 7 / 4, dist: 45 },
            // Inner ring
            { angle: Math.PI / 6, dist: 30 },
            { angle: Math.PI / 2 + Math.PI / 6, dist: 30 },
            { angle: Math.PI + Math.PI / 6, dist: 30 },
            { angle: Math.PI * 3 / 2 + Math.PI / 6, dist: 30 },
        ];
        
        sandbagPositions.forEach(pos => {
            const sx = x + Math.cos(pos.angle) * pos.dist;
            const sy = y + Math.sin(pos.angle) * pos.dist;
            
            // Sandbag shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(sx + 1, sy + 1, 9, 6, pos.angle, 0, Math.PI * 2);
            ctx.fill();
            
            // Sandbag
            ctx.fillStyle = '#8b7355';
            ctx.beginPath();
            ctx.ellipse(sx, sy, 9, 6, pos.angle, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#6b5335';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Sandbag texture
            ctx.fillStyle = '#7a6345';
            ctx.beginPath();
            ctx.ellipse(sx - 2, sy - 1, 3, 2, pos.angle, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Small barriers
        const barrierPositions = [
            { angle: Math.PI / 8, dist: 38 },
            { angle: Math.PI * 5 / 8, dist: 38 },
            { angle: Math.PI * 9 / 8, dist: 38 },
            { angle: Math.PI * 13 / 8, dist: 38 },
        ];
        
        barrierPositions.forEach(pos => {
            const bx = x + Math.cos(pos.angle) * pos.dist;
            const by = y + Math.sin(pos.angle) * pos.dist;
            
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(pos.angle);
            
            // Barrier
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(-6, -3, 12, 6);
            ctx.strokeStyle = '#3a2a1a';
            ctx.lineWidth = 1;
            ctx.strokeRect(-6, -3, 12, 6);
            
            ctx.restore();
        });
    }
    
    // Level 2: Concrete walls and mini-bunkers
    if (level >= 2) {
        // Keep level 1 elements
        // (sandbags are already drawn)
        
        // Concrete walls - more extensive
        const wallPositions = [
            { x: x - 55, y: y, width: 25, height: 10 },
            { x: x + 55, y: y, width: 25, height: 10 },
            { x: x, y: y - 55, width: 10, height: 25 },
            { x: x, y: y + 55, width: 10, height: 25 },
            // Diagonal walls
            { x: x - 40, y: y - 40, width: 20, height: 8, rotate: Math.PI / 4 },
            { x: x + 40, y: y - 40, width: 20, height: 8, rotate: -Math.PI / 4 },
            { x: x - 40, y: y + 40, width: 20, height: 8, rotate: -Math.PI / 4 },
            { x: x + 40, y: y + 40, width: 20, height: 8, rotate: Math.PI / 4 },
        ];
        
        wallPositions.forEach(wall => {
            ctx.save();
            ctx.translate(wall.x, wall.y);
            if (wall.rotate) ctx.rotate(wall.rotate);
            
            // Wall shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(-wall.width / 2 + 2, -wall.height / 2 + 2, wall.width, wall.height);
            
            // Wall
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            
            // Wall texture
            ctx.fillStyle = '#5b6270';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(-wall.width / 2 + i * 8, -wall.height / 2, 2, wall.height);
            }
            
            ctx.restore();
        });
        
        // Mini-bunkers
        const bunkerPositions = [
            { angle: Math.PI / 3, dist: 50 },
            { angle: Math.PI, dist: 50 },
            { angle: Math.PI * 5 / 3, dist: 50 },
        ];
        
        bunkerPositions.forEach(pos => {
            const bx = x + Math.cos(pos.angle) * pos.dist;
            const by = y + Math.sin(pos.angle) * pos.dist;
            
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(pos.angle + Math.PI);
            
            // Bunker shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(-10 + 2, -8 + 2, 20, 16);
            
            // Bunker body
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(-10, -8, 20, 16);
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 2;
            ctx.strokeRect(-10, -8, 20, 16);
            
            // Bunker roof
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(-11, -9, 22, 3);
            
            // Firing slit
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-2, -4, 4, 2);
            
            // Door
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(-3, 2, 6, 6);
            
            ctx.restore();
        });
    }
    
    // Level 3: Turrets and heavy fortifications
    if (level >= 3) {
        // Keep level 1 and 2 elements
        // (sandbags, walls, mini-bunkers are already drawn)
        
        // Heavy turrets
        const turretPositions = [
            { angle: Math.PI / 4, dist: 65 },
            { angle: Math.PI * 3 / 4, dist: 65 },
            { angle: Math.PI * 5 / 4, dist: 65 },
            { angle: Math.PI * 7 / 4, dist: 65 },
        ];
        
        turretPositions.forEach(pos => {
            const tx = x + Math.cos(pos.angle) * pos.dist;
            const ty = y + Math.sin(pos.angle) * pos.dist;
            
            // Turret shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(tx + 2, ty + 2, 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Turret base
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.arc(tx, ty, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Turret platform
            ctx.fillStyle = '#4b5563';
            ctx.beginPath();
            ctx.arc(tx, ty, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Turret barrel
            ctx.strokeStyle = col.p;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + Math.cos(pos.angle) * 18, ty + Math.sin(pos.angle) * 18);
            ctx.stroke();
            
            // Barrel tip
            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.arc(tx + Math.cos(pos.angle) * 18, ty + Math.sin(pos.angle) * 18, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Turret highlight
            ctx.fillStyle = col.a;
            ctx.beginPath();
            ctx.arc(tx, ty, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Turret details
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(tx, ty, 10, 0, Math.PI * 2);
            ctx.stroke();
        });
        
        // Anti-aircraft defense
        const aaPositions = [
            { angle: 0, dist: 70 },
            { angle: Math.PI, dist: 70 },
        ];
        
        aaPositions.forEach(pos => {
            const ax = x + Math.cos(pos.angle) * pos.dist;
            const ay = y + Math.sin(pos.angle) * pos.dist;
            
            // AA base
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(ax - 8, ay - 8, 16, 16);
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(ax - 8, ay - 8, 16, 16);
            
            // AA barrel
            ctx.strokeStyle = col.p;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + Math.cos(pos.angle) * 12, ay + Math.sin(pos.angle) * 12 - 8);
            ctx.stroke();
            
            // AA radar dish
            ctx.fillStyle = col.a;
            ctx.beginPath();
            ctx.arc(ax, ay - 10, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

function drawMine(ctx, mine, cam) {
    const x = mine.x - cam.x;
    const y = mine.y - cam.y;
    const col = mine.owner === 'neutral' ? COLORS.neutral : COLORS[mine.owner];
    
    ctx.beginPath();
    ctx.arc(x, y, mine.radius, 0, Math.PI * 2);
    ctx.fillStyle = col.p + '10';
    ctx.fill();
    ctx.strokeStyle = col.p + '60';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#8a7a60';
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.strokeStyle = '#6a5a40';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 8, y - 8, 16, 16);
    
    const typeColors = { supplies: '#fbbf24', components: '#60a5fa', materials: '#a78bfa' };
    ctx.fillStyle = typeColors[mine.type] || '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#d1d5db';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(mine.name, x, y - mine.radius - 6);
}

function drawBuilding(ctx, b, cam) {
    const x = b.x - cam.x;
    const y = b.y - cam.y;
    const col = COLORS[b.faction] || COLORS.neutral;
    
    // Укрепления (бункеры)
    if (b.type && b.type.startsWith('bunker_')) {
        const sz = b.type === 'bunker_light' ? 30 : b.type === 'bunker_medium' ? 38 : 46;
        
        // Если бункер строится - показываем процесс строительства
        if (b.isBuilding) {
            // Строительная площадка
            ctx.fillStyle = 'rgba(139, 115, 85, 0.5)';
            ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
            
            // Каркас
            ctx.strokeStyle = '#8b7355';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
            ctx.setLineDash([]);
            
            // Прогресс строительства
            const progress = b.buildProgress || 0;
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`🔨 ${Math.floor(progress)}%`, x, y);
            
            // Полоска прогресса
            ctx.fillStyle = '#333';
            ctx.fillRect(x - sz / 2, y + sz / 2 + 3, sz, 6);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - sz / 2, y + sz / 2 + 3, sz * (progress / 100), 6);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - sz / 2, y + sz / 2 + 3, sz, 6);
            
            return;
        }
        
        // Тень
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x - sz / 2 + 3, y - sz / 2 + 3, sz, sz);
        
        // Основание бункера
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        
        // Стены бункера
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
        
        // Бойницы
        ctx.fillStyle = '#1a1a1a';
        const slitSize = sz * 0.15;
        ctx.fillRect(x - sz / 4, y - sz / 4, slitSize, slitSize);
        ctx.fillRect(x + sz / 4 - slitSize, y - sz / 4, slitSize, slitSize);
        ctx.fillRect(x - sz / 4, y + sz / 4 - slitSize, slitSize, slitSize);
        ctx.fillRect(x + sz / 4 - slitSize, y + sz / 4 - slitSize, slitSize, slitSize);
        
        // Уровень укрепления (звёздочки)
        if (b.level) {
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★'.repeat(b.level), x, y - sz / 2 - 8);
        }
        
        // Полоска HP
        const hpPct = b.hp / b.maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(x - sz / 2, y + sz / 2 + 3, sz, 4);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(x - sz / 2, y + sz / 2 + 3, sz * hpPct, 4);
        
        return;
    }
    
    // Обычные здания
    const sz = b.type === 'town_hall' ? 48 : 38;
    
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - sz / 2 + 3, y - sz / 2 + 3, sz, sz);
    
    ctx.fillStyle = col.bg;
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    ctx.strokeStyle = col.p;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
    
    ctx.fillStyle = col.a;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons = { town_hall: 'HQ', barracks: 'BAR', factory: 'FAC', refinery: 'REF' };
    ctx.fillText(icons[b.type] || 'BLD', x, y);
    
    const hpPct = b.hp / b.maxHp;
    ctx.fillStyle = '#333';
    ctx.fillRect(x - sz / 2, y + sz / 2 + 3, sz, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(x - sz / 2, y + sz / 2 + 3, sz * hpPct, 4);
}

function drawUnit(ctx, u, cam, selected, hovered, G) {
    const x = u.x - cam.x;
    const y = u.y - cam.y;
    if (x < -40 || x > ctx.canvas.width + 40 || y < -40 || y > ctx.canvas.height + 40) return;
    
    const col = COLORS[u.faction] || COLORS.neutral;
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
    
    if (isInfUnit(u)) {
    const r = sz / 2;
    ctx.fillStyle = col.p;
    ctx.beginPath();
    if (u.type === 'sniper') {
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.8, -r * 0.9);
        ctx.lineTo(-r * 0.8, r * 0.9);
    } 
    else if (u.type === 'scout_infantry') {
    // Пехотинец-разведчик (бинокль/радар)
    // Основа - треугольник, направленный вперед
    ctx.moveTo(r * 0.8, 0);
    ctx.lineTo(-r * 0.8, -r * 0.8);
    ctx.lineTo(-r * 0.8, r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Характерная деталь: Бинокль или радарная тарелка
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(r * 0.5, 0, r * 0.25, 0, Math.PI * 2); // объектив
    ctx.fill();
    ctx.strokeStyle = '#60a5fa'; // Синий блик линзы
    ctx.lineWidth = 1;
    ctx.stroke();
}
    
    else if (u.type === 'grenadier') {
        ctx.moveTo(r, 0); ctx.lineTo(0, -r);
        ctx.lineTo(-r, 0); ctx.lineTo(0, r);
    } else if (u.type === 'mg_gunner') {
        ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    } else if (u.type === 'assualt_varden' || u.type === 'assualt_colonist') {
        // Штурмовик — пятиугольник «остриём вперёд»
        ctx.moveTo(r, 0);
        ctx.lineTo(r * 0.2, -r);
        ctx.lineTo(-r * 0.9, -r * 0.6);
        ctx.lineTo(-r * 0.9, r * 0.6);
        ctx.lineTo(r * 0.2, r);
    } else if (u.type === 'smuggler_varden' || u.type === 'poacher_colonist') {
        // Контрабандист / Браконьер — вытянутый шестиугольник
        ctx.moveTo(r, 0);
        ctx.lineTo(r * 0.4, -r * 0.8);
        ctx.lineTo(-r * 0.7, -r * 0.7);
        ctx.lineTo(-r, 0);
        ctx.lineTo(-r * 0.7, r * 0.7);
        ctx.lineTo(r * 0.4, r * 0.8);
    } else if (u.type === 'medic_varden' || u.type === 'medic_colonist') {
        // Медик — круг (как стрелок), но с красным крестом ниже
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();}
     else {
        // Vehicle body (centered at 0,0)
        ctx.fillStyle = col.p;
        ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.65);
        ctx.strokeStyle = col.a;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-sz / 2, -sz / 3, sz, sz * 0.65);
        
        // Light tanks (Devitt, Hatchet)
    // ===== DEVITT (Warden Devitt Mk.III — канадский лёгкий танк) =====
if (u.type === 'devitt') {
    // ===== ГУСЕНИЦЫ (маленькие, обтекаемые) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.46, -sz * 0.32, sz * 0.92, sz * 0.1);
    ctx.fillRect(-sz * 0.46, sz * 0.22, sz * 0.92, sz * 0.1);
    
    // Катки (5 штук, маленькие)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.38 + i * sz * 0.19;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.27, sz * 0.032, 0, Math.PI * 2);
        ctx.arc(wx, sz * 0.27, sz * 0.032, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (скруглённый, «обтекаемый» — характерно для Devitt) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.22);
    ctx.lineTo(-sz * 0.4, -sz * 0.24);    // скос кормы
    ctx.lineTo( sz * 0.34, -sz * 0.24);
    ctx.quadraticCurveTo(sz * 0.46, -sz * 0.24, sz * 0.48, -sz * 0.14);  // скруглённый лоб
    ctx.lineTo( sz * 0.48,  sz * 0.14);
    ctx.quadraticCurveTo(sz * 0.46,  sz * 0.24, sz * 0.34,  sz * 0.24);
    ctx.lineTo(-sz * 0.4,  sz * 0.24);
    ctx.lineTo(-sz * 0.48,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ПЕРЕДНЯЯ НАДСТРОЙКА (характерная «ступенька» Devitt) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.16, -sz * 0.24);
    ctx.lineTo( sz * 0.18, -sz * 0.24);
    ctx.lineTo( sz * 0.28, -sz * 0.16);
    ctx.lineTo( sz * 0.28,  sz * 0.16);
    ctx.lineTo( sz * 0.18,  sz * 0.24);
    ctx.lineTo(-sz * 0.16,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== КРУГЛАЯ БАШНЯ (низкая, скруглённая — как на картинке) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(0, 0, sz * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Внутренний контур башни (объём)
    ctx.beginPath();
    ctx.arc(-sz * 0.03, -sz * 0.03, sz * 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = '#00000030';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Люк на крыше башни
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(-sz * 0.06, -sz * 0.06, sz * 0.05, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ПУШКА (40мм, короткая, в маленькой маске) =====
    // Маска пушки (характерная прямоугольная с выступом)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.18, -sz * 0.1);
    ctx.lineTo(sz * 0.32, -sz * 0.08);
    ctx.lineTo(sz * 0.32,  sz * 0.08);
    ctx.lineTo(sz * 0.18,  sz * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, 0);
    ctx.lineTo(sz * 0.68, 0);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.68, 0, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== СПАРЕННЫЙ ПУЛЕМЁТ (рядом с пушкой) =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.28, -sz * 0.05);
    ctx.lineTo(sz * 0.42, -sz * 0.05);
    ctx.stroke();
    
    // ===== КРУГЛЫЕ ЭЛЕМЕНТЫ НА КОРПУСЕ (характерные для Devitt) =====
    // Левый круглый выступ (фара/прибор)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.28, -sz * 0.02, sz * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Внутренний круг
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(-sz * 0.28, -sz * 0.02, sz * 0.03, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА (спереди слева) =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.4, -sz * 0.18, sz * 0.03, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНАЯ ТРУБА (сзади сбоку) =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, -sz * 0.2);
    ctx.lineTo(-sz * 0.5, -sz * 0.28);
    ctx.stroke();
    
    // ===== ЯЩИК ЗИП на надгусеничной полке =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.4, sz * 0.02, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.4, sz * 0.02, sz * 0.12, sz * 0.1);
}

    // ===== МАРКЕРЫ НОВОЙ ПЕХОТЫ =====

    // Штурмовик — короткий толстый ствол + «дульный тормоз» (квадратик)
    if (u.type === 'assualt_varden' || u.type === 'assualt_colonist') {
        ctx.strokeStyle = col.s;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sz / 2 + 5, 0);
        ctx.stroke();
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(sz / 2 + 5, -2, 3, 4);
    }

    // Контрабандист / Браконьер — длинный тонкий ствол с прицелом
    if (u.type === 'smuggler_varden' || u.type === 'poacher_colonist') {
        ctx.strokeStyle = col.s;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sz / 2 + 7, 0);
        ctx.stroke();
        // прицел
        ctx.beginPath();
        ctx.arc(sz / 2 + 3, 0, 2.5, 0, Math.PI * 2);
        ctx.stroke();
        // «сумка» сбоку (контрабандист/браконьер)
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(-r * 0.6, -r * 0.9, 3, 4);
    }

    // Медик — красный крест в центре (вместо ствола)
    if (u.type === 'medic_varden' || u.type === 'medic_colonist') {
        ctx.fillStyle = '#dc2626';
        // вертикальная перекладина
        ctx.fillRect(-1.5, -r * 0.55, 3, r * 1.1);
        // горизонтальная перекладина
        ctx.fillRect(-r * 0.55, -1.5, r * 1.1, 3);
        // белая обводка вокруг креста (чтобы читался на любом фоне)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-r * 0.55, -1.5, r * 1.1, 3);
        ctx.strokeRect(-1.5, -r * 0.55, 3, r * 1.1);
    }

// ===== HATCHET (американский M24 Chaffee) =====
if (u.type === 'hatchet') {
    // ===== ГУСЕНИЦЫ (широкие, с характерными траками) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.5, -sz * 0.34, sz, sz * 0.1);
    ctx.fillRect(-sz * 0.5, sz * 0.24, sz, sz * 0.1);
    
    // Катки (5 штук, крупные — как у Chaffee)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.42 + i * sz * 0.21;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.29, sz * 0.042, 0, Math.PI * 2);
        ctx.arc(wx, sz * 0.29, sz * 0.042, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (с наклонной лобовой броней) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);    // корма
    ctx.lineTo( sz * 0.3, -sz * 0.24);    // верх до лба
    ctx.lineTo( sz * 0.46, -sz * 0.14);   // скошенный лоб (верх)
    ctx.lineTo( sz * 0.46,  sz * 0.14);   // скошенный лоб (низ)
    ctx.lineTo( sz * 0.3,  sz * 0.24);    // низ лба
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== БАШНЯ (обтекаемая, скруглённая — характерная для Chaffee) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.2, -sz * 0.2);      // корма башни (верх)
    ctx.quadraticCurveTo(-sz * 0.26, 0, -sz * 0.2, sz * 0.2);  // скруглённая корма
    ctx.lineTo( sz * 0.16, sz * 0.2);
    ctx.quadraticCurveTo(sz * 0.3, sz * 0.14, sz * 0.3, 0);    // скруглённый перед
    ctx.quadraticCurveTo(sz * 0.3, -sz * 0.14, sz * 0.16, -sz * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА (характерная для Chaffee) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.1, -sz * 0.04, sz * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.1, -sz * 0.04, sz * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== ПУШКА M6 (75мм, средняя длина) =====
    // Маска пушки (коническая, характерная для Chaffee)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.24, -sz * 0.09);
    ctx.lineTo(sz * 0.34, -sz * 0.06);
    ctx.lineTo(sz * 0.34,  sz * 0.06);
    ctx.lineTo(sz * 0.24,  sz * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол 75мм
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sz * 0.32, 0);
    ctx.lineTo(sz * 0.78, 0);
    ctx.stroke();
    
    // Дульный тормоз
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.78, 0, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== СПАРЕННЫЙ ПУЛЕМЁТ M1919 =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, -sz * 0.04);
    ctx.lineTo(sz * 0.44, -sz * 0.04);
    ctx.stroke();
    
    // ===== КУРСОВОЙ ПУЛЕМЁТ (в лобовой части) =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.42, -sz * 0.12);
    ctx.lineTo(sz * 0.54, -sz * 0.12);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.54, -sz * 0.12, sz * 0.015, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА (на лобовой броне) =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНЫЕ ТРУБЫ (по бокам сзади — характерно для Chaffee) =====
   
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.02, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.02, sz * 0.14, sz * 0.12);
}
        
        // King Spire - Scout tank with antenna
// ===== KING SPIRE (Warden Scout Tank MK-I) =====
if (u.type === 'king_spire') {
    // ===== ГУСЕНИЦЫ (лёгкие, узкие) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.44, -sz * 0.32, sz * 0.88, sz * 0.09);
    ctx.fillRect(-sz * 0.44,  sz * 0.23, sz * 0.88, sz * 0.09);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
        const tx = -sz * 0.44 + i * (sz * 0.88 / 9);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.32); ctx.lineTo(tx, -sz * 0.23);
        ctx.moveTo(tx,  sz * 0.23); ctx.lineTo(tx,  sz * 0.32);
        ctx.stroke();
    }
    
    // Катки (4 штуки — лёгкое шасси)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 4; i++) {
        const wx = -sz * 0.34 + i * sz * 0.22;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.275, sz * 0.035, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.275, sz * 0.035, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (низкий, с наклонным лбом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.2);
    ctx.lineTo( sz * 0.28, -sz * 0.2);
    ctx.lineTo( sz * 0.42, -sz * 0.12);
    ctx.lineTo( sz * 0.42,  sz * 0.12);
    ctx.lineTo( sz * 0.28,  sz * 0.2);
    ctx.lineTo(-sz * 0.44,  sz * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== МАЛЕНЬКАЯ БАШНЯ (цилиндрическая, характерна для King Spire) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(0, 0, sz * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Верхняя крышка башни
    ctx.beginPath();
    ctx.arc(-sz * 0.02, -sz * 0.02, sz * 0.16, 0, Math.PI * 2);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Люк на крыше
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.06, -sz * 0.04, sz * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== 12.7мм ПУЛЕМЁТ (основное вооружение — тонкий) =====
    // Маска
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.2, 0, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол пулемёта (тонкий)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.24, 0);
    ctx.lineTo(sz * 0.6, 0);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.6, 0, sz * 0.012, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== АНТЕННА (характерная длинная дуга — как на картинке) =====
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.12, -sz * 0.18);
    ctx.quadraticCurveTo(-sz * 0.3, -sz * 0.55, sz * 0.02, -sz * 0.6);
    ctx.stroke();
    
    // Наконечник антенны
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(sz * 0.02, -sz * 0.6, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.38, -sz * 0.15, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== Reveal radius indicator (if selected) =====
    if (selected.includes(u.id) && u.revealRadius) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#60a5fa40';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(x, y, u.revealRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.translate(x, y);
        ctx.rotate(u.direction || 0);
    }
}

// ===== SILVERHAND (штурмовой танк с двумя орудиями) =====
if (u.type === 'silverhand') {
    // ===== ГУСЕНИЦЫ (широкие, тяжёлые) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.54, -sz * 0.38, sz * 1.08, sz * 0.1);
    ctx.fillRect(-sz * 0.54,  sz * 0.28, sz * 1.08, sz * 0.1);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.54 + i * (sz * 1.08 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.38); ctx.lineTo(tx, -sz * 0.28);
        ctx.moveTo(tx,  sz * 0.28); ctx.lineTo(tx,  sz * 0.38);
        ctx.stroke();
    }
    
    // Катки (5 штук, крупные)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.42 + i * sz * 0.21;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.33, sz * 0.045, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.33, sz * 0.045, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (массивный, с наклонным лбом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);
    ctx.lineTo( sz * 0.32, -sz * 0.24);
    ctx.lineTo( sz * 0.48, -sz * 0.14);
    ctx.lineTo( sz * 0.48,  sz * 0.14);
    ctx.lineTo( sz * 0.32,  sz * 0.24);
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.lineTo(-sz * 0.52,  sz * 0.16);
    ctx.lineTo(-sz * 0.52, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== БОЛЬШАЯ БАШНЯ (многогранная, как на картинке) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    // Задняя часть
    ctx.moveTo(-sz * 0.32, -sz * 0.22);
    ctx.lineTo( sz * 0.08, -sz * 0.24);
    // Передние грани
    ctx.lineTo( sz * 0.18, -sz * 0.18);
    ctx.lineTo( sz * 0.26, -sz * 0.08);
    ctx.lineTo( sz * 0.28, 0);
    ctx.lineTo( sz * 0.26,  sz * 0.08);
    ctx.lineTo( sz * 0.18,  sz * 0.18);
    ctx.lineTo( sz * 0.08,  sz * 0.24);
    ctx.lineTo(-sz * 0.32,  sz * 0.22);
    ctx.lineTo(-sz * 0.34,  sz * 0.14);
    ctx.lineTo(-sz * 0.34, -sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Рёбра башни (грани)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo( sz * 0.08, -sz * 0.24);
    ctx.lineTo( sz * 0.08,  sz * 0.24);
    ctx.moveTo( sz * 0.18, -sz * 0.18);
    ctx.lineTo( sz * 0.18,  sz * 0.18);
    ctx.stroke();
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.12, -sz * 0.08, sz * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.12, -sz * 0.08, sz * 0.035, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== 40мм БАШЕННОЕ ОРУДИЕ =====
    // Маска
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.24, -sz * 0.1);
    ctx.lineTo(sz * 0.32, -sz * 0.07);
    ctx.lineTo(sz * 0.32,  sz * 0.07);
    ctx.lineTo(sz * 0.24,  sz * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол 40мм (башенный)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, -sz * 0.05);
    ctx.lineTo(sz * 0.72, -sz * 0.05);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.72, -sz * 0.05, sz * 0.018, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== 68мм КОРПУСНОЕ ОРУДИЕ (смещено вниз-вправо, как на картинке) =====
    // Маска корпусного орудия
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.38, sz * 0.14, sz * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол 68мм (толще башенного)
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.44, sz * 0.14);
    ctx.lineTo(sz * 0.82, sz * 0.14);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.82, sz * 0.14, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.44, -sz * 0.2, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.02, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.02, sz * 0.14, sz * 0.12);
}
        
        // Gallagher Outlaw Mk.II — тяжёлый крейсер: массивный корпус,
        // усиленная башня с одним длинным орудием и бронированными катками
// ===== GALLAGHER OUTLAW (тяжёлый крейсерский, предшественник Highwayman) =====
// ===== GALLAGHER OUTLAW (тяжёлый крейсерский) =====
if (u.type === 'gallagher_outlaw') {
    // ===== ГУСЕНИЦЫ (широкие, сильно выступают за корпус) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.56, -sz * 0.4, sz * 1.12, sz * 0.11);
    ctx.fillRect(-sz * 0.56,  sz * 0.29, sz * 1.12, sz * 0.11);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.56 + i * (sz * 1.12 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.4); ctx.lineTo(tx, -sz * 0.29);
        ctx.moveTo(tx,  sz * 0.29); ctx.lineTo(tx,  sz * 0.4);
        ctx.stroke();
    }
    
    // Катки (5 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.44 + i * sz * 0.22;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.345, sz * 0.042, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.345, sz * 0.042, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (широкий, но с наклонными бортами — не квадрат) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.52, -sz * 0.26);   // корма верх
    ctx.lineTo( sz * 0.32, -sz * 0.26);
    ctx.lineTo( sz * 0.48, -sz * 0.16);   // наклонный лоб (верх)
    ctx.lineTo( sz * 0.5,  -sz * 0.08);   // скругление к носу
    ctx.lineTo( sz * 0.5,   sz * 0.08);
    ctx.lineTo( sz * 0.48,  sz * 0.16);
    ctx.lineTo( sz * 0.32,  sz * 0.26);
    ctx.lineTo(-sz * 0.52,  sz * 0.26);
    ctx.lineTo(-sz * 0.54,  sz * 0.18);   // скос кормы
    ctx.lineTo(-sz * 0.54, -sz * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== БАШНЯ (широкая низкая трапеция) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, -sz * 0.22);    // корма верх
    ctx.lineTo( sz * 0.12, -sz * 0.18);   // крыша
    ctx.lineTo( sz * 0.22, -sz * 0.12);   // скос к маске
    ctx.lineTo( sz * 0.22,  sz * 0.12);
    ctx.lineTo( sz * 0.12,  sz * 0.18);
    ctx.lineTo(-sz * 0.3,   sz * 0.22);
    ctx.lineTo(-sz * 0.32,  sz * 0.14);   // скос кормы башни
    ctx.lineTo(-sz * 0.32, -sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Командирская башенка сзади
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.18, -sz * 0.06, sz * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.18, -sz * 0.06, sz * 0.028, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== МАСКА ОРУДИЯ =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.18, -sz * 0.11);
    ctx.lineTo(sz * 0.3,  -sz * 0.09);
    ctx.lineTo(sz * 0.3,   sz * 0.09);
    ctx.lineTo(sz * 0.18,  sz * 0.11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== СПАРЕННОЕ ОРУДИЕ (тонкие стволы) =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.28, -sz * 0.04);
    ctx.lineTo(sz * 0.72, -sz * 0.04);
    ctx.moveTo(sz * 0.28,  sz * 0.04);
    ctx.lineTo(sz * 0.72,  sz * 0.04);
    ctx.stroke();
    
    // Дульные срезы
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.72, -sz * 0.04, sz * 0.014, 0, Math.PI * 2);
    ctx.arc(sz * 0.72,  sz * 0.04, sz * 0.014, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== КОРМОВАЯ НИША (характерная для Outlaw) =====
    ctx.fillStyle = col.p;
    ctx.fillRect(-sz * 0.48, -sz * 0.13, sz * 0.12, sz * 0.26);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz * 0.48, -sz * 0.13, sz * 0.12, sz * 0.26);
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.44, -sz * 0.2, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== BOOST =====
    if (u.boosting) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-sz * 0.44, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-sz * 0.52, -sz * 0.14);
        ctx.lineTo(-sz * 0.78, 0);
        ctx.lineTo(-sz * 0.52,  sz * 0.14);
        ctx.closePath();
        ctx.fill();
    }
}

// ===== GALLAGHER HIGHWAYMAN (Dual 20mm Cruiser Tank) =====
if (u.type === 'gallagher_highwayman') {
    // ===== ГУСЕНИЦЫ (широкие) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.54, -sz * 0.38, sz * 1.08, sz * 0.1);
    ctx.fillRect(-sz * 0.54,  sz * 0.28, sz * 1.08, sz * 0.1);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.54 + i * (sz * 1.08 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.38); ctx.lineTo(tx, -sz * 0.28);
        ctx.moveTo(tx,  sz * 0.28); ctx.lineTo(tx,  sz * 0.38);
        ctx.stroke();
    }
    
    // Катки (5 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.44 + i * sz * 0.22;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.33, sz * 0.042, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.33, sz * 0.042, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (низкий, широкий, с закруглённым носом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);
    ctx.lineTo( sz * 0.3, -sz * 0.24);
    ctx.quadraticCurveTo(sz * 0.46, -sz * 0.24, sz * 0.5, -sz * 0.12);
    ctx.lineTo(sz * 0.5,  sz * 0.12);
    ctx.quadraticCurveTo(sz * 0.46,  sz * 0.24, sz * 0.3,  sz * 0.24);
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.lineTo(-sz * 0.52,  sz * 0.16);
    ctx.lineTo(-sz * 0.52, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ОСНОВНАЯ БАШНЯ (широкая, скруглённая — как на рендере) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, -sz * 0.2);
    ctx.quadraticCurveTo(-sz * 0.36, 0, -sz * 0.3, sz * 0.2);
    ctx.lineTo( sz * 0.14,  sz * 0.2);
    ctx.quadraticCurveTo(sz * 0.26,  sz * 0.16, sz * 0.28, 0);
    ctx.quadraticCurveTo(sz * 0.26, -sz * 0.16, sz * 0.14, -sz * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Рёбра на башне (заклёпки)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.22, -sz * 0.16);
    ctx.lineTo(-sz * 0.22,  sz * 0.16);
    ctx.moveTo( sz * 0.06, -sz * 0.18);
    ctx.lineTo( sz * 0.06,  sz * 0.18);
    ctx.stroke();
    
    // ===== ВРАЩАЮЩАЯСЯ ПУЛЕМЁТНАЯ БАШЕНКА (фишка Highwayman) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.08, -sz * 0.03, sz * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.08, -sz * 0.03, sz * 0.045, 0, Math.PI * 2);
    ctx.stroke();
    
    // Пулемёт 12.7мм вбок
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.02, -sz * 0.08);
    ctx.lineTo(sz * 0.26, -sz * 0.08);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.26, -sz * 0.08, sz * 0.012, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== МАСКА ОРУДИЯ (широкая, с двумя тонкими стволами) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.26, -sz * 0.1);
    ctx.lineTo(sz * 0.34, -sz * 0.06);
    ctx.lineTo(sz * 0.34,  sz * 0.06);
    ctx.lineTo(sz * 0.26,  sz * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== СПАРЕННЫЕ 20мм ПУШКИ (тонкие длинные стволы) =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.32, -sz * 0.038);
    ctx.lineTo(sz * 0.82, -sz * 0.038);
    ctx.moveTo(sz * 0.32,  sz * 0.038);
    ctx.lineTo(sz * 0.82,  sz * 0.038);
    ctx.stroke();
    
    // Дульные срезы
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.82, -sz * 0.038, sz * 0.011, 0, Math.PI * 2);
    ctx.arc(sz * 0.82,  sz * 0.038, sz * 0.011, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.44, -sz * 0.2, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНЫЕ ТРУБЫ =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.52, -sz * 0.16);
    ctx.lineTo(-sz * 0.62, -sz * 0.26);
    ctx.moveTo(-sz * 0.52,  sz * 0.16);
    ctx.lineTo(-sz * 0.62,  sz * 0.26);
    ctx.stroke();
    
    // ===== BOOST =====
    if (u.boosting) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-sz * 0.42, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-sz * 0.52, -sz * 0.12);
        ctx.lineTo(-sz * 0.74, 0);
        ctx.lineTo(-sz * 0.52, sz * 0.12);
        ctx.closePath();
        ctx.fill();
    }
}
        
        // Scorpion - Light infantry tank with twin MGs
if (u.type === 'scorpion') {
    // ===== РАЗВОРОТ НА 180° =====
    ctx.save();
    ctx.rotate(Math.PI);
    
    // ===== ГУСЕНИЦЫ =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.46, -sz * 0.34, sz * 0.92, sz * 0.09);
    ctx.fillRect(-sz * 0.46, sz * 0.25, sz * 0.92, sz * 0.09);
    
    // Катки (6 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 6; i++) {
        const wx = -sz * 0.38 + i * sz * 0.152;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.295, sz * 0.035, 0, Math.PI * 2);
        ctx.arc(wx, sz * 0.295, sz * 0.035, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== ПРЯМОУГОЛЬНЫЙ КОРПУС =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.25);
    ctx.lineTo( sz * 0.42, -sz * 0.25);
    ctx.lineTo( sz * 0.48, -sz * 0.18);
    ctx.lineTo( sz * 0.48,  sz * 0.18);
    ctx.lineTo( sz * 0.42,  sz * 0.25);
    ctx.lineTo(-sz * 0.44,  sz * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ДВЕ МИНИ-РУБКИ =====
    // Левая рубка
    ctx.fillStyle = col.s;
    ctx.fillRect(-sz * 0.24, -sz * 0.22, sz * 0.2, sz * 0.16);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz * 0.24, -sz * 0.22, sz * 0.2, sz * 0.16);
    
    // Правая рубка
    ctx.fillStyle = col.s;
    ctx.fillRect(-sz * 0.24, sz * 0.06, sz * 0.2, sz * 0.16);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz * 0.24, sz * 0.06, sz * 0.2, sz * 0.16);
    
    // ===== ПУЛЕМЁТЫ =====
    // Левый пулемёт
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.04, -sz * 0.14);
    ctx.lineTo( sz * 0.44, -sz * 0.14);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.44, -sz * 0.14, sz * 0.018, 0, Math.PI * 2);
    ctx.fill();
    
    // Правый пулемёт
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.04, sz * 0.14);
    ctx.lineTo( sz * 0.44, sz * 0.14);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.44, sz * 0.14, sz * 0.018, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ПРИЦЕЛЫ / ЛЮКИ =====
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(-sz * 0.14, -sz * 0.14, sz * 0.03, 0, Math.PI * 2);
    ctx.arc(-sz * 0.14,  sz * 0.14, sz * 0.03, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНЫЕ ТРУБЫ =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.14);
    ctx.lineTo(-sz * 0.54, -sz * 0.22);
    ctx.moveTo(-sz * 0.44,  sz * 0.14);
    ctx.lineTo(-sz * 0.54,  sz * 0.22);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.44, -sz * 0.1, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // ===== Reveal radius indicator (if selected) =====
    if (selected.includes(u.id) && u.revealRadius) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#60a5fa40';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(x, y, u.revealRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.translate(x, y);
        ctx.rotate(u.direction || 0);
    }
}
        
        // Nemesis - Assault tank with grenade launcher
if (u.type === 'nemesis') {
    // ===== ГУСЕНИЦЫ =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.56, -sz * 0.32, sz * 1.12, sz * 0.09);
    ctx.fillRect(-sz * 0.56, sz * 0.23, sz * 1.12, sz * 0.09);
    
    // Катки (7 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 7; i++) {
        const wx = -sz * 0.48 + i * sz * 0.16;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.275, sz * 0.035, 0, Math.PI * 2);
        ctx.arc(wx, sz * 0.275, sz * 0.035, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (вытянутый, со скошенным лбом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.54, -sz * 0.24);
    ctx.lineTo(-sz * 0.42, -sz * 0.19);
    ctx.lineTo( sz * 0.44, -sz * 0.19);
    ctx.lineTo( sz * 0.54, -sz * 0.10);
    ctx.lineTo( sz * 0.54,  sz * 0.10);
    ctx.lineTo( sz * 0.44,  sz * 0.19);
    ctx.lineTo(-sz * 0.42,  sz * 0.19);
    ctx.lineTo(-sz * 0.54,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ТОНКАЯ ВЫТЯНУТАЯ БАШНЯ (сдвинута вперёд) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.20, -sz * 0.16);
    ctx.lineTo(-sz * 0.14, -sz * 0.22);
    ctx.lineTo( sz * 0.36, -sz * 0.22);
    ctx.lineTo( sz * 0.44, -sz * 0.14);
    ctx.lineTo( sz * 0.44,  sz * 0.14);
    ctx.lineTo( sz * 0.36,  sz * 0.22);
    ctx.lineTo(-sz * 0.14,  sz * 0.22);
    ctx.lineTo(-sz * 0.20,  sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.04, -sz * 0.1, sz * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк на башенке
    ctx.beginPath();
    ctx.arc(-sz * 0.04, -sz * 0.1, sz * 0.03, 0, Math.PI * 2);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // ===== ПУШКА ЗИС-С-53 (85мм) =====
    // Маска пушки
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(sz * 0.44, 0, sz * 0.055, 0, Math.PI * 2);
    ctx.fill();
    
    // Ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sz * 0.46, 0);
    ctx.lineTo(sz * 0.92, 0);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.92, 0, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== КУРСОВОЙ ПУЛЕМЁТ ДТ =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.52, -sz * 0.06);
    ctx.lineTo(sz * 0.62, -sz * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.62, -sz * 0.06, sz * 0.015, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.5, -sz * 0.12, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНАЯ ТРУБА =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.54, -sz * 0.12);
    ctx.lineTo(-sz * 0.64, -sz * 0.22);
    ctx.stroke();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.52, sz * 0.05, sz * 0.1, sz * 0.09);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.52, sz * 0.05, sz * 0.1, sz * 0.09);
}

// ===== МИНИ-ИКОНКА НАД МЕДИКОМ =====
if (u.isMedic && u.hp > 0) {
    // Красный крестик над головой — видно, кто лечит
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x - 2, y - sz / 2 - 12, 4, 10);
    ctx.fillRect(x - 5, y - sz / 2 - 9, 10, 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 2, y - sz / 2 - 12, 4, 10);
    ctx.strokeRect(x - 5, y - sz / 2 - 9, 10, 4);
}

        // Falchion - Medium tank
// ===== FALCHION (средний танк) =====
if (u.type === 'falchion') {
    // ===== ГУСЕНИЦЫ =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.5, -sz * 0.32, sz * 1.0, sz * 0.09);
    ctx.fillRect(-sz * 0.5,  sz * 0.23, sz * 1.0, sz * 0.09);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
        const tx = -sz * 0.5 + i * (sz / 10);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.32); ctx.lineTo(tx, -sz * 0.23);
        ctx.moveTo(tx,  sz * 0.23); ctx.lineTo(tx,  sz * 0.32);
        ctx.stroke();
    }
    
    // Катки (5 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.4 + i * sz * 0.2;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.275, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.275, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (с наклонным лбом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.21);
    ctx.lineTo( sz * 0.32, -sz * 0.21);
    ctx.lineTo( sz * 0.46, -sz * 0.12);
    ctx.lineTo( sz * 0.46,  sz * 0.12);
    ctx.lineTo( sz * 0.32,  sz * 0.21);
    ctx.lineTo(-sz * 0.48,  sz * 0.21);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== КРУГЛАЯ БАШНЯ (характерна для Falchion) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(0, 0, sz * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Командирская башенка
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.08, -sz * 0.06, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.08, -sz * 0.06, sz * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== ОСНОВНОЕ ОРУДИЕ (среднее, тонкий ствол) =====
    // Маска
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.26, 0, sz * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, 0);
    ctx.lineTo(sz * 0.72, 0);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.72, 0, sz * 0.016, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.16, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОП =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.14);
    ctx.lineTo(-sz * 0.56, -sz * 0.22);
    ctx.stroke();
}

// ===== SPATHA (тяжёлый танк — по картинке) =====
if (u.type === 'spatha') {
    // ===== ГУСЕНИЦЫ (широкие, с траками) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.54, -sz * 0.36, sz * 1.08, sz * 0.1);
    ctx.fillRect(-sz * 0.54,  sz * 0.26, sz * 1.08, sz * 0.1);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.54 + i * (sz * 1.08 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.36); ctx.lineTo(tx, -sz * 0.26);
        ctx.moveTo(tx,  sz * 0.26); ctx.lineTo(tx,  sz * 0.36);
        ctx.stroke();
    }
    
    // Катки (5 штук, крупные)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.42 + i * sz * 0.21;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.31, sz * 0.045, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.31, sz * 0.045, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== ЭКРАНЫ ПО БОРТАМ (тяжёлая защита — характерно для Spatha) =====
    ctx.fillStyle = col.p;
    ctx.fillRect(-sz * 0.52, -sz * 0.32, sz * 1.04, sz * 0.06);
    ctx.fillRect(-sz * 0.52,  sz * 0.26, sz * 1.04, sz * 0.06);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.52, -sz * 0.32, sz * 1.04, sz * 0.06);
    ctx.strokeRect(-sz * 0.52,  sz * 0.26, sz * 1.04, sz * 0.06);
    
    // ===== КОРПУС (массивный, с наклонным лбом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);
    ctx.lineTo( sz * 0.3, -sz * 0.24);
    ctx.lineTo( sz * 0.46, -sz * 0.14);
    ctx.lineTo( sz * 0.46,  sz * 0.14);
    ctx.lineTo( sz * 0.3,  sz * 0.24);
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.lineTo(-sz * 0.52,  sz * 0.16);
    ctx.lineTo(-sz * 0.52, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== УГЛОВАТАЯ МНОГОГРАННАЯ БАШНЯ (как на картинке) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    // Задняя часть (широкая)
    ctx.moveTo(-sz * 0.3, -sz * 0.24);   // корма верх
    ctx.lineTo( sz * 0.06, -sz * 0.26);  // крыша задняя
    ctx.lineTo( sz * 0.14, -sz * 0.2);   // грань крыши
    ctx.lineTo( sz * 0.22, -sz * 0.12);  // передняя грань верх
    ctx.lineTo( sz * 0.26, 0);           // нос башни
    ctx.lineTo( sz * 0.22,  sz * 0.12);  // передняя грань низ
    ctx.lineTo( sz * 0.14,  sz * 0.2);
    ctx.lineTo( sz * 0.06,  sz * 0.26);
    ctx.lineTo(-sz * 0.3,   sz * 0.24);  // корма низ
    ctx.lineTo(-sz * 0.32,  sz * 0.16);  // скос кормы
    ctx.lineTo(-sz * 0.32, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Рёбра башни (грани — для узнаваемости)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo( sz * 0.06, -sz * 0.26);
    ctx.lineTo( sz * 0.06,  sz * 0.26);
    ctx.moveTo( sz * 0.14, -sz * 0.2);
    ctx.lineTo( sz * 0.14,  sz * 0.2);
    ctx.moveTo( sz * 0.22, -sz * 0.12);
    ctx.lineTo( sz * 0.22,  sz * 0.12);
    ctx.stroke();
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА (сзади на крыше) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.14, -sz * 0.08, sz * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.14, -sz * 0.08, sz * 0.035, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== ДЛИННОЕ ТЯЖЁЛОЕ ОРУДИЕ 80мм =====
    // Маска (массивная, угловатая)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.24, -sz * 0.12);
    ctx.lineTo(sz * 0.34, -sz * 0.09);
    ctx.lineTo(sz * 0.34,  sz * 0.09);
    ctx.lineTo(sz * 0.24,  sz * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол (длинный)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sz * 0.32, 0);
    ctx.lineTo(sz * 0.82, 0);
    ctx.stroke();
    
    // Дульный тормоз
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.74, -sz * 0.05, sz * 0.1, sz * 0.1);
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.04, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.04, sz * 0.14, sz * 0.12);
}
        
      // ===== NISKA (немецкий Hanomag Sd.Kfz. 251) =====
if (u.type === 'niska') {
    // ===== ГУСЕНИЦЫ (полугусеничный — гусеницы только сзади) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.5, -sz * 0.34, sz * 0.6, sz * 0.1);
    ctx.fillRect(-sz * 0.5, sz * 0.24, sz * 0.6, sz * 0.1);
    
    // Катки гусениц (4 штуки, сзади)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 4; i++) {
        const wx = -sz * 0.44 + i * sz * 0.14;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx, sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== ПЕРЕДНИЕ КОЛЁСА (не гусеницы — полугусеничная схема) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.075, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.075, 0, Math.PI * 2);
    ctx.fill();
    // Ступицы колёс
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.035, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.035, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== КОРПУС (со скошенным лбом, характерным для Ханомага) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.22);    // корма (верх)
    ctx.lineTo(-sz * 0.44, -sz * 0.22);
    ctx.lineTo( sz * 0.2, -sz * 0.22);    // верх до скоса
    ctx.lineTo( sz * 0.48, -sz * 0.1);    // скошенный лоб (верх)
    ctx.lineTo( sz * 0.48,  sz * 0.1);    // скошенный лоб (низ)
    ctx.lineTo( sz * 0.2,  sz * 0.22);    // низ лба
    ctx.lineTo(-sz * 0.44,  sz * 0.22);
    ctx.lineTo(-sz * 0.5,  sz * 0.26);    // скос кормы
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ОТКРЫТОЕ БОЕВОЕ ОТДЕЛЕНИЕ (сверху, характерно для Ханомага) =====
    // Внутренняя часть (тёмный прямоугольник)
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-sz * 0.42, -sz * 0.15, sz * 0.5, sz * 0.3);
    
    // Борта боевого отделения
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Левый борт
    ctx.moveTo(-sz * 0.42, -sz * 0.15);
    ctx.lineTo(-sz * 0.42, sz * 0.15);
    // Правый борт
    ctx.moveTo( sz * 0.08, -sz * 0.15);
    ctx.lineTo( sz * 0.08, sz * 0.15);
    ctx.stroke();
    
    // ===== ПУЛЕМЁТНАЯ ТУРЕЛЬ (спереди, на правом борту) =====
    // Основание турели
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.0, -sz * 0.08, sz * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Пулемёт MG-42
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.0, -sz * 0.08);
    ctx.lineTo(sz * 0.42, -sz * 0.08);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.08, sz * 0.015, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА (на скошенном лбе) =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.4, -sz * 0.16, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНАЯ ТРУБА (сбоку сзади) =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.2);
    ctx.lineTo(-sz * 0.52, -sz * 0.28);
    ctx.stroke();
    
    // ===== ЯЩИК ЗИП на надгусеничной полке =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.06, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.06, sz * 0.12, sz * 0.1);
}
// ===== NONA (2С9 «Нона-С» — советская 120мм САУ) =====
if (u.type === 'nona') {
    // ===== ГУСЕНИЦЫ (широкие, как у БТР-Д) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.52, -sz * 0.4, sz * 1.04, sz * 0.12);
    ctx.fillRect(-sz * 0.52,  sz * 0.28, sz * 1.04, sz * 0.12);

    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.52 + i * (sz * 1.04 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.4); ctx.lineTo(tx, -sz * 0.28);
        ctx.moveTo(tx,  sz * 0.28); ctx.lineTo(tx,  sz * 0.4);
        ctx.stroke();
    }

    // Катки (6 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 6; i++) {
        const wx = -sz * 0.44 + i * sz * 0.176;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.34, sz * 0.045, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.34, sz * 0.045, 0, Math.PI * 2);
        ctx.fill();
    }

    // ===== КОРПУС (низкий, обтекаемый, «лодочный» нос) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);
    ctx.lineTo( sz * 0.3, -sz * 0.24);
    ctx.lineTo( sz * 0.5, -sz * 0.1);   // волнообразный нос
    ctx.lineTo( sz * 0.5,  sz * 0.1);
    ctx.lineTo( sz * 0.3,  sz * 0.24);
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== БАШНЯ-«СТАКАН» (цилиндрическая, высокая — характерна для 2С9) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(0, 0, sz * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Внутренний контур (объём башни)
    ctx.beginPath();
    ctx.arc(-sz * 0.02, -sz * 0.02, sz * 0.19, 0, Math.PI * 2);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Люк на крыше
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.06, -sz * 0.05, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== ОРУДИЕ 120мм =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.2, -sz * 0.08);
    ctx.lineTo(sz * 0.3, -sz * 0.05);
    ctx.lineTo(sz * 0.3,  sz * 0.05);
    ctx.lineTo(sz * 0.2,  sz * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sz * 0.28, 0);
    ctx.lineTo(sz * 0.9, 0);
    ctx.stroke();

    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.9, 0, sz * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // «Грибок» датчика на башне
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(-sz * 0.14, -sz * 0.14, sz * 0.035, 0, Math.PI * 2);
    ctx.fill();

    // Фара
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // Выхлопная труба
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.18);
    ctx.lineTo(-sz * 0.6, -sz * 0.26);
    ctx.stroke();

    // Ящик ЗИП
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.06, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.06, sz * 0.12, sz * 0.1);
}
// ===== PELEKYS (СУ-85Б — советская лёгкая ПТ-САУ) =====
if (u.type === 'pelekys') {
    // ===== ГУСЕНИЦЫ (узкие, лёгкое шасси Т-70) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.48, -sz * 0.36, sz * 0.96, sz * 0.1);
    ctx.fillRect(-sz * 0.48,  sz * 0.26, sz * 0.96, sz * 0.1);

    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
        const tx = -sz * 0.48 + i * (sz * 0.96 / 10);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.36); ctx.lineTo(tx, -sz * 0.26);
        ctx.moveTo(tx,  sz * 0.26); ctx.lineTo(tx,  sz * 0.36);
        ctx.stroke();
    }

    // Катки (5 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.4 + i * sz * 0.2;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.31, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.31, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }

    // ===== КОРПУС (низкий, со скошенным лобовым листом) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.22);   // корма
    ctx.lineTo( sz * 0.2, -sz * 0.22);    // верх до скоса
    ctx.lineTo( sz * 0.44, -sz * 0.04);   // скошенный лоб (верх) — ключевая деталь
    ctx.lineTo( sz * 0.44,  sz * 0.04);   // скошенный лоб (низ)
    ctx.lineTo( sz * 0.2,  sz * 0.22);    // низ лба
    ctx.lineTo(-sz * 0.48,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== ОТКРЫТАЯ СВЕРХУ РУБКА (характерна для СУ-85Б) =====
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, -sz * 0.18);
    ctx.lineTo(-sz * 0.14, -sz * 0.18);
    ctx.lineTo(-sz * 0.14,  sz * 0.18);
    ctx.lineTo(-sz * 0.4,  sz * 0.18);
    ctx.closePath();
    ctx.fill();

    // Борта рубки
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, -sz * 0.18);
    ctx.lineTo(-sz * 0.4,  sz * 0.18);
    ctx.moveTo(-sz * 0.14, -sz * 0.18);
    ctx.lineTo(-sz * 0.14,  sz * 0.18);
    ctx.stroke();

    // ===== ОРУДИЕ 85мм (Д-5С) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.18, -sz * 0.06);
    ctx.lineTo(sz * 0.28, -sz * 0.04);
    ctx.lineTo(sz * 0.28,  sz * 0.04);
    ctx.lineTo(sz * 0.18,  sz * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sz * 0.26, 0);
    ctx.lineTo(sz * 0.86, 0);
    ctx.stroke();

    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.86, 0, sz * 0.018, 0, Math.PI * 2);
    ctx.fill();

    // Командирская башенка/люк
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.28, -sz * 0.06, sz * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-sz * 0.28, -sz * 0.06, sz * 0.035, 0, Math.PI * 2);
    ctx.stroke();

    // Фара
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.4, -sz * 0.16, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();

    // Выхлопная труба
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.14);
    ctx.lineTo(-sz * 0.56, -sz * 0.22);
    ctx.stroke();

    // Ящик ЗИП
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.44, sz * 0.04, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.44, sz * 0.04, sz * 0.12, sz * 0.1);
}
// ===== NISKA BLINDER (Hanomag с закрытым бронированием сверху) =====
if (u.type === 'niska_blinder') {
    // ===== ГУСЕНИЦЫ (полугусеничный — гусеницы только сзади) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.5, -sz * 0.34, sz * 0.6, sz * 0.1);
    ctx.fillRect(-sz * 0.5,  sz * 0.24, sz * 0.6, sz * 0.1);
    
    // Катки гусениц (4 штуки, сзади)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 4; i++) {
        const wx = -sz * 0.44 + i * sz * 0.14;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== ПЕРЕДНИЕ КОЛЁСА (полугусеничная схема) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.075, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.075, 0, Math.PI * 2);
    ctx.fill();
    // Ступицы
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.035, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.035, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== КОРПУС (со скошенным лбом, как у Ханомага) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.22);
    ctx.lineTo(-sz * 0.44, -sz * 0.22);
    ctx.lineTo( sz * 0.2, -sz * 0.22);
    ctx.lineTo( sz * 0.48, -sz * 0.1);
    ctx.lineTo( sz * 0.48,  sz * 0.1);
    ctx.lineTo( sz * 0.2,  sz * 0.22);
    ctx.lineTo(-sz * 0.44,  sz * 0.22);
    ctx.lineTo(-sz * 0.5,  sz * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ЗАКРЫТОЕ БРОНИРОВАННОЕ ОТДЕЛЕНИЕ (блиндирование — ключевая фишка) =====
    // Основной бронированный короб сверху
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.46, -sz * 0.2);   // задний левый верх
    ctx.lineTo(-sz * 0.44, -sz * 0.24);  // скошенный борт
    ctx.lineTo( sz * 0.06, -sz * 0.24);
    ctx.lineTo( sz * 0.14, -sz * 0.18);  // скос к рубке
    ctx.lineTo( sz * 0.14,  sz * 0.18);
    ctx.lineTo( sz * 0.06,  sz * 0.24);
    ctx.lineTo(-sz * 0.44,  sz * 0.24);
    ctx.lineTo(-sz * 0.46,  sz * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Рёбра жёсткости на броне (вертикальные линии)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, -sz * 0.24);
    ctx.lineTo(-sz * 0.3,  sz * 0.24);
    ctx.moveTo(-sz * 0.14, -sz * 0.24);
    ctx.lineTo(-sz * 0.14,  sz * 0.24);
    ctx.moveTo( sz * 0.0, -sz * 0.24);
    ctx.lineTo( sz * 0.0,  sz * 0.24);
    ctx.stroke();
    
    // ===== КРЫША БРОНИРОВАННОГО КОРОБА (плоская, со скошенными краями) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.24);
    ctx.lineTo( sz * 0.06, -sz * 0.24);
    ctx.lineTo( sz * 0.12, -sz * 0.28);
    ctx.lineTo(-sz * 0.4, -sz * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44,  sz * 0.24);
    ctx.lineTo( sz * 0.06,  sz * 0.24);
    ctx.lineTo( sz * 0.12,  sz * 0.28);
    ctx.lineTo(-sz * 0.4,  sz * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // ===== ПЕРЕДНЯЯ РУБКА (с наблюдательными щелями — как на картинке) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo( sz * 0.14, -sz * 0.18);
    ctx.lineTo( sz * 0.34, -sz * 0.14);
    ctx.lineTo( sz * 0.42, -sz * 0.06);
    ctx.lineTo( sz * 0.42,  sz * 0.06);
    ctx.lineTo( sz * 0.34,  sz * 0.14);
    ctx.lineTo( sz * 0.14,  sz * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Смотровые щели (характерные для блиндирования)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.22, -sz * 0.1, sz * 0.14, sz * 0.03);
    ctx.fillRect(sz * 0.22,  sz * 0.07, sz * 0.14, sz * 0.03);
    
    // ===== ПУЛЕМЁТНАЯ ТУРЕЛЬ (спереди на рубке) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.16, -sz * 0.05, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Пулемёт MG-42
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.16, -sz * 0.05);
    ctx.lineTo(sz * 0.5, -sz * 0.05);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.5, -sz * 0.05, sz * 0.014, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА (на скошенном лбе) =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.15, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ВЫХЛОПНАЯ ТРУБА (сбоку сзади) =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.46, -sz * 0.2);
    ctx.lineTo(-sz * 0.56, -sz * 0.28);
    ctx.stroke();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.06, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.06, sz * 0.12, sz * 0.1);
}
        // ===== СТРОИТЕЛЬНАЯ МАШИНА (Кран-манипулятор) =====
        if (u.type === 'construction_truck') {
            // Кабина
            ctx.fillStyle = '#f8fafc'; // Белая кабина
            ctx.fillRect(-sz * 0.45, -sz * 0.25, sz * 0.35, sz * 0.5);
            // Лобовое стекло
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(-sz * 0.35, -sz * 0.2, sz * 0.15, sz * 0.4);
            
            // Кузов
            ctx.fillStyle = '#6b7280'; // Серый кузов
            ctx.fillRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            
            // Красный кран
            ctx.fillStyle = '#dc2626';
            // Основание крана
            ctx.fillRect(-sz * 0.15, -sz * 0.1, sz * 0.1, sz * 0.2);
            // Стрела крана (повернута вперед)
            ctx.save();
            ctx.translate(-sz * 0.1, 0);
            ctx.rotate(Math.PI / 4); // Наклон
            ctx.fillRect(0, -sz * 0.04, sz * 0.4, sz * 0.08);
            ctx.restore();
            // Трос/крюк (просто линия)
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.1 + Math.cos(Math.PI/4)*sz*0.4, -Math.sin(Math.PI/4)*sz*0.4);
            ctx.lineTo(-sz * 0.1 + Math.cos(Math.PI/4)*sz*0.4, Math.sin(Math.PI/4)*sz*0.4);
            ctx.stroke();

            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Полоска запаса
            const cargoPct = u.currentCargo / u.cargoCapacity;
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-sz * 0.1, sz * 0.35, sz * 0.55 * cargoPct, 3);
        }

        // ===== ПОЖАРНАЯ МАШИНА (Красный ретро-грузовик) =====
        if (u.type === 'fire_truck') {
            // Кабина (красная, классическая)
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-sz * 0.45, -sz * 0.25, sz * 0.35, sz * 0.5);
            // Хромированная решетка
            ctx.fillStyle = '#d1d5db';
            ctx.fillRect(-sz * 0.48, -sz * 0.15, sz * 0.05, sz * 0.3);
            // Лобовое стекло
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(-sz * 0.35, -sz * 0.2, sz * 0.1, sz * 0.4);
            
            // Кузов (красный)
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            
            // Скатки рукавов (черные цилиндры) на крыше
            ctx.fillStyle = '#111';
            ctx.fillRect(-sz * 0.05, -sz * 0.25, sz * 0.45, sz * 0.06);
            ctx.fillRect(-sz * 0.05, sz * 0.19, sz * 0.45, sz * 0.06);
            
            // Мигалка (синяя/красная)
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(-sz * 0.2, -sz * 0.3, sz * 0.04, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(-sz * 0.2, sz * 0.3, sz * 0.04, 0, Math.PI * 2);
            ctx.fill();
            
            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Полоска воды
            const waterPct = u.currentCargo / u.cargoCapacity;
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(-sz * 0.1, sz * 0.35, sz * 0.55 * waterPct, 3);
        }

// ===== JAVELIN (американский M3 Half-track) =====
if (u.type === 'javelin') {
    // ===== ГУСЕНИЦЫ (полугусеничный — гусеницы сзади) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.5, -sz * 0.34, sz * 0.6, sz * 0.1);
    ctx.fillRect(-sz * 0.5, sz * 0.24, sz * 0.6, sz * 0.1);
    
    // Катки гусениц (4 штуки, сзади)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 4; i++) {
        const wx = -sz * 0.44 + i * sz * 0.14;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx, sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== ПЕРЕДНИЕ КОЛЁСА (характерная черта халф-трака) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.08, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Ступицы
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.038, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.038, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== КОРПУС (коробчатый, с наклонным лбом как у M3) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.22);
    ctx.lineTo( sz * 0.1, -sz * 0.22);    // верхняя часть моторного отсека
    ctx.lineTo( sz * 0.28, -sz * 0.14);   // наклонный лоб (верх)
    ctx.lineTo( sz * 0.48, -sz * 0.14);   // капот
    ctx.lineTo( sz * 0.48,  sz * 0.14);   // капот (низ)
    ctx.lineTo( sz * 0.28,  sz * 0.14);
    ctx.lineTo( sz * 0.1,  sz * 0.22);    // низ лба
    ctx.lineTo(-sz * 0.5,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== КАБИНА (открытая сверху, характерна для M3) =====
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-sz * 0.2, -sz * 0.18, sz * 0.35, sz * 0.36);
    
    // Борта кабины
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.2, -sz * 0.18);
    ctx.lineTo(-sz * 0.2, sz * 0.18);
    ctx.moveTo( sz * 0.15, -sz * 0.18);
    ctx.lineTo( sz * 0.15, sz * 0.18);
    ctx.stroke();
    
    // ===== ПУЛЕМЁТНАЯ ТУРЕЛЬ (на крыше кабины, как M2 Browning) =====
    // Основание кольца турели
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.02, 0, sz * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Кожух пулемёта M2 .50 cal
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(-sz * 0.02, 0, sz * 0.05, 0, Math.PI * 2);
    ctx.fill();
    
    // Ствол M2
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.02, 0);
    ctx.lineTo(sz * 0.48, 0);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.48, 0, sz * 0.018, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА (на капоте) =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.08, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== РЕШЁТКА РАДИАТОРА (на капоте) =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const ry = -sz * 0.1 + i * sz * 0.08;
        ctx.beginPath();
        ctx.moveTo(sz * 0.3, ry);
        ctx.lineTo(sz * 0.46, ry);
        ctx.stroke();
    }
    
    // ===== ВЫХЛОПНАЯ ТРУБА =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.2);
    ctx.lineTo(-sz * 0.52, -sz * 0.28);
    ctx.stroke();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.48, sz * 0.04, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.48, sz * 0.04, sz * 0.14, sz * 0.12);
}
 // ===== BREN SQUIRE (РСЗО, Вардены) =====
// ===== BREN SQUIRE (РСЗО, Wardens) =====
// Силуэт: колёсный БА-27-подобный, угловатый корпус,
// на башне — чёрная рама с белыми ракетами.
if (u.type === 'bren_squire') {
    // ===== КОЛЁСА (4 шт., вне корпуса) =====
    ctx.fillStyle = '#111';
    for (const [wx, wy] of [
        [-sz * 0.32, -sz * 0.42], [sz * 0.32, -sz * 0.42],
        [-sz * 0.32,  sz * 0.42], [sz * 0.32,  sz * 0.42],
    ]) {
        ctx.beginPath();
        ctx.arc(wx, wy, sz * 0.12, 0, Math.PI * 2);
        ctx.fill();
        // ступица
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(wx, wy, sz * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
    }

    // ===== КОРПУС (угловатый, как у БА-27) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.26);       // корма
    ctx.lineTo( sz * 0.28, -sz * 0.26);      // верх борта
    ctx.lineTo( sz * 0.46, -sz * 0.12);      // скошенный лоб
    ctx.lineTo( sz * 0.46,  sz * 0.12);
    ctx.lineTo( sz * 0.28,  sz * 0.26);
    ctx.lineTo(-sz * 0.5,   sz * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== КАПОТ / РЕШЁТКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo( sz * 0.26, -sz * 0.2);
    ctx.lineTo( sz * 0.44, -sz * 0.08);
    ctx.lineTo( sz * 0.44,  sz * 0.08);
    ctx.lineTo( sz * 0.26,  sz * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.stroke();
    // вертикальные рёбра решётки
    for (let i = 0; i < 3; i++) {
        const rx = sz * 0.3 + i * sz * 0.045;
        ctx.beginPath();
        ctx.moveTo(rx, -sz * 0.16);
        ctx.lineTo(rx,  sz * 0.16);
        ctx.stroke();
    }

    // ===== МАЛЕНЬКАЯ БАШНЯ (как у БА-27) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.1, 0, sz * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // люк
    ctx.beginPath();
    ctx.arc(-sz * 0.1, 0, sz * 0.08, 0, Math.PI * 2);
    ctx.stroke();

    // ===== РАКЕТНАЯ УСТАНОВКА НА БАШНЕ =====
    // Чёрная П-образная рама (направляющие) — «рельсы»
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    // вертикальные стойки рамы
    ctx.beginPath();
    ctx.moveTo(-sz * 0.32, -sz * 0.14);
    ctx.lineTo(-sz * 0.32,  sz * 0.14);
    ctx.moveTo( sz * 0.06, -sz * 0.14);
    ctx.lineTo( sz * 0.06,  sz * 0.14);
    ctx.stroke();
    // поперечные рельсы (4 шт.)
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
        const ry = -sz * 0.12 + i * sz * 0.08;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.34, ry);
        ctx.lineTo( sz * 0.08, ry);
        ctx.stroke();
    }

    // ===== БЕЛЫЕ РАКЕТЫ на раме (2 в ряд × 4 яруса) =====
    for (let row = 0; row < 4; row++) {
        const ry = -sz * 0.12 + row * sz * 0.08;
        for (const rx of [-sz * 0.24, -sz * 0.02]) {
            // корпус ракеты
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(rx - sz * 0.04, ry - sz * 0.025, sz * 0.08, sz * 0.05);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 0.7;
            ctx.strokeRect(rx - sz * 0.04, ry - sz * 0.025, sz * 0.08, sz * 0.05);
            // красный носик (боеголовка)
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(rx + sz * 0.04, ry - sz * 0.025);
            ctx.lineTo(rx + sz * 0.07, ry);
            ctx.lineTo(rx + sz * 0.04, ry + sz * 0.025);
            ctx.closePath();
            ctx.fill();
            // хвостовые стабилизаторы
            ctx.fillStyle = '#64748b';
            ctx.fillRect(rx - sz * 0.05, ry - sz * 0.035, sz * 0.012, sz * 0.07);
        }
    }

    // ===== ФАРА (спереди) =====
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.arc(sz * 0.42,  sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // ===== ЯЩИК ЗИП на корме =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.48, sz * 0.04, sz * 0.1, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.48, sz * 0.04, sz * 0.1, sz * 0.1);
}

// ===== XIPHOS (T3, Colonials) =====
// Силуэт: удлинённый колёсный корпус типа M6 Staghound,
// МАЛЕНЬКАЯ башня (Greyhound-стиль), СПАРЕННЫЙ пулемёт.
if (u.type === 'xiphos') {
    // ===== КОЛЁСА (4 шт., вынесены за корпус) =====
    ctx.fillStyle = '#111';
    for (const [wx, wy] of [
        [-sz * 0.36, -sz * 0.44], [sz * 0.3, -sz * 0.44],
        [-sz * 0.36,  sz * 0.44], [sz * 0.3,  sz * 0.44],
    ]) {
        ctx.beginPath();
        ctx.arc(wx, wy, sz * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(wx, wy, sz * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
    }

    // ===== УДЛИНЁННЫЙ КОРПУС (Staghound) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.56, -sz * 0.24);      // корма
    ctx.lineTo( sz * 0.32, -sz * 0.24);
    ctx.quadraticCurveTo(sz * 0.52, -sz * 0.24, sz * 0.54, -sz * 0.08);
    ctx.lineTo( sz * 0.54,  sz * 0.08);
    ctx.quadraticCurveTo(sz * 0.52,  sz * 0.24, sz * 0.32,  sz * 0.24);
    ctx.lineTo(-sz * 0.56,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== КАПОТ / РЕШЁТКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo( sz * 0.32, -sz * 0.16);
    ctx.lineTo( sz * 0.5, -sz * 0.06);
    ctx.lineTo( sz * 0.5,  sz * 0.06);
    ctx.lineTo( sz * 0.32,  sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
        const rx = sz * 0.36 + i * sz * 0.045;
        ctx.beginPath();
        ctx.moveTo(rx, -sz * 0.12);
        ctx.lineTo(rx,  sz * 0.12);
        ctx.stroke();
    }

    // ===== МАЛЕНЬКАЯ БАШНЯ (Greyhound-стиль) =====
    // Сдвинута ближе к центру-корме — Staghound-фишка.
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.14, 0, sz * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // люк сверху
    ctx.beginPath();
    ctx.arc(-sz * 0.14, 0, sz * 0.07, 0, Math.PI * 2);
    ctx.stroke();
    // командирская башенка сзади
    ctx.beginPath();
    ctx.arc(-sz * 0.24, -sz * 0.04, sz * 0.035, 0, Math.PI * 2);
    ctx.stroke();

    // ===== СПАРЕННЫЙ ПУЛЕМЁТ =====
    // Маска (небольшая сфера)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.02, 0, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Два ствола параллельно
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sz * 0.06, -sz * 0.03);
    ctx.lineTo(sz * 0.52, -sz * 0.03);
    ctx.moveTo(sz * 0.06,  sz * 0.03);
    ctx.lineTo(sz * 0.52,  sz * 0.03);
    ctx.stroke();
    // Дульные срезы
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.52, -sz * 0.03, sz * 0.012, 0, Math.PI * 2);
    ctx.arc(sz * 0.52,  sz * 0.03, sz * 0.012, 0, Math.PI * 2);
    ctx.fill();

    // ===== ФАРА =====
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sz * 0.46, -sz * 0.16, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();

    // ===== ЯЩИК ЗИП на борту =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.44, sz * 0.04, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.44, sz * 0.04, sz * 0.12, sz * 0.1);
}

// ===== PERCUTIO (T5, Colonials) =====
// Тот же силуэт, что Xiphos (удлинённый корпус, маленькая башня),
// НО: башня ОТКРЫТАЯ сверху, вооружение — длинное ПТ-ружьё.
if (u.type === 'percutio') {
    // ===== КОЛЁСА =====
    ctx.fillStyle = '#111';
    for (const [wx, wy] of [
        [-sz * 0.36, -sz * 0.44], [sz * 0.3, -sz * 0.44],
        [-sz * 0.36,  sz * 0.44], [sz * 0.3,  sz * 0.44],
    ]) {
        ctx.beginPath();
        ctx.arc(wx, wy, sz * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(wx, wy, sz * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
    }

    // ===== УДЛИНЁННЫЙ КОРПУС =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.56, -sz * 0.24);
    ctx.lineTo( sz * 0.32, -sz * 0.24);
    ctx.quadraticCurveTo(sz * 0.52, -sz * 0.24, sz * 0.54, -sz * 0.08);
    ctx.lineTo( sz * 0.54,  sz * 0.08);
    ctx.quadraticCurveTo(sz * 0.52,  sz * 0.24, sz * 0.32,  sz * 0.24);
    ctx.lineTo(-sz * 0.56,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ===== КАПОТ / РЕШЁТКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo( sz * 0.32, -sz * 0.16);
    ctx.lineTo( sz * 0.5, -sz * 0.06);
    ctx.lineTo( sz * 0.5,  sz * 0.06);
    ctx.lineTo( sz * 0.32,  sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
        const rx = sz * 0.36 + i * sz * 0.045;
        ctx.beginPath();
        ctx.moveTo(rx, -sz * 0.12);
        ctx.lineTo(rx,  sz * 0.12);
        ctx.stroke();
    }

    // ===== МАЛЕНЬКАЯ ОТКРЫТАЯ БАШНЯ (на том же месте, что у Xiphos) =====
    // Внешний корпус (полукольцо, т.к. сверху открыто)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.14, 0, sz * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Внутреннее «открытое» пространство — тёмное
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-sz * 0.14, 0, sz * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Командирская башенка сзади (закрытая — маленький кружок)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.25, -sz * 0.04, sz * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ===== ДЛИННОЕ ПТ-РУЖЬЁ =====
    // Маска (небольшая)
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(sz * 0.02, 0, sz * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Длинный ствол (толще, чем у пулемётов)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sz * 0.06, 0);
    ctx.lineTo(sz * 0.66, 0);
    ctx.stroke();
    // Дульный тормоз (характерный для ПТ)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.6, -sz * 0.04, sz * 0.08, sz * 0.08);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(sz * 0.6, -sz * 0.04, sz * 0.08, sz * 0.08);

    // ===== ФАРА =====
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sz * 0.46, -sz * 0.16, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();

    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.44, sz * 0.04, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.44, sz * 0.04, sz * 0.12, sz * 0.1);
}
// ===== HOPLITE (шасси Javelin, миномёт на корме, ствол смотрит вперёд к кабине) =====
if (u.type === 'hoplite') {
    // ===== ГУСЕНИЦЫ (полугусеничный — гусеницы сзади) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.5, -sz * 0.34, sz * 0.6, sz * 0.1);
    ctx.fillRect(-sz * 0.5,  sz * 0.24, sz * 0.6, sz * 0.1);
    
    // Катки гусениц (4 штуки)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 4; i++) {
        const wx = -sz * 0.44 + i * sz * 0.14;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.29, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== ПЕРЕДНИЕ КОЛЁСА (халф-трак) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.08, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(sz * 0.36, -sz * 0.3, sz * 0.038, 0, Math.PI * 2);
    ctx.arc(sz * 0.36,  sz * 0.3, sz * 0.038, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== КОРПУС JAVELIN =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.22);
    ctx.lineTo( sz * 0.1, -sz * 0.22);
    ctx.lineTo( sz * 0.28, -sz * 0.14);
    ctx.lineTo( sz * 0.48, -sz * 0.14);
    ctx.lineTo( sz * 0.48,  sz * 0.14);
    ctx.lineTo( sz * 0.28,  sz * 0.14);
    ctx.lineTo( sz * 0.1,  sz * 0.22);
    ctx.lineTo(-sz * 0.5,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== КАБИНА (открытая) =====
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-sz * 0.2, -sz * 0.18, sz * 0.35, sz * 0.36);
    
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.2, -sz * 0.18);
    ctx.lineTo(-sz * 0.2,  sz * 0.18);
    ctx.moveTo( sz * 0.15, -sz * 0.18);
    ctx.lineTo( sz * 0.15,  sz * 0.18);
    ctx.stroke();
    
    // ===== РЕШЁТКА РАДИАТОРА =====
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const ry = -sz * 0.1 + i * sz * 0.08;
        ctx.beginPath();
        ctx.moveTo(sz * 0.3, ry);
        ctx.lineTo(sz * 0.46, ry);
        ctx.stroke();
    }
    
    // ===== МИНОМЁТ НА КОРМЕ (ствол смотрит ВПЕРЁД, к кабине) =====
    // Плита-основание на корме
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.48, 0, sz * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол миномёта — направлен ВПЕРЁД (к кабине), вдоль кузова
    // Немного приподнят вверх
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.46, -sz * 0.02);
    ctx.lineTo(-sz * 0.06, -sz * 0.18);   // вперёд + вверх
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-sz * 0.06, -sz * 0.18, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // Сошки/опора миномёта (позади ствола, у кормы)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, -sz * 0.1);
    ctx.lineTo(-sz * 0.42, sz * 0.06);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.08, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.48, sz * 0.04, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.48, sz * 0.04, sz * 0.14, sz * 0.12);
}
// ===== DEVITT MMR (шасси Devitt, открытая башня, миномёт вместо орудия) =====
if (u.type === 'devitt_mmr') {
    // ===== ГУСЕНИЦЫ =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.46, -sz * 0.32, sz * 0.92, sz * 0.1);
    ctx.fillRect(-sz * 0.46,  sz * 0.22, sz * 0.92, sz * 0.1);
    
    // Катки (5 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 5; i++) {
        const wx = -sz * 0.38 + i * sz * 0.19;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.27, sz * 0.032, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.27, sz * 0.032, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.48, -sz * 0.22);
    ctx.lineTo(-sz * 0.4, -sz * 0.24);
    ctx.lineTo( sz * 0.34, -sz * 0.24);
    ctx.quadraticCurveTo(sz * 0.46, -sz * 0.24, sz * 0.48, -sz * 0.14);
    ctx.lineTo( sz * 0.48,  sz * 0.14);
    ctx.quadraticCurveTo(sz * 0.46,  sz * 0.24, sz * 0.34,  sz * 0.24);
    ctx.lineTo(-sz * 0.4,  sz * 0.24);
    ctx.lineTo(-sz * 0.48,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ПЕРЕДНЯЯ НАДСТРОЙКА =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.16, -sz * 0.24);
    ctx.lineTo( sz * 0.18, -sz * 0.24);
    ctx.lineTo( sz * 0.28, -sz * 0.16);
    ctx.lineTo( sz * 0.28,  sz * 0.16);
    ctx.lineTo( sz * 0.18,  sz * 0.24);
    ctx.lineTo(-sz * 0.16,  sz * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ОТКРЫТАЯ БАШНЯ (смещена вперёд, с полной обводкой) =====
    // Смещение вперёд: центр башни на sz * 0.08
    const tcx = sz * 0.08;
    
    // Внешний контур башни
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(tcx, 0, sz * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Внутреннее открытое пространство
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(tcx, 0, sz * 0.18, 0, Math.PI * 2);
    ctx.fill();
    
    // Внутренняя обводка (борта башни) — теперь тоже col.a
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tcx, 0, sz * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== МИНОМЁТ (в открытой башне) =====
    // Опора плиты
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(tcx - sz * 0.02, sz * 0.02, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Ствол миномёта
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(tcx - sz * 0.02, sz * 0.02);
    ctx.lineTo(tcx + sz * 0.28, -sz * 0.28);
    ctx.stroke();
    
    // Дульный срез
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(tcx + sz * 0.28, -sz * 0.28, sz * 0.02, 0, Math.PI * 2);
    ctx.fill();
    
    // Сошки/опора
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tcx + sz * 0.04, -sz * 0.08);
    ctx.lineTo(tcx - sz * 0.14, sz * 0.1);
    ctx.stroke();
    
    // ===== КРУГЛЫЙ ЭЛЕМЕНТ НА КОРПУСЕ =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.32, -sz * 0.02, sz * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.fillStyle = col.a;
    ctx.beginPath();
    ctx.arc(-sz * 0.32, -sz * 0.02, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.42, sz * 0.02, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.42, sz * 0.02, sz * 0.12, sz * 0.1);
}
// ===== GOD LOADER 200mm (тяжёлая САУ на шасси типа Karl) =====
if (u.type === 'god_loader') {
    // ===== ШИРОКИЕ ГУСЕНИЦЫ (тяжёлое шасси — как у Karl-Gerät) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.6, -sz * 0.42, sz * 1.2, sz * 0.12);
    ctx.fillRect(-sz * 0.6,  sz * 0.3,  sz * 1.2, sz * 0.12);
    
    // Траки (крупные сегменты)
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        const tx = -sz * 0.6 + i * (sz * 1.2 / 12);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.42); ctx.lineTo(tx, -sz * 0.3);
        ctx.moveTo(tx,  sz * 0.3);  ctx.lineTo(tx,  sz * 0.42);
        ctx.stroke();
    }
    
    // Катки (7 штук, крупные)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 7; i++) {
        const wx = -sz * 0.5 + i * sz * 0.167;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.36, sz * 0.05, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.36, sz * 0.05, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (массивный, прямоугольный — как у Karl) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.58, -sz * 0.3);
    ctx.lineTo( sz * 0.3, -sz * 0.3);
    ctx.lineTo( sz * 0.52, -sz * 0.2);
    ctx.lineTo( sz * 0.52,  sz * 0.2);
    ctx.lineTo( sz * 0.3,  sz * 0.3);
    ctx.lineTo(-sz * 0.58,  sz * 0.3);
    ctx.lineTo(-sz * 0.62,  sz * 0.22);
    ctx.lineTo(-sz * 0.62, -sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Заклёпки по бортам (характерно для Karl)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const rx = -sz * 0.5 + i * sz * 0.2;
        ctx.beginPath();
        ctx.moveTo(rx, -sz * 0.3);
        ctx.lineTo(rx, -sz * 0.24);
        ctx.moveTo(rx,  sz * 0.24);
        ctx.lineTo(rx,  sz * 0.3);
        ctx.stroke();
    }
    
    // ===== ОТКРЫТАЯ РУБКА (характерна для Karl) =====
    // Внутреннее тёмное пространство
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.42, -sz * 0.22);
    ctx.lineTo( sz * 0.1, -sz * 0.22);
    ctx.lineTo( sz * 0.16, -sz * 0.14);
    ctx.lineTo( sz * 0.16,  sz * 0.14);
    ctx.lineTo( sz * 0.1,  sz * 0.22);
    ctx.lineTo(-sz * 0.42,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    
    // Борта рубки
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.42, -sz * 0.22);
    ctx.lineTo(-sz * 0.42,  sz * 0.22);
    ctx.moveTo( sz * 0.1, -sz * 0.22);
    ctx.lineTo( sz * 0.16, -sz * 0.14);
    ctx.lineTo( sz * 0.16,  sz * 0.14);
    ctx.lineTo( sz * 0.1,  sz * 0.22);
    ctx.stroke();
    
    // ===== МАСКА ОРУДИЯ (массивная, в передней части рубки) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo( sz * 0.16, -sz * 0.2);
    ctx.lineTo( sz * 0.3,  -sz * 0.16);
    ctx.lineTo( sz * 0.34, -sz * 0.08);
    ctx.lineTo( sz * 0.34,  sz * 0.08);
    ctx.lineTo( sz * 0.3,   sz * 0.16);
    ctx.lineTo( sz * 0.16,  sz * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // ===== ДЛИННОЕ ОРУДИЕ 200мм =====
    // Ствол (длинный, толстый)
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sz * 0.32, 0);
    ctx.lineTo(sz * 1.05, 0);
    ctx.stroke();
    
    // Утолщение у основания ствола
    ctx.fillStyle = col.s;
    ctx.fillRect(sz * 0.32, -sz * 0.05, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sz * 0.32, -sz * 0.05, sz * 0.12, sz * 0.1);
    
    // Дульный тормоз (массивный, характерный для тяжёлых орудий)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.94, -sz * 0.07, sz * 0.14, sz * 0.14);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sz * 0.94, -sz * 0.07, sz * 0.14, sz * 0.14);
    
    // Отверстия дульного тормоза
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(sz * 0.97, -sz * 0.04, sz * 0.03, sz * 0.08);
    ctx.fillRect(sz * 1.02, -sz * 0.04, sz * 0.03, sz * 0.08);
    
    // ===== ПРОТИВООТКАТНЫЕ УПОРЫ (характерны для Karl — опускаются сзади) =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.58, sz * 0.22);
    ctx.lineTo(-sz * 0.72, sz * 0.34);
    ctx.moveTo(-sz * 0.58, -sz * 0.22);
    ctx.lineTo(-sz * 0.72, -sz * 0.34);
    ctx.stroke();
    
    // Опорные плиты упоров
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.78, sz * 0.28, sz * 0.08, sz * 0.12);
    ctx.fillRect(-sz * 0.78, -sz * 0.4, sz * 0.08, sz * 0.12);
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА (сзади на рубке) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.3, -sz * 0.08, sz * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Люк
    ctx.beginPath();
    ctx.arc(-sz * 0.3, -sz * 0.08, sz * 0.035, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.5, -sz * 0.16, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.54, sz * 0.08, sz * 0.16, sz * 0.14);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.54, sz * 0.08, sz * 0.16, sz * 0.14);
    
    // ===== ЗАРЯДЫ / СНАРЯДЫ (открыто лежат на корме — характерно для САУ) =====
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-sz * 0.5, -sz * 0.12, sz * 0.08, sz * 0.1);
    ctx.fillRect(-sz * 0.5, -sz * 0.0,  sz * 0.08, sz * 0.1);
    ctx.fillRect(-sz * 0.5,  sz * 0.12, sz * 0.08, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.5, -sz * 0.12, sz * 0.08, sz * 0.1);
    ctx.strokeRect(-sz * 0.5, -sz * 0.0,  sz * 0.08, sz * 0.1);
    ctx.strokeRect(-sz * 0.5,  sz * 0.12, sz * 0.08, sz * 0.1);
}     
        // Ствольная артиллерия (все калибры обеих фракций) — гаубичный ствол
// ===== WARDEN ARTILLERY 120 (объект 261 на базе ИС-7) =====
// ===== WARDEN ARTILLERY 120 (объект 261) =====
if (u.type === 'warden_artillery120') {
    // ===== ГУСЕНИЦЫ (широкие, тяжёлые — от ИС-7) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.56, -sz * 0.38, sz * 1.12, sz * 0.11);
    ctx.fillRect(-sz * 0.56,  sz * 0.27, sz * 1.12, sz * 0.11);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        const tx = -sz * 0.56 + i * (sz * 1.12 / 12);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.38); ctx.lineTo(tx, -sz * 0.27);
        ctx.moveTo(tx,  sz * 0.27); ctx.lineTo(tx,  sz * 0.38);
        ctx.stroke();
    }
    
    // Катки (7 штук — длинное шасси ИС-7)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 7; i++) {
        const wx = -sz * 0.48 + i * sz * 0.16;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.325, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.325, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС («щучий нос» ИС-7) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.54, -sz * 0.26);
    ctx.lineTo(-sz * 0.44, -sz * 0.26);
    ctx.lineTo( sz * 0.28, -sz * 0.26);
    ctx.lineTo( sz * 0.5,  -sz * 0.12);
    ctx.lineTo( sz * 0.52, 0);
    ctx.lineTo( sz * 0.5,   sz * 0.12);
    ctx.lineTo( sz * 0.28,  sz * 0.26);
    ctx.lineTo(-sz * 0.44,  sz * 0.26);
    ctx.lineTo(-sz * 0.54,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== МАССИВНАЯ ЗАКРЫТАЯ РУБКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.38, -sz * 0.24);
    ctx.lineTo( sz * 0.08, -sz * 0.24);
    ctx.lineTo( sz * 0.18, -sz * 0.18);
    ctx.lineTo( sz * 0.18,  sz * 0.18);
    ctx.lineTo( sz * 0.08,  sz * 0.24);
    ctx.lineTo(-sz * 0.38,  sz * 0.24);
    ctx.lineTo(-sz * 0.42,  sz * 0.16);
    ctx.lineTo(-sz * 0.42, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Рёбра на рубке
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.24, -sz * 0.24);
    ctx.lineTo(-sz * 0.24,  sz * 0.24);
    ctx.moveTo(-sz * 0.08, -sz * 0.24);
    ctx.lineTo(-sz * 0.08,  sz * 0.24);
    ctx.stroke();
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.24, -sz * 0.08, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(-sz * 0.24, -sz * 0.08, sz * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== ОРУДИЕ 120мм (длинный ствол, lineWidth 4) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.16, -sz * 0.13);
    ctx.lineTo(sz * 0.28, -sz * 0.1);
    ctx.lineTo(sz * 0.28,  sz * 0.1);
    ctx.lineTo(sz * 0.16,  sz * 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sz * 0.26, 0);
    ctx.lineTo(sz * 0.92, 0);
    ctx.stroke();
    
    // Дульный тормоз
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.84, -sz * 0.06, sz * 0.1, sz * 0.12);
    
    // ===== СОШКИ =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.42, -sz * 0.1);
    ctx.lineTo(-sz * 0.56, -sz * 0.22);
    ctx.moveTo(-sz * 0.42,  sz * 0.1);
    ctx.lineTo(-sz * 0.56,  sz * 0.22);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.46, -sz * 0.16, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.5, sz * 0.04, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.5, sz * 0.04, sz * 0.12, sz * 0.1);
}

// ===== WARDEN ARTILLERY 150 (Б-4) — та же модель, только ствол толще =====
if (u.type === 'warden_artillery150') {
    // ===== ГУСЕНИЦЫ (идентичны 120) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.56, -sz * 0.38, sz * 1.12, sz * 0.11);
    ctx.fillRect(-sz * 0.56,  sz * 0.27, sz * 1.12, sz * 0.11);
    
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        const tx = -sz * 0.56 + i * (sz * 1.12 / 12);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.38); ctx.lineTo(tx, -sz * 0.27);
        ctx.moveTo(tx,  sz * 0.27); ctx.lineTo(tx,  sz * 0.38);
        ctx.stroke();
    }
    
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 7; i++) {
        const wx = -sz * 0.48 + i * sz * 0.16;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.325, sz * 0.038, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.325, sz * 0.038, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (идентичен 120) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.54, -sz * 0.26);
    ctx.lineTo(-sz * 0.44, -sz * 0.26);
    ctx.lineTo( sz * 0.28, -sz * 0.26);
    ctx.lineTo( sz * 0.5,  -sz * 0.12);
    ctx.lineTo( sz * 0.52, 0);
    ctx.lineTo( sz * 0.5,   sz * 0.12);
    ctx.lineTo( sz * 0.28,  sz * 0.26);
    ctx.lineTo(-sz * 0.44,  sz * 0.26);
    ctx.lineTo(-sz * 0.54,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== РУБКА (идентична 120) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.38, -sz * 0.24);
    ctx.lineTo( sz * 0.08, -sz * 0.24);
    ctx.lineTo( sz * 0.18, -sz * 0.18);
    ctx.lineTo( sz * 0.18,  sz * 0.18);
    ctx.lineTo( sz * 0.08,  sz * 0.24);
    ctx.lineTo(-sz * 0.38,  sz * 0.24);
    ctx.lineTo(-sz * 0.42,  sz * 0.16);
    ctx.lineTo(-sz * 0.42, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.24, -sz * 0.24);
    ctx.lineTo(-sz * 0.24,  sz * 0.24);
    ctx.moveTo(-sz * 0.08, -sz * 0.24);
    ctx.lineTo(-sz * 0.08,  sz * 0.24);
    ctx.stroke();
    
    // ===== КОМАНДИРСКАЯ БАШЕНКА =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.arc(-sz * 0.24, -sz * 0.08, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(-sz * 0.24, -sz * 0.08, sz * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== ОРУДИЕ 150мм (КОРОТКИЙ ТОЛСТЫЙ ствол, lineWidth 5) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.16, -sz * 0.14);
    ctx.lineTo(sz * 0.28, -sz * 0.11);
    ctx.lineTo(sz * 0.28,  sz * 0.11);
    ctx.lineTo(sz * 0.16,  sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Короткий толстый ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.26, 0);
    ctx.lineTo(sz * 0.78, 0);
    ctx.stroke();
    
    // Массивный дульный тормоз
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.7, -sz * 0.08, sz * 0.12, sz * 0.16);
    
    // ===== СОШКИ =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.42, -sz * 0.1);
    ctx.lineTo(-sz * 0.56, -sz * 0.22);
    ctx.moveTo(-sz * 0.42,  sz * 0.1);
    ctx.lineTo(-sz * 0.56,  sz * 0.22);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.46, -sz * 0.16, sz * 0.022, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.5, sz * 0.04, sz * 0.12, sz * 0.1);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.5, sz * 0.04, sz * 0.12, sz * 0.1);
}

// ===== COLONIAL ARTILLERY 120 (M40/M43 на базе M12) =====
if (u.type === 'colonial_artillery120') {
    // ===== ГУСЕНИЦЫ (американские — от M12) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.52, -sz * 0.36, sz * 1.04, sz * 0.1);
    ctx.fillRect(-sz * 0.52,  sz * 0.26, sz * 1.04, sz * 0.1);
    
    // Траки
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.52 + i * (sz * 1.04 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.36); ctx.lineTo(tx, -sz * 0.26);
        ctx.moveTo(tx,  sz * 0.26); ctx.lineTo(tx,  sz * 0.36);
        ctx.stroke();
    }
    
    // Катки (6 штук)
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 6; i++) {
        const wx = -sz * 0.44 + i * sz * 0.176;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.31, sz * 0.04, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.31, sz * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (M12) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);
    ctx.lineTo( sz * 0.3, -sz * 0.24);
    ctx.lineTo( sz * 0.46, -sz * 0.14);
    ctx.lineTo( sz * 0.46,  sz * 0.14);
    ctx.lineTo( sz * 0.3,  sz * 0.24);
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.lineTo(-sz * 0.52,  sz * 0.16);
    ctx.lineTo(-sz * 0.52, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== ОТКРЫТАЯ РУБКА (M40/M43) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.34, -sz * 0.22);
    ctx.lineTo( sz * 0.06, -sz * 0.22);
    ctx.lineTo( sz * 0.14, -sz * 0.16);
    ctx.lineTo( sz * 0.14,  sz * 0.16);
    ctx.lineTo( sz * 0.06,  sz * 0.22);
    ctx.lineTo(-sz * 0.34,  sz * 0.22);
    ctx.lineTo(-sz * 0.38,  sz * 0.14);
    ctx.lineTo(-sz * 0.38, -sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Внутреннее открытое пространство
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, -sz * 0.16);
    ctx.lineTo( sz * 0.02, -sz * 0.16);
    ctx.lineTo( sz * 0.08, -sz * 0.12);
    ctx.lineTo( sz * 0.08,  sz * 0.12);
    ctx.lineTo( sz * 0.02,  sz * 0.16);
    ctx.lineTo(-sz * 0.3,  sz * 0.16);
    ctx.lineTo(-sz * 0.32,  sz * 0.1);
    ctx.lineTo(-sz * 0.32, -sz * 0.1);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== 120мм ОРУДИЕ (средний ствол, lineWidth 4) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.1, -sz * 0.14);
    ctx.lineTo(sz * 0.22, -sz * 0.11);
    ctx.lineTo(sz * 0.22,  sz * 0.11);
    ctx.lineTo(sz * 0.1,  sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sz * 0.2, 0);
    ctx.lineTo(sz * 0.8, 0);
    ctx.stroke();
    
    // Дульный тормоз
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.72, -sz * 0.06, sz * 0.1, sz * 0.12);
    
    // Противооткатные устройства
    ctx.strokeStyle = col.p;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.24, sz * 0.05);
    ctx.lineTo(sz * 0.5, sz * 0.05);
    ctx.stroke();
    
    // ===== СОШКИ =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, -sz * 0.1);
    ctx.lineTo(-sz * 0.54, -sz * 0.22);
    ctx.moveTo(-sz * 0.4,  sz * 0.1);
    ctx.lineTo(-sz * 0.54,  sz * 0.22);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.04, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.04, sz * 0.14, sz * 0.12);
}
// ===== WARDEN SCOUT CAR (O'Brien V.130) =====
if (u.type === 'warden_scout_car') {
    // Гусеницы / колёса (скрыты бронекорпусом, видны только снизу)
    ctx.fillStyle = '#111';
    ctx.fillRect(-sz * 0.35, -sz * 0.4, sz * 0.2, sz * 0.12); // переднее левое
    ctx.fillRect( sz * 0.15, -sz * 0.4, sz * 0.2, sz * 0.12); // переднее правое
    ctx.fillRect(-sz * 0.35,  sz * 0.28, sz * 0.2, sz * 0.12); // заднее левое
    ctx.fillRect( sz * 0.15,  sz * 0.28, sz * 0.2, sz * 0.12); // заднее правое

    // Основной угловатый корпус (цвет Варденов - сине-серый)
    ctx.fillStyle = '#4b5563'; // Темно-серый
    ctx.beginPath();
    ctx.moveTo(-sz * 0.45, -sz * 0.3); // корма
    ctx.lineTo( sz * 0.4, -sz * 0.3);  // крыша
    ctx.lineTo( sz * 0.55, -sz * 0.15); // скошенный капот
    ctx.lineTo( sz * 0.55,  sz * 0.15);
    ctx.lineTo( sz * 0.4,  sz * 0.3);
    ctx.lineTo(-sz * 0.45,  sz * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1f2937'; // Обводка
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Крыша (светло-коричневая, как брезент на референсе)
    ctx.fillStyle = '#d4a373'; 
    ctx.beginPath();
    ctx.moveTo(-sz * 0.35, -sz * 0.22);
    ctx.lineTo( sz * 0.15, -sz * 0.22);
    ctx.lineTo( sz * 0.25, -sz * 0.05);
    ctx.lineTo( sz * 0.25,  sz * 0.05);
    ctx.lineTo( sz * 0.15,  sz * 0.22);
    ctx.lineTo(-sz * 0.35,  sz * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a67c52'; // Шов брезента
    ctx.lineWidth = 1;
    ctx.stroke();

    // Лобовое стекло / бронещиток (спереди)
    ctx.fillStyle = '#93c5fd'; // Голубое стекло
    ctx.beginPath();
    ctx.moveTo(sz * 0.2, -sz * 0.18);
    ctx.lineTo(sz * 0.35, -sz * 0.1);
    ctx.lineTo(sz * 0.35,  sz * 0.1);
    ctx.lineTo(sz * 0.2,  sz * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4b5563';
    ctx.stroke();

    // Задняя часть: Канистра с красным крестом/огнетушитель (характерная деталь)
    ctx.fillStyle = '#991b1b'; // Темно-красный
    ctx.beginPath();
    ctx.arc(-sz * 0.42, -sz * 0.15, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Задний ящик ЗИП / рация
    ctx.fillStyle = '#374151';
    ctx.fillRect(-sz * 0.5, sz * 0.05, sz * 0.1, sz * 0.15);
    ctx.strokeStyle = '#111';
    ctx.strokeRect(-sz * 0.5, sz * 0.05, sz * 0.1, sz * 0.15);

    // Длинная антенна
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.45, -sz * 0.2);
    ctx.lineTo(-sz * 0.65, -sz * 0.4); // Антенна торчит назад-влево
    ctx.stroke();

    }
// ===== COLONIAL SCOUT CAR (UV-05 Foxhole) =====
if (u.type === 'colonial_scout_car') {
    // Колёса (открытые, вне корпуса)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc( sz * 0.3, -sz * 0.38, sz * 0.08, 0, Math.PI * 2); // переднее левое
    ctx.arc( sz * 0.3,  sz * 0.38, sz * 0.08, 0, Math.PI * 2); // переднее правое
    ctx.arc(-sz * 0.3, -sz * 0.38, sz * 0.08, 0, Math.PI * 2); // заднее левое
    ctx.arc(-sz * 0.3,  sz * 0.38, sz * 0.08, 0, Math.PI * 2); // заднее правое
    ctx.fill();

    // Основной корпус (грязно-желтый, "пустынный")
    ctx.fillStyle = '#b5a642'; 
    ctx.beginPath();
    ctx.moveTo(-sz * 0.45, -sz * 0.25); // корма
    ctx.lineTo( sz * 0.1, -sz * 0.25);  
    ctx.lineTo( sz * 0.35, -sz * 0.15); // капот
    ctx.lineTo( sz * 0.45, 0);          // решетка радиатора
    ctx.lineTo( sz * 0.35,  sz * 0.15);
    ctx.lineTo( sz * 0.1,  sz * 0.25);
    ctx.lineTo(-sz * 0.45,  sz * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5c531e'; // Темная обводка
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Крыша (брезент/тент, более светлый оттенок)
    ctx.fillStyle = '#d6cfa3';
    ctx.fillRect(-sz * 0.35, -sz * 0.18, sz * 0.4, sz * 0.36);
    ctx.strokeStyle = '#a39c75';
    ctx.strokeRect(-sz * 0.35, -sz * 0.18, sz * 0.4, sz * 0.36);

    // Лобовое стекло (два окошка, как на референсе)
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(sz * 0.1, -sz * 0.18, sz * 0.1, sz * 0.36); // Бронированная перегородка
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(sz * 0.08, -sz * 0.14, sz * 0.04, sz * 0.1); // Левое окно
    ctx.fillRect(sz * 0.08,  sz * 0.04, sz * 0.04, sz * 0.1); // Правое окно

    // Решетка радиатора (спереди)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.4, -sz * 0.15, sz * 0.05, sz * 0.3);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sz * 0.4, -sz * 0.15 + i * (sz * 0.1));
        ctx.lineTo(sz * 0.45, -sz * 0.15 + i * (sz * 0.1));
        ctx.stroke();
    }

    // Рация / ящик сзади на борту
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.4, -sz * 0.3, sz * 0.1, sz * 0.1);
    ctx.strokeStyle = '#111';
    ctx.strokeRect(-sz * 0.4, -sz * 0.3, sz * 0.1, sz * 0.1);

    // Две высокие антенны (фишка Foxhole)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Антенна 1 (сзади)
    ctx.moveTo(-sz * 0.35, -sz * 0.25);
    ctx.lineTo(-sz * 0.5, -sz * 0.45);
    // Антенна 2 (спереди на капоте)
    ctx.moveTo( sz * 0.3, -sz * 0.2);
    ctx.lineTo( sz * 0.4, -sz * 0.4);
    ctx.stroke();
}

// ===== COLONIAL ARTILLERY 150 (M40/M43, 150мм) — та же модель, ствол толще =====
if (u.type === 'colonial_artillery150' || u.type === 'colonial_artillery') {
    // ===== ГУСЕНИЦЫ (идентичны 120) =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-sz * 0.52, -sz * 0.36, sz * 1.04, sz * 0.1);
    ctx.fillRect(-sz * 0.52,  sz * 0.26, sz * 1.04, sz * 0.1);
    
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 11; i++) {
        const tx = -sz * 0.52 + i * (sz * 1.04 / 11);
        ctx.beginPath();
        ctx.moveTo(tx, -sz * 0.36); ctx.lineTo(tx, -sz * 0.26);
        ctx.moveTo(tx,  sz * 0.26); ctx.lineTo(tx,  sz * 0.36);
        ctx.stroke();
    }
    
    ctx.fillStyle = '#374151';
    for (let i = 0; i < 6; i++) {
        const wx = -sz * 0.44 + i * sz * 0.176;
        ctx.beginPath();
        ctx.arc(wx, -sz * 0.31, sz * 0.04, 0, Math.PI * 2);
        ctx.arc(wx,  sz * 0.31, sz * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ===== КОРПУС (идентичен 120) =====
    ctx.fillStyle = col.p;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.5, -sz * 0.24);
    ctx.lineTo( sz * 0.3, -sz * 0.24);
    ctx.lineTo( sz * 0.46, -sz * 0.14);
    ctx.lineTo( sz * 0.46,  sz * 0.14);
    ctx.lineTo( sz * 0.3,  sz * 0.24);
    ctx.lineTo(-sz * 0.5,  sz * 0.24);
    ctx.lineTo(-sz * 0.52,  sz * 0.16);
    ctx.lineTo(-sz * 0.52, -sz * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== РУБКА (идентична 120) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.34, -sz * 0.22);
    ctx.lineTo( sz * 0.06, -sz * 0.22);
    ctx.lineTo( sz * 0.14, -sz * 0.16);
    ctx.lineTo( sz * 0.14,  sz * 0.16);
    ctx.lineTo( sz * 0.06,  sz * 0.22);
    ctx.lineTo(-sz * 0.34,  sz * 0.22);
    ctx.lineTo(-sz * 0.38,  sz * 0.14);
    ctx.lineTo(-sz * 0.38, -sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, -sz * 0.16);
    ctx.lineTo( sz * 0.02, -sz * 0.16);
    ctx.lineTo( sz * 0.08, -sz * 0.12);
    ctx.lineTo( sz * 0.08,  sz * 0.12);
    ctx.lineTo( sz * 0.02,  sz * 0.16);
    ctx.lineTo(-sz * 0.3,  sz * 0.16);
    ctx.lineTo(-sz * 0.32,  sz * 0.1);
    ctx.lineTo(-sz * 0.32, -sz * 0.1);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // ===== 150мм ГАУБИЦА (толстый ствол, lineWidth 5) =====
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(sz * 0.1, -sz * 0.14);
    ctx.lineTo(sz * 0.22, -sz * 0.11);
    ctx.lineTo(sz * 0.22,  sz * 0.11);
    ctx.lineTo(sz * 0.1,  sz * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Толстый короткий ствол
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sz * 0.2, 0);
    ctx.lineTo(sz * 0.7, 0);
    ctx.stroke();
    
    // Массивный дульный тормоз
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sz * 0.62, -sz * 0.08, sz * 0.12, sz * 0.16);
    
    // Противооткатные устройства
    ctx.strokeStyle = col.p;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.24, sz * 0.05);
    ctx.lineTo(sz * 0.5, sz * 0.05);
    ctx.stroke();
    
    // ===== СОШКИ =====
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, -sz * 0.1);
    ctx.lineTo(-sz * 0.54, -sz * 0.22);
    ctx.moveTo(-sz * 0.4,  sz * 0.1);
    ctx.lineTo(-sz * 0.54,  sz * 0.22);
    ctx.stroke();
    
    // ===== ФАРА =====
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== ЯЩИК ЗИП =====
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-sz * 0.46, sz * 0.04, sz * 0.14, sz * 0.12);
    ctx.strokeStyle = col.a;
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, sz * 0.04, sz * 0.14, sz * 0.12);
}
        
        // Грузовик
        if (u.type === 'truck') {
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.4, -sz * 0.25, sz * 0.8, sz * 0.5);
            // Кузов
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(-sz * 0.1, -sz * 0.2, sz * 0.5, sz * 0.4);
            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Бензовоз
        if (u.type === 'fuel_truck') {
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.4, -sz * 0.25, sz * 0.8, sz * 0.5);
            // Цистерна
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.ellipse(sz * 0.1, 0, sz * 0.3, sz * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
        
 if (u.type === 'noble_widow') {
            // Гусеницы по бортам
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-sz * 0.5, -sz * 0.34, sz, sz * 0.1);
            ctx.fillRect(-sz * 0.5, sz * 0.24, sz, sz * 0.1);
            // Катки
            ctx.fillStyle = '#374151';
            for (let i = 0; i < 4; i++) {
                const wx = -sz * 0.36 + i * sz * 0.24;
                ctx.beginPath();
                ctx.arc(wx, -sz * 0.29, sz * 0.045, 0, Math.PI * 2);
                ctx.arc(wx, sz * 0.29, sz * 0.045, 0, Math.PI * 2);
                ctx.fill();
            }
            // Низкий безбашенный корпус
            ctx.fillStyle = col.p;
            ctx.fillRect(-sz * 0.48, -sz * 0.24, sz * 0.96, sz * 0.48);
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.48, -sz * 0.24, sz * 0.96, sz * 0.48);
            // Наклонная рубка (трапеция, скошенный лоб)
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.28, -sz * 0.2);
            ctx.lineTo(sz * 0.2, -sz * 0.14);
            ctx.lineTo(sz * 0.34, 0);           // скошенный нос
            ctx.lineTo(sz * 0.2, sz * 0.14);
            ctx.lineTo(-sz * 0.28, sz * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Длинное орудие, смещённое вправо от продольной оси (как у Хетцера)
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(sz * 0.15, sz * 0.08);
            ctx.lineTo(sz * 0.78, sz * 0.08);
            ctx.stroke();
            // Дульный тормоз
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(sz * 0.7, sz * 0.03, sz * 0.09, sz * 0.1);
            // Люк командира в кормовой части рубки
            ctx.strokeStyle = col.p;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(-sz * 0.15, 0, sz * 0.06, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Talos — тяжёлый штурмовик колонистов (силуэт сов. КВ-2):
        // высокий коробчатый корпус и большая прямоугольная «самоходная»
        // башня с массивным коротким орудием
        if (u.type === 'talos') {
            // Гусеницы (широкие, выступают за корпус)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-sz * 0.5, -sz * 0.34, sz, sz * 0.1);
            ctx.fillRect(-sz * 0.5, sz * 0.24, sz, sz * 0.1);
            // Катки
            ctx.fillStyle = '#374151';
            for (let i = 0; i < 5; i++) {
                const wx = -sz * 0.38 + i * sz * 0.19;
                ctx.beginPath();
                ctx.arc(wx, -sz * 0.29, sz * 0.04, 0, Math.PI * 2);
                ctx.arc(wx, sz * 0.29, sz * 0.04, 0, Math.PI * 2);
                ctx.fill();
            }
            // Коробчатый корпус
            ctx.fillStyle = col.p;
            ctx.fillRect(-sz * 0.46, -sz * 0.26, sz * 0.92, sz * 0.52);
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.46, -sz * 0.26, sz * 0.92, sz * 0.52);
            // Большая прямоугольная высокая башня (сдвинута к корме — как у КВ-2)
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.26, -sz * 0.22, sz * 0.44, sz * 0.44);
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.strokeRect(-sz * 0.26, -sz * 0.22, sz * 0.44, sz * 0.44);
            // Массивное короткое орудие крупного калибра
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(sz * 0.12, 0);
            ctx.lineTo(sz * 0.6, 0);
            ctx.stroke();
            // Дульный срез (толстый — «миллионный» калибр)
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(sz * 0.62, 0, sz * 0.06, 0, Math.PI * 2);
            ctx.fill();
            // Командирская башенка на крыше
            ctx.fillStyle = col.a;
            ctx.beginPath();
            ctx.arc(-sz * 0.12, -sz * 0.1, sz * 0.06, 0, Math.PI * 2);
            ctx.fill();
        }

// Скорая помощь — белый фургон с красным крестом и «молниями»
if (u.type === 'medic_truck') {
    // ==== ГУСЕНИЦЫ/КОЛЁСА (колёсный фургон, 4 колеса) ====
    ctx.fillStyle = '#1a1a1a';
    // задняя ось
    ctx.fillRect(-sz * 0.34, -sz * 0.34, sz * 0.14, sz * 0.12);
    ctx.fillRect(-sz * 0.34,  sz * 0.22, sz * 0.14, sz * 0.12);
    // передняя ось
    ctx.fillRect( sz * 0.18, -sz * 0.34, sz * 0.14, sz * 0.12);
    ctx.fillRect( sz * 0.18,  sz * 0.22, sz * 0.14, sz * 0.12);

    // ==== КУЗОВ (белый медицинский фургон) ====
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.28);          // корма
    ctx.lineTo( sz * 0.22, -sz * 0.28);          // верх кабины
    ctx.lineTo( sz * 0.44, -sz * 0.16);          // скошенное лобовое стекло
    ctx.lineTo( sz * 0.44,  sz * 0.16);          // низ лба
    ctx.lineTo( sz * 0.22,  sz * 0.28);          // низ кабины
    ctx.lineTo(-sz * 0.44,  sz * 0.28);          // низ кормы
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ==== КАБИНА / ЛОБОВОЕ СТЕКЛО ====
    ctx.fillStyle = '#93c5fd';                   // голубое стекло
    ctx.beginPath();
    ctx.moveTo( sz * 0.28, -sz * 0.18);
    ctx.lineTo( sz * 0.4,  -sz * 0.1);
    ctx.lineTo( sz * 0.4,   sz * 0.1);
    ctx.lineTo( sz * 0.28,  sz * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.stroke();

    // боковые стёкла кабины
    ctx.fillStyle = '#bfdbfe';
    ctx.fillRect( sz * 0.14, -sz * 0.26, sz * 0.1, sz * 0.08);
    ctx.fillRect( sz * 0.14,  sz * 0.18, sz * 0.1, sz * 0.08);

    // ==== КРАСНАЯ ПОЛОСА ПО БОРТУ (характерный «медицинский» окрас) ====
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-sz * 0.38, -sz * 0.24, sz * 0.56, sz * 0.06);  // верхняя полоса
    ctx.fillRect(-sz * 0.38,  sz * 0.18, sz * 0.56, sz * 0.06);  // нижняя полоса

    // ==== ЗАДНЯЯ ДВЕРЬ (распашные створки с «молниями») ====
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-sz * 0.46, -sz * 0.22, sz * 0.08, sz * 0.44);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, -sz * 0.22, sz * 0.08, sz * 0.44);
    // молнии-«зигзаги» на дверях
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.14);
    ctx.lineTo(-sz * 0.41, -sz * 0.06);
    ctx.lineTo(-sz * 0.44,  sz * 0.02);
    ctx.lineTo(-sz * 0.41,  sz * 0.1);
    ctx.stroke();

    // ==== КРАСНЫЙ КРЕСТ НА КРЫШЕ (главный маркер) ====
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-sz * 0.16, -sz * 0.12, sz * 0.28, sz * 0.24);   // белый квадрат-фон
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz * 0.16, -sz * 0.12, sz * 0.28, sz * 0.24);
    ctx.fillStyle = '#dc2626';
    // вертикальная перекладина
    ctx.fillRect(-sz * 0.04, -sz * 0.1, sz * 0.08, sz * 0.2);
    // горизонтальная перекладина
    ctx.fillRect(-sz * 0.14, -sz * 0.02, sz * 0.28, sz * 0.08);

    // ==== ПРОБЛЕСКОВЫЙ МАЯЧОК (красно-синий, на крыше кабины) ====
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc( sz * 0.2, -sz * 0.12, sz * 0.035, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc( sz * 0.2,  sz * 0.12, sz * 0.035, 0, Math.PI);
    ctx.fill();
    // «дуга» мигалки
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc( sz * 0.2, 0, sz * 0.06, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // ==== ФАРЫ ====
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc( sz * 0.42, -sz * 0.2, sz * 0.025, 0, Math.PI * 2);
    ctx.arc( sz * 0.42,  sz * 0.2, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // ==== «+» на решётке радиатора ====
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo( sz * 0.4, -sz * 0.02);
    ctx.lineTo( sz * 0.4,  sz * 0.02);
    ctx.moveTo( sz * 0.38, 0);
    ctx.lineTo( sz * 0.42, 0);
    ctx.stroke();
}

        // Инженерная машина
        if (u.type === 'engineer') {
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.4, -sz * 0.25, sz * 0.8, sz * 0.5);
            // Кран
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -sz * 0.1);
            ctx.lineTo(sz * 0.3, -sz * 0.3);
            ctx.lineTo(sz * 0.4, -sz * 0.2);
            ctx.stroke();
            // Инструменты
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(-sz * 0.2, -sz * 0.15, sz * 0.15, sz * 0.1);
            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Flatbed truck
        if (u.type === 'flatbed') {
            // Кабина
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.4, -sz * 0.25, sz * 0.35, sz * 0.5);
            // Платформа
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(-sz * 0.05, -sz * 0.3, sz * 0.45, sz * 0.6);
            // Снаряды на платформе
            ctx.fillStyle = '#fbbf24';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(sz * 0.05 + i * sz * 0.12, -sz * 0.15, sz * 0.08, sz * 0.3);
            }
            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.25, sz * 0.1, 0, Math.PI * 2);
            ctx.arc(sz * 0.1, sz * 0.3, sz * 0.1, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.3, sz * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
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

// ===== ТРУП: отрисовка =====
// Простой «поваленный» вариант: чёрный силуэт с крестом/дымом, без поворота
// к направлению (чтобы визуально отличать от живых). Прозрачность плавно
// падает к концу срока жизни.
// ===== ТРУП: отрисовка с анимацией =====
// Для пехоты: пятно крови растекается в первые ~0.5 сек, затем силуэт лежащего.
// Для техники: тёмный сгоревший корпус + пульсирующий дым + мерцающий огонь
// (огонь гаснет через ~5 сек после смерти, дым остаётся до конца жизни трупа).
//
// ВАЖНО: функция не знает G.time — анимация строится на реальном времени
// (performance.now()), т.к. труп — чисто визуальный объект. Это допустимо:
// труп не влияет на геймплей, и его анимация не должна зависеть от тиков.
function drawCorpse(ctx, c, cam, G) {
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
// ===== ДОМА ГОРОДА =====
// ===== ДОМА ГОРОДА =====
function drawCityHouses(ctx, cp, cam, G) {
    if (!cp.houses) return;
    
    for (const h of cp.houses) {
        const x = h.x - cam.x;
        const y = h.y - cam.y;
        
        // Оптимизация: не рисуем, если за экраном
        if (x < -40 || x > ctx.canvas.width + 40 ||
            y < -40 || y > ctx.canvas.height + 40) continue;
        // ===== 1. ОТРИСОВКА РУИН =====
              // ===== ОТРИСОВКА РУИН =====
        if (h.ruin) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(h.angle); // angle = 0, поэтому дома смотрят вверх

            // Определяем тип руины (0 или 1) на основе seed
            const ruinType = Math.sin(h.seed) > 0 ? 0 : 1;
            
            // Общая тень/пепел под домом
            ctx.fillStyle = 'rgba(15, 10, 5, 0.8)';
            ctx.beginPath();
            ctx.ellipse(0, 0, h.size * 0.7, h.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            if (ruinType === 0) {
                // ===== ТИП 0: ПОЛНОСТЬЮ СГОРЕВШИЙ (ОСТОВ) =====
                
                // Тёмные "стены" (обугленный каркас)
                ctx.fillStyle = '#111';
                // Задняя стена
                ctx.fillRect(-h.size * 0.5, -h.size * 0.5, h.size, h.size);
                
                // Торчащие балки (крест-накрест)
                ctx.strokeStyle = '#0a0a0a';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-h.size * 0.5, -h.size * 0.5); ctx.lineTo(h.size * 0.5, h.size * 0.5);
                ctx.moveTo(h.size * 0.5, -h.size * 0.5); ctx.lineTo(-h.size * 0.5, h.size * 0.5);
                ctx.stroke();

                // Провалы окон (пустые глазницы)
                ctx.fillStyle = '#000';
                ctx.fillRect(-h.size * 0.3, -h.size * 0.2, h.size * 0.2, h.size * 0.3);
                ctx.fillRect(h.size * 0.1, -h.size * 0.2, h.size * 0.2, h.size * 0.3);
                
                // Рухнувшая крыша (обломки)
                ctx.fillStyle = '#1a1510';
                ctx.beginPath();
                ctx.moveTo(-h.size * 0.6, h.size * 0.4);
                ctx.lineTo(h.size * 0.6, h.size * 0.3);
                ctx.lineTo(h.size * 0.4, h.size * 0.6);
                ctx.lineTo(-h.size * 0.4, h.size * 0.5);
                ctx.fill();

            } else {
                // ===== ТИП 1: ПОЛУСГОРЕВШИЙ (ОСТАТКИ ДОМА) =====
                
                // Уцелевшая часть стен (зеленоватые/коричневые)
                ctx.fillStyle = '#4a5a3a'; 
                ctx.fillRect(-h.size * 0.5, -h.size * 0.5, h.size * 0.5, h.size); // Левая половина
                
                // Сгоревшая часть
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, -h.size * 0.5, h.size * 0.5, h.size); // Правая половина
                
                // Обводка (каркас)
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-h.size * 0.5, -h.size * 0.5, h.size, h.size);

                // Окна (пустые)
                ctx.fillStyle = '#000';
                ctx.fillRect(-h.size * 0.35, h.size * 0.0, h.size * 0.15, h.size * 0.2); // Левое
                ctx.fillRect(h.size * 0.15, h.size * 0.0, h.size * 0.15, h.size * 0.2); // Правое

                // Остатки крыши (обгоревший треугольник)
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.moveTo(-h.size * 0.5, -h.size * 0.5);
                ctx.lineTo(0, -h.size * 0.8);
                ctx.lineTo(h.size * 0.2, -h.size * 0.5);
                ctx.closePath();
                ctx.fill();

                // Торчащие балки на месте крыши
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-h.size * 0.2, -h.size * 0.6);
                ctx.lineTo(h.size * 0.4, -h.size * 0.4);
                ctx.moveTo(h.size * 0.1, -h.size * 0.7);
                ctx.lineTo(h.size * 0.3, -h.size * 0.3);
                ctx.stroke();
            }

            ctx.restore();
            continue; // Пропускаем отрисовку обычного дома
        }

        // ===== 2. ОТРИСОВКА ОБЫЧНОГО ДОМА =====
        const k = h.hp / h.maxHp;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(h.angle);

        // Тень
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-h.size * 0.5 + 2, -h.size * 0.5 + 2, h.size, h.size);

        // Стены (цвет зависит от HP: целый - коричневый, раненый - темнеет)
        const wallBase = h.destroyed ? '#1a1510' : mixHexColor('#8b7355', '#3a2a1a', 1 - k);
        ctx.fillStyle = wallBase;
        ctx.fillRect(-h.size * 0.5, -h.size * 0.5, h.size, h.size);
        ctx.strokeStyle = h.destroyed ? '#000' : '#5a4a3a';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-h.size * 0.5, -h.size * 0.5, h.size, h.size);

        if (!h.destroyed) {
            // Крыша (треугольник)
            ctx.fillStyle = mixHexColor('#a0522d', '#2a1a0a', 1 - k);
            ctx.beginPath();
            ctx.moveTo(-h.size * 0.55, -h.size * 0.5);
            ctx.lineTo(0, -h.size * 0.9);
            ctx.lineTo(h.size * 0.55, -h.size * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#3a2a1a';
            ctx.stroke();
            
            // Окно (светится, если дом цел)
            ctx.fillStyle = k > 0.5 ? '#fbbf24' : '#3a2a1a';
            ctx.fillRect(-h.size * 0.15, h.size * 0.1, h.size * 0.3, h.size * 0.3);
        } else {
            // Обугленный остов (если дом уже разрушен, но ещё не стал руиной)
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-h.size * 0.3, -h.size * 0.2);
            ctx.lineTo(h.size * 0.2, h.size * 0.1);
            ctx.moveTo(-h.size * 0.2, h.size * 0.3);
            ctx.lineTo(h.size * 0.3, -h.size * 0.1);
            ctx.stroke();
        }

        ctx.restore();

        // ===== 3. ОГОНЬ И ДЫМ =====
        if (h.burning) {
            const now = performance.now() / 1000;
            // Постепенное затухание огня, если дом уже "руина" (догорает)
            const fade = h.ruin
                ? Math.max(0.2, 1 - (G.time - h.burnStart) / (cp.burnDuration || 7200))
                : 1;
            
            // 3 языка пламени
            const positions = [
                { dx: -h.size * 0.3, dy: -h.size * 0.1 },
                { dx:  h.size * 0.2, dy: -h.size * 0.3 },
                { dx:  0,            dy:  h.size * 0.05 },
            ];
            
            for (let i = 0; i < positions.length; i++) {
                const p = positions[i];
                const phase = now * (5 + i * 1.3) + h.seed + i;
                const scale = 0.6 + 0.4 * Math.abs(Math.sin(phase));
                const fx = x + p.dx;
                const fy = y + p.dy;
                const fr = h.size * 0.35 * scale;
                
                // Жёлтый внутренний
                ctx.globalAlpha = 0.9 * fade;
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.moveTo(fx, fy - fr);
                ctx.quadraticCurveTo(fx + fr * 0.6, fy - fr * 0.2, fx, fy + fr * 0.3);
                ctx.quadraticCurveTo(fx - fr * 0.6, fy - fr * 0.2, fx, fy - fr);
                ctx.fill();
                
                // Оранжевый внешний
                ctx.globalAlpha = 0.7 * fade;
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.moveTo(fx, fy - fr * 1.3);
                ctx.quadraticCurveTo(fx + fr * 0.9, fy - fr * 0.1, fx, fy + fr * 0.5);
                ctx.quadraticCurveTo(fx - fr * 0.9, fy - fr * 0.1, fx, fy - fr * 1.3);
                ctx.fill();
            }
            
            // Дым
            ctx.globalAlpha = 0.35 * fade;
            for (let i = 0; i < 2; i++) {
                const phase = now * 0.8 + h.seed + i * 1.7;
                const rise = (now * 0.6 + i) % 3;
                const sx = x + Math.sin(phase) * h.size * 0.3;
                const sy = y - h.size * 0.6 - rise * h.size * 0.4;
                const sr = h.size * (0.25 + i * 0.1) * (1 + 0.2 * Math.sin(phase));
                
                const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                g.addColorStop(0, 'rgba(50, 45, 40, 0.9)');
                g.addColorStop(1, 'rgba(50, 45, 40, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }
}
// Утилита: смешать два hex-цвета (#rrggbb). t=0 → a, t=1 → b.
function mixHexColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
    const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
function drawMinimap(ctx, G, canvas) {
    const mw = 180, mh = 120;
    const mx = canvas.width - mw - 10, my = canvas.height - mh - 50;
    const sx = mw / 3000, sy = mh / 2250;
    
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(mx, my, mw, mh);
    
    // Cities on minimap (цвета фракций: Wardens — синий, Colonials — зелёный)
    G.cps.forEach(cp => {
        const col = cp.owner === 'neutral' ? COLORS.neutral.p : COLORS[cp.owner].p;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(mx + cp.x * sx, my + cp.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Mines on minimap
    G.mines.forEach(mine => {
        const col = mine.owner === 'neutral' ? '#fbbf24' : COLORS[mine.owner].p;
        ctx.fillStyle = col;
        ctx.fillRect(mx + mine.x * sx - 2, my + mine.y * sy - 2, 4, 4);
    });
    
    // Buildings on minimap
    G.buildings.forEach(b => {
        ctx.fillStyle = COLORS[b.faction] ? COLORS[b.faction].p : '#6b7280';
        ctx.fillRect(mx + b.x * sx - 2, my + b.y * sy - 2, 4, 4);
    });
    
    // Units on minimap (свои — светлый цвет фракции, чужие — тёмный)
    G.units.forEach(u => {
        const c = COLORS[u.faction];
        if (!c) return;
        ctx.fillStyle = u.faction === G.faction ? c.a : c.s;
        ctx.fillRect(mx + u.x * sx - 1, my + u.y * sy - 1, 2, 2);
    });
    
    // Camera viewport
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + G.cam.x * sx, my + G.cam.y * sy, canvas.width * sx, canvas.height * sy);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 2, my - 2, mw + 4, mh + 4);
}

function drawFogOverlay(ctx, G, cam, canvas) {
    if (!G.fogEnabled) return;

    const { canvas: fogCanvas, ctx: fctx } = getFogCanvas(canvas.width, canvas.height);
    
    // 1. СБРОС КОМПОЗИТНОГО РЕЖИМА (критично!)
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

    // 2. Заливаем ВЕСЬ экран черным (плотность 0.9 — почти непроглядный)
    fctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    fctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

    // 3. Режим "вырезания дырок"
    fctx.globalCompositeOperation = 'destination-out';

    const carve = (x, y, range) => {
        const sx = x - cam.x, sy = y - cam.y;
        // Если точка далеко за экраном — не рисуем
        if (sx < -range || sx > fogCanvas.width + range ||
            sy < -range || sy > fogCanvas.height + range) return;
        
        // Радиальный градиент для мягких краев
        const g = fctx.createRadialGradient(sx, sy, range * 0.3, sx, sy, range);
        g.addColorStop(0, 'rgba(0,0,0,1)');      // центр — полностью прозрачный
        g.addColorStop(0.7, 'rgba(0,0,0,0.8)');  // ближе к краю
        g.addColorStop(1, 'rgba(0,0,0,0)');      // край — растворяется
        
        fctx.fillStyle = g;
        fctx.beginPath();
        fctx.arc(sx, sy, range, 0, Math.PI * 2);
        fctx.fill();
    };

    // --- ВЫРЕЗАЕМ ДЫРКИ ---
    
    // 1. Свои юниты (радиус обзора)
    for (const u of G.units) {
        if (u.faction !== G.faction || u.hp <= 0) continue;
        const range = G.getUnitVisibilityRange(u) || 150;
        carve(u.x, u.y, range);
    }

    // 2. Свои города (база + бонус от обороны)
    for (const cp of G.cps) {
        if (cp.owner !== G.faction) continue;
        let range = cp.radius + 120;
        if (cp.defenseLevel > 0) {
            const stats = G.getTerritoryDefenseStats(cp.defenseLevel);
            range += (stats.range * 0.25);
        }
        carve(cp.x, cp.y, range);
    }

    // 3. Свои здания (заводы, казармы)
    for (const b of G.buildings) {
        if (b.faction !== G.faction || b.hp <= 0) continue;
        carve(b.x, b.y, 350);
    }

    // 4. ВАЖНО: Гарантированные дырки вокруг вражеской техники в 50px
    // (если вы применили мой патч в game.js)
    for (const u of G.units) {
        if (u.faction === G.faction || u.hp <= 0) continue;
        // Если враг в радиусе 50 от наших войск — мы его "видим", делаем дырку
        // (на самом деле он уже попал в visibleEnemyIds, но дырка нужна для визуала)
        const isVisible = G.visibleEnemyIds && G.visibleEnemyIds.has(u.id);
        if (isVisible) {
            // Если видим — делаем небольшую дырку, чтобы он не был в черноте
            carve(u.x, u.y, 80); 
        }
    }

    // 5. СБРОС КОМПОЗИТНОГО РЕЖИМА НАЗАД
    fctx.globalCompositeOperation = 'source-over';

    // 6. Накладываем туман на основной холст
    ctx.drawImage(fogCanvas, 0, 0);
}