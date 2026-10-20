// ===== MAIN ENTRY POINT =====
import { VEHICLE_COSTS, dist, GAME_MODES, FIXED_STEP_MS, MAX_STEPS_PER_FRAME,
    RESTRICTION_OPTIONS, ECONOMY_OPTIONS, FOG_OPTIONS,
    DEFAULT_RESTRICTION, DEFAULT_ECONOMY, DEFAULT_FOG,
    getModeFlags } from './constants.js';
import { createVehicle, FACTION_VEHICLES, FACTION_INFANTRY, INFANTRY_TYPES } from './vehicles.js';
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
let selectedRestriction = DEFAULT_RESTRICTION;
let selectedEconomy = DEFAULT_ECONOMY;
let selectedFog = DEFAULT_FOG;
// Дополнительные настройки режима (выбираются на экране «Настройки игры»,
// в каждой группе ровно одно значение — radio-поведение):
//  selectedRestriction: classic | infantry_only | vehicles_only | no_artillery
//  selectedEconomy:     classic | attrition (Вымирание) | scarcity (Дефицит)
let lastClickTime = 0;
let factoryMenuOpen = false;
let aoeMode = false;
let selectedCapturePoint = null;
let factoryMenuFactory = null;
let defensePanelInterval = null;

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
    infantry: { name: 'Пехота', icon: '🔫', stats: 'HP:30-35 DMG:6-8 RNG:120-130 SPD:0.5-0.65 (стрелки)', cost: VEHICLE_COSTS.infantry },
    rifleman: { name: 'Стрелок', icon: '🔫', stats: 'HP:30-35 DMG:6-8 RNG:120-130 SPD:0.5-0.65 Универсальная пехота, идёт в атаку', cost: VEHICLE_COSTS.rifleman },
    mg_gunner: { name: 'Пулемётчик', icon: '🛡️', stats: 'HP:45 DMG:10 RNG:95 CD:0.5с x2 по пехоте SPD:0.2 — оборона (общий для обеих фракций)', cost: VEHICLE_COSTS.mg_gunner },
    grenadier: { name: 'Гранатомётчик / Гренадер', icon: '💣', stats: 'AoE по пехоте: W: HP:40 DMG:60 RNG:45 r15 · C: HP:40 DMG:25 RNG:70 r25', cost: VEHICLE_COSTS.grenadier },
    sniper: { name: 'Снайпер', icon: '🎯', stats: 'W: HP:20 DMG:45 RNG:260 CD:16с · C: HP:30 DMG:35 RNG:230 CD:13с', cost: VEHICLE_COSTS.sniper },
    // ===== НОВАЯ ПЕХОТА =====
    assualt_varden:   { name: 'Штурмовик', icon: '⚔️', stats: 'W: HP:45 DMG:5 RNG:110 CD:0.8с · C: HP:50 DMG:6 RNG:90 CD:1с', cost: VEHICLE_COSTS.assualt_varden },
    smuggler_varden:  { name: 'Контрабандист', icon: '💰', stats: 'HP:60 DMG:20 RNG:140 CD:2.3с SPD:0.7', cost: VEHICLE_COSTS.smuggler_varden },
    poacher_colonist: { name: 'Браконьер', icon: '🎯', stats: 'HP:40 DMG:35 RNG:190 CD:5.8с SPD:0.7', cost: VEHICLE_COSTS.poacher_colonist },
    medic_varden:     { name: 'Медик', icon: '⚕️', stats: 'HP:30 DMG:2 Лечит пехоту в радиусе 80 (0.08 HP/тик)', cost: VEHICLE_COSTS.medic_varden },
    medic_colonist:   { name: 'Медик', icon: '⚕️', stats: 'HP:25 DMG:4 Лечит пехоту в радиусе 80 (0.08 HP/тик)', cost: VEHICLE_COSTS.medic_colonist },
    scout_infantry:   { name: 'Разведчик', icon: '👁️', stats: 'HP:25 SPD:0.8 Обзор: 140. Скрытен в кустах (виден с 5, иначе с 50)', cost: VEHICLE_COSTS.scout_infantry },

    // ... (в технику wardens)
    warden_scout_car: { name: 'Drummond 100a', icon: '📡', stats: 'HP:120 SPD:2.2 Маскировка: Высокая Обзор: 200 (Не атакует)', cost: VEHICLE_COSTS.warden_scout_car },
    colonial_scout_car: { name: 'UV-5c "Odyssey"', icon: '📡', stats: 'HP:110 SPD:2.4 Маскировка: Высокая Обзор: 180 (Не атакует)', cost: VEHICLE_COSTS.colonial_scout_car },

    // Wardens tanks
    king_spire: { name: 'King Spire Mk.I', icon: '🔍', stats: 'HP:135 DMG:15 RNG:140 SPD:1.3 ARM:25 Разведка 120', cost: VEHICLE_COSTS.king_spire },
    devitt: { name: 'Devitt Mk.III', icon: '🚗', stats: 'HP:195 DMG:45 RNG:160 SPD:1.6 ARM:35 40мм CD:4.8с БК:50', cost: VEHICLE_COSTS.devitt },
    devitt_mmr: { name: 'Devitt MMR', icon: '💥', stats: 'Миномёт: HP:160 DMG:25 AoE:30 RNG:90-240 SPD:1.1 ARM:30 БК:70', cost: VEHICLE_COSTS.devitt_mmr },
    silverhand: { name: 'Silverhand Mk.IV', icon: '💪', stats: 'HP:310 DMG:85 RNG:170 SPD:1.1 ARM:50 40мм+68мм CD:8.3с БК:50', cost: VEHICLE_COSTS.silverhand },
    gallagher_highwayman: { name: 'Gallagher Highwayman', icon: '⚡', stats: 'HP:295 DMG:35 RNG:165 SPD:1.7→2.8 Буст ARM:45 CD:1с', cost: VEHICLE_COSTS.gallagher_highwayman },
    gallagher_outlaw: { name: 'Gallagher Outlaw Mk.II', icon: '🌪️', stats: 'HP:370 DMG:45 RNG:190 SPD:1.5→2.8 Буст ARM:30 CD:2.5с', cost: VEHICLE_COSTS.gallagher_outlaw },
    noble_widow: { name: 'Noble Widow MK. XIV', icon: '🌪️', stats: 'HP:370 DMG:45 RNG:190 SPD:1.5→2.8 Буст ARM:30 CD:2.5с', cost: VEHICLE_COSTS.noble_widow },
    niska: { name: 'Niska APC', icon: '🚙', stats: 'HP:260 DMG:10 RNG:150 SPD:1.8 ARM:20 БТР CD:0.75с', cost: VEHICLE_COSTS.niska },
    niska_blinder: { name: 'Niska Mk.2 Blinder', icon: '🚙', stats: 'HP:260 DMG:10 RNG:150 SPD:1.8 ARM:20 БТР CD:0.75с', cost: VEHICLE_COSTS.niska_blinder },
    warden_artillery120: { name: 'Warden Artillery 120мм', icon: '🎯', stats: 'HP:100 DMG:60 RNG:100-600 AoE:65 SPD:0.6 ARM:25 CD:6.7с БК:50', cost: VEHICLE_COSTS.warden_artillery120 },
    warden_artillery150: { name: 'Warden Artillery 150мм', icon: '🎯', stats: 'HP:80 DMG:95 RNG:180-550 AoE:100 SPD:0.3 ARM:30 CD:9.2с', cost: VEHICLE_COSTS.warden_artillery150 },
    nona: { name: 'Нона-С 120мм', icon: '🎯', stats: 'САУ: HP:120 DMG:75 RNG:50-350 AoE:50 SPD:1.2 ARM:25 CD:5с БК:80 (миномёт-арта)', cost: VEHICLE_COSTS.nona },

    // Colonials tanks
    hatchet: { name: 'H-5 Hatchet', icon: '🪓', stats: 'HP:195 DMG:45 RNG:160 SPD:1.3 ARM:5 40мм CD:5.8с БК:50 +бак 25', cost: VEHICLE_COSTS.hatchet },
    scorpion: { name: 'HC-2 Scorpion', icon: '🦂', stats: 'HP:330 DMG:15 RNG:130 SPD:0.7 ARM:20 Пулемёты x2.5 по пехоте CD:0.83с', cost: VEHICLE_COSTS.scorpion },
    nemesis: { name: '90T-v Nemesis', icon: '🔥', stats: 'HP:365 DMG:110 RNG:190 SPD:1.3 ARM:50 68мм+гранатомёт AoE:40 CD:6.7с', cost: VEHICLE_COSTS.nemesis },
    talos: { name: '85V-G Talos', icon: '🔥', stats: 'HP:365 DMG:110 RNG:190 SPD:1.3 ARM:50 68мм+гранатомёт AoE:40 CD:6.7с', cost: VEHICLE_COSTS.talos },
    falchion: { name: 'Falchion', icon: '⚔️', stats: 'HP:450 DMG:70 RNG:150 SPD:0.8 ARM:50 Средний танк CD:7.7с', cost: VEHICLE_COSTS.falchion },
    spatha: { name: 'Spatha', icon: '🗡️', stats: 'HP:560 DMG:80 RNG:180 SPD:0.7 ARM:70 Тяжёлый танк CD:8.3с', cost: VEHICLE_COSTS.spatha },
    hoplite: { name: 'Hoplite Mortar', icon: '💥', stats: 'Миномёт: HP:150 DMG:25 AoE:30 RNG:80-180 SPD:1.3 ARM:15 CD:2.5с БК:70', cost: VEHICLE_COSTS.hoplite },
    javelin: { name: 'Javelin APC', icon: '🛡️', stats: 'HP:200 DMG:7 RNG:140 SPD:1.65 ARM:25 БТР CD:1.1с', cost: VEHICLE_COSTS.javelin },
    colonial_artillery120: { name: 'Colonial Artillery 120мм', icon: '🎯', stats: 'HP:60 DMG:55 RNG:60-400 AoE:45 SPD:0.7 ARM:15 Быстрая лёгкая арта CD:6.7с БК:70', cost: VEHICLE_COSTS.colonial_artillery120 },
    colonial_artillery150: { name: 'Colonial Artillery 150мм', icon: '🎯', stats: 'HP:90 DMG:85 RNG:150-550 AoE:80 SPD:0.5 ARM:15 CD:7.5с', cost: VEHICLE_COSTS.colonial_artillery150 },
    god_loader: { name: 'God Loader 200мм', icon: '🎯', stats: 'САУ 200мм: HP:500 DMG:140 RNG:340-700 AoE:90 SPD:0.15 ARM:40 CD:12с БК:30', cost: VEHICLE_COSTS.god_loader },
    pelekys: { name: 'Pelekys (ПТ-САУ)', icon: '🎯', stats: 'HP:175 DMG:110 RNG:190 SPD:1.3 ARM:15 CD:8.3с ПТ (пробитие 70) БК:70', cost: VEHICLE_COSTS.pelekys },

    bren_squire: { name: 'Bren V.200 Squire', icon: '🚀', stats: 'РСЗО: 5 залпов по 8 ракет. HP:130 DMG:60 AoE:35 RNG:400 SPD:1.8', cost: VEHICLE_COSTS.bren_squire },
xiphos: { name: 'Xiphos (T3)', icon: '🛡️', stats: 'БТР: HP:140 DMG:9 (x1.2 по пехоте) RNG:130 SPD:1.5', cost: VEHICLE_COSTS.xiphos },
percutio: { name: 'Percutio (T5)', icon: '🎯', stats: 'БТР: HP:150 DMG:30 (x1.3 по легкой, x0.5 по тяжелой технике) RNG:130', cost: VEHICLE_COSTS.percutio },
    // Logistics
    truck: { name: 'Грузовик', icon: '🚚', stats: 'HP:100 SPD:1.5 Без оружия Пополняет БК (запас 400)', cost: VEHICLE_COSTS.truck },
    fuel_truck: { name: 'Бензовоз', icon: '⛽', stats: 'HP:80 SPD:1.3 Без оружия Пополняет топливо (запас 400)', cost: VEHICLE_COSTS.fuel_truck },
    engineer: { name: 'Инженер', icon: '🔧', stats: 'HP:120 SPD:1.1 Без оружия Ремонт в радиусе 100 (запас 500)', cost: VEHICLE_COSTS.engineer },
    flatbed: { name: 'Flatbed', icon: '🚛', stats: 'HP:150 SPD:1.0 Без оружия Снаряды для артиллерии (запас 300)', cost: VEHICLE_COSTS.flatbed },
    medic_truck: { name: 'Скорая помощь', icon: '🚛', stats: 'HP:150 SPD:1.0  Машина скорой помощи', cost: VEHICLE_COSTS.medic_truck },
    construction_truck: { name: 'Строймашина', icon: '🏗️', stats: 'HP:250 Без оружия Ускоряет ремонт обороны в городе x2 (x3 при 2-х). Запас: 400', cost: { s: 60, c: 40, m: 30, buildTime: 20 } },
    fire_truck: { name: 'Пожарная', icon: '🚒', stats: 'HP:180 Без оружия Тушит пожары в городе. Запас воды: 300', cost: { s: 50, c: 30, m: 20, buildTime: 15 } },
};

// Defense upgrade info
const DEFENSE_UPGRADE_INFO = [
    { level: 1, name: 'Уровень 1', icon: '🛡️', stats: 'DMG:15 RNG:240 HP:300', cost: { s: 50, c: 30, m: 40 } },
    { level: 2, name: 'Уровень 2', icon: '🛡️🛡️', stats: 'DMG:25 RNG:300 HP:600', cost: { s: 100, c: 60, m: 80 } },
    { level: 3, name: 'Уровень 3', icon: '🛡️🛡️🛡️', stats: 'DMG:40 RNG:360 HP:1000 +30% по технике, защита от артиллерии', cost: { s: 150, c: 90, m: 120 } },
];

// ===== ИСПРАВЛЕНИЕ "showMapSelect is not defined" =====
['showMapSelect', 'showGameInfo', 'hideGameInfo', 'showInfoTab', 'selectMap', 'selectFaction',
 'selectGameMode', 'backToMainMenu', 'backToMapSelect', 'notify',
 'toggleMoveMode', 'toggleAoEMode', 'closeFactoryMenu', 'closeDefensePanel',
 'upgradeDefense'].forEach(fn => {
    if (typeof window[fn] !== 'function') {
        window[fn] = function() {
            console.error('[Loader] Функция ' + fn + ' ещё не готова: ошибка загрузки модулей. См. консоль.');
        };
    }
});

// Initialize
window.addEventListener('load', () => {
    try {
        canvas = document.getElementById('gameCanvas');
        if (!canvas) throw new Error('Не найден элемент #gameCanvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

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

        initDraggableWindow(document.getElementById('productionQueue'), '#productionQueueHeader');

        console.log('✅ Игра инициализирована успешно');
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
    }
});

function resizeCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
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

window.showInfoTab = function(btn) {
    const screen = document.getElementById('gameInfoScreen');
    if (!screen || !btn) return;
    screen.querySelectorAll('.info-tab').forEach(t => t.classList.remove('active'));
    screen.querySelectorAll('.info-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const page = document.getElementById(btn.dataset.page);
    if (page) {
        page.classList.add('active');
        const body = screen.querySelector('.info-body');
        if (body) body.scrollTop = 0;
    }
};

window.selectMap = function(map) {
    selectedMap = map;
    document.getElementById('mapSelectScreen').classList.add('hidden');
    document.getElementById('factionScreen').classList.remove('hidden');
};

window.selectFaction = function(faction) {
    selectedFaction = faction;
    document.getElementById('factionScreen').classList.add('hidden');
    renderModeToggles();
    document.getElementById('settingsScreen').classList.remove('hidden');
};

function renderToggleRow(containerId, options, current, onSelect) {
    const row = document.getElementById(containerId);
    if (!row) return;
    row.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'toggle-btn' + (opt.id === current ? ' active' : '');
        btn.dataset.value = opt.id;
        btn.innerHTML = `
            <div class="t-name">${opt.icon} ${opt.name}</div>
            <div class="t-desc">${opt.description}</div>
        `;
        btn.onclick = () => {
            onSelect(opt.id);
            renderToggleRow(containerId, options, opt.id, onSelect);
        };
        row.appendChild(btn);
    });
}

function renderModeToggles() {
    renderToggleRow('restrictionRow', RESTRICTION_OPTIONS, selectedRestriction,
        id => { selectedRestriction = id; });
    renderToggleRow('economyRow', ECONOMY_OPTIONS, selectedEconomy,
        id => { selectedEconomy = id; });
    const fogRow = document.getElementById('fogRow');
    if (fogRow) {
        renderToggleRow('fogRow', FOG_OPTIONS, selectedFog,
            id => { selectedFog = id; });
    }
}

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
        game = new Game(selectedFaction, selectedGameMode,
            selectedRestriction, selectedEconomy, selectedFog);
        window.game = game;

        const badge = document.getElementById('factionBadge');
        badge.className = 'faction-badge ' + selectedFaction;
        badge.innerHTML = selectedFaction === 'wardens' ? '🛡️ WARDENS' : '⚔️ COLONIALS';

        const modeInfo = document.getElementById('gameModeInfo');
        if (modeInfo) {
            const mode = GAME_MODES[selectedGameMode];
            let txt = `${mode.icon} ${mode.name}`;
            const rOpt = RESTRICTION_OPTIONS.find(o => o.id === selectedRestriction);
            const eOpt = ECONOMY_OPTIONS.find(o => o.id === selectedEconomy);
            if (rOpt && rOpt.id !== 'classic') txt += ` · ${rOpt.icon} ${rOpt.name}`;
            if (eOpt && eOpt.id !== 'classic') txt += ` · ${eOpt.icon} ${eOpt.name}`;
            modeInfo.textContent = txt;
            modeInfo.title = `Ограничения: ${rOpt ? rOpt.name : '—'}\nЭкономика: ${eOpt ? eOpt.name : '—'}`;
        }

        game.keys = globalKeys;

        const startRes = GAME_MODES[selectedGameMode].startingResources;
        game.res = { ...startRes };

        const cps = getCapturePointsInWorld();
        const mines = getResourcePointsInWorld();

        const playerBaseIdx = selectedFaction === 'wardens' ? 0 : 13;
        const aiBaseIdx = selectedFaction === 'wardens' ? 13 : 0;

        cps[playerBaseIdx].owner = selectedFaction;
        cps[playerBaseIdx].progress = 100;
        cps[aiBaseIdx].owner = game.ai;
        cps[aiBaseIdx].progress = 100;

        const playerBase = cps[playerBaseIdx];
        const aiBase = cps[aiBaseIdx];

        const buildings = [];
        let nextId = 1;
        const uid = () => 'b' + (nextId++);

        buildings.push({ id: uid(), type: 'town_hall', faction: selectedFaction, x: playerBase.x - 50, y: playerBase.y - 50, hp: 2000, maxHp: 2000 });
        buildings.push({ id: uid(), type: 'barracks', faction: selectedFaction, x: playerBase.x + 80, y: playerBase.y - 30, hp: 800, maxHp: 800 });
        buildings.push({ id: uid(), type: 'factory', faction: selectedFaction, x: playerBase.x - 30, y: playerBase.y + 100, hp: 1000, maxHp: 1000 });

        buildings.push({ id: uid(), type: 'town_hall', faction: game.ai, x: aiBase.x + 50, y: aiBase.y - 50, hp: 2000, maxHp: 2000 });
        buildings.push({ id: uid(), type: 'barracks', faction: game.ai, x: aiBase.x - 80, y: aiBase.y - 30, hp: 800, maxHp: 800 });
        buildings.push({ id: uid(), type: 'factory', faction: game.ai, x: aiBase.x + 30, y: aiBase.y + 100, hp: 1000, maxHp: 1000 });

        const units = [];

        const startFlags = getModeFlags(game);
        if (startFlags.allowUnit('infantry')) {
            units.push(createVehicle('infantry', selectedFaction, playerBase.x + 30, playerBase.y + 50));
            units.push(createVehicle('infantry', selectedFaction, playerBase.x + 50, playerBase.y + 50));
            units.push(createVehicle('infantry', selectedFaction, playerBase.x + 70, playerBase.y + 50));
        }

        const playerLightTank = selectedFaction === 'wardens' ? 'devitt' : 'hatchet';
        if (startFlags.allowUnit(playerLightTank)) {
            units.push(createVehicle(playerLightTank, selectedFaction, playerBase.x, playerBase.y + 120));
        }

        if (startFlags.allowUnit('infantry')) {
            units.push(createVehicle('infantry', game.ai, aiBase.x - 30, aiBase.y + 50));
            units.push(createVehicle('infantry', game.ai, aiBase.x - 50, aiBase.y + 50));
            units.push(createVehicle('infantry', game.ai, aiBase.x - 70, aiBase.y + 50));
        }

        const aiAPC = game.ai === 'wardens' ? 'niska' : 'javelin';
        if (startFlags.allowUnit(aiAPC)) {
            units.push(createVehicle(aiAPC, game.ai, aiBase.x, aiBase.y + 120));
        }

        const aiAssaultTank = game.ai === 'wardens' ? 'gallagher_highwayman' : 'falchion';
        if (startFlags.allowUnit(aiAssaultTank)) {
            units.push(createVehicle(aiAssaultTank, game.ai, aiBase.x + 50, aiBase.y - 30));
        }

        game.init(cps, mines, buildings, units);
        game.notify = notify;

        console.log('✅ Игра инициализирована, запуск игрового цикла...');

        lastFrameTime = 0;
        logicAccumulator = 0;
        gameLoop();
    } catch (error) {
        console.error('❌ Ошибка при запуске игры:', error);
        alert('Ошибка при запуске игры: ' + error.message);
    }
}

// ===== ИГРОВОЙ ЦИКЛ С ФИКСИРОВАННЫМ ШАГОМ (FIXSS) =====
let lastFrameTime = 0;
let logicAccumulator = 0;

function gameLoop(now) {
    if (!game) return;

    const frameStart = (typeof now === 'number' && now > 0) ? now : performance.now();

    if (lastFrameTime === 0) {
        lastFrameTime = frameStart;
        requestAnimationFrame(gameLoop);
        return;
    }

    let elapsed = frameStart - lastFrameTime;
    lastFrameTime = frameStart;

    if (elapsed > FIXED_STEP_MS * MAX_STEPS_PER_FRAME) {
        elapsed = FIXED_STEP_MS * MAX_STEPS_PER_FRAME;
    }

    try {
        logicAccumulator += elapsed;
        let steps = 0;
        const loopStart = performance.now();
        while (logicAccumulator >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
            const stepStart = performance.now();
            game.update();
            logicAccumulator -= FIXED_STEP_MS;
            steps++;
            if (game.over) break;

            if (performance.now() - stepStart > 16) {
                logicAccumulator = 0;
                break;
            }

            if (performance.now() - loopStart > 50) {
                logicAccumulator = 0;
                break;
            }
        }

        render(ctx, game, canvas);

        document.getElementById('rSup').textContent = Math.floor(game.res.s);
        document.getElementById('rComp').textContent = Math.floor(game.res.c);
        document.getElementById('rMat').textContent = Math.floor(game.res.m);
        const income = game.getIncomePerSec();
        const setRate = (id, v) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '+' + v.toFixed(2) + '/с';
        };
        setRate('rSupRate', income.s);
        setRate('rCompRate', income.c);
        setRate('rMatRate', income.m);
        document.getElementById('tCount').textContent = game.cps.filter(c => c.owner === game.faction).length;

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

            if (u.ammo !== undefined && u.maxAmmo > 0) {
                const ammoPct = (u.ammo / u.maxAmmo) * 100;
                html += `<p style="font-size:0.7rem;color:#f97316;">🔫 БК: ${Math.floor(u.ammo)}/${u.maxAmmo} (${Math.floor(ammoPct)}%)</p>`;
            }
            if (u.fuel !== undefined && u.maxFuel > 0) {
                const fuelPct = (u.fuel / u.maxFuel) * 100;
                html += `<p style="font-size:0.7rem;color:#3b82f6;">⛽ Топливо: ${Math.floor(u.fuel)}/${u.maxFuel} (${Math.floor(fuelPct)}%)</p>`;
            }

            if (u.currentCargo !== undefined && u.cargoCapacity > 0) {
                const cargoPct = (u.currentCargo / u.cargoCapacity) * 100;
                const cargoType =
                    u.cargoType === 'ammo' ? '📦 БК' :
                    u.cargoType === 'fuel' ? '⛽ Топливо' :
                    u.cargoType === 'repair' ? '🔧 Материалы' :
                    u.cargoType === 'med' ? '💊 Медикаменты' :
                    '🎯 Снаряды';
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

function issueMoveOrder(selUnits, worldX, worldY) {
    const cols = Math.ceil(Math.sqrt(selUnits.length));
    selUnits.forEach((u, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const offset = (selUnits.length > 1 && !u.aoe) ? 25 : 0;
        u.tx = worldX + (col - cols / 2) * offset;
        u.ty = worldY + (row - cols / 2) * offset;
        u.orderOrigin = { x: u.tx, y: u.ty };
        u.stuckCounter = 0;
        u.detourSide = undefined;
        u.retreatOrder = null;
        u.moveOrder = null;
        u.retreatToBase = false;
        if (u.aoe) {
            u.aoeTarget = null;
            u.holdPosition = undefined;
            u.retreatDecisionAt = undefined;
        }
    });
}

function handleMouseDown(e) {
    if (!game) return;
    e.preventDefault();

    const now = Date.now();
    const isDouble = (now - lastClickTime) < 350;
    lastClickTime = now;

    const worldX = e.clientX + game.cam.x;
    const worldY = e.clientY + game.cam.y;

    if (e.button === 2) {
        if (game.selected.length > 0) {
            const selUnits = game.units.filter(u => game.selected.includes(u.id));
            issueMoveOrder(selUnits, worldX, worldY);
            game.addParticles(worldX, worldY, '#22c55e', 5);
        }
        return;
    }

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

    const clickedFactory = game.buildings.find(b =>
        b.type === 'factory' && b.faction === game.faction &&
        dist(b.x, b.y, worldX, worldY) < 30
    );

    if (clickedFactory && !isDouble && !aoeMode) {
        exitMoveMode();
        openFactoryMenu(clickedFactory, e.clientX, e.clientY);
        return;
    }

    if (aoeMode && game.selected.length > 0) {
        const selUnits = game.units.filter(u => game.selected.includes(u.id));
        const artilleryUnits = selUnits.filter(u => u.aoe);

        if (artilleryUnits.length > 0) {
            artilleryUnits.forEach(u => {
                u.aoeTarget = { x: worldX, y: worldY };
                u.tx = undefined;
                u.ty = undefined;
                u.orderOrigin = undefined;
                u.retreatOrder = null;
                u.moveOrder = null;
                u.stuckCounter = 0;
                u.shotsFired = 0;
            });
            aoeMode = false;
            const btn = document.getElementById('aoeBtn');
            btn.style.borderColor = '#374151';
            btn.style.background = 'rgba(17,24,39,0.9)';
        }
        return;
    }

    const clickedFlag = game.cps.find(cp => {
        const d = dist(cp.x, cp.y, worldX, worldY);
        return d <= 30 && cp.owner === game.faction;
    });

    if (clickedFlag && !isDouble && !aoeMode) {
        exitMoveMode();
        selectedCapturePoint = clickedFlag;
        openDefensePanel(clickedFlag, e.clientX, e.clientY);
        return;
    }

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

function exitMoveMode() {
    if (!game || !game.moveMode) return;
    game.moveMode = false;
    const btn = document.getElementById('moveBtn');
    if (btn) {
        btn.style.borderColor = '#374151';
        btn.style.background = 'rgba(17,24,39,0.9)';
    }
    document.getElementById('modeIndicator')?.classList.add('hidden');
}

function handleMouseMove(e) {
    if (!game) return;
    game.mousePos = { x: e.clientX, y: e.clientY };

    const edge = 30;
    if (e.clientX < edge) game.cam.x -= 5;
    if (e.clientX > canvas.width - edge) game.cam.x += 5;
    if (e.clientY < edge) game.cam.y -= 5;
    if (e.clientY > canvas.height - edge) game.cam.y += 5;
}

window.toggleMoveMode = function() {
    if (!game) return;
    game.moveMode = !game.moveMode;
    document.getElementById('modeIndicator').classList.toggle('hidden', !game.moveMode);
};

// ===== ВКЛАДКИ ПРОИЗВОДСТВА =====
// Плоские списки для вкладок без подвкладок (Снабжение, Поддержка)
const TAB_TYPES = {
    supply:  ['truck', 'fuel_truck', 'engineer', 'flatbed', 'medic_truck',
              'construction_truck', 'fire_truck'],
    support: ['warden_artillery120', 'nona', 'warden_artillery150',
              'colonial_artillery120', 'colonial_artillery150',
              'hoplite', 'devitt_mmr', 'god_loader', 'bren_squire'],
};

const PRODUCTION_TABS = [
    { id: 'infantry', label: '🔫 Пехота' },
    { id: 'vehicles', label: '🚗 Техника' },
    { id: 'supply',   label: '📦 Снабжение' },
    { id: 'support',  label: '🎯 Поддержка' },
];

const FACTION_INFANTRY_TYPES = ['rifleman', 'mg_gunner', 'grenadier', 'sniper'];

// Подвкладки для техники
const VEHICLE_SUBTABS = {
    wardens: [
        { id: 'tanks',  label: '🛡️ Танки' },
        { id: 'at',     label: '🎯 ПТ' },
        { id: 'armor',  label: '🚙 Бронемашины' },
    ],
    colonials: [
        { id: 'tanks',  label: '🛡️ Танки' },
        { id: 'at',     label: '🎯 ПТ' },
        { id: 'armor',  label: '🚙 Бронемашины' },
    ],
};

// Подвкладки для пехоты
const INFANTRY_SUBTABS = [
    { id: 'base',    label: '🔫 Базовые' },
    { id: 'veteran', label: '⭐ Ветераны' },
    { id: 'special', label: '🎖️ Специальные' },
];

// Что лежит в каждой подвкладке техники (по фракциям)
const VEHICLE_SUBTAB_TYPES = {
    wardens: {
        tanks: ['king_spire', 'devitt', 'silverhand',
                'gallagher_highwayman', 'gallagher_outlaw'],
        at:    ['noble_widow', 'niska_blinder'],
        armor: ['niska', 'warden_scout_car'],
    },
    colonials: {
        tanks: ['hatchet', 'scorpion', 'falchion', 'spatha', 'talos'],
        at:    ['pelekys','percutio' ,'nemesis'],
        armor: ['javelin', 'colonial_scout_car', 'xiphos'],
    },
};

// Что лежит в каждой подвкладке пехоты (по фракциям)
const INFANTRY_SUBTAB_TYPES = {
    wardens: {
        base:    ['rifleman', 'mg_gunner', 'assualt_varden'],
        veteran: ['smuggler_varden'],
        special: ['sniper', 'grenadier', 'medic_varden', 'scout_infantry'],
    },
    colonials: {
        base:    ['rifleman', 'mg_gunner', 'assualt_varden'],
        veteran: ['poacher_colonist'],
        special: ['sniper', 'grenadier', 'medic_colonist', 'scout_infantry'],
    },
};

let factoryTab = 'infantry';
let factorySubTab = null;

function factionUnitName(type, info) {
    if (type === 'grenadier') {
        return game && game.faction === 'colonials' ? 'Гренадер' : 'Гранатомётчик';
    }
    return info?.name || type;
}

function openFactoryMenu(factory, mx, my) {
    factoryMenuOpen = true;
    const menu = document.getElementById('factoryMenu');
    menu.classList.remove('hidden');
    menu.style.left = Math.min(mx, window.innerWidth - 340) + 'px';
    menu.style.top = Math.min(my, window.innerHeight - 400) + 'px';

    factoryMenuFactory = factory;
    initDraggableWindow(menu);

    const grid = document.getElementById('unitGrid');
    let tabsEl = document.getElementById('factoryTabs');
    if (!tabsEl) {
        tabsEl = document.createElement('div');
        tabsEl.id = 'factoryTabs';
        tabsEl.style.cssText = 'margin-bottom:0.6rem;';
        menu.insertBefore(tabsEl, grid);
    }
    renderFactoryTabs(tabsEl, factory, grid);
}

function renderFactoryTabs(tabsEl, factory, grid) {
    tabsEl.innerHTML = '';

    const flags = getModeFlags(game);
    const visibleTabs = PRODUCTION_TABS.filter(tab =>
        !(tab.id === 'supply' && !flags.logisticsAllowed));

    if (!visibleTabs.some(t => t.id === factoryTab)) {
        factoryTab = visibleTabs[0]?.id || 'infantry';
        factorySubTab = null;
    }

    // --- Верхняя строка: вкладки ---
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;';
    visibleTabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        const active = tab.id === factoryTab;
        btn.style.cssText = 'padding:4px 10px;border-radius:6px;font-size:0.72rem;cursor:pointer;' +
            (active ? 'background:#2563eb;color:#fff;border:1px solid #60a5fa;'
                    : 'background:rgba(17,24,39,0.9);color:#d1d5db;border:1px solid #374151;');
        btn.onclick = () => {
            factoryTab = tab.id;
            factorySubTab = null;
            renderFactoryTabs(tabsEl, factory, grid);
        };
        topRow.appendChild(btn);
    });
    tabsEl.appendChild(topRow);

    // --- Вторая строка: подвкладки (только для infantry/vehicles) ---
    let subTabs = null;
    if (factoryTab === 'infantry') {
        subTabs = INFANTRY_SUBTABS;
    } else if (factoryTab === 'vehicles') {
        subTabs = VEHICLE_SUBTABS[game.faction] || null;
    }

    if (subTabs && subTabs.length > 0) {
        if (!factorySubTab || !subTabs.some(s => s.id === factorySubTab)) {
            factorySubTab = subTabs[0].id;
        }
        const subRow = document.createElement('div');
        subRow.style.cssText =
            'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;' +
            'padding-top:4px;border-top:1px dashed #374151;';
        subTabs.forEach(sub => {
            const btn = document.createElement('button');
            btn.textContent = sub.label;
            const active = sub.id === factorySubTab;
            btn.style.cssText = 'padding:3px 8px;border-radius:5px;font-size:0.68rem;cursor:pointer;' +
                (active ? 'background:#1e40af;color:#fff;border:1px solid #3b82f6;'
                        : 'background:rgba(17,24,39,0.9);color:#9ca3af;border:1px solid #374151;');
            btn.onclick = () => {
                factorySubTab = sub.id;
                renderFactoryTabs(tabsEl, factory, grid);
            };
            subRow.appendChild(btn);
        });
        tabsEl.appendChild(subRow);
    } else {
        factorySubTab = null;
    }

    renderTabUnits(grid, factory);
}

function renderTabUnits(grid, factory) {
    grid.innerHTML = '';
    const ownInfantry = FACTION_INFANTRY[game.faction] || [];
    const factionPool = ['infantry', ...ownInfantry, ...FACTION_VEHICLES[game.faction]];

    let types = [];

    if (factoryTab === 'infantry') {
        const subMap = INFANTRY_SUBTAB_TYPES[game.faction] || {};
        types = (subMap[factorySubTab] || []).filter(t => factionPool.includes(t));
        types = [...new Set(types)].filter(t => t !== 'infantry');
    } else if (factoryTab === 'vehicles') {
        const subMap = VEHICLE_SUBTAB_TYPES[game.faction] || {};
        types = (subMap[factorySubTab] || []).filter(t => factionPool.includes(t));
        types = [...new Set(types)];
    } else {
        types = (TAB_TYPES[factoryTab] || []).filter(t => factionPool.includes(t));
    }

    if (types.length === 0) {
        grid.innerHTML = '<div style="color:#9ca3af;font-size:0.75rem;">Нет доступных юнитов в этой подвкладке</div>';
        return;
    }

    types.forEach(type => {
        const info = VEHICLE_INFO[type];
        if (!info) return;
        const name = factionUnitName(type, info);
        const canAfford = game.res.s >= info.cost.s
                       && game.res.c >= info.cost.c
                       && game.res.m >= info.cost.m;
        const allowedByMode = getModeFlags(game).allowUnit(type);
        const card = document.createElement('div');
        card.className = 'unit-card'
            + ((canAfford && allowedByMode) ? '' : ' disabled')
            + (allowedByMode ? '' : ' restricted');
        card.innerHTML = `
            <div class="unit-name">${info.icon} ${name}${allowedByMode ? '' : ' 🔒'}</div>
            <div class="unit-stats">${info.stats}</div>
            <div class="unit-cost">S:${info.cost.s} C:${info.cost.c} M:${info.cost.m}</div>
            ${allowedByMode ? '' : '<div class="unit-restricted-lbl">Недоступно в этом режиме</div>'}
        `;
        if (!allowedByMode) {
            card.title = 'Этот юнит запрещён выбранным режимом ограничений';
        } else if (canAfford) {
            card.onclick = () => trainUnit(type, factory);
        }
        grid.appendChild(card);
    });
}

function updateProductionQueueUI() {
    const queueContainer = document.getElementById('productionQueue');
    const queueContent = document.getElementById('productionQueueContent');

    if (!queueContainer || !queueContent || !game) return;

    const playerFactories = game.buildings.filter(b => b.type === 'factory' && b.faction === game.faction);

    let allQueueItems = [];
    playerFactories.forEach(factory => {
        const queue = game.getProductionProgress(factory.id);
        allQueueItems = allQueueItems.concat(queue);
    });

    if (allQueueItems.length === 0) {
        queueContainer.style.display = 'none';
        return;
    }

    queueContainer.style.display = 'block';

    let queueHtml = '';

    allQueueItems.forEach((item, index) => {
        const info = VEHICLE_INFO[item.type];
        const displayName = factionUnitName(item.type, info);
        const elapsed = game.time - item.startTime;
        const buildTimeTicks = item.buildTime * 60;
        const progress = Math.min(100, (elapsed / buildTimeTicks) * 100);
        const remainingTime = Math.max(0, Math.ceil((buildTimeTicks - elapsed) / 60));

        queueHtml += `
            <div style="margin-bottom:0.5rem;">
                <div style="font-size:0.7rem;color:#d1d5db;">${info.icon} ${displayName}</div>
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

    if (!game.canProduceUnit(type, game.faction)) {
        const limits = game.getUnitLimits(game.faction);
        const counts = game.getUnitCounts(game.faction);

        if (type === 'infantry' || type === 'rifleman' || type === 'mg_gunner' ||
            type === 'grenadier' || type === 'sniper') {
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

    const buildTime = cost.buildTime || 10;
    game.addToProductionQueue(type, game.faction, factory.id, buildTime);
    notify(`${factionUnitName(type, info)} поставлен в очередь (${buildTime}с)`);
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

window.toggleDefenseRepair = function() {
    if (!selectedCapturePoint) return;
    const cp = selectedCapturePoint;
    if (cp.owner !== game.faction) {
        notify('Ремонт доступен только на своей точке');
        return;
    }
    if (cp.defenseHp === undefined || cp._defMaxHp === undefined) {
        game.refreshCityDefenseHp(cp);
    }
    const maxHp = cp._defMaxHp || 0;
    if (maxHp <= 0) {
        notify('У точки нет обороны для ремонта (уровень 0)');
        return;
    }
    if (cp.defenseHp >= maxHp) {
        notify('Оборона уже цела');
        return;
    }
    cp.repairDefense = !cp.repairDefense;
    notify(cp.repairDefense ? 'Ремонт обороны ВКЛЮЧЁН' : 'Ремонт обороны ВЫКЛЮЧЕН');
    openDefensePanel(cp,
        parseInt(document.getElementById('defensePanel').style.left) || 0,
        parseInt(document.getElementById('defensePanel').style.top) || 0);
};

function updateRepairButton(cp) {
    const btn = document.getElementById('repairDefenseBtn');
    if (!btn || !cp) return;
    const maxHp = cp._defMaxHp || 0;
    const curHp = cp.defenseHp || 0;
    if (maxHp <= 0) {
        btn.textContent = '🔧 Оборона не построена';
        btn.style.opacity = 0.5;
        btn.disabled = true;
        return;
    }
    btn.disabled = false;
    btn.style.opacity = 1;
    if (curHp >= maxHp) {
        btn.textContent = '✅ Оборона цела';
        btn.style.background = 'rgba(107,114,128,0.15)';
        btn.style.borderColor = '#6b7280';
        btn.style.color = '#9ca3af';
    } else if (cp.repairDefense) {
        btn.textContent = '⏸ Остановить ремонт';
        btn.style.background = 'rgba(251,191,36,0.15)';
        btn.style.borderColor = '#fbbf24';
        btn.style.color = '#fbbf24';
    } else {
        const cost = game.getRepairCostPer1Pct(cp.defenseLevel || 0);
        btn.textContent = `🔧 Ремонт обороны (${cost} S за 1%/3с)`;
        btn.style.background = 'rgba(34,197,94,0.15)';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#22c55e';
    }
}

function openDefensePanel(cp, mx, my) {
    if (cp.defenseLevel === undefined) {
        cp.defenseLevel = 0;
    }

    const panel = document.getElementById('defensePanel');
    panel.classList.remove('hidden');
    panel.style.left = Math.min(mx, window.innerWidth - 380) + 'px';
    panel.style.top = Math.min(my, window.innerHeight - 400) + 'px';

    initDraggableWindow(panel);

    const info = document.getElementById('defenseInfo');
    let extra = '';
    if (typeof game.getCityDefenseDisplayInfo === 'function') {
        const dinfo = game.getCityDefenseDisplayInfo(cp);
        if (dinfo) {
            extra += `<div>Прочность обороны: <strong style="color:${dinfo.broken ? '#ef4444' : '#22c55e'};">${dinfo.integrity}</strong>${dinfo.broken ? ' <span style="color:#ef4444;font-size:0.7rem;">(оборона сломлена — город можно захватить)</span>' : ' <span style="color:#9ca3af;font-size:0.7rem;">(вражеская техника не может въехать в город)</span>'}</div>`;
        }
    }
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
    const defenseInfo = DEFENSE_UPGRADE_INFO.map(d => ({ ...d }));

    levels.innerHTML = defenseInfo.map(d => {
        const currentLevel = cp.defenseLevel || 0;
        const canUpgrade = currentLevel === d.level - 1;
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
    updateRepairButton(cp);
}

function startDefensePanelUpdater() {
    if (defensePanelInterval) clearInterval(defensePanelInterval);
    defensePanelInterval = setInterval(() => {
        if (!game || game.over) return;
        const panel = document.getElementById('defensePanel');
        if (panel && !panel.classList.contains('hidden') && selectedCapturePoint) {
            const now = Date.now();
            if (panel._lastRender && now - panel._lastRender < 2000) return;
            panel._lastRender = now;

            openDefensePanel(selectedCapturePoint,
                parseInt(panel.style.left) || 0,
                parseInt(panel.style.top) || 0);
        }
    }, 1000);
}

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