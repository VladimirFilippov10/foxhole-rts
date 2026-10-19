// ===== РЕНДЕР: ЛОГИСТИКА / ТЕХНИЧЕСКИЕ МАШИНЫ =====

export function drawtruck(ctx, u, sz, col) {
    if (!(u.type === 'truck')) return;
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

export function drawfuel_truck(ctx, u, sz, col) {
    if (!(u.type === 'fuel_truck')) return;
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

export function drawengineer(ctx, u, sz, col) {
    if (!(u.type === 'engineer')) return;
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

export function drawflatbed(ctx, u, sz, col) {
    if (!(u.type === 'flatbed')) return;
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

export function drawmedic_truck(ctx, u, sz, col) {
    if (!(u.type === 'medic_truck')) return;
    // ==== ГУСЕНИЦЫ/КОЛЁСА (колёсный фургон, 4 колеса) ====
    ctx.fillStyle = '#1a1a1a';
    // задняя ось
    ctx.fillRect(-sz * 0.34, -sz * 0.34, sz * 0.14, sz * 0.12);
    ctx.fillRect(-sz * 0.34,  sz * 0.22, sz * 0.14, sz * 0.12);
    // передняя ось
    ctx.fillRect( sz * 0.18, -sz * 0.34, sz * 0.14, sz * 0.12);
    ctx.fillRect( sz * 0.18,  sz * 0.22, sz * 0.14, sz * 0.12);

    // ==== КУЗОВ (белый медицинский фургон) ====
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.28);          // корма
    ctx.lineTo( sz * 0.22, -sz * 0.28);          // верх кабины
    ctx.lineTo( sz * 0.44, -sz * 0.16);          // скошенное лобовое стекло
    ctx.lineTo( sz * 0.44,  sz * 0.16);          // низ лба
    ctx.lineTo( sz * 0.22,  sz * 0.28);          // низ кабины
    ctx.lineTo(-sz * 0.44,  sz * 0.28);          // низ кормы
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ==== КАБИНА / ЛОБОВОЕ СТЕКЛО ====
    ctx.fillStyle = '#93c5fd';                   // голубое стекло
    ctx.beginPath();
    ctx.moveTo( sz * 0.28, -sz * 0.18);
    ctx.lineTo( sz * 0.4,  -sz * 0.1);
    ctx.lineTo( sz * 0.4,   sz * 0.1);
    ctx.lineTo( sz * 0.28,  sz * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.stroke();

    // боковые стёкла кабины
    ctx.fillStyle = '#bfdbfe';
    ctx.fillRect( sz * 0.14, -sz * 0.26, sz * 0.1, sz * 0.08);
    ctx.fillRect( sz * 0.14,  sz * 0.18, sz * 0.1, sz * 0.08);

    // ==== КРАСНАЯ ПОЛОСА ПО БОРТУ (характерный «медицинский» окрас) ====
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-sz * 0.38, -sz * 0.24, sz * 0.56, sz * 0.06);  // верхняя полоса
    ctx.fillRect(-sz * 0.38,  sz * 0.18, sz * 0.56, sz * 0.06);  // нижняя полоса

    // ==== ЗАДНЯЯ ДВЕРЬ (распашные створки с «молниями») ====
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-sz * 0.46, -sz * 0.22, sz * 0.08, sz * 0.44);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(-sz * 0.46, -sz * 0.22, sz * 0.08, sz * 0.44);
    // молнии-«зигзаги» на дверях
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.44, -sz * 0.14);
    ctx.lineTo(-sz * 0.41, -sz * 0.06);
    ctx.lineTo(-sz * 0.44,  sz * 0.02);
    ctx.lineTo(-sz * 0.41,  sz * 0.1);
    ctx.stroke();

    // ==== КРАСНЫЙ КРЕСТ НА КРЫШЕ (главный маркер) ====
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-sz * 0.16, -sz * 0.12, sz * 0.28, sz * 0.24);   // белый квадрат-фон
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-sz * 0.16, -sz * 0.12, sz * 0.28, sz * 0.24);
    ctx.fillStyle = '#dc2626';
    // вертикальная перекладина
    ctx.fillRect(-sz * 0.04, -sz * 0.1, sz * 0.08, sz * 0.2);
    // горизонтальная перекладина
    ctx.fillRect(-sz * 0.14, -sz * 0.02, sz * 0.28, sz * 0.08);

    // ==== ПРОБЛЕСКОВЫЙ МАЯЧОК (красно-синий, на крыше кабины) ====
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc( sz * 0.2, -sz * 0.12, sz * 0.035, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc( sz * 0.2,  sz * 0.12, sz * 0.035, 0, Math.PI);
    ctx.fill();
    // «дуга» мигалки
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc( sz * 0.2, 0, sz * 0.06, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // ==== ФАРЫ ====
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc( sz * 0.42, -sz * 0.2, sz * 0.025, 0, Math.PI * 2);
    ctx.arc( sz * 0.42,  sz * 0.2, sz * 0.025, 0, Math.PI * 2);
    ctx.fill();

    // ==== «+» на решётке радиатора ====
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo( sz * 0.4, -sz * 0.02);
    ctx.lineTo( sz * 0.4,  sz * 0.02);
    ctx.moveTo( sz * 0.38, 0);
    ctx.lineTo( sz * 0.42, 0);
    ctx.stroke();
}

export function drawconstruction_truck(ctx, u, sz, col) {
    if (!(u.type === 'construction_truck')) return;
            // Кабина
            ctx.fillStyle = '#f8fafc'; // Белая кабина
            ctx.fillRect(-sz * 0.45, -sz * 0.25, sz * 0.35, sz * 0.5);
            // Лобовое стекло
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(-sz * 0.35, -sz * 0.2, sz * 0.15, sz * 0.4);
            
            // Кузов
            ctx.fillStyle = '#6b7280'; // Серый кузов
            ctx.fillRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            
            // Красный кран
            ctx.fillStyle = '#dc2626';
            // Основание крана
            ctx.fillRect(-sz * 0.15, -sz * 0.1, sz * 0.1, sz * 0.2);
            // Стрела крана (повернута вперед)
            ctx.save();
            ctx.translate(-sz * 0.1, 0);
            ctx.rotate(Math.PI / 4); // Наклон
            ctx.fillRect(0, -sz * 0.04, sz * 0.4, sz * 0.08);
            ctx.restore();
            // Трос/крюк (просто линия)
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.1 + Math.cos(Math.PI/4)*sz*0.4, -Math.sin(Math.PI/4)*sz*0.4);
            ctx.lineTo(-sz * 0.1 + Math.cos(Math.PI/4)*sz*0.4, Math.sin(Math.PI/4)*sz*0.4);
            ctx.stroke();

            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Полоска запаса
            const cargoPct = u.currentCargo / u.cargoCapacity;
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-sz * 0.1, sz * 0.35, sz * 0.55 * cargoPct, 3);
        }

export function drawfire_truck(ctx, u, sz, col) {
    if (!(u.type === 'fire_truck')) return;
            // Кабина (красная, классическая)
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-sz * 0.45, -sz * 0.25, sz * 0.35, sz * 0.5);
            // Хромированная решетка
            ctx.fillStyle = '#d1d5db';
            ctx.fillRect(-sz * 0.48, -sz * 0.15, sz * 0.05, sz * 0.3);
            // Лобовое стекло
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(-sz * 0.35, -sz * 0.2, sz * 0.1, sz * 0.4);
            
            // Кузов (красный)
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz * 0.1, -sz * 0.3, sz * 0.55, sz * 0.6);
            
            // Скатки рукавов (черные цилиндры) на крыше
            ctx.fillStyle = '#111';
            ctx.fillRect(-sz * 0.05, -sz * 0.25, sz * 0.45, sz * 0.06);
            ctx.fillRect(-sz * 0.05, sz * 0.19, sz * 0.45, sz * 0.06);
            
            // Мигалка (синяя/красная)
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(-sz * 0.2, -sz * 0.3, sz * 0.04, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(-sz * 0.2, sz * 0.3, sz * 0.04, 0, Math.PI * 2);
            ctx.fill();
            
            // Колёса
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(-sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.arc(sz * 0.3, sz * 0.3, sz * 0.12, 0, Math.PI * 2);
            ctx.fill();
            
            // Полоска воды
            const waterPct = u.currentCargo / u.cargoCapacity;
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(-sz * 0.1, sz * 0.35, sz * 0.55 * waterPct, 3);
        }

