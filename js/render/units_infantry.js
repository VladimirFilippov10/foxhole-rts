// ===== РЕНДЕР: ПЕХОТА =====
// Общий силуэт всех юнитов пехоты + маркеры (стволики/кресты) спец-типов.
// ctx уже повёрнут в центр юнита (x,y -> 0,0, direction).
export function drawInfantry(ctx, u, sz, col) {
    const r = sz / 2;
    ctx.fillStyle = col.p;
    ctx.beginPath();
    if (u.type === 'sniper') {
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.8, -r * 0.9);
        ctx.lineTo(-r * 0.8, r * 0.9);
    } else if (u.type === 'grenadier') {
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
    ctx.stroke();

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
}
