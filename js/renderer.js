// ===== RENDERER =====
import { COLORS } from './constants.js';
import { RIVER_POINTS, ROADS, BRIDGES, getLocationsInWorld } from './map.js';

export function render(ctx, G, canvas) {
    const cam = G.cam;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background - sandy/desert color
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some texture
    drawTerrainTexture(ctx, cam, canvas);

    // River
    drawRiver(ctx, RIVER_POINTS, cam, 25, '#5a6b5a');
    drawRiver(ctx, RIVER_POINTS, cam, 18, '#6b7b6b');

    // Roads
    const locations = getLocationsInWorld();
    ROADS.forEach(([a, b]) => {
        if (a >= locations.length || b >= locations.length) return;
        const la = locations[a], lb = locations[b];
        ctx.strokeStyle = '#6b5a45';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(la.x - cam.x, la.y - cam.y);
        ctx.lineTo(lb.x - cam.x, lb.y - cam.y);
        ctx.stroke();
        
        ctx.strokeStyle = '#8b7a65';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(la.x - cam.x, la.y - cam.y);
        ctx.lineTo(lb.x - cam.x, lb.y - cam.y);
        ctx.stroke();
    });

    // Bridges
    BRIDGES.forEach(br => {
        const bx = br.x - cam.x, by = br.y - cam.y;
        ctx.fillStyle = '#7a6a55';
        ctx.fillRect(bx - 25, by - 10, 50, 20);
        ctx.strokeStyle = '#5a4a35';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 25, by - 10, 50, 20);
        // Railings
        ctx.fillStyle = '#5a4a35';
        ctx.fillRect(bx - 25, by - 12, 50, 3);
        ctx.fillRect(bx - 25, by + 9, 50, 3);
    });

    // Locations
    locations.forEach(loc => {
        drawLocation(ctx, loc, cam);
    });

    // Capture points
    G.cps.forEach(cp => {
        drawCapturePoint(ctx, cp, cam);
    });

    // Resource mines
    G.mines.forEach(mine => {
        drawMine(ctx, mine, cam);
    });

    // Buildings
    G.buildings.forEach(b => {
        drawBuilding(ctx, b, cam);
    });

    // Units
    G.units.forEach(u => {
        drawUnit(ctx, u, cam, G.selected);
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

function drawTerrainTexture(ctx, cam, canvas) {
    // Simple noise-like texture
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 50; i++) {
        const x = (i * 137) % canvas.width;
        const y = (i * 241) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
    }
}

function drawRiver(ctx, points, cam, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x - cam.x, points[0].y - cam.y);
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1], curr = points[i];
        ctx.quadraticCurveTo(
            prev.x - cam.x, prev.y - cam.y,
            (prev.x + curr.x) / 2 - cam.x, (prev.y + curr.y) / 2 - cam.y
        );
    }
    ctx.stroke();
}

function drawLocation(ctx, loc, cam) {
    const x = loc.x - cam.x, y = loc.y - cam.y;
    
    // Different icons based on type
    switch (loc.type) {
        case 'base':
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(x - 8, y - 8, 16, 16);
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 8, y - 8, 16, 16);
            break;
        case 'settlement':
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x - 6, y - 6, 12, 12);
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 6, y - 6, 12, 12);
            break;
        case 'hex':
            ctx.fillStyle = '#9ca3af';
            drawHexagon(ctx, x, y, 8);
            break;
        case 'medical':
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 6, y - 2, 12, 4);
            ctx.fillRect(x - 2, y - 6, 4, 12);
            break;
        case 'workshop':
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 5, y + 5);
            ctx.lineTo(x + 5, y - 5);
            ctx.moveTo(x - 5, y - 5);
            ctx.lineTo(x + 5, y + 5);
            ctx.stroke();
            break;
        case 'resource':
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 5, y - 5, 10, 10);
            break;
        case 'player_base':
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(x, y - 10);
            ctx.lineTo(x + 10, y + 10);
            ctx.lineTo(x - 10, y + 10);
            ctx.closePath();
            ctx.fill();
            break;
        default:
            // Just label
            break;
    }
    
    // Name label
    ctx.fillStyle = '#d1d5db';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(loc.name, x, y - 15);
}

function drawHexagon(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawCapturePoint(ctx, cp, cam) {
    const x = cp.x - cam.x, y = cp.y - cam.y;
    const col = cp.owner === 'neutral' ? COLORS.neutral : COLORS[cp.owner];
    
    ctx.beginPath();
    ctx.arc(x, y, cp.radius, 0, Math.PI * 2);
    ctx.fillStyle = col.p + '15';
    ctx.fill();
    ctx.strokeStyle = col.p + '80';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (cp.capturing) {
        const cCol = COLORS[cp.capturing];
        ctx.beginPath();
        ctx.arc(x, y, cp.radius * 0.6, -Math.PI / 2, -Math.PI / 2 + (cp.progress / 100) * Math.PI * 2);
        ctx.strokeStyle = cCol.a;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    
    ctx.fillStyle = col.p;
    ctx.fillRect(x - 2, y - 18, 4, 24);
    ctx.fillStyle = col.a;
    ctx.fillRect(x + 2, y - 18, 14, 9);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cp.name, x, y - cp.radius - 10);
}

function drawMine(ctx, mine, cam) {
    const x = mine.x - cam.x, y = mine.y - cam.y;
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
    const x = b.x - cam.x, y = b.y - cam.y;
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

function drawUnit(ctx, u, cam, selected) {
    const x = u.x - cam.x, y = u.y - cam.y;
    if (x < -40 || x > ctx.canvas.width + 40 || y < -40 || y > ctx.canvas.height + 40) return;
    
    const col = COLORS[u.faction];
    const sz = u.size;
    
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
        
        if (['niska', 'halftrack'].includes(u.type)) {
            ctx.fillStyle = col.s;
            ctx.fillRect(x - sz * 0.3, y - sz * 0.2, sz * 0.6, sz * 0.4);
        }
        
        if (u.type === 'artillery') {
            ctx.strokeStyle = col.a;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + sz * 0.7, y - sz * 0.2);
            ctx.stroke();
        }
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
