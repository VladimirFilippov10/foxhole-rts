// ===== MAIN ENTRY POINT =====
import { VEHICLE_COSTS, dist, GAME_MODES } from './constants.js';
import { createVehicle, FACTION_VEHICLES } from './vehicles.js';
import { getCapturePointsInWorld, getResourcePointsInWorld } from './map.js';
import { Game } from './game.js';
import { render } from './renderer.js';

let canvas, ctx;
let game = null;
let selectedMap = 'deadlands';
let selectedFaction = 'wardens';
let selectedGameMode = 'normal';
let lastClickTime = 0;
let factoryMenuOpen = false;
let aoeMode = false;
let buildMode = false;
let selectedFortificationType = null;

// Vehicle info for factory menu
const VEHICLE_INFO = {
    infantry: { name: 'Пехота', icon: '🔫', stats: 'HP:50 DMG:8 SPD:0.8', cost: VEHICLE_COSTS.infantry },
    devitt: { name: 'Devitt', icon: '🚗', stats: 'HP:280 DMG:35 RNG:160 SPD:1.2', cost: VEHICLE_COSTS.devitt },
    gallagher: { name: 'Gallagher 30mm', icon: '💥', stats: 'HP:520 DMG:65 RNG:180 SPD:0.9', cost: VEHICLE_COSTS.gallagher },
    niska: { name: 'Niska APC', icon: '🚙', stats: 'HP:240 DMG:20 RNG:150 SPD:1.4', cost: VEHICLE_COSTS.niska },
    hatchet: { name: 'Hatchet', icon: '🪓', stats: 'HP:220 DMG:30 RNG:150 SPD:1.5', cost: VEHICLE_COSTS.hatchet },
    falchion: { name: 'Falchion', icon: '⚔️', stats: 'HP:480 DMG:70 RNG:170 SPD:1.0', cost: VEHICLE_COSTS.falchion },
    hoplite: { name: 'Hoplite APC', icon: '🛡️', stats: 'HP:200 DMG:18 RNG:140 SPD:1.6', cost: VEHICLE_COSTS.hoplite },
    warden_artillery: { name: 'Warden Artillery', icon: '🎯', stats: 'HP:100 DMG:85 RNG:150-500 AoE:80 SPD:0.3 CD:8s', cost: VEHICLE_COSTS.warden_artillery },
    colonial_artillery: { name: 'Colonial Artillery', icon: '🎯', stats: 'HP:110 DMG:75 RNG:120-400 AoE:70 SPD:0.6 CD:7s', cost: VEHICLE_COSTS.colonial_artillery },
    truck: { name: 'Грузовик', icon: '🚚', stats: 'HP:120 SPD:1.8 Пополняет БК', cost: VEHICLE_COSTS.truck },
    fuel_truck: { name: 'Бензовоз', icon: '⛽', stats: 'HP:140 SPD:1.6 Пополняет топливо', cost: VEHICLE_COSTS.fuel_truck },
    engineer: { name: 'Инженер', icon: '🔧', stats: 'HP:160 SPD:1.2 Ремонтирует технику', cost: VEHICLE_COSTS.engineer },
    flatbed: { name: 'Flatbed', icon: '🚛', stats: 'HP:150 SPD:1.5 Перевозит снаряды для артиллерии', cost: VEHICLE_COSTS.flatbed },
};

// Fortification info
const FORTIFICATION_INFO = {
    bunker_light: { name: 'Лёгкий бункер', icon: '🏰', stats: 'HP:300 DEF:10 RNG:120', cost: { s: 30, c: 20, m: 25 } },
    bunker_medium: { name: 'Средний бункер', icon: '🏯', stats: 'HP:600 DEF:20 RNG:150', cost: { s: 60, c: 40, m: 50 } },
    bunker_heavy: { name: 'Тяжёлый бункер', icon: '🏰', stats: 'HP:1000 DEF:35 RNG:180', cost: { s: 100, c: 70, m: 80 } },
};

// Initialize
window.addEventListener('load', () => {
    try {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Input handlers
        window.addEventListener('keydown', e => { if (game) game.keys = game.keys || {}; game.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if (game) game.keys = game.keys || {}; game.keys[e.key.toLowerCase()] = false; });
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        
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
        
        const aiAssaultTank = game.ai === 'wardens' ? 'gallagher' : 'falchion';
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
        
        // Обновляем очередь производства если меню открыто
        if (factoryMenuOpen) {
            const factory = game.buildings.find(b => b.type === 'factory' && b.faction === game.faction);
            if (factory) {
                updateFactoryQueue(factory);
            }
        }
        
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

// Input handlers
function handleMouseDown(e) {
    if (!game) return;
    e.preventDefault();
    
    const now = Date.now();
    const isDouble = (now - lastClickTime) < 350;
    lastClickTime = now;
    
    const worldX = e.clientX + game.cam.x;
    const worldY = e.clientY + game.cam.y;
    
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
    
    // Build mode - place fortification
    if (buildMode && selectedFortificationType) {
        const result = game.buildFortification(selectedFortificationType, worldX, worldY, game.faction);
        if (result) {
            notify(`${FORTIFICATION_INFO[selectedFortificationType].name} построен!`);
            buildMode = false;
            selectedFortificationType = null;
            const btn = document.getElementById('buildBtn');
            btn.style.borderColor = '#374151';
            btn.style.background = 'rgba(17,24,39,0.9)';
        } else {
            notify('Недостаточно ресурсов или нельзя строить здесь!');
        }
        return;
    }
    
    // Double click or move mode - move units
    if (isDouble || game.moveMode) {
        if (game.selected.length > 0) {
            const selUnits = game.units.filter(u => game.selected.includes(u.id));
            const cols = Math.ceil(Math.sqrt(selUnits.length));
            selUnits.forEach((u, i) => {
                const row = Math.floor(i / cols);
                const col = i % cols;
                u.tx = worldX + (col - cols / 2) * 25;
                u.ty = worldY + (row - cols / 2) * 25;
            });
            if (game.moveMode) {
                game.moveMode = false;
                document.getElementById('modeIndicator').classList.add('hidden');
            }
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

function openFactoryMenu(factory, mx, my) {
    factoryMenuOpen = true;
    const menu = document.getElementById('factoryMenu');
    menu.classList.remove('hidden');
    menu.style.left = Math.min(mx, window.innerWidth - 340) + 'px';
    menu.style.top = Math.min(my, window.innerHeight - 400) + 'px';
    
    const grid = document.getElementById('unitGrid');
    grid.innerHTML = '';
    
    // Add infantry first
    const allUnits = ['infantry', ...FACTION_VEHICLES[game.faction]];
    
    allUnits.forEach(type => {
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
                updateFactoryQueue(factory); // Обновляем очередь после заказа
            };
        }
        grid.appendChild(card);
    });
    
    // Показываем очередь производства
    updateFactoryQueue(factory);
}

function updateFactoryQueue(factory) {
    const queue = game.getProductionProgress(factory.id);
    
    // Удаляем старую очередь если есть
    const menu = document.getElementById('factoryMenu');
    const existingQueue = menu.querySelector('.production-queue');
    if (existingQueue) {
        existingQueue.remove();
    }
    
    // Если очередь пустая - не создаём ничего
    if (queue.length === 0) {
        return;
    }
    
    // Создаём новую очередь
    const queueDiv = document.createElement('div');
    queueDiv.className = 'production-queue';
    queueDiv.style.marginTop = '1rem';
    queueDiv.style.paddingTop = '0.75rem';
    queueDiv.style.borderTop = '1px solid #374151';
    
    let queueHtml = '<div style="font-size:0.75rem;color:#9ca3af;margin-bottom:0.5rem;">📋 Очередь производства:</div>';
    
    queue.forEach((item, index) => {
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
    
    queueDiv.innerHTML = queueHtml;
    menu.appendChild(queueDiv);
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
    
    // Обновляем очередь в меню
    updateFactoryQueue(factory);
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

window.toggleBuildMode = function() {
    if (!game) return;
    buildMode = !buildMode;
    const btn = document.getElementById('buildBtn');
    
    if (buildMode) {
        btn.style.borderColor = '#22c55e';
        btn.style.background = 'rgba(34,197,94,0.15)';
        showFortificationMenu();
    } else {
        btn.style.borderColor = '#374151';
        btn.style.background = 'rgba(17,24,39,0.9)';
        hideFortificationMenu();
    }
};

function showFortificationMenu() {
    // Создаём меню выбора типа укрепления
    let menu = document.getElementById('fortificationMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'fortificationMenu';
        menu.style.cssText = 'position:fixed;bottom:5rem;right:1rem;background:rgba(17,24,39,0.95);border:2px solid #4b5563;border-radius:12px;padding:1rem;z-index:300;min-width:280px;';
        document.body.appendChild(menu);
    }
    
    menu.innerHTML = `
        <h3 style="font-size:1rem;margin-bottom:0.75rem;color:#22c55e;border-bottom:1px solid #374151;padding-bottom:0.5rem;">🏰 Строительство укреплений</h3>
        <div style="display:grid;grid-template-columns:1fr;gap:0.5rem;">
            ${Object.entries(FORTIFICATION_INFO).map(([type, info]) => `
                <div class="unit-card" onclick="selectFortification('${type}')" style="cursor:pointer;">
                    <div class="unit-name">${info.icon} ${info.name}</div>
                    <div class="unit-stats">${info.stats}</div>
                    <div class="unit-cost">S:${info.cost.s} C:${info.cost.c} M:${info.cost.m}</div>
                </div>
            `).join('')}
        </div>
    `;
    menu.style.display = 'block';
}

function hideFortificationMenu() {
    const menu = document.getElementById('fortificationMenu');
    if (menu) {
        menu.style.display = 'none';
    }
    selectedFortificationType = null;
}

window.selectFortification = function(type) {
    selectedFortificationType = type;
    buildMode = true; // Включаем режим строительства
    notify(`Выбрано: ${FORTIFICATION_INFO[type].name}. Кликните на карту для строительства.`);
    hideFortificationMenu();
    
    // Обновляем кнопку BUILD
    const btn = document.getElementById('buildBtn');
    if (btn) {
        btn.style.borderColor = '#22c55e';
        btn.style.background = 'rgba(34,197,94,0.15)';
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
