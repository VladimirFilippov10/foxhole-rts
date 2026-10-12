// ===== MAIN ENTRY POINT =====
import { VEHICLE_COSTS, BUILDING_COSTS, dist } from './constants.js';
import { createVehicle } from './vehicles.js';
import { getCapturePointsInWorld, getResourcePointsInWorld, CAPTURE_POINTS } from './map.js';
import { Game } from './game.js';
import { render } from './renderer.js';

let canvas, ctx;
let game = null;
let selectedFaction = 'wardens';
let lastClickTime = 0;
let factoryMenuOpen = false;

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
    document.getElementById('hudBottom').style.display = 'flex';
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
    const playerBaseIdx = selectedFaction === 'wardens' ? 0 : 9; // Sun's Hollow or Salt March
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
    
    // Player units
    units.push(createVehicle('infantry', selectedFaction, playerBase.x + 30, playerBase.y + 50));
    units.push(createVehicle('infantry', selectedFaction, playerBase.x + 50, playerBase.y + 50));
    units.push(createVehicle('infantry', selectedFaction, playerBase.x + 70, playerBase.y + 50));
    units.push(createVehicle('hatchet', selectedFaction, playerBase.x, playerBase.y + 120));
    
    // AI units
    units.push(createVehicle('infantry', game.ai, aiBase.x - 30, aiBase.y + 50));
    units.push(createVehicle('infantry', game.ai, aiBase.x - 50, aiBase.y + 50));
    units.push(createVehicle('infantry', game.ai, aiBase.x - 70, aiBase.y + 50));
    units.push(createVehicle('halftrack', game.ai, aiBase.x, aiBase.y + 120));
    units.push(createVehicle('gallagher', game.ai, aiBase.x + 50, aiBase.y - 30));
    
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
        let html = `<p>Выбрано: ${units.length} юнитов</p>`;
        Object.entries(types).forEach(([t, c]) => { html += `<p class="sel-type">${t} ×${c}</p>`; });
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
    
    // Check factory click
    const clickedFactory = game.buildings.find(b => 
        b.type === 'factory' && b.faction === game.faction && 
        dist(b.x, b.y, worldX, worldY) < 30
    );
    
    if (clickedFactory && !isDouble && !game.moveMode) {
        openFactoryMenu(clickedFactory, e.clientX, e.clientY);
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
                document.getElementById('moveBtn').classList.remove('active');
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
    document.getElementById('moveBtn').classList.toggle('active', game.moveMode);
    document.getElementById('modeIndicator').classList.toggle('hidden', !game.moveMode);
};

window.trainUnit = function(type) {
    if (!game) return;
    
    const cost = VEHICLE_COSTS[type];
    if (game.res.s < cost.s || game.res.c < cost.c || game.res.m < cost.m) {
        notify('Недостаточно ресурсов!');
        return;
    }
    
    const isInfantry = type === 'infantry';
    const bldgType = isInfantry ? 'barracks' : 'factory';
    const bldg = game.buildings.find(b => b.faction === game.faction && b.type === bldgType);
    
    if (!bldg) {
        notify(`Нужно построить ${isInfantry ? 'казарму' : 'завод'}!`);
        return;
    }
    
    game.res.s -= cost.s;
    game.res.c -= cost.c;
    game.res.m -= cost.m;
    
    const unit = createVehicle(type, game.faction, bldg.x + 50, bldg.y + 50);
    game.units.push(unit);
    notify(unit.label + ' создан!');
};

function openFactoryMenu(factory, mx, my) {
    factoryMenuOpen = true;
    const menu = document.getElementById('factoryMenu');
    menu.classList.remove('hidden');
    menu.style.left = Math.min(mx, window.innerWidth - 340) + 'px';
    menu.style.top = Math.min(my, window.innerHeight - 300) + 'px';
    
    const grid = document.getElementById('unitGrid');
    grid.innerHTML = '';
    
    const units = [
        { type: 'hatchet', name: 'Hatchet', icon: '🪓', cost: VEHICLE_COSTS.hatchet, stats: 'HP:220 DMG:28 SPD:2.3' },
        { type: 'devitt', name: 'Devitt', icon: '🚗', cost: VEHICLE_COSTS.devitt, stats: 'HP:190 DMG:22 SPD:2.5' },
        { type: 'gallagher', name: 'Gallagher 30mm', icon: '💥', cost: VEHICLE_COSTS.gallagher, stats: 'HP:420 DMG:50 SPD:1.1' },
        { type: 'falchion', name: 'Falchion', icon: '⚔️', cost: VEHICLE_COSTS.falchion, stats: 'HP:380 DMG:55 SPD:1.3' },
        { type: 'niska', name: 'Niska APC', icon: '🚙', cost: VEHICLE_COSTS.niska, stats: 'HP:200 DMG:18 SPD:2.1' },
        { type: 'artillery', name: 'Artillery', icon: '🎯', cost: VEHICLE_COSTS.artillery, stats: 'HP:120 DMG:70 RNG:350' },
    ];
    
    units.forEach(u => {
        const canAfford = game.res.s >= u.cost.s && game.res.c >= u.cost.c && game.res.m >= u.cost.m;
        const card = document.createElement('div');
        card.className = 'unit-card' + (canAfford ? '' : ' disabled');
        card.innerHTML = `
            <div class="unit-name">${u.icon} ${u.name}</div>
            <div class="unit-stats">${u.stats}</div>
            <div class="unit-cost">S:${u.cost.s} C:${u.cost.c} M:${u.cost.m}</div>
        `;
        if (canAfford) {
            card.onclick = () => {
                trainUnit(u.type);
                closeFactoryMenu();
            };
        }
        grid.appendChild(card);
    });
}

window.closeFactoryMenu = function() {
    document.getElementById('factoryMenu').classList.add('hidden');
    factoryMenuOpen = false;
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
    document.getElementById('hudBottom').style.display = 'none';
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
