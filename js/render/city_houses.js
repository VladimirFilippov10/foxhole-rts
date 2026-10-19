// ===== РЕНДЕР: ГОРОДСКИЕ ДОМА =====
// Дома внутри зон захвата городов: горят и разрушаются вместе с обороной точки.

export function drawCityHouses(ctx, cp, cam, G) {
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

export function mixHexColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
    const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
