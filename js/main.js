// ===== MAIN ENTRY POINT =====
import { VEHICLE_COSTS, dist } from './constants.js';
import { createVehicle, FACTION_VEHICLES } from './vehicles.js';
import { getCapturePointsInWorld, getResourcePointsInWorld } from './map.js';
import { Game } from './game.js';
import { render } from './renderer.js';

let canvas, ctx;
let game = null;
let selectedFaction = 'wardens';
let lastClickTime = 0;
let factoryMenuOpen = false;
let aoeMode = false;

// Vehicle info for factory menu
const VEHICLE_INFO = {
    infantry: { name: 'Пехота', icon: '🔫', stats: 'HP:50 DMG:8 SPD:0.8', cost: VEHICLE_COSTS.infantry },
    devitt: { name: 'Devitt', icon: '🚗', stats: 'HP:280 DMG:35 RNG:160 SPD:1.2', cost: VEHICLE_COSTS.devitt },
    gallagher: { name: 'Gallagher 30mm', icon: '💥', stats: 'HP:520 DMG:65 RNG:180 SPD:0.9', cost: VEHICLE_COSTS.gallagher },
    niska: { name: 'Niska APC', icon: '🚙', stats: 'HP:240 DMG:20 RNG:150 SPD:1.4', cost: VEHICLE_COSTS.niska },
    hatchet: { name: 'Hatchet', icon: '🪓', stats: 'HP:220 DMG:30 RNG:150 SPD:1.5', cost: VEHICLE_COSTS.hatchet },
    falchion: { name: 'Falchion', icon: '⚔️', stats: 'HP:480 DMG:70 RNG:170 SPD:1.0', cost: VEHICLE_COSTS.falchion },
    hoplite: { name: 'Hoplite APC', icon: '🛡️', stats: 'HP:200 DMG:18 RNG:140 SPD:1.6', cost: VEHICLE_COSTS.hoplite },
    warden_artillery: { name: 'Warden Artillery', icon: '🎯', stats: 'HP:100 DMG:85 RNG:500 AoE:80 SPD:0.3 CD:8s', cost: VEHICLE_COSTS.warden_artillery },
    colonial_artillery: { name: 'Colonial Artillery', icon: '🎯', stats: 'HP:110 DMG:75 RNG:400 AoE:70 SPD:0.6 CD:7s', cost: VEHICLE_COSTS.colonial_artillery },
};

// Initialize
window.addEventListener('load', () => {
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
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Screen management
window.selectFaction = function(faction) {
    selectedFaction = faction;
    document.getElementById('menuScreen').classList.add('hidden');
    startGame();
};

function startGame() {
    document.getElementById('hudTop').style.display = 'flex';
    document.getElementById('controlsHint').style.display = 'block';
    
    const badge = document.getElementById('factionBadge');
    badge.className = 'faction-badge ' + selectedFaction;
    badge.innerHTML = selectedFaction === 'wardens' ? '🛡️ WARDENS' : '⚔️ COLONIALS';
    
    // Create game
    game = new Game(selectedFaction);
    
    // Setup map
    const cps = getCapturePointsInWorld();
    const mines = getResourcePointsInWorld();
    
    // Find player and AI bases
    // Wardens: Callahan Gate (index 0 - The Spine)
    // Colonials: The Salt March (index 9)
    const playerBaseIdx = selectedFaction === 'wardens' ? 0 : 9;
    const aiBaseIdx = selectedFaction === 'wardens' ? 9 : 0;
    
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
    
    // Start game loop
    gameLoop();
}

function gameLoop() {
    if (!game) return;
    
    game.update();
    render(ctx, game, canvas);
    
    // Update HUD
    document.getElementById('rSup').textContent = Math.floor(game.res.s);
    document.getElementById('rComp').textContent = Math.floor(game.res.c);
    document.getElementById('rMat').textContent = Math.floor(game.res.m);
    document.getElementById('tCount').textContent = game.cps.filter(c => c.owner === game.faction).length;
    
    updateSelInfo();
    
    if (game.over) {
        showEndScreen();
        return;
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
        dist(u.x, u.y, worldX, worldY) < 18 && u.faction === game.faction
    );
    
    if (clickedUnit) {
        game.selected = [clickedUnit.id];
    } else {
        game.selected = game.units.filter(u => 
            dist(u.x, u.y, worldX, worldY) < 50 && u.faction === game.faction
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
                closeFactoryMenu();
            };
        }
        grid.appendChild(card);
    });
}

function trainUnit(type, factory) {
    if (!game || !factory) return;
    
    const info = VEHICLE_INFO[type];
    const cost = info.cost;
    
    if (game.res.s < cost.s || game.res.c < cost.c || game.res.m < cost.m) {
        notify('Недостаточно ресурсов!');
        return;
    }
    
    game.res.s -= cost.s;
    game.res.c -= cost.c;
    game.res.m -= cost.m;
    
    const unit = createVehicle(type, game.faction, factory.x + 50, factory.y + 50);
    game.units.push(unit);
    notify(unit.label + ' создан!');
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
