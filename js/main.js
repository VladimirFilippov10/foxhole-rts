// ===== MAIN ENTRY POINT =====
import { VEHICLE_COSTS, dist, GAME_MODES } from './constants.js';
import { createVehicle, FACTION_VEHICLES } from './vehicles.js';
import { getCapturePointsInWorld, getResourcePointsInWorld } from './map.js';
import { Game } from './game.js';
import { render } from './renderer.js';

let canvas, ctx;
let game = null;
// Глобальное состояние клавиш — не зависит от того, создана ли уже игра.
const globalKeys = {};
let selectedMap = 'deadlands';
let selectedFaction = 'wardens';
let selectedGameMode = 'normal';
let lastClickTime = 0;
let factoryMenuOpen = false;
let aoeMode = false;
let selectedCapturePoint = null;
let factoryMenuFactory = null;

// ===== Перемещаемые окна (drag за заголовок) =====
function initDraggableWindow(el, handleSelector) {
    if (el._draggableInit) return;
    el._draggableInit = true;
    const handle = handleSelector ? el.querySelector(handleSelector) : el.querySelector('h3');
    if (!handle) return;
    handle.style.cursor = 'move';
    handle.style.userSelect = 'none';
    let startX = 0, startY = 0, origLeft = 0, origTop = 0, dragging = false;

    handle.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origLeft = el.offsetLeft;
        origTop = el.offsetTop;

        const onMove = ev => {
            if (!dragging) return;
            const maxLeft = window.innerWidth - el.offsetWidth;
            const maxTop = window.innerHeight - el.offsetHeight;
            el.style.left = Math.max(0, Math.min(maxLeft, origLeft + ev.clientX - startX)) + 'px';
            el.style.top = Math.max(0, Math.min(maxTop, origTop + ev.clientY - startY)) + 'px';
        };
        const onUp = () => {
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// Vehicle info for factory menu
const VEHICLE_INFO = {
    infantry: { name: 'Пехота', icon: '🔫', stats: 'HP:50 DMG:8 SPD:0.8', cost: VEHICLE_COSTS.infantry },
    
    // Wardens tanks
    king_spire: { name: 'King Spire Mk.I', icon: '🔍', stats: 'HP:135 DMG:15 RNG:140 SPD:1.4 Разведка', cost: VEHICLE_COSTS.king_spire },
    devitt: { name: 'Devitt Mk.III', icon: '🚗', stats: 'HP:195 DMG:45 RNG:160 SPD:1.6 40мм пушка', cost: VEHICLE_COSTS.devitt },
    silverhand: { name: 'Silverhand Mk.IV', icon: '💪', stats: 'HP:310 DMG:65 RNG:170 SPD:1.5 40мм+68мм', cost: VEHICLE_COSTS.silverhand },
    gallagher_highwayman: { name: 'Gallagher Highwayman', icon: '⚡', stats: 'HP:295 DMG:35 RNG:165 SPD:1.7 Буст', cost: VEHICLE_COSTS.gallagher_highwayman },
    niska: { name: 'Niska APC', icon: '🚙', stats: 'HP:260 DMG:10 RNG:150 SPD:1.8 БТР', cost: VEHICLE_COSTS.niska },
    warden_artillery: { name: 'Warden Artillery', icon: '🎯', stats: 'HP:100 DMG:85 RNG:150-500 AoE:80 SPD:0.3', cost: VEHICLE_COSTS.warden_artillery },
    
    // Colonials tanks
    hatchet: { name: 'H-5 Hatchet', icon: '🪓', stats: 'HP:195 DMG:45 RNG:160 SPD:1.6 40мм пушка', cost: VEHICLE_COSTS.hatchet },
    scorpion: { name: 'HC-2 Scorpion', icon: '🦂', stats: 'HP:330 DMG:20 RNG:130 SPD:1.3 Пулеметы x2', cost: VEHICLE_COSTS.scorpion },
    nemesis: { name: '90T-v Nemesis', icon: '🔥', stats: 'HP:365 DMG:70 RNG:175 SPD:1.7 68мм+гранатомет', cost: VEHICLE_COSTS.nemesis },
    falchion: { name: 'Falchion', icon: '⚔️', stats: 'HP:480 DMG:60 RNG:170 SPD:1.0', cost: VEHICLE_COSTS.falchion },
    hoplite: { name: 'Hoplite APC', icon: '🛡️', stats: 'HP:200 DMG:5 RNG:140 SPD:1.6 БТР', cost: VEHICLE_COSTS.hoplite },
    colonial_artillery: { name: 'Colonial Artillery', icon: '🎯', stats: 'HP:110 DMG:75 RNG:120-400 AoE:70 SPD:0.6', cost: VEHICLE_COSTS.colonial_artillery },
    
    // Logistics
    truck: { name: 'Грузовик', icon: '🚚', stats: 'HP:120 SPD:1.8 Пополняет БК', cost: VEHICLE_COSTS.truck },
    fuel_truck: { name: 'Бензовоз', icon: '⛽', stats: 'HP:140 SPD:1.6 Пополняет топливо', cost: VEHICLE_COSTS.fuel_truck },
    engineer: { name: 'Инженер', icon: '🔧', stats: 'HP:160 SPD:1.2 Ремонтирует технику', cost: VEHICLE_COSTS.engineer },
    flatbed: { name: 'Flatbed', icon: '🚛', stats: 'HP:150 SPD:1.5 Перевозит снаряды', cost: VEHICLE_COSTS.flatbed },
};

// Defense upgrade info
const DEFENSE_UPGRADE_INFO = [
    { level: 1, name: 'Оборона Уровень 1', icon: '🛡️', stats: 'DMG:15 RNG:120', cost: { s: 50, c: 30, m: 40 } },
    { level: 2, name: 'Оборона Уровень 2', icon: '🛡️🛡️', stats: 'DMG:25 RNG:150', cost: { s: 100, c: 60, m: 80 } },
    { level: 3, name: 'Оборона Уровень 3', icon: '🛡️🛡️🛡️', stats: 'DMG:40 RNG:180', cost: { s: 150, c: 90, m: 120 } },
];

// Initialize
window.addEventListener('load', () => {
    try {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Input handlers
        // Исправлено: раньше при `game === null` (например, на экране меню) происходило
        // обращение к game.keys и падало "Uncaught TypeError: Cannot read properties of null".
        // Теперь ключи хранятся в независимом объекте globalKeys и передаются в игру.
        window.addEventListener('keydown', e => {
            globalKeys[e.key.toLowerCase()] = true;
            if (game) game.keys = globalKeys;
        });
        window.addEventListener('keyup', e => {
            globalKeys[e.key.toLowerCase()] = false;
            if (game) game.keys = globalKeys;
        });
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Окно очереди производства юнитов — перемещаемое (drag за заголовок)
        initDraggableWindow(document.getElementById('productionQueue'), '#productionQueueHeader');
        
        console.log('✅ Игра инициализирована успешно');
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Screen management
window.showMapSelect = function() {
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('mapSelectScreen').classList.remove('hidden');
};

window.showGameInfo = function() {
    document.getElementById('menuScreen').classList.add('hidden');
    document.getElementById('gameInfoScreen').classList.remove('hidden');
};

window.hideGameInfo = function() {
    document.getElementById('gameInfoScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
};

window.selectMap = function(map) {
    selectedMap = map;
    document.getElementById('mapSelectScreen').classList.add('hidden');
    document.getElementById('factionScreen').classList.remove('hidden');
};

window.selectFaction = function(faction) {
    selectedFaction = faction;
    document.getElementById('factionScreen').classList.add('hidden');
    document.getElementById('settingsScreen').classList.remove('hidden');
};

window.selectGameMode = function(mode) {
    selectedGameMode = mode;
    document.getElementById('settingsScreen').classList.add('hidden');
    startGame();
};

window.backToMainMenu = function() {
    document.getElementById('mapSelectScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.remove('hidden');
};

window.backToMapSelect = function() {
    document.getElementById('settingsScreen').classList.add('hidden');
    document.getElementById('factionScreen').classList.add('hidden');
    document.getElementById('mapSelectScreen').classList.remove('hidden');
};

function startGame() {
    try {
        console.log('🎮 Запуск игры...');
        
        document.getElementById('hudTop').style.display = 'flex';
        document.getElementById('controlsHint').style.display = 'block';
        
        const badge = document.getElementById('factionBadge');
        badge.className = 'faction-badge ' + selectedFaction;
        badge.innerHTML = selectedFaction === 'wardens' ? '🛡️ WARDENS' : '⚔️ COLONIALS';
        
        // Show game mode in HUD
        const modeInfo = document.getElementById('gameModeInfo');
        if (modeInfo) {
            const mode = GAME_MODES[selectedGameMode];
            modeInfo.textContent = `${mode.icon} ${mode.name}`;
        }
        
        // Create game with selected mode
        game = new Game(selectedFaction, selectedGameMode);
        // Передаём текущее состояние клавиш в игру (см. globalKeys выше)
        game.keys = globalKeys;
        
        // Set starting resources based on game mode
        const startRes = GAME_MODES[selectedGameMode].startingResources;
        game.res = { ...startRes };
        
        // Setup map
        const cps = getCapturePointsInWorld();
        const mines = getResourcePointsInWorld();
        
        // Find player and AI bases
        // Wardens: Callahan Gate (index 0)
        // Colonials: The Salt March (index 13)
        const playerBaseIdx = selectedFaction === 'wardens' ? 0 : 13;
        const aiBaseIdx = selectedFaction === 'wardens' ? 13 : 0;
        
        // Set ownership
        cps[playerBaseIdx].owner = selectedFaction;
        cps[playerBaseIdx].progress = 100;
        cps[aiBaseIdx].owner = game.ai;
        cps[aiBaseIdx].progress = 100;
        
        const playerBase = cps[playerBaseIdx];
        const aiBase = cps[aiBaseIdx];
        
        // Create buildings
        const buildings = [];
        let nextId = 1;
        const uid = () => 'b' + (nextId++);
        
        // Player buildings
        buildings.push({ id: uid(), type: 'town_hall', faction: selectedFaction, x: playerBase.x - 50, y: playerBase.y - 50, hp: 2000, maxHp: 2000 });
        buildings.push({ id: uid(), type: 'barracks', faction: selectedFaction, x: playerBase.x + 80, y: playerBase.y - 30, hp: 800, maxHp: 800 });
        buildings.push({ id: uid(), type: 'factory', faction: selectedFaction, x: playerBase.x - 30, y: playerBase.y + 100, hp: 1000, maxHp: 1000 });
        
        // AI buildings
        buildings.push({ id: uid(), type: 'town_hall', faction: game.ai, x: aiBase.x + 50, y: aiBase.y - 50, hp: 2000, maxHp: 2000 });
        buildings.push({ id: uid(), type: 'barracks', faction: game.ai, x: aiBase.x - 80, y: aiBase.y - 30, hp: 800, maxHp: 800 });
        buildings.push({ id: uid(), type: 'factory', faction: game.ai, x: aiBase.x + 30, y: aiBase.y + 100, hp: 1000, maxHp: 1000 });
        
        // Create starting units
        const units = [];
        
        // Player units - use faction-specific vehicles
        units.push(createVehicle('infantry', selectedFaction, playerBase.x + 30, playerBase.y + 50));
        units.push(createVehicle('infantry', selectedFaction, playerBase.x + 50, playerBase.y + 50));
        units.push(createVehicle('infantry', selectedFaction, playerBase.x + 70, playerBase.y + 50));
        
        // Wardens start with Devitt, Colonials with Hatchet
        const playerLightTank = selectedFaction === 'wardens' ? 'devitt' : 'hatchet';
        units.push(createVehicle(playerLightTank, selectedFaction, playerBase.x, playerBase.y + 120));
        
        // AI units
        units.push(createVehicle('infantry', game.ai, aiBase.x - 30, aiBase.y + 50));
        units.push(createVehicle('infantry', game.ai, aiBase.x - 50, aiBase.y + 50));
        units.push(createVehicle('infantry', game.ai, aiBase.x - 70, aiBase.y + 50));
        
        const aiAPC = game.ai === 'wardens' ? 'niska' : 'hoplite';
        units.push(createVehicle(aiAPC, game.ai, aiBase.x, aiBase.y + 120));
        
        const aiAssaultTank = game.ai === 'wardens' ? 'gallagher_highwayman' : 'falchion';
        units.push(createVehicle(aiAssaultTank, game.ai, aiBase.x + 50, aiBase.y - 30));
        
        // Initialize game
        game.init(cps, mines, buildings, units);
        game.notify = notify;
        
        console.log('✅ Игра инициализирована, запуск игрового цикла...');
        
        // Start game loop
        gameLoop();
    } catch (error) {
        console.error('❌ Ошибка при запуске игры:', error);
        alert('Ошибка при запуске игры: ' + error.message);
    }
}

function gameLoop() {
    if (!game) return;
    
    try {
        game.update();
        render(ctx, game, canvas);
        
        // Update HUD
        document.getElementById('rSup').textContent = Math.floor(game.res.s);
        document.getElementById('rComp').textContent = Math.floor(game.res.c);
        document.getElementById('rMat').textContent = Math.floor(game.res.m);
        document.getElementById('tCount').textContent = game.cps.filter(c => c.owner === game.faction).length;
        
        // Update unit limits display
        const limits = game.getUnitLimits(game.faction);
        const counts = game.getUnitCounts(game.faction);
        const limitsEl = document.getElementById('unitLimits');
        if (limitsEl) {
            limitsEl.innerHTML = `
                <div style="font-size:0.7rem;color:#9ca3af;">
                    <div>🔫 Пехота: ${counts.infantry}/${limits.infantry}</div>
                    <div>🚗 Техника: ${counts.vehicles}/${limits.vehicles}</div>
                </div>
            `;
        }
        
        // Обновляем очередь производства (всегда видна слева вверху)
        updateProductionQueueUI();
        
        updateSelInfo();
        
        if (game.over) {
            showEndScreen();
            return;
        }
    } catch (error) {
        console.error('❌ Ошибка в игровом цикле:', error);
    }
    
    requestAnimationFrame(gameLoop);
}

function updateSelInfo() {
    const el = document.getElementById('selInfo');
    if (game.selected.length > 0) {
        const units = game.units.filter(u => game.selected.includes(u.id));
        const types = {};
        units.forEach(u => { types[u.label] = (types[u.label] || 0) + 1; });
        
        let html = `<p style="font-weight:bold;margin-bottom:4px;">Выбрано: ${units.length} юнитов</p>`;
        Object.entries(types).forEach(([t, c]) => { html += `<p class="sel-type">${t} ×${c}</p>`; });
        
        // Show stats for first selected unit
        if (units.length === 1) {
            const u = units[0];
            const reloadProgress = Math.min(100, ((u.gameTime - u.lastAtk) / u.cd) * 100);
            html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #374151;">`;
            html += `<p style="font-size:0.7rem;color:#9ca3af;">HP: ${Math.floor(u.hp)}/${u.maxHp}</p>`;
            html += `<p style="font-size:0.7rem;color:#9ca3af;">DMG: ${u.dmg}</p>`;
            html += `<p style="font-size:0.7rem;color:#9ca3af;">RNG: ${u.range}</p>`;
            html += `<p style="font-size:0.7rem;color:#9ca3af;">SPD: ${u.spd}</p>`;
            html += `<p style="font-size:0.7rem;color:#9ca3af;">CD: ${(u.cd / 60).toFixed(1)}s</p>`;
            html += `<p style="font-size:0.7rem;color:${reloadProgress >= 100 ? '#22c55e' : '#fbbf24'};">Reload: ${Math.floor(reloadProgress)}%</p>`;
            
            // Display ammo and fuel if available
            if (u.ammo !== undefined && u.maxAmmo > 0) {
                const ammoPct = (u.ammo / u.maxAmmo) * 100;
                html += `<p style="font-size:0.7rem;color:#f97316;">🔫 БК: ${Math.floor(u.ammo)}/${u.maxAmmo} (${Math.floor(ammoPct)}%)</p>`;
            }
            if (u.fuel !== undefined && u.maxFuel > 0) {
                const fuelPct = (u.fuel / u.maxFuel) * 100;
                html += `<p style="font-size:0.7rem;color:#3b82f6;">⛽ Топливо: ${Math.floor(u.fuel)}/${u.maxFuel} (${Math.floor(fuelPct)}%)</p>`;
            }
            
            // Display cargo for logistics vehicles
            if (u.currentCargo !== undefined && u.cargoCapacity > 0) {
                const cargoPct = (u.currentCargo / u.cargoCapacity) * 100;
                const cargoType = u.cargoType === 'ammo' ? '📦 БК' : u.cargoType === 'fuel' ? '⛽ Топливо' : u.cargoType === 'repair' ? '🔧 Материалы' : '🎯 Снаряды';
                html += `<p style="font-size:0.7rem;color:#a855f7;">${cargoType}: ${Math.floor(u.currentCargo)}/${u.cargoCapacity} (${Math.floor(cargoPct)}%)</p>`;
            }
            
            if (u.aoe) {
                html += `<p style="font-size:0.7rem;color:#f97316;">AoE: ${u.aoeRadius}</p>`;
            }
            html += `</div>`;
        }
        
        el.innerHTML = html;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// ===== Приказ движения (ПКМ / двойной клик / режим движения) =====
// ИСПРАВЛЕНИЕ БАГА «артиллерия игрока исчезает после начала движения»:
// раньше всем юнитам (включая арту) выдавалось построение со смещением
// (col - cols/2)*25. Для ОДНОГО выбранного юнита смещение = -12.5px — цель
// оказывалась почти под ногами, и арта с её логикой отъезда (retreatOrder)
// бесконечно переставляла приказ, «ехала на месте» и в итоге останавливалась
// у стены обороны, где её расстреливали — визуально она «пропадала».
// Теперь: одиночные юниты и артиллерия идут ТОЧНО в точку клика (смещение 0),
// при получении приказа игроком старые AI-приказы отъезда/выдвижения сбрасываются.
function issueMoveOrder(selUnits, worldX, worldY) {
    const cols = Math.ceil(Math.sqrt(selUnits.length));
    selUnits.forEach((u, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        // Строй только для группы НЕ-артиллерии; одиночный юнит и арта — точно в клик
        const offset = (selUnits.length > 1 && !u.aoe) ? 25 : 0;
        u.tx = worldX + (col - cols / 2) * offset;
        u.ty = worldY + (row - cols / 2) * offset;
        if (u.aoe) {
            // Сбрасываем прежние приказы отъезда/выдвижения (в т.ч. выданные ИИ-логикой)
            u.retreatOrder = null;
            u.moveOrder = null;
            u.stuckCounter = 0;
        }
    });
}

// Input handlers
function handleMouseDown(e) {
    if (!game) return;
    e.preventDefault();
    
    const now = Date.now();
    const isDouble = (now - lastClickTime) < 350;
    lastClickTime = now;
    
    const worldX = e.clientX + game.cam.x;
    const worldY = e.clientY + game.cam.y;
    
    // Right click - move units
    if (e.button === 2) {
        if (game.selected.length > 0) {
            const selUnits = game.units.filter(u => game.selected.includes(u.id));
            issueMoveOrder(selUnits, worldX, worldY);
            // Add move indicator particles
            game.addParticles(worldX, worldY, '#22c55e', 5);
        }
        return;
    }
    
    // Check minimap click
    const mw = 180, mh = 120;
    const mx = canvas.width - mw - 10, my = canvas.height - mh - 50;
    if (e.clientX >= mx && e.clientX <= mx + mw && e.clientY >= my && e.clientY <= my + mh) {
        const mapW = 3000, mapH = 2250;
        const clickX = (e.clientX - mx) / mw;
        const clickY = (e.clientY - my) / mh;
        game.cam.x = Math.max(0, Math.min(mapW - canvas.width, clickX * mapW - canvas.width / 2));
        game.cam.y = Math.max(0, Math.min(mapH - canvas.height, clickY * mapH - canvas.height / 2));
        return;
    }
    
    // Check factory click
    const clickedFactory = game.buildings.find(b => 
        b.type === 'factory' && b.faction === game.faction && 
        dist(b.x, b.y, worldX, worldY) < 30
    );
    
    if (clickedFactory && !isDouble && !game.moveMode && !aoeMode) {
        openFactoryMenu(clickedFactory, e.clientX, e.clientY);
        return;
    }
    
    // AoE mode - set artillery target
    if (aoeMode && game.selected.length > 0) {
        const selUnits = game.units.filter(u => game.selected.includes(u.id));
        const artilleryUnits = selUnits.filter(u => u.aoe);
        
        if (artilleryUnits.length > 0) {
            artilleryUnits.forEach(u => {
                u.aoeTarget = { x: worldX, y: worldY };
            });
            aoeMode = false;
            const btn = document.getElementById('aoeBtn');
            btn.style.borderColor = '#374151';
            btn.style.background = 'rgba(17,24,39,0.9)';
        }
        return;
    }
    
    // Check if clicked on a flag (capture point) - only if clicked very close to flag
    const clickedFlag = game.cps.find(cp => {
        const d = dist(cp.x, cp.y, worldX, worldY);
        // Only trigger defense panel if clicked within 30px of flag center (not entire territory)
        return d <= 30 && cp.owner === game.faction;
    });
    
    if (clickedFlag && !isDouble && !game.moveMode && !aoeMode) {
        selectedCapturePoint = clickedFlag;
        openDefensePanel(clickedFlag, e.clientX, e.clientY);
        return;
    }
    
    // Double click or move mode - move units
    if (isDouble || game.moveMode) {
        if (game.selected.length > 0) {
            const selUnits = game.units.filter(u => game.selected.includes(u.id));
            issueMoveOrder(selUnits, worldX, worldY);
        }
        if (game.moveMode) {
            game.moveMode = false;
            document.getElementById('modeIndicator').classList.add('hidden');
        }
        return;
    }
    
    // Select units
    const clickedUnit = game.units.find(u => 
        dist(u.x, u.y, worldX, worldY) < 25 && u.faction === game.faction
    );
    
    if (clickedUnit) {
        game.selected = [clickedUnit.id];
    } else {
        game.selected = game.units.filter(u => 
            dist(u.x, u.y, worldX, worldY) < 60 && u.faction === game.faction
        ).map(u => u.id);
    }
}

function handleMouseMove(e) {
    if (!game) return;
    game.mousePos = { x: e.clientX, y: e.clientY };
    
    // Edge scrolling
    const edge = 30;
    if (e.clientX < edge) game.cam.x -= 5;
    if (e.clientX > canvas.width - edge) game.cam.x += 5;
    if (e.clientY < edge) game.cam.y -= 5;
    if (e.clientY > canvas.height - edge) game.cam.y += 5;
}

// UI functions
window.toggleMoveMode = function() {
    if (!game) return;
    game.moveMode = !game.moveMode;
    document.getElementById('modeIndicator').classList.toggle('hidden', !game.moveMode);
};

// ===== Вкладки производства: Пехота / Техника / Снабжение / Поддержка =====
const PRODUCTION_TABS = [
    { id: 'infantry',   label: '🔫 Пехота' },
    { id: 'vehicles',   label: '🚗 Техника' },
    { id: 'supply',     label: '📦 Снабжение' },
    { id: 'support',    label: '🎯 Поддержка' },
];

// Раскладка типов юнитов по вкладкам (для обеих фракций)
const TAB_TYPES = {
    infantry: ['infantry'],
    vehicles: ['king_spire', 'devitt', 'silverhand', 'gallagher_highwayman', 'niska',
               'hatchet', 'scorpion', 'nemesis', 'falchion', 'hoplite'],
    supply:   ['truck', 'fuel_truck', 'engineer', 'flatbed'],
    support:  ['warden_artillery', 'colonial_artillery'], // пока только арта
};

let factoryTab = 'infantry';

function openFactoryMenu(factory, mx, my) {
    factoryMenuOpen = true;
    const menu = document.getElementById('factoryMenu');
    menu.classList.remove('hidden');
    menu.style.left = Math.min(mx, window.innerWidth - 340) + 'px';
    menu.style.top = Math.min(my, window.innerHeight - 400) + 'px';

    // Запоминаем текущий завод и делаем заголовок окна перетаскиваемым
    factoryMenuFactory = factory;
    initDraggableWindow(menu);

    // Контейнер вкладок создаём один раз
    const grid = document.getElementById('unitGrid');
    let tabsEl = document.getElementById('factoryTabs');
    if (!tabsEl) {
        tabsEl = document.createElement('div');
        tabsEl.id = 'factoryTabs';
        tabsEl.style.cssText = 'display:flex;gap:4px;margin-bottom:0.6rem;flex-wrap:wrap;';
        menu.insertBefore(tabsEl, grid);
    }
    renderFactoryTabs(tabsEl, factory, grid);
}

function renderFactoryTabs(tabsEl, factory, grid) {
    tabsEl.innerHTML = '';
    PRODUCTION_TABS.forEach(tab => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        const active = tab.id === factoryTab;
        btn.style.cssText = `padding:4px 10px;border-radius:6px;font-size:0.72rem;cursor:pointer;` +
            (active ? 'background:#2563eb;color:#fff;border:1px solid #60a5fa;'
                    : 'background:rgba(17,24,39,0.9);color:#d1d5db;border:1px solid #374151;');
        btn.onclick = () => {
            factoryTab = tab.id;
            renderFactoryTabs(tabsEl, factory, grid);
        };
        tabsEl.appendChild(btn);
    });
    renderTabUnits(grid, factory);
}

function renderTabUnits(grid, factory) {
    grid.innerHTML = '';
    const factionPool = ['infantry', ...FACTION_VEHICLES[game.faction]];
    const types = (TAB_TYPES[factoryTab] || []).filter(t => factionPool.includes(t));

    if (types.length === 0) {
        grid.innerHTML = '<div style="color:#9ca3af;font-size:0.75rem;">Нет доступных юнитов в этой вкладке</div>';
        return;
    }

    types.forEach(type => {
        const info = VEHICLE_INFO[type];
        const canAfford = game.res.s >= info.cost.s && game.res.c >= info.cost.c && game.res.m >= info.cost.m;
        const card = document.createElement('div');
        card.className = 'unit-card' + (canAfford ? '' : ' disabled');
        card.innerHTML = `
            <div class="unit-name">${info.icon} ${info.name}</div>
            <div class="unit-stats">${info.stats}</div>
            <div class="unit-cost">S:${info.cost.s} C:${info.cost.c} M:${info.cost.m}</div>
        `;
        if (canAfford) {
            card.onclick = () => {
                trainUnit(type, factory);
            };
        }
        grid.appendChild(card);
    });
}

function updateProductionQueueUI() {
    const queueContainer = document.getElementById('productionQueue');
    const queueContent = document.getElementById('productionQueueContent');
    
    if (!queueContainer || !queueContent || !game) return;
    
    // Получаем все заводы игрока
    const playerFactories = game.buildings.filter(b => b.type === 'factory' && b.faction === game.faction);
    
    // Собираем все элементы очереди со всех заводов
    let allQueueItems = [];
    playerFactories.forEach(factory => {
        const queue = game.getProductionProgress(factory.id);
        allQueueItems = allQueueItems.concat(queue);
    });
    
    // Если очередь пустая - скрываем контейнер
    if (allQueueItems.length === 0) {
        queueContainer.style.display = 'none';
        return;
    }
    
    // Показываем контейнер
    queueContainer.style.display = 'block';
    
    // Генерируем HTML для очереди
    let queueHtml = '';
    
    allQueueItems.forEach((item, index) => {
        const info = VEHICLE_INFO[item.type];
        const elapsed = game.time - item.startTime;
        const buildTimeTicks = item.buildTime * 60;
        const progress = Math.min(100, (elapsed / buildTimeTicks) * 100);
        const remainingTime = Math.max(0, Math.ceil((buildTimeTicks - elapsed) / 60));
        
        queueHtml += `
            <div style="margin-bottom:0.5rem;">
                <div style="font-size:0.7rem;color:#d1d5db;">${info.icon} ${info.name}</div>
                <div style="background:#1f2937;height:6px;border-radius:3px;overflow:hidden;margin-top:3px;border:1px solid #374151;">
                    <div style="background:linear-gradient(90deg, #60a5fa, #3b82f6);height:100%;width:${progress}%;"></div>
                </div>
                <div style="font-size:0.65rem;color:#9ca3af;margin-top:3px;display:flex;justify-content:space-between;">
                    <span>${Math.floor(progress)}%</span>
                    <span>${remainingTime}с</span>
                </div>
            </div>
        `;
    });
    
    queueContent.innerHTML = queueHtml;
}

function trainUnit(type, factory) {
    if (!game || !factory) return;
    
    const info = VEHICLE_INFO[type];
    const cost = info.cost;
    
    // Проверка лимитов юнитов
    if (!game.canProduceUnit(type, game.faction)) {
        const limits = game.getUnitLimits(game.faction);
        const counts = game.getUnitCounts(game.faction);
        
        if (type === 'infantry') {
            notify(`Достигнут лимит пехоты! (${counts.infantry}/${limits.infantry}) Захватите больше точек для увеличения лимита.`);
        } else {
            notify(`Достигнут лимит техники! (${counts.vehicles}/${limits.vehicles}) Захватите больше точек для увеличения лимита.`);
        }
        return;
    }
    
    if (game.res.s < cost.s || game.res.c < cost.c || game.res.m < cost.m) {
        notify('Недостаточно ресурсов!');
        return;
    }
    
    game.res.s -= cost.s;
    game.res.c -= cost.c;
    game.res.m -= cost.m;
    
    // Добавляем в очередь производства
    const buildTime = cost.buildTime || 10; // По умолчанию 10 секунд
    game.addToProductionQueue(type, game.faction, factory.id, buildTime);
    notify(`${info.name} поставлен в очередь (${buildTime}с)`);
}

window.closeFactoryMenu = function() {
    document.getElementById('factoryMenu').classList.add('hidden');
    factoryMenuOpen = false;
};

window.toggleMoveMode = function() {
    if (!game) return;
    game.moveMode = !game.moveMode;
    const btn = document.getElementById('moveBtn');
    const indicator = document.getElementById('modeIndicator');
    
    if (game.moveMode) {
        btn.style.borderColor = '#fbbf24';
        btn.style.background = 'rgba(251,191,36,0.15)';
        indicator.classList.remove('hidden');
    } else {
        btn.style.borderColor = '#374151';
        btn.style.background = 'rgba(17,24,39,0.9)';
        indicator.classList.add('hidden');
    }
};

window.toggleAoEMode = function() {
    if (!game) return;
    aoeMode = !aoeMode;
    const btn = document.getElementById('aoeBtn');
    
    if (aoeMode) {
        btn.style.borderColor = '#ef4444';
        btn.style.background = 'rgba(239,68,68,0.15)';
    } else {
        btn.style.borderColor = '#374151';
        btn.style.background = 'rgba(17,24,39,0.9)';
    }
};

function openDefensePanel(cp, mx, my) {
    // Инициализируем defenseLevel если его нет
    if (cp.defenseLevel === undefined) {
        cp.defenseLevel = 0;
    }
    
    const panel = document.getElementById('defensePanel');
    panel.classList.remove('hidden');
    panel.style.left = Math.min(mx, window.innerWidth - 380) + 'px';
    panel.style.top = Math.min(my, window.innerHeight - 400) + 'px';

    // Окно улучшения обороны тоже можно перемещать за заголовок
    initDraggableWindow(panel);

    const info = document.getElementById('defenseInfo');
    let extra = '';
    // Прочность обороны города (очки прочности)
    if (typeof game.getCityDefenseDisplayInfo === 'function') {
        const dinfo = game.getCityDefenseDisplayInfo(cp);
        if (dinfo) {
            extra += `<div>Прочность обороны: <strong style="color:${dinfo.broken ? '#ef4444' : '#22c55e'};">${dinfo.integrity}</strong>${dinfo.broken ? ' <span style="color:#ef4444;font-size:0.7rem;">(оборона сломлена — город можно захватить)</span>' : ' <span style="color:#9ca3af;font-size:0.7rem;">(вражеская техника не может въехать в город)</span>'}</div>`;
        }
    }
    // Время улучшения обороны (прогресс)
    const upg = typeof game.getDefenseUpgradeProgress === 'function' ? game.getDefenseUpgradeProgress(cp) : null;
    if (upg) {
        extra += `
            <div style="margin-top:0.5rem;">
                <div style="font-size:0.75rem;color:#fbbf24;">Улучшение до уровня ${upg.targetLevel}: ${Math.floor(upg.percent)}% (${upg.remaining}с)</div>
                <div style="background:#1f2937;height:6px;border-radius:3px;overflow:hidden;margin-top:3px;border:1px solid #374151;">
                    <div style="background:linear-gradient(90deg,#fbbf24,#f59e0b);height:100%;width:${upg.percent}%;"></div>
                </div>
            </div>`;
    } else {
        const nextTime = cp.defenseLevel < 3 ? game.getDefenseUpgradeTime(cp.defenseLevel + 1) : null;
        if (nextTime) extra += `<div style="font-size:0.7rem;color:#9ca3af;margin-top:0.25rem;">Следующее улучшение займёт ${nextTime}с</div>`;
    }

    info.innerHTML = `
        <div style="font-weight:bold;color:#60a5fa;margin-bottom:0.5rem;">${cp.name}</div>
        <div>Текущий уровень обороны: <strong style="color:#fbbf24;">${cp.defenseLevel}/3</strong></div>
        ${extra}
    `;
    
    const levels = document.getElementById('defenseLevels');
    const defenseInfo = [
        { level: 1, name: 'Уровень 1', icon: '🛡️', stats: 'DMG:15 RNG:120 HP:300', cost: { s: 50, c: 30, m: 40 } },
        { level: 2, name: 'Уровень 2', icon: '🛡️🛡️', stats: 'DMG:25 RNG:150 HP:600', cost: { s: 100, c: 60, m: 80 } },
        { level: 3, name: 'Уровень 3', icon: '🛡️🛡️🛡️', stats: 'DMG:40 RNG:180 HP:1000 + защита от артиллерии', cost: { s: 150, c: 90, m: 120 } },
    ];
    
    levels.innerHTML = defenseInfo.map(d => {
        const currentLevel = cp.defenseLevel || 0;
        const canUpgrade = currentLevel === d.level - 1; // Можно улучшить только на следующий уровень
        const isCurrent = currentLevel === d.level;
        const isPast = currentLevel > d.level;
        const canAfford = game.res.s >= d.cost.s && game.res.c >= d.cost.c && game.res.m >= d.cost.m;
        const upgTime = game.getDefenseUpgradeTime ? game.getDefenseUpgradeTime(d.level) : null;

        let status = '';
        let cardClass = 'unit-card';

        if (cp.upgrading) {
            cardClass += ' disabled';
            status = '<div style="color:#fbbf24;font-size:0.6rem;margin-top:0.25rem;">Улучшение уже идёт...</div>';
        } else if (isCurrent) {
            status = '<div style="color:#22c55e;font-weight:bold;margin-top:0.25rem;">✓ Текущий уровень</div>';
        } else if (isPast) {
            status = '<div style="color:#6b7280;font-size:0.6rem;margin-top:0.25rem;">✓ Улучшено</div>';
        } else if (!canUpgrade) {
            cardClass += ' disabled';
            status = '<div style="color:#6b7280;font-size:0.6rem;margin-top:0.25rem;">Сначала улучшите предыдущий уровень</div>';
        } else if (!canAfford) {
            cardClass += ' disabled';
            status = '<div style="color:#ef4444;font-size:0.6rem;margin-top:0.25rem;">Недостаточно ресурсов</div>';
        }
        
        return `
            <div class="${cardClass}" style="margin-bottom:0.5rem;${canUpgrade && canAfford && !cp.upgrading ? 'cursor:pointer;' : ''}" 
                 ${canUpgrade && canAfford && !cp.upgrading ? `onclick="upgradeDefense(${d.level})"` : ''}>
                <div class="unit-name">${d.icon} ${d.name}</div>
                <div class="unit-stats">${d.stats}</div>
                <div class="unit-cost">S:${d.cost.s} C:${d.cost.c} M:${d.cost.m}${upgTime ? ` | Время: ${upgTime}с` : ''}</div>
                ${status}
            </div>
        `;
    }).join('');
}

// Периодическое обновление панели обороны (прогресс улучшения занимает время)
setInterval(() => {
    if (!game || game.over) return;
    const panel = document.getElementById('defensePanel');
    if (panel && !panel.classList.contains('hidden') && selectedCapturePoint) {
        openDefensePanel(selectedCapturePoint,
            parseInt(panel.style.left) || 0,
            parseInt(panel.style.top) || 0);
    }
}, 1000);

window.closeDefensePanel = function() {
    document.getElementById('defensePanel').classList.add('hidden');
    selectedCapturePoint = null;
};

window.upgradeDefense = function(level) {
    if (!selectedCapturePoint) return;
    
    const cpIndex = game.cps.indexOf(selectedCapturePoint);
    const result = game.upgradeTerritoryDefense(cpIndex);
    
    if (result) {
        const time = game.getDefenseUpgradeTime ? game.getDefenseUpgradeTime(level) : 0;
        notify(`${selectedCapturePoint.name}: улучшение обороны до уровня ${level} — ${time}с`);
        // Обновляем панель
        openDefensePanel(selectedCapturePoint, 
            parseInt(document.getElementById('defensePanel').style.left),
            parseInt(document.getElementById('defensePanel').style.top));
    } else {
        notify('Не удалось улучшить оборону!');
    }
};

function notify(msg) {
    const el = document.getElementById('notif');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 2500);
}

function showEndScreen() {
    const won = game.winner === game.faction;
    document.getElementById('hudTop').style.display = 'none';
    document.getElementById('controlsHint').style.display = 'none';
    
    const div = document.createElement('div');
    div.className = 'screen';
    div.innerHTML = `
        <div style="font-size:5rem;margin-bottom:1rem;">${won ? '🏆' : '💀'}</div>
        <h1 style="color:${won ? '#fbbf24' : '#ef4444'}">${won ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}</h1>
        <p class="subtitle">${won ? 'Вы захватили континент!' : 'Противник оказался сильнее.'}</p>
        <button onclick="location.reload()" style="padding:0.75rem 2rem;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;margin-top:1rem;">Заново</button>
    `;
    document.body.appendChild(div);
}
