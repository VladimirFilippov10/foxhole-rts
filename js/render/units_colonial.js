// ===== РЕНДЕР: ТЕХНИКА COLONIALS (танки) =====
// См. комментарий в units_warden.js — тот же принцип.

export function drawhatchet(ctx, u, sz, col) {
    if (!(u.type === 'hatchet')) return;
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

export function drawscorpion(ctx, u, sz, col) {
    if (!(u.type === 'scorpion')) return;
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

export function drawnemesis(ctx, u, sz, col) {
    if (!(u.type === 'nemesis')) return;
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

export function drawfalchion(ctx, u, sz, col) {
    if (!(u.type === 'falchion')) return;
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

export function drawspatha(ctx, u, sz, col) {
    if (!(u.type === 'spatha')) return;
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

export function drawjavelin(ctx, u, sz, col) {
    if (!(u.type === 'javelin')) return;
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

export function drawhoplite(ctx, u, sz, col) {
    if (!(u.type === 'hoplite')) return;
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

export function drawtalos(ctx, u, sz, col) {
    if (!(u.type === 'talos')) return;
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

