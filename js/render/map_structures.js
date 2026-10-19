// ===== РЕНДЕР: СООРУЖЕНИЯ НА КАРТЕ =====
// Точки захвата, укрепления (бункеры), ресурсные шахты, здания базы.

export function drawCapturePoint(ctx, cp, cam) {
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

export function drawFortifications(ctx, x, y, level, col, integrity = 1) {
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

export function drawMine(ctx, mine, cam) {
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

export function drawBuilding(ctx, b, cam) {
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
