// ===== AI SYSTEM - STRATEGIC BEHAVIOR =====
import { dist, VEHICLE_COSTS } from './constants.js';
import { createVehicle, isInfUnit } from './vehicles.js';

// Логирование действий бота в консоль (отключается: window.AI_LOG = false)
let LOG_ENABLED = true;
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'AI_LOG', {
        get: () => LOG_ENABLED,
        set: v => { LOG_ENABLED = !!v; console.log('[AI] Логирование ' + (LOG_ENABLED ? 'включено' : 'отключено')); },
    });
}
function aiLog(...args) {
    if (LOG_ENABLED) console.log(...args);
}

export class AI {
    constructor(gameState) {
        this.G = gameState;
        this.timer = 0;
        this.difficulty = 1;
        this.defenseMode = true; // Начинаем в оборонительном режиме
        this.lastAttackTime = 0;
        this.accumulatedForces = 0; // Счётчик накопленных сил
        this.attackThreshold = 6; // Порог накопления сил для атаки (был 12 — ИИ был пассивным)
        this.artilleryPositions = []; // Позиции для артиллерии

        // ===== ЛОГИСТИКА ИИ =====
        // Последняя точка, в которой был замечен враг (для решения «атакуют ли базу»)
        this.lastEnemySighting = null;
        // Логистика: max 5 «наборов» (engineer+truck+fuel_truck) и по 1 машине на точку
        this.logistics = { sets: [], lastScanAt: -9999 };
        // Garrison — сколько юнитов остаётся охранять каждую захваченную точку
        this.garrison = new Map(); // cpId -> [unit,...]
        
        // Система ресурсов ИИ (медленнее чем у игрока)
        this.aiResources = {
            s: 150, // Начальные ресурсы
            c: 75,
            m: 60,
        };
        this.aiResourceRate = 0.6; // Множитель скорости фарма (60% от игрока)

        // ===== КВОТА «1 ТЕХНИКА НА 5 ПЕХОТИНЦЕВ» =====
        // Фикс краша: методы/поля squadSizeOf / infantrySpawned / vehicleDebtTarget /
        // vehicleCount использовались в updateInner(), но НЕ были определены —
        // весь цикл ИИ падал с TypeError и бот «не строил технику».
        this.infantrySpawned = 0;   // сколько пехотинцев выпущено с момента последней техники
        this.vehicleDebtTarget = 5; // нужно 5 пехоты -> 1 техника
        this.vehicleCount = 0;      // всего произведено техники ИИ
        this.infantryCount = 0;     // всего произведено пехотинцев ИИ

        // ===== РОДИ ПЕХОТЫ: АТАКА / ОБОРОНА / СНАЙПЕРЫ =====
        // Состав атакующей пехоты (в процентах от отряда):
        //   стрелки ~60%, гранатомётчики ~20%, пулемётчики ~20%
        // В обороне (гарнизон своих точек) ИИ использует ПРЕИМУЩЕСТВЕННО
        // пулемётчиков, а снайперов рассылает по захваченным противником
        // городам — ровно 1 снайпер на 1 город.
        this.sniperAssignments = new Map(); // cityKey -> id снайпера
        this.lastSniperScanAt = -9999;
    }

    // Размер отряда пехоты по сложности
    squadSizeOf(diff) {
        const d = diff || this.difficulty;
        return Math.min(4, 2 + Math.floor(d / 2));
    }

    // ===== СОСТАВ ПЕХОТЫ =====
    // 'attack' — смешанные отряды для штурма: стрелки + гранатомётчики
    //            + немного пулемётчиков.
    // 'defense' — преимущественно пулемётчики (дешёвый плотный огонь на
    //             короткой дистанции — идеальны для обороны своих точек).
    pickInfantryType(role) {
        const r = Math.random();
        if (role === 'defense') {
            return r < 0.75 ? 'mg_gunner' : 'rifleman';
        }
        if (r < 0.6) return 'rifleman';
        if (r < 0.8) return 'grenadier';
        return 'mg_gunner';
    }

    // Текущее соотношение пехота:техника «на поле» (живые юниты ИИ).
    // Используется для догоняющего производства техники: если пехоты больше
    // чем 5x техники — ИИ наращивает технику, пока квота 1:5 не восстановится.
    getLiveCounts() {
        let inf = 0, veh = 0;
        for (const u of this.G.units) {
            if (u.faction !== this.G.ai || u.hp <= 0) continue;
            if (isInfUnit(u)) inf++;
            else if (u.type !== 'truck' && u.type !== 'fuel_truck' &&
                     u.type !== 'engineer' && u.type !== 'flatbed') veh++;
        }
        return { inf, veh };
    }

    update() {
        try {
            this.updateInner();
        } catch (err) {
            // Критическая защита: если в логике ИИ возникает ошибка (например,
            // вызов несуществующего метода), она НЕ должна прерывать игровой цикл,
            // иначе юниты перестают обновляться и "исчезают" из игры.
            console.error('[AI] Ошибка в update() бота:', err);
            // ИИ никогда не должен ронять игровой цикл: логируем ошибку и продолжаем
            console.error('[AI][ERROR] Ошибка в update() бота:', err);
        }
    }

    updateInner() {
        this.timer++;

        // Периодический отчёт о состоянии бота (каждые ~10 секунд)
        if (this.timer % 600 === 0) {
            const aiUnits = this.G.units.filter(u => u.faction === this.G.ai && u.hp > 0);
            const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
            const playerPts = this.G.cps.filter(c => c.owner === this.G.faction).length;
            const arts = aiUnits.filter(u => u.aoe).length;
            aiLog(`[AI][STATUS] t=${this.timer} режим=${this.defenseMode ? 'ОБОРОНА' : 'АТАКА'} силы=${this.accumulatedForces}/${this.attackThreshold} сложность=${this.difficulty} юнитов=${aiUnits.length} арт=${arts} точки(ИИ/игрок)=${aiPoints}/${playerPts} res: s=${Math.floor(this.aiResources.s)} c=${Math.floor(this.aiResources.c)} m=${Math.floor(this.aiResources.m)}`);
        }
        this.difficulty = Math.min(3, 1 + Math.floor(this.timer / 4000)); // Ещё медленнее растёт
        
        // Генерация ресурсов ИИ (медленнее чем у игрока)
        this.updateAIResources();

        // Проверка лимита пехоты влияет только на производство пехоты.
        // Раньше при достижении лимита выходил весь update(), из-за чего
        // бот полностью замирал: не двигал юниты, не строил укрепления,
        // не атаковал оборону игрока.
        const canProduceInfantry = this.G.canProduceUnit('infantry', this.G.ai);

        // Проверка доминирования игрока (больше 50% точек)
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;
        const totalPoints = this.G.cps.length;
        const playerDominance = playerPoints > totalPoints * 0.5;
        
        // Базовые интервалы спавна (ИИ стал активнее: производство ускорено)
        const baseInfantryInterval = 600;
        const baseVehicleInterval = 1100;

        // Раньше ИИ спавнил юнитов в 2-3 раза медленнее базового интервала —
        // из-за этого он «сидел в обороне» и за 2 минуты не мог захватить ни одной точки.
        // Теперь: до 50% точек у игрока — полная скорость, после — лишь 1.4x замедление.
        const spawnMultiplier = playerDominance ? 1.4 : 1.0;
        const actualInfantryInterval = Math.round(baseInfantryInterval * spawnMultiplier);
        const actualVehicleInterval = Math.round(baseVehicleInterval * spawnMultiplier);

        // ===== ПРОИЗВОДСТВО ИИ: КВОТА 1 ТЕХНИКА / 5 ПЕХОТЫ + ДОГОНЯЩЕЕ СТРОИТЕЛЬСТВО =====
        // Правила:
        //  1) На каждые выпущенных 5 пехотинцев ИИ обязан выпустить 1 технику.
        //  2) Если техника ТЕРЯЕТСЯ в бою и живая пехота превышает 5x живую
        //     технику — ИИ В ПРИОРИТЕТЕ наращивает технику, пока соотношение
        //     1:5 не восстановится (фикс «бот спамит пехотой»).
        //  3) Пока копятся ресурсы на технику — пехоту НЕ спавним вообще
        //     (раньше именно это создавало спам: пехота сыпалась каждую
        //     секунду и съедала весь бюджет).
        const INF_PER_VEHICLE = 5;
        let spawnedThisTick = false;

        const liveInf = this.G.units.filter(u => u.faction === this.G.ai && isInfUnit(u) && u.hp > 0).length;
        const liveVeh = this.G.units.filter(u => u.faction === this.G.ai && u.hp > 0 &&
            !isInfUnit(u) && u.type !== 'truck' && u.type !== 'fuel_truck' &&
            u.type !== 'engineer' && u.type !== 'flatbed').length;
        // Соотношение «на поле»: пехоты больше 5x техники -> копим технику (debt)
        const debtTarget = liveVeh * INF_PER_VEHICLE;
        const needsCatchUp = liveInf > debtTarget;

        // ===== ФИКС КРАША "SyntaxError / manageSnipers is not a function" =====
        // Раньше весь блок производства был обёрнут в условие
        // `if (canProduceInfantry && this.timer % actualInfantryInterval === 0)`
        // с незакрытой фигурной скобкой. Из-за этого:
        //   1) синтаксис файла был сломан — модуль ai.js вообще не загружался
        //      в браузере (а значит, НЕ СУЩЕСТВОВАЛО ни manageSnipers, ни
        //      expandAndCapture — отсюда TypeError в updateInner() и полная
        //      остановка обновлений юнитов: юниты «внезапно пропадали», а
        //      артиллерия без приказов ИИ носилась по карте);
        //   2) логика движения/снайперов/артиллерии была заперта внутри
        //      блока производства и выполнялась лишь раз в ~10 секунд.
        // Теперь это плоский код updateInner(): производство проверяет
        // интервалы само, а поведение юнитов выполняется КАЖДЫЙ тик.
        const spawnTick = this.timer % actualInfantryInterval === 0;
        const vehTick = this.timer % actualVehicleInterval === 0;

        const hasFactory = this.G.buildings.some(b => b.faction === this.G.ai && b.type === 'factory');
        const canVehicleSlot = this.G.canProduceUnit('vehicle', this.G.ai);
        const canAffordVeh = this.canAffordVehicle();
        const quotaMet = this.infantrySpawned >= this.vehicleDebtTarget;
        // Техника возможна только когда ЕСТЬ завод (иначе бот «копил» бы вечно
        // без factory и не производил вообще ничего — фикс этого тупика):
        const vehiclePossible = hasFactory && canVehicleSlot && canAffordVeh;

        if (vehTick && vehiclePossible && (quotaMet || needsCatchUp)) {
            // Квота выполнена ИЛИ нужно догнать потери техники — выпускаем технику
            const before = this.G.units.length;
            this.spawnVehicle();
            if (this.G.units.length > before) {
                this.vehicleCount++;
                this.infantrySpawned = 0;
                this.accumulatedForces += 2;
                spawnedThisTick = true;
                aiLog(`[AI][SPAWN] т.${this.timer}: ТЕХНИКА (${this.vehicleCount} всего). На поле: пехота=${liveInf}, техника=${liveVeh} (квота 1:${INF_PER_VEHICLE}${needsCatchUp ? ', ДОГОНЯЕМ ПОТЕРИ' : ''})`);
            }
        } else if (spawnTick && canProduceInfantry && this.canAffordInfantry()) {
            if (hasFactory && canVehicleSlot && canAffordVeh) {
                // Завод есть, техника доступна, но квота ещё не набрана — копим пехоту
                this.spawnInfantrySquad();
                this.infantrySpawned += this.squadSizeOf(this.difficulty);
                this.accumulatedForces++;
                spawnedThisTick = true;
            } else if (!canVehicleSlot && canAffordVeh && needsCatchUp && hasFactory) {
                // Догоняем потери, но слотов техники нет — ждём, пехоту НЕ спамим
            } else {
                // Нет завода / нет ресурсов на технику / лимит техники -> компенсируем пехотой
                this.spawnInfantrySquad();
                this.infantrySpawned += this.squadSizeOf(this.difficulty);
                this.accumulatedForces++;
                spawnedThisTick = true;
            }
        }

        // Активное расширение: юниты без приказа сами идут на ближайшие
        // нейтральные/вражеские точки и захватывают их
        this.expandAndCapture();

        // Гарнизон: минимум 1 юнит охраны на каждой захваченной точке
        this.maintainGarrisons();

        // Снайперы: 1 снайпер на каждый захваченный противником город
        // (при достаточном запасе ресурсов цель расширяется и на главную базу)
        // ФИКС КРАША: у этого метода не существовало реализации — вызов
        // ронял весь цикл ИИ (TypeError: this.manageSnipers is not a function),
        // из-за чего бот «внезапно» терял управление над всеми юнитами.
        // Теперь метод реализован ниже + защита typeof на всякий случай.
        if (typeof this.manageSnipers === 'function') this.manageSnipers();

        // Стратегическое поведение
        this.strategicBehavior();
        
        // Управление артиллерией
        this.manageArtillery();

        // Логистика ИИ: ремонтники / грузовики БК / бензовозы к технике,
        // flatbed (+ремонт+топливо) к артиллерии
        this.manageLogistics();

        // Отвод повреждённой техники: порог 50% HP + шанс удержать позицию.
        // Чем меньше точек у ИИ относительно игрока — тем крепче он держится.
        this.handleDamagedVehicles();

        // Строительство укреплений (линия обороны: чем ближе к базе — тем плотнее)
        this.buildFortifications();
        // Оборонительные действия (не зависят от лимитов производства)
        if (!spawnedThisTick) this.defensiveReactions();
    }
    
    // ===== Активное расширение: юниты ИИ без приказа сами идут захватывать точки =====
    // Раньше этих методов НЕ СУЩЕСТВОВАЛО, хотя они вызывались в updateInner().
    // Это роняло весь цикл ИИ (TypeError: this.expandAndCapture is not a function),
    // из-за чего бот «строил технику, но не захватывал точки».
    expandAndCapture() {
        // Каждые ~2 секунды отправляем свободных юнитов на ближайшие
        // нейтральные или вражеские точки
        if (this.timer % 120 !== 0) return;

        const targets = this.G.cps.filter(c => c.owner !== this.G.ai);
        if (targets.length === 0) return;

        const idle = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            u.tx === undefined && !u.aoe &&
            u.type !== 'truck' && u.type !== 'fuel_truck' &&
            u.type !== 'engineer' && u.type !== 'flatbed'
        );
        if (idle.length === 0) return;

        // Сортируем цели: нейтральные ближе всего — приоритет, затем слабые вражеские
        const sorted = targets.slice().sort((a, b) => {
            const na = (a.owner === 'neutral' ? -1000 : 0);
            const nb = (b.owner === 'neutral' ? -1000 : 0);
            return na - nb;
        });

        // Отправляем до 6 свободных юнитов за раз, распределяя по точкам
        const squadSize = Math.min(6, idle.length);
        for (let i = 0; i < squadSize; i++) {
            const u = idle[i];
            const cp = sorted[i % Math.min(sorted.length, 3)]; // делим на 2-3 ближайшие точки
            // Цель приказа: нейтральная точка — в любую точку (там нет обороны);
            // во вражескую — только если её оборона уже пробита, иначе ставим
            // приказ у границы зоны (юнит не упрётся в блок-линию и не «исчезнет»).
            const canEnter = cp.owner === 'neutral' || this.G.isCityDefenseBroken(cp);
            if (canEnter) {
                u.tx = cp.x + (Math.random() - 0.5) * cp.radius;
                u.ty = cp.y + (Math.random() - 0.5) * cp.radius;
            } else {
                const a = Math.atan2(u.y - cp.y, u.x - cp.x) || 0;
                u.tx = cp.x + Math.cos(a) * (cp.radius + 40);
                u.ty = cp.y + Math.sin(a) * (cp.radius + 40);
            }
            u.captureTarget = cp;
        }
    }

    // Угрожает ли точке враг (юниты рядом или в приближении)?
    isPointThreatened(cp) {
        return this.G.units.some(u =>
            u.faction === this.G.faction && u.hp > 0 &&
            dist(u.x, u.y, cp.x, cp.y) < cp.radius + 180
        );
    }

    // ===== Гарнизон: держим минимум 1 юнита на каждой важной захваченной точке =====
    maintainGarrisons() {
        if (this.timer % 300 !== 0) return; // пересмотр раз в 5 секунд

        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);

        // Освобождаем юнитов, чья точка больше не принадлежит ИИ
        for (const [cpId, units] of this.garrison.entries()) {
            const cp = this.G.cps.find(c => (c.id || c.name) === cpId);
            if (!cp || cp.owner !== this.G.ai) {
                units.forEach(u => { u.garrisonedAt = null; });
                this.garrison.delete(cpId);
            }
        }

        for (const cp of aiPoints) {
            const key = cp.id || cp.name;
            const current = (this.garrison.get(key) || []).filter(u =>
                u.hp > 0 && u.faction === this.G.ai && dist(u.x, u.y, cp.x, cp.y) <= cp.radius + 40
            );
            this.garrison.set(key, current);

            const base = this.getAIMainBase();
            const dBase = base ? dist(base.x, base.y, cp.x, cp.y) : 0;
            const desired = (cp === base) ? 2 : (dBase < 700 ? 1 : 1);

            if (current.length >= desired) continue;

            // Кого послать в гарнизон?
            const candidates = this.G.units.filter(u =>
                u.faction === this.G.ai && u.hp > 0 && !u.aoe &&
                u.type !== 'truck' && u.type !== 'fuel_truck' &&
                u.type !== 'engineer' && u.type !== 'flatbed' &&
                !u.garrisonedAt && u.isScout !== true
            ).sort((a, b) => dist(a.x, a.y, cp.x, cp.y) - dist(b.x, b.y, cp.x, cp.y));

            const need = desired - current.length;
            for (let i = 0; i < need && i < candidates.length; i++) {
                const u = candidates[i];
                u.garrisonedAt = key;
                u.tx = cp.x + (Math.random() - 0.5) * cp.radius * 0.6;
                u.ty = cp.y + (Math.random() - 0.5) * cp.radius * 0.6;
                current.push(u);
            }
            if (need > 0) this.garrison.set(key, current);
        }

        // Гарнизонные юниты без приказа — возвращаем на свою точку
        for (const [key, units] of this.garrison.entries()) {
            const cp = this.G.cps.find(c => (c.id || c.name) === key);
            if (!cp || cp.owner !== this.G.ai) continue;
            units.forEach(u => {
                if (u.hp > 0 && u.tx === undefined && dist(u.x, u.y, cp.x, cp.y) > cp.radius + 60) {
                    u.tx = cp.x + (Math.random() - 0.5) * cp.radius * 0.6;
                    u.ty = cp.y + (Math.random() - 0.5) * cp.radius * 0.6;
                }
            });
        }
    }

    // ===== Логистика ИИ: ремонтники / БК / топливо к нуждающейся технике =====
    manageLogistics() {
        if (this.timer % 90 !== 0) return; // приказ раз в 1.5 секунды

        const sendToNeedy = (logType, predicate) => {
            const vehicles = this.G.units.filter(u =>
                u.faction === this.G.ai && u.hp > 0 && !isInfUnit(u) &&
                u.type !== logType && predicate(u)
            ).sort((a, b) => a.hp / (a.maxHp || 1) - b.hp / (b.maxHp || 1));
            if (vehicles.length === 0) return;

            const needy = vehicles[0];
            const helpers = this.G.units.filter(u =>
                u.faction === this.G.ai && u.type === logType && u.hp > 0
            ).sort((a, b) => dist(a.x, a.y, needy.x, needy.y) - dist(b.x, b.y, needy.x, needy.y));
            if (helpers.length === 0) return;

            const h = helpers[0];
            if (h.tx !== undefined && dist(h.x, h.y, needy.x, needy.y) < 60) return; // уже рядом
            h.tx = needy.x + (Math.random() - 0.5) * 20;
            h.ty = needy.y + (Math.random() - 0.5) * 20;
        };

        // Инженер — к технике с низким HP
        sendToNeedy('engineer', u => u.hp < (u.maxHp || 100) * 0.6);
        // Грузовик — к технике с кончающимся БК
        sendToNeedy('truck', u => u.ammo !== undefined && u.maxAmmo !== undefined && u.ammo < u.maxAmmo * 0.3);
        // Бензовоз — к технике с кончающимся топливом
        sendToNeedy('fuel_truck', u => u.fuel !== undefined && u.maxFuel !== undefined && u.fuel < u.maxFuel * 0.3);
        // Flatbed — к артиллерии (снаряды)
        sendToNeedy('flatbed', u => !!u.aoe);
    }

    // ===== ОТВОД ПОВРЕЖДЁННОЙ ТЕХНИКИ =====
    // Шанс НЕ отступать: чем меньше точек у ИИ по сравнению с игроком,
    // тем крепче он держится за то, что есть.
    //  - точки равны / у ИИ больше            -> 20% (базовый шанс)
    //  - точек ИИ в 2 раза меньше, чем у игрока -> 80%
    //  - ещё меньше                            -> до 95%
    getHoldGroundChance() {
        const aiPts = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const plPts = this.G.cps.filter(c => c.owner === this.G.faction).length;
        const BASE = 0.2;   // 20% при равенстве точек
        const MAXHOLD = 0.95;
        if (plPts <= 0) return Math.min(MAXHOLD, BASE + 0.4); // игрок без точек — держим намертво
        const ratio = aiPts / plPts;      // 1.0 — паритет, 0.5 — в 2 раза меньше
        if (ratio >= 1) return BASE;
        // линейная прогрессия от ratio=1 (20%) до ratio=0.5 (80%)
        const slope = (0.8 - BASE) / (1 - 0.5); // 1.2
        const chance = BASE + (1 - ratio) * slope;
        return Math.max(BASE, Math.min(MAXHOLD, chance));
    }

    // Принять решение об отводе повреждённой техники. Вызывается из game.js
    // раз в ~2 секунды, чтобы решения не «мигали» каждый кадр.
    makeRetreatDecisions() {
        if (this.timer % 120 !== 0) return;
        const holdChance = this.getHoldGroundChance();
        const vehicles = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            !isInfUnit(u) && u.type !== 'truck' &&
            u.type !== 'fuel_truck' && u.type !== 'engineer' && u.type !== 'flatbed'
        );
        for (const v of vehicles) {
            // ===== ФИКС «юниты едут хрен пойми куда» =====
            // Юнитам, которым игрок отдал приказ движения, ИИ не навязывает
            // свои решения об отводе/удержании — иначе его флаги перебивали
            // приказ игрока и уводили технику в другую сторону.
            if (v.orderOrigin !== undefined) continue;
            const maxHp = v.maxHp || 100;
            if (v.hp >= maxHp * 0.5) {
                // долечился выше порога — забываем прошлое решение
                v.holdPosition = false;
                v.retreatDecisionAt = undefined;
                continue;
            }
            if (v.holdPosition !== undefined && v.retreatDecisionAt !== undefined) continue;
            const stay = Math.random() < holdChance;
            v.holdPosition = stay;
            v.retreatDecisionAt = this.timer;
            aiLog(`[AI][RETREAT] т.${this.timer}: ${v.label} HP=${Math.round(v.hp)}/${maxHp} → ${stay ? 'ДЕРЖИТ ПОЗИЦИЮ до конца' : 'отводится в тыл'} (шанс удержать=${Math.round(holdChance * 100)}%)`);
        }
    }

    handleDamagedVehicles() {
        const base = this.getAIMainBase();
        if (!base) return;

        const damaged = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            !isInfUnit(u) && u.type !== 'truck' &&
            u.type !== 'fuel_truck' && u.type !== 'engineer' && u.type !== 'flatbed' &&
            u.hp < (u.maxHp || 100) * 0.5
        );
        if (damaged.length === 0) return;

        // Если у главной базы стоит вражеская техника — её нужно уничтожить
        // всей доступной техникой и пехотой ИИ (независимо от режима).
        const enemyVehiclesAtBase = this.G.units.filter(u =>
            u.faction === this.G.faction && u.hp > 0 && !isInfUnit(u) &&
            dist(u.x, u.y, base.x, base.y) <= base.radius + 150
        );
        if (enemyVehiclesAtBase.length > 0) {
            const focus = enemyVehiclesAtBase.reduce((best, e) =>
                dist(e.x, e.y, base.x, base.y) < dist(best.x, best.y, base.x, base.y) ? e : best);
            const attackers = this.G.units.filter(u =>
                u.faction === this.G.ai && u.hp > 0 && !u.aoe &&
                u.type !== 'truck' && u.type !== 'fuel_truck' &&
                u.type !== 'engineer' && u.type !== 'flatbed' &&
                dist(u.x, u.y, base.x, base.y) < 1600
            );
            attackers.forEach(u => {
                u.tx = focus.x + (Math.random() - 0.5) * 70;
                u.ty = focus.y + (Math.random() - 0.5) * 70;
                u.holdPosition = true; // при контратаке базу не покидаем
                u.retreatDecisionAt = this.timer;
            });
            aiLog(`[AI][BASE-DEF] т.${this.timer}: техника игрока у главной базы (${enemyVehiclesAtBase.length} шт.) — в атаку ${attackers.length} юнитов`);
        }

        for (const v of damaged) {
            if (v.holdPosition === true) continue;           // решил стоять до конца
            if (v.holdPosition === undefined) continue;      // решение ещё не принято
            if (v.isScout) continue;                         // разведка не отводится
            // уже отведён/в тылу — не трогаем
            if (dist(v.x, v.y, base.x, base.y) <= base.radius + 120) continue;
            // уже есть приказ движения в тыл — не переставляем
            if (v.tx !== undefined) continue;

            const angle = Math.atan2(base.y - v.y, base.x - v.x);
            const stopDist = base.radius * 0.5;
            v.tx = base.x - Math.cos(angle) * stopDist;
            v.ty = base.y - Math.sin(angle) * stopDist;
            v.retreatToBase = true;
            aiLog(`[AI][RETREAT] т.${this.timer}: ${v.label} HP=${Math.round(v.hp)}/${v.maxHp || 100} отводится на базу (${Math.round(v.tx)}, ${Math.round(v.ty)})`);
        }
    }

    defensiveReactions() {
        // Если свои территории под угрозой - отправляем свободных юнитов защищать
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;
        
        const threatened = aiPoints.filter(cp => {
            const enemyNear = this.G.units.some(u =>
                u.faction === this.G.faction && u.hp > 0 &&
                dist(u.x, u.y, cp.x, cp.y) < cp.radius + 60
            );
            return enemyNear;
        });
        if (threatened.length === 0) return;
        
        const target = threatened[0];
        const idle = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && u.tx === undefined && !u.aoe &&
            !u.retreatToBase // не дёргаем технику, которую отводим в тыл на ремонт
        );
        idle.slice(0, 4).forEach(u => {
            u.tx = target.x + (Math.random() - 0.5) * 60;
            u.ty = target.y + (Math.random() - 0.5) * 60;
        });
    }
    
    // Категории юнитов (вместо отсутствующего поля category):
    // 'infantry' | 'tank' | 'apc' | 'artillery' | 'supply' | 'engineer'
    unitCategory(u) {
        if (!u || !u.type) return 'other';
        const t = u.type;
        if (t === 'infantry') return 'infantry';
        if (t.includes('artillery')) return 'artillery';
        if (t === 'truck' || t === 'fuel_truck' || t === 'flatbed') return 'supply';
        if (t === 'engineer') return 'engineer';
        if (t === 'niska' || t === 'hoplite') return 'apc';
        return 'tank';
    }

    // Главная база ИИ — точка захвата, рядом с которой стоит его town_hall.
    getAIMainBase() {
        const hall = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'town_hall');
        if (hall) {
            let best = null, bd = Infinity;
            for (const cp of this.G.cps) {
                const d = dist(hall.x, hall.y, cp.x, cp.y);
                if (d < bd) { bd = d; best = cp; }
            }
            if (best && bd <= 250) return best;
        }
        return this.G.cps.find(c => c.owner === this.G.ai) || null;
    }

    // Сколько бункеров должно стоять на точке — «линия обороны».
    // Чем ближе точка к базе ИИ, тем сильнее линия обороны.
    getDesiredBunkerCount(cp) {
        const base = this.getAIMainBase(); // ГЛАВНАЯ база ИИ (не первая попавшаяся его точка!)
        if (!base) return 1;
        const dBase = dist(base.x, base.y, cp.x, cp.y);
        const isMainBase = (cp === base);
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length || 1;
        const playerDominates = this.G.cps.filter(c => c.owner === this.G.faction).length > aiPoints;

        let desired;
        if (isMainBase) {
            desired = 4;                       // главная база — самая плотная оборона
        } else if (dBase < 700) {
            desired = 3;                       // ближний пояс к базе
        } else if (dBase < 1200) {
            desired = 2;                       // средний пояс
        } else {
            desired = 1;                       // дальние/фронтовые точки
        }
        // Под угрозой или при доминировании игрока — дополнительно укрепляем тылы
        if ((playerDominates || this.isPointThreatened(cp)) && !isMainBase && desired < 3) desired += 1;
        if (isMainBase && (playerDominates || this.isPointThreatened(cp))) desired = 5;
        return desired;
    }

    // Тип бункера по приоритету: у базы — тяжёлые, дальше — легче
    pickBunkerType(cp, index) {
        const base = this.getAIMainBase();
        const dBase = base ? dist(base.x, base.y, cp.x, cp.y) : 99999;
        const options = [];
        if (cp === base || dBase < 700) options.push('bunker_heavy', 'bunker_medium', 'bunker_light');
        else if (dBase < 1200) options.push('bunker_medium', 'bunker_light');
        else options.push('bunker_light');
        const costs = { bunker_light: { s: 30, c: 20, m: 25 }, bunker_medium: { s: 60, c: 40, m: 50 }, bunker_heavy: { s: 100, c: 70, m: 80 } };
        for (const t of options) {
            const c = costs[t];
            if (this.aiResources.s >= c.s && this.aiResources.c >= c.c && this.aiResources.m >= c.m) return t;
        }
        return null;
    }

    buildFortifications() {
        // Строим не чаще одного бункера в ~2 секунды (очередь из нескольких зданий)
        if (this.timer % 120 !== 0) return;

        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;

        // Идентификация ГЛАВНОЙ базы ИИ: точка, рядом с которой стоит его town_hall.
        // (cps в начале массива — обе главные базы, поэтому нельзя брать просто
        //  первую точку ИИ из списка — иначе оборона строилась не у своей базы)
        const aiMainBase = this.getAIMainBase();

        // Считаем существующие бункеры ИИ рядом с каждой точкой.
        // ВАЖНО: считаем и недостроенные (hp<=0) — иначе ИИ ставил бы бункер
        // на одно и то же место каждые 2 секунды, спамя постройку.
        const counts = new Map();
        for (const cp of aiPoints) {
            const n = this.G.buildings.filter(b =>
                b.faction === this.G.ai && b.type && b.type.startsWith('bunker_') &&
                dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80
            ).length;
            counts.set(cp.id || cp.name, n);
        }

        // Выбираем точку, где нехватка обороны максимальна (приоритет — близость к базе)
        let best = null, bestScore = -Infinity;
        for (const cp of aiPoints) {
            const have = counts.get(cp.id || cp.name) || 0;
            const need = this.getDesiredBunkerCount(cp);
            const deficit = need - have;
            if (deficit <= 0) continue;
            const dBase = aiMainBase ? dist(aiMainBase.x, aiMainBase.y, cp.x, cp.y) : 0;
            const score = deficit * 100 - dBase * 0.1; // ближе к базе = выше приоритет
            if (score > bestScore) { bestScore = score; best = cp; }
        }
        if (!best) return;

        const have = counts.get(best.id || best.name) || 0;
        const type = this.pickBunkerType(best, have);
        if (!type) return; // не хватает ресурсов — ждём

        // Позиция: по кругу вокруг точки, на границе зоны (чтобы вражеская техника
        // упиралась в оборону раньше), без наложения на уже стоящие бункеры
        let placed = false, bx = 0, by = 0;
        for (let attempt = 0; attempt < 10; attempt++) {
            const angle = ((have + attempt) / Math.max(6, this.getDesiredBunkerCount(best))) * Math.PI * 2 + Math.random() * 0.4;
            const r = best.radius * (0.75 + Math.random() * 0.2);
            bx = best.x + Math.cos(angle) * r;
            by = best.y + Math.sin(angle) * r;
            const tooClose = this.G.buildings.some(b => b.hp > 0 && dist(b.x, b.y, bx, by) < 45);
            if (!tooClose) { placed = true; break; }
        }
        if (!placed) return;

        // ВАЖНО: ИИ платит из своего пула ресурсов (5-й аргумент) — иначе он тратил
        // ресурсы игрока и не мог построить ничего дороже лёгкого бункера
        const fortification = this.G.buildFortification(type, bx, by, this.G.ai, this.aiResources);
        if (fortification) {
            fortification.buildTime *= 1.3; // ИИ строит чуть медленнее игрока
            aiLog(`[AI][FORT] т.${this.timer}: линия обороны — ${type} у "${best.name}" (${have + 1}/${this.getDesiredBunkerCount(best)})`);
        }
    }

    updateAIResources() {
        // ИИ получает ресурсы медленнее чем игрок
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const modeMultiplier = this.G.gameMode === 'realism' ? 0.3 : this.G.gameMode === 'fast' ? 2.5 : 1.0;
        
        this.aiResources.s += aiPoints * 0.03 * this.aiResourceRate * modeMultiplier;
        this.aiResources.c += aiPoints * 0.015 * this.aiResourceRate * modeMultiplier;
        this.aiResources.m += aiPoints * 0.01 * this.aiResourceRate * modeMultiplier;
    }
    
    canAffordInfantry() {
        const cost = VEHICLE_COSTS.infantry;
        return this.aiResources.s >= cost.s && 
               this.aiResources.c >= cost.c && 
               this.aiResources.m >= cost.m;
    }
    
    canAffordVehicle() {
        // Проверяем можем ли позволить себе хотя бы самый дешёвый танк
        const cheapestVehicle = this.G.ai === 'wardens' ? VEHICLE_COSTS.devitt : VEHICLE_COSTS.hatchet;
        return this.aiResources.s >= cheapestVehicle.s && 
               this.aiResources.c >= cheapestVehicle.c && 
               this.aiResources.m >= cheapestVehicle.m;
    }
    
    spendResources(cost) {
        this.aiResources.s -= cost.s;
        this.aiResources.c -= cost.c;
        this.aiResources.m -= cost.m;
    }

    spawnInfantrySquad(role = 'attack') {
        const barracks = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'barracks');
        if (!barracks) return;

        // Меньше пехоты за раз
        const squadSize = this.squadSizeOf(this.difficulty);

        // Формируем состав отряда: в атаку — разная пехота (стрелки,
        // гранатомётчики, немного пулемётчиков), в оборону — преимущественно
        // пулемётчики. Считаем стоимость по фактическому составу и проверяем,
        // хватает ли ресурсов (если нет — берём более дешёвые варианты).
        let types = [];
        for (let i = 0; i < squadSize; i++) types.push(this.pickInfantryType(role));
        while (types.length > 0 && !this.canAffordSquad(types)) {
            // Заменяем самый дорогой юнит на стрелка (дешевле всего);
            // если и так все стрелки — уменьшаем отряд
            const idx = types.reduce((best, t, i) =>
                (VEHICLE_COSTS[t].s > VEHICLE_COSTS[types[best]].s ? i : best), 0);
            if (types[idx] === 'rifleman') types.pop();
            else types[idx] = 'rifleman';
        }
        if (types.length === 0) return; // не хватает даже на стрелков

        const totalCost = this.squadCost(types);
        this.spendResources(totalCost);

        const spawned = [];
        for (let i = 0; i < types.length; i++) {
            const unit = createVehicle(types[i], this.G.ai,
                barracks.x + 50 + (i % 3) * 20,
                barracks.y + 50 + Math.floor(i / 3) * 20);
            this.G.units.push(unit);
            spawned.push(unit);
        }

        // В оборонительном режиме - защищаем свои территории
        if (this.defenseMode) {
            this.assignDefensivePositions(spawned);
        } else {
            // В режиме атаки - идём к ближайшей точке
            const target = this.findDefensiveTarget(barracks.x, barracks.y);
            if (target) {
                this.assignSquadToTarget(spawned, target);
            }
        }
    }

    // ===== СНАЙПЕРЫ: 1 снайпер на каждый город, захваченный противником =====
    // ФИКС КРАША: метод вызывался в updateInner(), но реализован не был —
    // это роняло весь цикл ИИ (TypeError), из-за чего юниты бота «внезапно
    // пропадали» (переставали двигаться/стрелять и гибли поодиночке).
    manageSnipers() {
        // Ревизия назначений раз в ~2 секунды
        if (this.timer - this.lastSniperScanAt < 120) return;
        this.lastSniperScanAt = this.timer;

        const enemyCities = this.G.cps.filter(c => c.owner === this.G.faction);

        // 1) Удаляем назначения за городами, которые перестали быть вражескими,
        //    и за мёртвыми/удалёнными снайперами.
        for (const [key, id] of [...this.sniperAssignments.entries()]) {
            const cp = this.G.cps.find(c => (c.id || c.name) === key);
            const stillEnemy = cp && cp.owner === this.G.faction;
            const sniperAlive = this.G.units.some(u => u.id === id && u.hp > 0);
            if (!stillEnemy || !sniperAlive) this.sniperAssignments.delete(key);
        }

        // 2) Новый снайпер — только если нет незакрытых вакансий и есть запас
        //    ресурсов (снайпер не должен съедать бюджет производства отрядов).
        const unstaffed = enemyCities.filter(
            c => !this.sniperAssignments.has(c.id || c.name));
        if (unstaffed.length === 0) return;

        const cost = VEHICLE_COSTS.sniper || VEHICLE_COSTS.infantry;
        const RESERVE = 60; // не тратим последние ресурсы на снайпера
        if (this.aiResources.s < cost.s + RESERVE ||
            this.aiResources.c < cost.c + RESERVE ||
            this.aiResources.m < cost.m + RESERVE) return;

        const target = unstaffed[0];
        const unit = this.spawnSniper();
        if (!unit) return;

        this.sniperAssignments.set(target.id || target.name, unit.id);
        aiLog(`[AI][SNIPER] т.${this.timer}: снайпер отправлен к городу "${target.name || ''}" (${Math.round(unit.x)}, ${Math.round(unit.y)})`);
    }

    // Выпустить одного снайпера с казармы и поставить его на огневую позицию
    // у границы целевого города (сам город может быть под обороной — поэтому
    // цель — край зоны, а не центр).
    spawnSniper() {
        const barracks = this.G.buildings.find(b =>
            b.faction === this.G.ai && b.type === 'barracks' && b.hp > 0);
        if (!barracks) return null;
        if (!this.G.canProduceUnit('infantry', this.G.ai)) return null;

        const cost = VEHICLE_COSTS.sniper || VEHICLE_COSTS.infantry;
        if (this.aiResources.s < cost.s || this.aiResources.c < cost.c ||
            this.aiResources.m < cost.m) return null;
        this.spendResources(cost);

        const unit = createVehicle('sniper', this.G.ai,
            barracks.x + 40, barracks.y + 40);
        this.G.units.push(unit);
        this.infantryCount++;

        // Позиция: снаружи зоны цели, со стороны своих войск
        const target = this.pickBestTarget(unit.x, unit.y);
        if (target) {
            const a = Math.atan2(unit.y - target.y, unit.x - target.x) || 0;
            unit.tx = target.x + Math.cos(a) * (target.radius + 60);
            unit.ty = target.y + Math.sin(a) * (target.radius + 60);
            unit.isSniperPost = true;
        }
        return unit;
    }

    // Стоимость отряда пехоты по фактическому составу
    squadCost(types) {
        const total = { s: 0, c: 0, m: 0 };
        for (const t of types) {
            const c = VEHICLE_COSTS[t] || VEHICLE_COSTS.infantry;
            total.s += c.s; total.c += c.c; total.m += c.m;
        }
        return total;
    }

    canAffordSquad(types) {
        const t = this.squadCost(types);
        return this.aiResources.s >= t.s && this.aiResources.c >= t.c && this.aiResources.m >= t.m;
    }

    spawnVehicle() {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory');
        if (!factory) return;

        // Используем технику своей фракции (включая новые танки)
        let types = [];
        
        if (this.G.ai === 'wardens') {
            // Базовая техника
            types = ['devitt', 'niska'];
            
            // Добавляем новые танки в зависимости от сложности
            if (this.difficulty >= 1) {
                types.push('king_spire'); // Разведывательный танк
            }
            if (this.difficulty >= 2) {
                types.push('silverhand'); // Штурмовой танк
                types.push('gallagher_highwayman'); // Крейсерский танк
            }
        } else {
            // Colonial
            types = ['hatchet', 'hoplite'];
            
            // Добавляем новые танки в зависимости от сложности
            if (this.difficulty >= 1) {
                types.push('scorpion'); // Пехотный танк
            }
            if (this.difficulty >= 2) {
                types.push('nemesis'); // Штурмовой танк
                types.push('falchion'); // Средний танк
            }
        }
        
        // Добавляем артиллерию для дальнего обстрела (реже - 20% шанс)
        if (this.difficulty >= 2 && Math.random() < 0.2) {
            const artilleryType = this.G.ai === 'wardens' ? 'warden_artillery' : 'colonial_artillery';
            const cost = VEHICLE_COSTS[artilleryType];
            
            if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                this.spendResources(cost);
                const unit = createVehicle(artilleryType, this.G.ai, factory.x + 60, factory.y + 60);
                this.G.units.push(unit);
                this.accumulatedForces += 3; // Артиллерия очень ценна
                
                // ВАЖНОЕ ИСПРАВЛЕНИЕ ("арта пропадает после начала движения"):
                // раньше артиллерии выдавался обычный приказ движения (tx/ty).
                // По прибытии game.updateUnits() сбрасывал tx/ty, manageArtillery()
                // тут же ставил новый приказ, и арта снова трогалась с места —
                // уезжала на фронт и гибла. Теперь арта помнит, что она артиллерия
                // (isArtillery): стоит на месте и сама выбирает позицию для
                // стрельбы через setArtilleryPosition() в game.js.
                unit.isArtillery = true;
                aiLog(`[AI][ARTILLERY] т.${this.timer}: произведена ${unit.label} в (${Math.round(unit.x)}, ${Math.round(unit.y)}), range=${unit.range}, minRange=${unit.minRange}`);
                return;
            }
        }
        
        // Выбираем случайный тип техники
        const type = types[Math.floor(Math.random() * types.length)];
        const cost = VEHICLE_COSTS[type];
        
        // Проверяем хватает ли ресурсов
        if (this.aiResources.s < cost.s || this.aiResources.c < cost.c || this.aiResources.m < cost.m) {
            return; // Не хватает ресурсов
        }
        
        // Тратим ресурсы
        this.spendResources(cost);
        
        const unit = createVehicle(type, this.G.ai, factory.x + 60, factory.y + 60);
        this.G.units.push(unit);
        
        // Специальное поведение для разведывательных танков
        if (unit.revealRadius) {
            this.assignScoutPatrol(unit);
            return;
        }

        // В оборонительном режиме - патрулируем свои территории
        if (this.defenseMode) {
            this.assignPatrolRoute(unit);
        } else {
            const target = this.findDefensiveTarget(factory.x, factory.y);
            if (target) {
                this.assignSquadToTarget([unit], target);
            }
        }
    }
    
    assignScoutPatrol(unit) {
        // Разведывательные танки патрулируют периметр своих территорий
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;
        
        // Выбираем случайную точку для патрулирования
        const point = aiPoints[Math.floor(Math.random() * aiPoints.length)];
        
        // Патрулируем на расстоянии от точки
        const angle = Math.random() * Math.PI * 2;
        const radius = point.radius * 1.5; // Дальше чем обычные патрульные
        
        unit.tx = point.x + Math.cos(angle) * radius;
        unit.ty = point.y + Math.sin(angle) * radius;
        
        // Сохраняем точку для дальнейшего патрулирования
        unit.patrolCenter = point;
        unit.patrolAngle = angle;
        unit.isScout = true;
    }
    
    assignArtilleryPosition(unit) {
        // Находим позицию для артиллерии (далеко от фронта, но в радиусе атаки)
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction);
        
        if (aiPoints.length === 0 || playerPoints.length === 0) return;
        
        // Находим центральную точку своих территорий
        const centerX = aiPoints.reduce((sum, cp) => sum + cp.x, 0) / aiPoints.length;
        const centerY = aiPoints.reduce((sum, cp) => sum + cp.y, 0) / aiPoints.length;
        
        // Находим ближайшую вражескую точку
        const nearestEnemy = playerPoints.reduce((closest, cp) => {
            const d = dist(centerX, centerY, cp.x, cp.y);
            return d < closest.dist ? { cp, dist: d } : closest;
        }, { cp: null, dist: Infinity });
        
        if (!nearestEnemy.cp) return;
        
        // Позиционируем артиллерию на расстоянии 70-80% от максимальной дальности
        const angle = Math.atan2(nearestEnemy.cp.y - centerY, nearestEnemy.cp.x - centerX);
        const optimalDist = unit.range * 0.75;
        
        unit.tx = centerX + Math.cos(angle) * optimalDist;
        unit.ty = centerY + Math.sin(angle) * optimalDist;
    }

    // Свободные боевые юниты ИИ (без приказа, не логистика, не арта) —
    // кандидаты в штурмовые отряды 3-5 бойцов
    getIdleAttackers() {
        return this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && !u.aoe && u.tx === undefined &&
            !u.retreatToBase && !u.garrisonedAt &&
            u.type !== 'truck' && u.type !== 'fuel_truck' &&
            u.type !== 'engineer' && u.type !== 'flatbed'
        );
    }

    // Лучшая цель для отряда: сначала нейтральные точки (легко захватить),
    // затем вражеские с пробитой обороной, затем любые вражеские.
    pickBestTarget(fromX, fromY) {
        const neutral = this.G.cps.filter(c => c.owner === 'neutral');
        const enemy = this.G.cps.filter(c => c.owner === this.G.faction);
        const nearestOf = (list) => list.length ? list.reduce((best, cp) =>
            dist(fromX, fromY, cp.x, cp.y) < dist(fromX, fromY, best.x, best.y) ? cp : best) : null;

        if (neutral.length) return nearestOf(neutral);
        // вражеские точки с разрушенной обороной — приоритет
        const broken = enemy.filter(cp => this.G.isCityDefenseBroken(cp));
        if (broken.length) return nearestOf(broken);
        if (enemy.length) return nearestOf(enemy);
        return null;
    }

    // Формирование штурмового отряда из 3-5 свободных бойцов (с техникой,
    // если есть; иначе только пехота) и отправка его на цель. Вызывается
    // постоянно, поэтому ИИ атакует и занимает точки и после первой волны.
    sendIdleSquadToTarget() {
        const idle = this.getIdleAttackers();
        if (idle.length < 3) return;

        const base = this.getAIMainBase();
        const sorted = idle.sort((a, b) =>
            dist(a.x, a.y, base?.x ?? a.x, base?.y ?? a.y) -
            dist(b.x, b.y, base?.x ?? b.x, base?.y ?? b.y));

        // Отряд 3-5 человек: техника идёт впереди, пехота под её прикрытием
        const squadSize = Math.min(3 + Math.floor(this.difficulty), sorted.length);
        const vehicles = sorted.filter(u => !isInfUnit(u));
        const infantry = sorted.filter(u => isInfUnit(u));
        const squad = [...vehicles, ...infantry].slice(0, squadSize);

        const leader = squad[0];
        const target = this.pickBestTarget(leader.x, leader.y);
        if (!target) return;

        squad.forEach((u, i) => {
            const angle = (i / squad.length) * Math.PI * 2;
            // Нейтральная точка или пробитая оборона — заходим внутрь зоны;
            // иначе становимся у границы вражеской зоны (оборона цела —
            // въезд заблокирован, приказ не должен тянуть юнит «в стену»).
            const canEnter = target.owner === 'neutral' ||
                this.G.isCityDefenseBroken(target);
            const spread = canEnter ? target.radius * 0.5 : target.radius + 40;
            u.tx = target.x + Math.cos(angle) * spread;
            u.ty = target.y + Math.sin(angle) * spread;
            u.captureTarget = target;
            u.squadAttack = true;
        });
        aiLog(`[AI][SQUAD] т.${this.timer}: отряд ${squad.length} (техника=${vehicles.slice(0, squadSize).length}) идёт на "${target.name || ''}" (${target.owner})`);
    }

    strategicBehavior() {
        // Переключение между режимами каждые 1500 тиков (~25 сек; было 3000 — ИИ засиживался в обороне)
        if (this.timer % 1500 === 0) {
            this.defenseMode = !this.defenseMode;
            aiLog(`[AI][MODE] т.${this.timer}: переключение режима -> ${this.defenseMode ? 'ОБОРОНА' : 'АТАКА'} (по таймеру)`);
        }

        // Проверяем, нужно ли перейти в оборону
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;
        
        // Если у игрока ЗНАЧИТЕЛЬНО больше точек - переходим в оборону
        // (раньше порог был +2 — ИИ уходил в оборону слишком рано и «не захватывал точки»)
        if (playerPoints > aiPoints + 4 && !this.defenseMode) {
            this.defenseMode = true;
            aiLog(`[AI][MODE] т.${this.timer}: принудительная ОБОРОНА (точки ИИ=${aiPoints}, игрока=${playerPoints})`);
        }

        // ===== ПОСТОЯННАЯ АКТИВНОСТЬ (фикс «после первой атаки ИИ засиживается
        // у базы толпами пехоты»): как только накапливается отряд из 3-5 бойцов
        // без приказа — он тут же отправляется на ближайшую доступную цель
        // (нейтральная или вражеская точка), с техникой или без неё.
        // Атака больше НЕ зависит от режима и от большого кулдауна.
        const idleSquadCount = this.getIdleAttackers().length;
        if (idleSquadCount >= 3 && this.timer - this.lastAttackTime > 600) { // ~10 сек
            this.lastAttackTime = this.timer;
            this.sendIdleSquadToTarget();
        }

        // Активность: если есть численное превосходство свободных боёв над гарнизонами —
        // сами ищем цель и атакуем, не дожидаясь накопления по таймеру
        if (!this.defenseMode && idleSquadCount >= 4 && this.timer - this.lastAttackTime > 900) {
            this.lastAttackTime = this.timer;
            this.launchAttack();
        }

        // Стратегия накопления сил и атаки (перезарядка после атаки укорочена
        // с 3600 до 1200 тиков (~20 сек) — иначе после одной волны бот
        // «переставал атаковать и занимать точки»)
        if (this.accumulatedForces >= this.attackThreshold && this.timer - this.lastAttackTime > 1200) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
            this.accumulatedForces = 0; // Сбрасываем счётчик после атаки
            this.launchAttack();
        } else if (this.accumulatedForces >= this.attackThreshold) {
            aiLog(`[AI][ATTACK] т.${this.timer}: силы накоплены (${this.accumulatedForces}), перезарядка после прошлой атаки ${this.timer - this.lastAttackTime}/1200 тиков`);
        }
        
        // Если у нас больше точек и прошло достаточно времени - атакуем
        if (aiPoints > playerPoints + 1 && this.timer - this.lastAttackTime > 3000) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
            this.launchAttack();
        }
    }
    
    launchAttack() {
        // Находим лучшую цель для атаки
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction);
        if (playerPoints.length === 0) return;
        
        // Выбираем самую ценную цель (базу или большую точку)
        const target = playerPoints.reduce((best, cp) => {
            const value = cp.radius + (cp.type === 'town_hall' ? 100 : 0);
            return value > best.value ? { cp, value } : best;
        }, { cp: null, value: 0 }).cp;
        
        if (!target) return;
        
        // Отправляем в атаку пехоту и технику, но НЕ артиллерию:
        // она остаётся на позиции и работает отдельно через manageArtillery
        // (в лоб на вражескую базу она едет и гибнет — «внезапно пропадает»).
        const aiUnits = this.G.units.filter(u => u.faction === this.G.ai && u.hp > 0 && !u.aoe);
        aiUnits.forEach(unit => {
            unit.tx = target.x + (Math.random() - 0.5) * 50;
            unit.ty = target.y + (Math.random() - 0.5) * 50;
        });
        const arts = this.G.units.filter(u => u.faction === this.G.ai && u.aoe && u.hp > 0).length;
        aiLog(`[AI][ATTACK] т.${this.timer}: АТАКА! ${aiUnits.length} юнитов идут на цель (${Math.round(target.x)}, ${Math.round(target.y)}) "${target.name || ''}". Артиллерия (${arts} шт.) остаётся на позициях.`);
    }
    
    manageArtillery() {
        // Находим всю живую артиллерию ИИ
        const artillery = this.G.units.filter(u =>
            u.faction === this.G.ai &&
            (u.type === 'warden_artillery' || u.type === 'colonial_artillery') &&
            u.hp > 0
        );

        if (artillery.length === 0) return;

        // Находим позиции для обстрела (далеко от вражеских территорий)
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction);
        if (playerPoints.length === 0) return;

        artillery.forEach(art => {
            // Находим ближайшую вражескую точку
            const target = playerPoints.reduce((closest, cp) => {
                const d = dist(art.x, art.y, cp.x, cp.y);
                return d < closest.dist ? { cp, dist: d } : closest;
            }, { cp: null, dist: Infinity });

            if (!target.cp) return;

            const targetDist = dist(art.x, art.y, target.cp.x, target.cp.y);
            const minRange = art.minRange || 100;

            // Если цель в радиусе атаки - стреляем и СТОИМ на месте
            if (targetDist <= art.range && targetDist >= minRange) {
                art.aoeTarget = { x: target.cp.x, y: target.cp.y };
                if (!art._fireLogged) {
                    art._fireLogged = true;
                    aiLog(`[AI][ARTILLERY] т.${this.timer}: ${art.label} ведёт огонь по "${target.cp.name || ''}" с позиции (${Math.round(art.x)}, ${Math.round(art.y)}), дистанция=${Math.round(targetDist)}`);
                }
                this.sendEscortToArtillery(art);
            }
            // Цель слишком близко — один раз отъезжаем назад и встаём на новую
            // огневую позицию. ВАЖНО: приказ движения сохраняется до прибытия
            // (флаг isArtillery в game.js не даёт updateUnits() сбросить tx/ty
            // раньше времени — именно из-за этого сброса арта "вечно ехала"
            // и пропадала на подступах к фронту).
            else if (targetDist < minRange) {
                if (!art.retreatOrder) {
                    const retreatAngle = Math.atan2(art.y - target.cp.y, art.x - target.cp.x);
                    art.retreatOrder = {
                        x: art.x + Math.cos(retreatAngle) * (minRange + 60 - targetDist),
                        y: art.y + Math.sin(retreatAngle) * (minRange + 60 - targetDist),
                    };
                    art.tx = art.retreatOrder.x;
                    art.ty = art.retreatOrder.y;
                    aiLog(`[AI][ARTILLERY] т.${this.timer}: ${art.label} — цель слишком близко (${Math.round(targetDist)} < ${minRange}), отъезжает на (${Math.round(art.tx)}, ${Math.round(art.ty)})`);
                }
            }
            // Цель вне дальности — один раз даём приказ выдвинуться на огневую
            // позицию ЗА ПРЕДЕЛАМИ вражеского города и ждём прибытия. После
            // прибытия (retreatOrder/moveOrder очищены в game.js) снова
            // проверяем дистанцию — без бесконечного переставления приказов.
            else if (targetDist > art.range) {
                if (!art.moveOrder && art.tx === undefined) {
                    const moveAngle = Math.atan2(target.cp.y - art.y, target.cp.x - art.x);
                    const parkDist = Math.max(target.cp.radius + 40, art.range - 60);
                    art.moveOrder = {
                        x: target.cp.x - Math.cos(moveAngle) * parkDist,
                        y: target.cp.y - Math.sin(moveAngle) * parkDist,
                    };
                    art.tx = art.moveOrder.x;
                    art.ty = art.moveOrder.y;
                    aiLog(`[AI][ARTILLERY] т.${this.timer}: ${art.label} — цель далеко (${Math.round(targetDist)} > ${art.range}), выдвигается на огневую позицию (${Math.round(art.tx)}, ${Math.round(art.ty)})`);
                }
            }
        });

        // Агрессивная артиллерия: если у ИИ нет ни одной точки-цели игрока в зоне
        // досягаемости (например, игрок ещё не захватил нейтральные точки), арта
        // сама выдвигается к ближайшей нейтральной/вражеской точке, чтобы начать
        // обстрел, а не стоит вечно на базе.
        const anyTargetable = playerPoints.length > 0;
        if (!anyTargetable) {
            const pushTargets = this.G.cps.filter(c => c.owner !== this.G.ai);
            if (pushTargets.length > 0) {
                artillery.forEach(art => {
                    if (art.tx !== undefined || art.moveOrder) return; // уже едет
                    const near = pushTargets.reduce((best, cp) =>
                        dist(art.x, art.y, cp.x, cp.y) < dist(art.x, art.y, best.x, best.y) ? cp : best);
                    const a = Math.atan2(near.y - art.y, near.x - art.x);
                    const parkDist = Math.max(near.radius + 40, art.range - 80);
                    art.moveOrder = { x: near.x - Math.cos(a) * parkDist, y: near.y - Math.sin(a) * parkDist };
                    art.tx = art.moveOrder.x;
                    art.ty = art.moveOrder.y;
                });
            }
        }
    }

    sendEscortToArtillery(artillery) {
        // Не спамим приказами сопровождения каждый кадр — достаточно раз в ~3 секунды,
        // иначе эскорт постоянно «переклеивается» и стоит на месте.
        if (artillery.lastEscortAt !== undefined && this.timer - artillery.lastEscortAt < 180) return;
        artillery.lastEscortAt = this.timer;
        
        // Находим свободные юниты для сопровождения
        const availableUnits = this.G.units.filter(u => 
            u.faction === this.G.ai && 
            u.hp > 0 && 
            u.tx === undefined && // Не имеет цели
            u !== artillery &&
            (isInfUnit(u) || u.type === 'devitt' || u.type === 'hatchet' || 
             u.type === 'gallagher_highwayman' || u.type === 'falchion' || 
             u.type === 'niska' || u.type === 'hoplite')
        );
        
        // Отправляем 2-3 юнита в сопровождение
        const escortCount = Math.min(3, availableUnits.length);
        for (let i = 0; i < escortCount; i++) {
            const escort = availableUnits[i];
            // Позиция рядом с артиллерией
            const angle = (i / escortCount) * Math.PI * 2;
            const escortDist = 50;
            escort.tx = artillery.x + Math.cos(angle) * escortDist;
            escort.ty = artillery.y + Math.sin(angle) * escortDist;
        }
    }

    findDefensiveTarget(fromX, fromY) {
        // Ищем ближайшую точку, которую нужно защитить или захватить
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        const neutralPoints = this.G.cps.filter(c => c.owner === 'neutral');
        
        // Приоритет 1: защитить свои точки от захвата
        const threatenedPoints = aiPoints.filter(cp => {
            const playerUnits = this.G.units.filter(u => 
                u.faction === this.G.faction && 
                dist(u.x, u.y, cp.x, cp.y) < cp.radius * 2
            );
            return playerUnits.length > 0;
        });
        
        if (threatenedPoints.length > 0) {
            // Идём к самой угрожаемой точке
            return threatenedPoints.reduce((closest, cp) => {
                const d = dist(fromX, fromY, cp.x, cp.y);
                return d < dist(fromX, fromY, closest.x, closest.y) ? cp : closest;
            });
        }
        
        // Приоритет 2: захватить нейтральные точки
        if (neutralPoints.length > 0) {
            return neutralPoints.reduce((closest, cp) => {
                const d = dist(fromX, fromY, cp.x, cp.y);
                return d < dist(fromX, fromY, closest.x, closest.y) ? cp : closest;
            });
        }
        
        return null;
    }

    assignDefensivePositions(units) {
        // Назначаем юнитов на оборонительные позиции вокруг своих точек
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        
        units.forEach((unit, index) => {
            if (aiPoints.length === 0) return;
            
            // Выбираем точку для защиты
            const point = aiPoints[index % aiPoints.length];
            
            // Позиция на расстоянии от центра точки
            const angle = (index / units.length) * Math.PI * 2;
            const radius = point.radius * 0.7;
            
            unit.tx = point.x + Math.cos(angle) * radius;
            unit.ty = point.y + Math.sin(angle) * radius;
        });
    }

    assignPatrolRoute(unit) {
        // Создаём патрульный маршрут вокруг своих точек
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;
        
        // Выбираем случайную точку для патрулирования
        const point = aiPoints[Math.floor(Math.random() * aiPoints.length)];
        
        // Патрулируем по кругу
        const angle = Math.random() * Math.PI * 2;
        const radius = point.radius * 0.8;
        
        unit.tx = point.x + Math.cos(angle) * radius;
        unit.ty = point.y + Math.sin(angle) * radius;
        
        // Сохраняем точку для дальнейшего патрулирования
        unit.patrolCenter = point;
        unit.patrolAngle = angle;
    }

    assignSquadToTarget(units, target) {
        const targetPos = { x: target.x, y: target.y };
        units.forEach(unit => {
            // Прямое движение к цели с небольшим разбросом
            unit.tx = targetPos.x + (Math.random() - 0.5) * 40;
            unit.ty = targetPos.y + (Math.random() - 0.5) * 40;
        });
    }
}
