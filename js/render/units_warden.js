// ===== РЕНДЕР: ТЕХНИКА WARDENS (танки) =====
// Каждая функция рисует свой тип; вызывается из dispatcher в units_common.js.
// Контекст ctx уже повёрнут в центр юнита; sz = u.size, col = COLORS[u.faction].
// Чтобы добавить новый юнит: создайте функцию draw<type> здесь (или в другом
// файле) и зарегистрируйте её в UNIT_DRAWERS в units_common.js.

export function drawdevitt(ctx, u, sz, col) {
    if (!(u.type === 'devitt')) return;
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

export function drawking_spire(ctx, u, sz, col) {
    if (!(u.type === 'king_spire')) return;
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

export function drawsilverhand(ctx, u, sz, col) {
    if (!(u.type === 'silverhand')) return;
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

export function drawgallagher_outlaw(ctx, u, sz, col) {
    if (!(u.type === 'gallagher_outlaw')) return;
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

export function drawgallagher_highwayman(ctx, u, sz, col) {
    if (!(u.type === 'gallagher_highwayman')) return;
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

export function drawniska(ctx, u, sz, col) {
    if (!(u.type === 'niska')) return;
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

export function drawniska_blinder(ctx, u, sz, col) {
    if (!(u.type === 'niska_blinder')) return;
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

export function drawdevitt_mmr(ctx, u, sz, col) {
    if (!(u.type === 'devitt_mmr')) return;
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

export function drawnoble_widow(ctx, u, sz, col) {
    if (!(u.type === 'noble_widow')) return;
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

