// ===== RENDERER =====
import { COLORS } from './constants.js';
import { RIVER_POINTS, ROADS, BRIDGES, WATER_ZONES, CITY_ZONES, TREES, BUSHES, ROCKS, GRASS_PATCHES } from './map.js';

export function render(ctx, G, canvas) {
    const cam = G.cam;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background - sandy/desert with variation
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#a08968');
    gradient.addColorStop(0.5, '#8b7355');
    gradient.addColorStop(1, '#9a8465');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grass patches
    drawGrassPatches(ctx, cam, canvas);

    // Water zones (flooded areas)
    drawWaterZones(ctx, WATER_ZONES, cam);

    // River - multiple layers for depth
    drawRiver(ctx, RIVER_POINTS, cam, 35, '#4a5a4a'); // Dark edge
    drawRiver(ctx, RIVER_POINTS, cam, 28, '#5a6b5a'); // Main
    drawRiver(ctx, RIVER_POINTS, cam, 20, '#6b7b6b'); // Light center
    drawRiverHighlights(ctx, RIVER_POINTS, cam);

    // Roads - winding with curves
    drawRoads(ctx, ROADS, cam);

    // Bridges
    drawBridges(ctx, BRIDGES, cam);

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
        drawUnit(ctx, u, cam, G.selected, hoveredUnit === u);
        
        // Draw AoE target if set
        if (u.aoe && u.aoeTarget) {
            const tx = u.aoeTarget.x - cam.x;
            const ty = u.aoeTarget.y - cam.y;
            
            // Draw target circle
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
            ctx.moveTo(tx - 15, ty);
            ctx.lineTo(tx + 15, ty);
            ctx.moveTo(tx, ty - 15);
            ctx.lineTo(tx, ty + 15);
            ctx.stroke();
            
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

function drawWaterZones(ctx, zones, cam) {
    zones.forEach(zone => {
        const x = zone.x - cam.x;
        const y = zone.y - cam.y;
        
        // Water with gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, zone.radius);
        gradient.addColorStop(0, 'rgba(90, 107, 90, 0.7)');
        gradient.addColorStop(0.5, 'rgba(80, 97, 80, 0.5)');
        gradient.addColorStop(1, 'rgba(70, 87, 70, 0.3)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, zone.radius, zone.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Lighter center
        ctx.fillStyle = 'rgba(107, 123, 107, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y, zone.radius * 0.6, zone.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Ripples
        ctx.strokeStyle = 'rgba(150, 180, 150, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(x, y, zone.radius * (0.3 + i * 0.2), zone.radius * 0.25 * (0.3 + i * 0.2), 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Label
        ctx.fillStyle = '#d1d5db';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name, x, y - zone.radius - 8);
    });
}

function drawRiver(ctx, points, cam, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    if (points.length < 2) return;
    
    ctx.moveTo(points[0].x - cam.x, points[0].y - cam.y);
    
    // Smooth curve through points
    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2 - cam.x;
        const yc = (points[i].y + points[i + 1].y) / 2 - cam.y;
        ctx.quadraticCurveTo(points[i].x - cam.x, points[i].y - cam.y, xc, yc);
    }
    
    // Last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x - cam.x, last.y - cam.y);
    ctx.stroke();
}

function drawRiverHighlights(ctx, points, cam) {
    ctx.strokeStyle = 'rgba(150, 180, 150, 0.4)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    for (let i = 0; i < points.length - 1; i += 2) {
        const p = points[i];
        ctx.moveTo(p.x - cam.x + 8, p.y - cam.y);
        ctx.lineTo(p.x - cam.x + 20, p.y - cam.y);
    }
    ctx.stroke();
}

function drawRoads(ctx, roads, cam) {
    roads.forEach(road => {
        const fromX = road.from[0] * 250 + 125;
        const fromY = road.from[1] * 150 + 75;
        const toX = road.to[0] * 250 + 125;
        const toY = road.to[1] * 150 + 75;
        
        // Road shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 16;
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
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road surface
        ctx.strokeStyle = '#7a6a55';
        ctx.lineWidth = 10;
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
        ctx.fillRect(x - 32, y - 14, 64, 28);
        
        // Bridge structure
        ctx.fillStyle = '#6a5a45';
        ctx.fillRect(x - 30, y - 12, 60, 24);
        
        // Bridge planks
        ctx.strokeStyle = '#5a4a35';
        ctx.lineWidth = 1;
        for (let i = -25; i < 30; i += 5) {
            ctx.beginPath();
            ctx.moveTo(x + i, y - 12);
            ctx.lineTo(x + i, y + 12);
            ctx.stroke();
        }
        
        // Bridge details
        ctx.strokeStyle = '#4a3a25';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 30, y - 12, 60, 24);
        
        // Railings
        ctx.fillStyle = '#4a3a25';
        ctx.fillRect(x - 30, y - 14, 60, 3);
        ctx.fillRect(x - 30, y + 11, 60, 3);
        
        // Railing posts
        for (let i = -25; i <= 25; i += 10) {
            ctx.fillRect(x + i, y - 16, 2, 5);
            ctx.fillRect(x + i, y + 11, 2, 5);
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
    
    // Different building types
    if (type === 'military' || type === 'cache') {
        // Military buildings - darker, fortified
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x - 9, y - 9, 18, 18);
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 9, y - 9, 18, 18);
        
        // Roof
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(x - 10, y - 10, 20, 4);
        
        // Windows
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 4, y - 2, 3, 3);
        ctx.fillRect(x + 2, y - 2, 3, 3);
    } else if (type === 'settlement' || type === 'farms') {
        // Residential buildings - warmer colors
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(x - 8, y - 8, 16, 16);
        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 8, y - 8, 16, 16);
        
        // Roof
        ctx.fillStyle = '#7a6a5a';
        ctx.fillRect(x - 9, y - 9, 18, 3);
        
        // Windows
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 3, y - 2, 3, 3);
        ctx.fillRect(x + 1, y - 2, 3, 3);
        
        // Door
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x - 2, y + 3, 4, 5);
    } else if (type === 'plaza') {
        // Plaza buildings - elegant
        ctx.fillStyle = '#7a6a5a';
        ctx.fillRect(x - 10, y - 10, 20, 20);
        ctx.strokeStyle = '#6a5a4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 10, y - 10, 20, 20);
        
        // Roof
        ctx.fillStyle = '#8a7a6a';
        ctx.fillRect(x - 11, y - 11, 22, 4);
        
        // Windows (more)
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 5, y - 3, 3, 3);
        ctx.fillRect(x - 1, y - 3, 3, 3);
        ctx.fillRect(x + 3, y - 3, 3, 3);
    } else {
        // Default buildings
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(x - 8, y - 8, 16, 16);
        ctx.strokeStyle = '#4a3a2a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 8, y - 8, 16, 16);
        
        // Roof
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(x - 9, y - 9, 18, 3);
        
        // Window
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 3, y - 2, 3, 3);
        ctx.fillRect(x + 1, y - 2, 3, 3);
        
        // Door
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x - 2, y + 3, 4, 5);
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

function drawUnit(ctx, u, cam, selected, hovered) {
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
    
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, sz * 0.5, sz * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (u.type === 'infantry') {
        ctx.fillStyle = col.p;
        ctx.beginPath();
        ctx.arc(x, y, sz / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col.a;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else {
        ctx.fillStyle = col.p;
        ctx.fillRect(x - sz / 2, y - sz / 3, sz, sz * 0.65);
        ctx.strokeStyle = col.a;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - sz / 2, y - sz / 3, sz, sz * 0.65);
        
        if (['hatchet', 'devitt', 'gallagher', 'falchion'].includes(u.type)) {
            ctx.fillStyle = col.s;
            ctx.beginPath();
            ctx.arc(x, y, sz * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = col.a;
            ctx.lineWidth = u.type === 'gallagher' || u.type === 'falchion' ? 3 : 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + sz * 0.55, y);
            ctx.stroke();
        }
        
        if (['niska', 'hoplite'].includes(u.type)) {
            ctx.fillStyle = col.s;
            ctx.fillRect(x - sz * 0.3, y - sz * 0.2, sz * 0.6, sz * 0.4);
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - sz * 0.3, y - sz * 0.2, sz * 0.6, sz * 0.4);
        }
        
        if (u.type === 'warden_artillery' || u.type === 'colonial_artillery') {
            // Artillery barrel
            ctx.strokeStyle = col.a;
            ctx.lineWidth = u.type === 'warden_artillery' ? 5 : 4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + sz * 0.7, y - sz * 0.3);
            ctx.stroke();
            // Base
            ctx.fillStyle = col.s;
            ctx.fillRect(x - sz * 0.25, y, sz * 0.5, sz * 0.3);
            
            // Faction indicator
            if (u.type === 'warden_artillery') {
                // Blue star for Wardens
                ctx.fillStyle = '#60a5fa';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('★', x, y - sz * 0.5);
            } else {
                // Red triangle for Colonials
                ctx.fillStyle = '#f87171';
                ctx.beginPath();
                ctx.moveTo(x, y - sz * 0.6);
                ctx.lineTo(x - 4, y - sz * 0.45);
                ctx.lineTo(x + 4, y - sz * 0.45);
                ctx.closePath();
                ctx.fill();
            }
        }
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
}

function drawMinimap(ctx, G, canvas) {
    const mw = 180, mh = 120;
    const mx = canvas.width - mw - 10, my = canvas.height - mh - 50;
    const sx = mw / 3000, sy = mh / 2250;
    
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(mx, my, mw, mh);
    
    // River on minimap
    ctx.strokeStyle = '#5a6b5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx + RIVER_POINTS[0].x * sx, my + RIVER_POINTS[0].y * sy);
    for (let i = 1; i < RIVER_POINTS.length; i++) {
        ctx.lineTo(mx + RIVER_POINTS[i].x * sx, my + RIVER_POINTS[i].y * sy);
    }
    ctx.stroke();
    
    G.cps.forEach(cp => {
        const col = cp.owner === 'neutral' ? '#6b7280' : cp.owner === 'wardens' ? '#2563eb' : '#dc2626';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(mx + cp.x * sx, my + cp.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    
    G.mines.forEach(mine => {
        const col = mine.owner === 'neutral' ? '#fbbf24' : mine.owner === 'wardens' ? '#2563eb' : '#dc2626';
        ctx.fillStyle = col;
        ctx.fillRect(mx + mine.x * sx - 2, my + mine.y * sy - 2, 4, 4);
    });
    
    G.buildings.forEach(b => {
        ctx.fillStyle = b.faction === 'wardens' ? '#2563eb' : '#dc2626';
        ctx.fillRect(mx + b.x * sx - 2, my + b.y * sy - 2, 4, 4);
    });
    
    G.units.forEach(u => {
        ctx.fillStyle = u.faction === G.faction ? '#60a5fa' : '#f87171';
        ctx.fillRect(mx + u.x * sx - 1, my + u.y * sy - 1, 2, 2);
    });
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + G.cam.x * sx, my + G.cam.y * sy, canvas.width * sx, canvas.height * sy);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 2, my - 2, mw + 4, mh + 4);
}
