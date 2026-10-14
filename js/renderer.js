// ===== RENDERER =====
import { COLORS, dist } from './constants.js';
import { ROADS, CITY_ZONES, TREES, BUSHES, ROCKS, GRASS_PATCHES, LAKES } from './map.js';
import { isInfUnit } from './vehicles.js';

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

    // Buildings
    G.buildings.forEach(b => drawBuilding(ctx, b, cam));

    // Units
    const hoveredUnit = getHoveredUnit(G, cam);
    G.units.forEach(u => {
        drawUnit(ctx, u, cam, G.selected, hoveredUnit === u, G);

        // Draw AoE target if set
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
    });

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
        drawFortifications(ctx, x, y, cp.defenseLevel, col);
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

function drawFortifications(ctx, x, y, level, col) {
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
    const col = COLORS[b.faction];
    
    // Укрепления (бункеры)
    if (b.type && b.type.startsWith('bunker_')) {
        const sz = b.type === 'bunker_light' ? 30 : b.type === 'bunker_medium' ? 38 : 46;
        
        // ===== УБРАНА ОТЛАДКА («красная/последняя строчка» в консоли) =====
        // Этот console.log на каждый бункер засорял лог и выглядел как
        // «висящая ошибка» в конце консоли. Рендерер не должен логировать.
        
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
    
    if (isInfUnit(u)) {
        const r = sz / 2;
        // ===== ФОРМА ФИГУРКИ ПО ВИДУ ПЕХОТЫ =====
        // sniper — треугольник (вершина по направлению), grenadier — ромб,
        // mg_gunner — квадрат (общий для обеих фракций), остальные — круг.
        ctx.fillStyle = col.p;
        ctx.beginPath();
        if (u.type === 'sniper') {
            ctx.moveTo(r, 0);          // нос (направление)
            ctx.lineTo(-r * 0.8, -r * 0.9);
            ctx.lineTo(-r * 0.8, r * 0.9);
        } else if (u.type === 'grenadier') {
            ctx.moveTo(r, 0);          // правый угол
            ctx.lineTo(0, -r);         // верхний
            ctx.lineTo(-r, 0);         // левый
            ctx.lineTo(0, r);          // нижний
        } else if (u.type === 'mg_gunner') {
            ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); // квадрат
        } else {
            ctx.arc(0, 0, r, 0, Math.PI * 2); // стрелки — круг
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = col.a;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Маркеры вида пехоты: пулемётчик — короткий «ствол» спереди,
        // снайпер — длинный ствол + прицел, гранатомётчик — «дуло»,
        // стрелок — только указатель направления
        if (u.type === 'mg_gunner') {
            ctx.strokeStyle = col.s;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz / 2 + 4, 0);
            ctx.stroke();
        } else if (u.type === 'sniper') {
            ctx.strokeStyle = col.s;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz / 2 + 8, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sz / 2 + 3, 0, 2.5, 0, Math.PI * 2);
            ctx.stroke();
        } else if (u.type === 'grenadier') {
            ctx.strokeStyle = col.s;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz / 2 + 5, 0);
            ctx.stroke();
        }
        // Direction indicator for infantry
        ctx.fillStyle = col.a;
        ctx.beginPath();
        ctx.moveTo(sz / 2, 0);
        ctx.lineTo(sz / 2 - 3, -2);
        ctx.lineTo(sz / 2 - 3, 2);
        ctx.closePath();
        ctx.fill();
    } else {
        // Vehicle body (centered at 0,0)
        ctx.fillStyle = col.p;
        ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.65);
        ctx.strokeStyle = col.a;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-sz / 2, -sz / 3, sz, sz * 0.65);
        
        // Light tanks (Devitt, Hatchet)
        if (['hatchet', 'devitt'].includes(u.type)) {
            // Turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // 40mm barrel
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz * 0.6, 0);
            ctx.stroke();
            // Barrel tip
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(sz * 0.6, 0, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // King Spire - Scout tank with antenna
        if (u.type === 'king_spire') {
            // Small turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Machine gun
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz * 0.4, 0);
            ctx.stroke();
            // Antenna
            ctx.strokeStyle = '#9ca3af';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.15, -sz * 0.15);
            ctx.lineTo(-sz * 0.15, -sz * 0.5);
            ctx.stroke();
            // Antenna tip
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(-sz * 0.15, -sz * 0.5, 2, 0, Math.PI * 2);
            ctx.fill();
            // Reveal radius indicator (if selected)
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
        
        // Silverhand - Assault tank with dual guns
        if (u.type === 'silverhand') {
            // Large turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.stroke();
            // 40mm turret gun
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(sz * 0.1, -sz * 0.08);
            ctx.lineTo(sz * 0.65, -sz * 0.08);
            ctx.stroke();
            // 68mm hull gun (offset)
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(sz * 0.3, sz * 0.15);
            ctx.lineTo(sz * 0.6, sz * 0.15);
            ctx.stroke();
        }
        
        // Gallagher Highwayman - Cruiser tank with boost
        if (u.type === 'gallagher_highwayman') {
            // Turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.26, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Twin 14.5mm guns
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -sz * 0.05);
            ctx.lineTo(sz * 0.55, -sz * 0.05);
            ctx.moveTo(0, sz * 0.05);
            ctx.lineTo(sz * 0.55, sz * 0.05);
            ctx.stroke();
            // Boost indicator
            if (u.boosting) {
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(-sz * 0.4, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                // Boost flames
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(-sz * 0.5, -sz * 0.1);
                ctx.lineTo(-sz * 0.7, 0);
                ctx.lineTo(-sz * 0.5, sz * 0.1);
                ctx.closePath();
                ctx.fill();
            }
        }
        
        // Scorpion - Light infantry tank with twin MGs
        if (u.type === 'scorpion') {
            // Turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Twin 12.7mm machine guns
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -sz * 0.08);
            ctx.lineTo(sz * 0.5, -sz * 0.08);
            ctx.moveTo(0, sz * 0.08);
            ctx.lineTo(sz * 0.5, sz * 0.08);
            ctx.stroke();
            // Reveal radius indicator (if selected)
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
            // Large turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.stroke();
            // 68mm main gun
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz * 0.65, 0);
            ctx.stroke();
            // 4-tube grenade launcher (on top)
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(-sz * 0.1, -sz * 0.35, sz * 0.2, sz * 0.15);
            // Grenade tubes
            ctx.fillStyle = '#1a1a1a';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(-sz * 0.05 + i * sz * 0.05, -sz * 0.28, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Falchion - Medium tank
        if (u.type === 'falchion' || u.type === 'spatha') {
            // Turret
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 2;
            ctx.stroke();
            // Main gun
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz * 0.6, 0);
            ctx.stroke();
        }
        
        if (['niska', 'javelin'].includes(u.type)) {
            // БТР: корпус с боевым отделением и пулемётной турелью
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.3, -sz * 0.2, sz * 0.6, sz * 0.4);
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1;
            ctx.strokeRect(-sz * 0.3, -sz * 0.2, sz * 0.6, sz * 0.4);
            // Пулемётная турель
            ctx.fillStyle = col.a;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz * 0.4, 0);
            ctx.stroke();
        }

        // ===== Миномётная поддержка (Hoplite, Devitt MMR) — отдельная модель =====
        if (u.isMortar || ['hoplite', 'devitt_mmr'].includes(u.type)) {
            // Низкий гусеничный корпус
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.45, -sz * 0.18, sz * 0.9, sz * 0.36);
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1;
            ctx.strokeRect(-sz * 0.45, -sz * 0.18, sz * 0.9, sz * 0.36);
            // Гусеницы
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-sz * 0.45, -sz * 0.26, sz * 0.9, sz * 0.07);
            ctx.fillRect(-sz * 0.45, sz * 0.19, sz * 0.9, sz * 0.07);
            // Осевая миномётная ствола (короткая, толстая — характерный миномёт)
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.05, 0);
            ctx.lineTo(sz * 0.32, -sz * 0.28);
            ctx.stroke();
            // Дульный срез
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(sz * 0.32, -sz * 0.28, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Опора плиты под миномётом
            ctx.strokeStyle = col.p;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.05, 0);
            ctx.lineTo(-sz * 0.2, sz * 0.15);
            ctx.stroke();
        }
        
        if (u.type === 'warden_artillery' || u.type === 'colonial_artillery') {
            // Artillery barrel
            ctx.strokeStyle = col.a;
            ctx.lineWidth = u.type === 'warden_artillery' ? 5 : 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sz * 0.7, 0);
            ctx.stroke();
            // Base
            ctx.fillStyle = col.s;
            ctx.fillRect(-sz * 0.25, 0, sz * 0.5, sz * 0.3);
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
    if (u.type === 'warden_artillery') {
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', x, y - sz * 0.5);
    } else if (u.type === 'colonial_artillery') {
        ctx.fillStyle = '#4ade80'; // зелёный маркер артиллерии колонистов
        ctx.fillStyle = '#4ade80';
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
        // ФИКС СИНТАКСИСА: здесь было два объявления `const col` подряд —
        // файл не разбирался вообще, вся игра падала при загрузке модуля
        // рендера (что косвенно ломало и ИИ/юниты). Оставлено одно —
        // через палитру COLORS (поддерживает обе фракции корректно).
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
