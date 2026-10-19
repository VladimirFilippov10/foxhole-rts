// ===== РЕНДЕР: МИНИКАРТА =====

export function drawMinimap(ctx, G, canvas) {
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
