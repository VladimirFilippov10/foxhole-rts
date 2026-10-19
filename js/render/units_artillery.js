// ===== РЕНДЕР: АРТИЛЛЕРИЯ (обе фракции, ствольная + мортира god_loader) =====

export function drawgod_loader(ctx, u, sz, col) {
    if (!(u.type === 'god_loader')) return;
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

export function drawwarden_artillery120(ctx, u, sz, col) {
    if (!(u.type === 'warden_artillery120')) return;
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

export function drawwarden_artillery150(ctx, u, sz, col) {
    if (!(u.type === 'warden_artillery150')) return;
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

export function drawcolonial_artillery120(ctx, u, sz, col) {
    if (!(u.type === 'colonial_artillery120')) return;
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

export function drawcolonial_artillery150(ctx, u, sz, col) {
    if (!(u.type === 'colonial_artillery150' || u.type === 'colonial_artillery')) return;
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

