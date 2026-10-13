// ===== AI SYSTEM - STRATEGIC BEHAVIOR =====
import { dist, VEHICLE_COSTS } from './constants.js';
import { createVehicle } from './vehicles.js';

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
    }

    update() {
        try {
            this.updateInner();
        } catch (err) {
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

        // Спавн пехоты (с учётом доминирования И лимита пехоты).
        // ВАЖНО: лимит блокирует только производство, но НЕ вывод из строя всего ИИ.
        // (раньше здесь был `return` — при достижении лимита пехоты ИИ полностью
        //  замирал: переставал атаковать, управлять артиллерией и строить укрепления)
        let spawnedThisTick = false;
        if (this.timer % actualInfantryInterval === 0) {
            if (this.G.canProduceUnit('infantry', this.G.ai) && this.canAffordInfantry()) {
                this.spawnInfantrySquad();
                this.infantrySpawned += squadSizeOf(this.difficulty);
                this.accumulatedForces++;
                spawnedThisTick = true;
            } else {
                aiLog(`[AI][SPAWN] т.${this.timer}: пехота НЕ произведена (лимит=${this.G.canProduceUnit('infantry', this.G.ai)}, ресурсы=${this.canAffordInfantry()})`);
            }
        }

        // Спавн техники.
        // ИСПРАВЛЕНИЕ ("в обороне не спавнит технику"): раньше производство
        // техники было привязано к таймеру (timer % interval). В оборонительном
        // режиме ИИ почти не терял технику в контратаках, её число быстро
        // доходило до лимита — и таймерная проверка больше никогда не
        // срабатывала в тот момент, когда слот освобождался. Техника в
        // обороне фактически не производилась.
        // Теперь правило: если ЕСТЬ возможность (свободный слот + ресурсы на
        // самый дешёвый танк) — строим технику; если возможности нет — вместо
        // техники строим пехоту (по обычному интервалу).
        //
        // ИСПРАВЛЕНИЕ СПАМА ПЕХОТОЙ («за эту цену он должен делать технику»):
        // раньше техника ставилась безусловно при каждой возможности, а пехота
        // сыпалась каждые N тиков — ресурсы улетали в пехоту. Теперь действует
        // КВОТА 1 ТЕХНИКА / 5 ПЕХОТИНЫ: техника производится только когда на
        // счётчике накопилось >=5 выпущенных пехотинцев ИЛИ когда копится на
        // технику (не хватает ресурсов) — вместо пехоты мы копить не можем,
        // поэтому ждём. Как только ресурс на технику появился и квота выполнена
        // — сразу техника. Пехота же пропускает спавн, пока очередь техники
        // не исчерпана (см. vehicleDebt ниже).
        const INF_PER_VEHICLE = 5;
        const canVehicleNow = this.G.canProduceUnit('vehicle', this.G.ai) && this.canAffordVehicle();
        if (canVehicleNow && this.infantrySpawned >= this.vehicleDebtTarget) {
            // Квота «5 пехоты → 1 техника» выполнена — выпускаем технику
            this.spawnVehicle();
            this.vehicleCount++;
            this.infantrySpawned = 0;               // сброс счётчика пехоты после техники
            this.vehicleDebtTarget = INF_PER_VEHICLE;
            this.accumulatedForces += 2;           // Техника ценнее
            spawnedThisTick = true;
        } else if (!canVehicleNow &&
                   this.G.canProduceUnit('infantry', this.G.ai) && this.canAffordInfantry()) {
            // Нет возможности для техники → компенсируем пехотой,
            // НО не чаще чем раз в actualInfantryInterval (без спама)
            if (this.timer % actualInfantryInterval !== 0) {
                this.spawnInfantrySquad();
                this.infantrySpawned += squadSizeOf(this.difficulty);
                this.accumulatedForces++;
                spawnedThisTick = true;
            }
        }

        // Активное расширение: юниты без приказа сами идут на ближайшие
        // нейтральные/вражеские точки и захватывают их
        this.expandAndCapture();

        // Гарнизон: минимум 1 юнит охраны на каждой захваченной точке
        this.maintainGarrisons();

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
            u.tx = cp.x + (Math.random() - 0.5) * cp.radius;
            u.ty = cp.y + (Math.random() - 0.5) * cp.radius;
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
                u.faction === this.G.ai && u.hp > 0 && u.type !== 'infantry' &&
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
            u.type !== 'infantry' && u.type !== 'truck' &&
            u.type !== 'fuel_truck' && u.type !== 'engineer' && u.type !== 'flatbed'
        );
        for (const v of vehicles) {
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
            u.type !== 'infantry' && u.type !== 'truck' &&
            u.type !== 'fuel_truck' && u.type !== 'engineer' && u.type !== 'flatbed' &&
            u.hp < (u.maxHp || 100) * 0.5
        );
        if (damaged.length === 0) return;

        // Если у главной базы стоит вражеская техника — её нужно уничтожить
        // всей доступной техникой и пехотой ИИ (независимо от режима).
        const enemyVehiclesAtBase = this.G.units.filter(u =>
            u.faction === this.G.faction && u.hp > 0 && u.type !== 'infantry' &&
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

    spawnInfantrySquad() {
        const barracks = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'barracks');
        if (!barracks) return;

        // Меньше пехоты за раз
        const squadSize = 2 + Math.floor(this.difficulty / 2);
        
        // Проверяем хватает ли ресурсов на всю группу
        const cost = VEHICLE_COSTS.infantry;
        const totalCost = { s: cost.s * squadSize, c: cost.c * squadSize, m: cost.m * squadSize };
        
        if (this.aiResources.s < totalCost.s || this.aiResources.c < totalCost.c || this.aiResources.m < totalCost.m) {
            return; // Не хватает ресурсов
        }
        
        // Тратим ресурсы
        this.spendResources(totalCost);
        
        for (let i = 0; i < squadSize; i++) {
            const unit = createVehicle('infantry', this.G.ai, 
                barracks.x + 50 + (i % 3) * 20, 
                barracks.y + 50 + Math.floor(i / 3) * 20);
            this.G.units.push(unit);
        }

        // В оборонительном режиме - защищаем свои территории
        if (this.defenseMode) {
            this.assignDefensivePositions(this.G.units.slice(-squadSize));
        } else {
            // В режиме атаки - идём к ближайшей точке
            const target = this.findDefensiveTarget(barracks.x, barracks.y);
            if (target) {
                this.assignSquadToTarget(this.G.units.slice(-squadSize), target);
            }
        }
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

        // Активность: если есть численное превосходство свободных боёв над гарнизонами —
        // сами ищем цель и атакуем, не дожидаясь накопления по таймеру
        const idleAttackers = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && !u.aoe && u.tx === undefined &&
            u.type !== 'truck' && u.type !== 'fuel_truck' &&
            u.type !== 'engineer' && u.type !== 'flatbed'
        ).length;
        if (!this.defenseMode && idleAttackers >= 4 && this.timer - this.lastAttackTime > 1800) {
            this.lastAttackTime = this.timer;
            this.launchAttack();
        }
        
        // Стратегия накопления сил и атаки
        if (this.accumulatedForces >= this.attackThreshold && this.timer - this.lastAttackTime > 3600) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
            this.accumulatedForces = 0; // Сбрасываем счётчик после атаки
            this.launchAttack();
        } else if (this.accumulatedForces >= this.attackThreshold) {
            aiLog(`[AI][ATTACK] т.${this.timer}: силы накоплены (${this.accumulatedForces}), но атака отложена — перезарядка после прошлой атаки ${this.timer - this.lastAttackTime}/3600 тиков`);
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
            (u.type === 'infantry' || u.type === 'devitt' || u.type === 'hatchet' || 
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
