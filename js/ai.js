// ===== AI SYSTEM - STRATEGIC BEHAVIOR =====
import { dist, VEHICLE_COSTS, getModeFlags, attritionMultiplier } from './constants.js';
import { createVehicle, isInfUnit, isTechUnit, isLogisticsUnit } from './vehicles.js';
import { ROADS, isInBush } from './map.js';

// ===== ПОМОЩНИКИ РЕЖИМОВ ИГРЫ ДЛЯ ИИ =====
function aiRestriction(G) { return G.restriction || 'classic'; }
function aiAllow(G, type) {
    return getModeFlags(G).allowUnit(type);
}
function classesCoexist(G) {
    const r = aiRestriction(G);
    return r !== 'infantry_only' && r !== 'vehicles_only';
}

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
        this.defenseMode = true;
        this.lastAttackTime = 0;
        this.accumulatedForces = 0;
        this.attackThreshold = 6;
        this.artilleryPositions = [];

        this.lastEnemySighting = null;
        this.logistics = { sets: [], lastScanAt: -9999 };
        this.garrison = new Map();

        this.aiResources = { s: 150, c: 75, m: 60 };
        this.aiResourceRate = 0.6;

        this.infantrySpawned = 0;
        this.vehicleDebtTarget = 3;
        this.vehicleCount = 0;
        this.infantryCount = 0;

        this.sniperAssignments = new Map();
        this.lastSniperScanAt = -9999;

        this._roadSamples = null;
    }

    // ===== РАЗМЕР ОТРЯДА =====
    squadSizeOf(diff) {
        const d = diff || this.difficulty;
        return Math.min(4, 2 + Math.floor(d / 2));
    }

    pickInfantryType(role) {
        const r = Math.random();
        if (role === 'defense') {
            return r < 0.75 ? 'mg_gunner' : 'rifleman';
        }
        if (r < 0.6) return 'rifleman';
        if (r < 0.8) return 'grenadier';
        return 'mg_gunner';
    }

    getLiveCounts() {
        let inf = 0, veh = 0;
        for (const u of this.G.units) {
            if (u.faction !== this.G.ai || u.hp <= 0) continue;
            if (isInfUnit(u)) inf++;
            else if (!isLogisticsUnit(u)) veh++;
        }
        return { inf, veh };
    }

    isSupportUnit(u) {
        if (!u || !u.type) return false;
        return [
            'truck', 'fuel_truck', 'engineer', 'flatbed',
            'medic_truck', 'construction_truck', 'fire_truck',
        ].includes(u.type);
    }

    // ===== НАВИГАЦИЯ ПО ДОРОГАМ =====

    // Кэш дискретизированных дорог — точки через ~30 px.
    _getRoadSamples() {
        if (this._roadSamples) return this._roadSamples;
        const samples = [];
        const STEP = 30;
        for (const road of ROADS) {
            const fromX = road.from[0] * 250 + 125;
            const fromY = road.from[1] * 150 + 75;
            const toX   = road.to[0]   * 250 + 125;
            const toY   = road.to[1]   * 150 + 75;
            const midX = (fromX + toX) / 2 + (toY - fromY) * road.curve;
            const midY = (fromY + toY) / 2 - (toX - fromX) * road.curve;
            const approxLen = Math.hypot(toX - fromX, toY - fromY) + Math.abs(road.curve) * 100;
            const n = Math.max(4, Math.floor(approxLen / STEP));
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * midX + t * t * toX;
                const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * midY + t * t * toY;
                samples.push({ x, y, road });
            }
        }
        this._roadSamples = samples;
        return samples;
    }

    // Ближайшая точка на дороге к (x, y). Возвращает {x, y, d, index} — index
    // полезен, чтобы потом нарезать маршрут по последовательным точкам.
    _nearestRoadPoint(x, y) {
        const samples = this._getRoadSamples();
        let best = null, bestD = Infinity, bestIdx = -1;
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const d = dist(x, y, s.x, s.y);
            if (d < bestD) { bestD = d; best = s; bestIdx = i; }
        }
        return best ? { x: best.x, y: best.y, d: bestD, index: bestIdx } : null;
    }

    // ===== МАРШРУТ «ПО ДОРОГЕ» ДЛЯ ТЕХНИКИ =====
    // Возвращает ПОЛНЫЙ маршрут: [выход на дорогу, ...все точки дороги..., съезд к цели].
    _routeByRoads(ax, ay, bx, by) {
        const nearA = this._nearestRoadPoint(ax, ay);
        const nearB = this._nearestRoadPoint(bx, by);

        // Совсем нет дорог — идём напрямую
        if (!nearA || !nearB) return [{ x: bx, y: by }];

        // Если ближайшая к цели точка — та же самая (обе рядом с одной дорогой),
        // всё равно прокладываем по дороге, но без лишних петель.
        const direct = dist(ax, ay, bx, by);
        const viaRoad = nearA.d + dist(nearA.x, nearA.y, nearB.x, nearB.y) + nearB.d;

        // Порог «не объезжать» ослаблен до 2.0× — бот почти всегда предпочтёт дорогу.
        if (viaRoad > direct * 2.0) return [{ x: bx, y: by }];

        const samples = this._getRoadSamples();
        const iA = nearA.index;
        const iB = nearB.index;

        const pts = [];
        // 1) Дойти от текущей позиции до точки выхода на дорогу
        pts.push({ x: nearA.x, y: nearA.y });

        // 2) Пройти по дороге от nearA до nearB через каждую промежуточную точку
        if (iA >= 0 && iB >= 0) {
            if (iA === iB) {
                // уже на нужной точке дороги — ничего дополнительно
            } else if (iA < iB) {
                for (let i = iA + 1; i <= iB; i++) {
                    pts.push({ x: samples[i].x, y: samples[i].y });
                }
            } else {
                // идём в обратную сторону
                for (let i = iA - 1; i >= iB; i--) {
                    pts.push({ x: samples[i].x, y: samples[i].y });
                }
            }
        }

        // 3) Съезд с дороги к цели
        pts.push({ x: bx, y: by });
        return pts;
    }

    // ===== МАРШРУТ «ВДОЛЬ ДОРОГ» ДЛЯ ПЕХОТЫ =====
    // Идём по точкам дороги, но со сдвигом в сторону (лесополоса).
    // Шаг 2 — чтобы не генерить слишком много waypoints (пехота медленная).
    _routeAlongRoads(ax, ay, bx, by, sideOffset = 55) {
        const nearA = this._nearestRoadPoint(ax, ay);
        const nearB = this._nearestRoadPoint(bx, by);
        if (!nearA || !nearB) return [{ x: bx, y: by }];

        const samples = this._getRoadSamples();
        const iA = nearA.index;
        const iB = nearB.index;

        // Стабильная сторона обхода (чтобы пехота не метался влево-вправо)
        const sideSign = this._detourSideFor(ax + ay) || 1;

        // Строим касательную в точке, чтобы получить нормаль для сдвига
        const tangentAt = (i) => {
            const a = samples[Math.max(0, i - 1)];
            const b = samples[Math.min(samples.length - 1, i + 1)];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            return { nx: -dy / len, ny: dx / len };
        };

        const pts = [];
        const pushSide = (i) => {
            const s = samples[i];
            const { nx, ny } = tangentAt(i);
            pts.push({
                x: s.x + nx * sideSign * sideOffset,
                y: s.y + ny * sideSign * sideOffset,
            });
        };

        // 1) Выход на «обочину» у старта
        pushSide(iA);

        // 2) Вдоль дороги — каждый 2-й семпл
        if (iA < iB) {
            for (let i = iA + 2; i <= iB; i += 2) pushSide(i);
            if ((iB - iA) % 2 !== 0) pushSide(iB);
        } else if (iA > iB) {
            for (let i = iA - 2; i >= iB; i -= 2) pushSide(i);
            if ((iA - iB) % 2 !== 0) pushSide(iB);
        }

        // 3) Съезд к цели
        pts.push({ x: bx, y: by });
        return pts;
    }

    _detourSideFor(seed) {
        const n = Math.abs(Math.floor(seed)) % 2;
        return n ? 1 : -1;
    }

    // Единая точка входа для маршей ИИ.
    _issueRoadMarch(u, targetX, targetY) {
        if (!u || u.hp <= 0) return;
        // Для пехоты — вдоль дорог (с боковым смещением).
        // Для техники — по дорогам (по каждой точке).
        const pts = isInfUnit(u)
            ? this._routeAlongRoads(u.x, u.y, targetX, targetY, 55)
            : this._routeByRoads(u.x, u.y, targetX, targetY);
        this._queueWaypoints(u, pts);
    }

    _queueWaypoints(u, pts) {
        if (!pts || pts.length === 0) return;
        u._wpQueue = pts.slice();
        this._nextWaypoint(u);
    }

    _nextWaypoint(u) {
        if (!u._wpQueue || u._wpQueue.length === 0) {
            u._wpQueue = null;
            return;
        }
        const next = u._wpQueue.shift();
        u.tx = next.x;
        u.ty = next.y;
        u.orderOrigin = { x: next.x, y: next.y };
        u.retreatOrder = null;
        u.moveOrder = null;
        u.stuckCounter = 0;
        u.detourSide = undefined;
    }

    // Скрытный подход (для снайперов) — 2 точки в обход дорог.
    _stealthApproach(ax, ay, bx, by) {
        const mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
        const near = this._nearestRoadPoint(mid.x, mid.y);
        if (near && near.d < 60) {
            const dx = bx - ax, dy = by - ay;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const side = this._detourSideFor(ax + ay + bx + by);
            mid.x += nx * side * 180;
            mid.y += ny * side * 180;
        }
        return [mid, { x: bx, y: by }];
    }

    update() {
        try {
            this.updateInner();
        } catch (err) {
            console.error('[AI] Ошибка в update() бота:', err);
        }
    }

    updateInner() {
        this.timer++;

        // ===== ОБСЛУЖИВАНИЕ WAYPOINTS =====
        // Если у юнита есть очередь и он дошёл до текущей точки (tx === undefined) — выдаём следующую.
        for (const u of this.G.units) {
            if (u.faction !== this.G.ai || u.hp <= 0) continue;
            if (u._wpQueue && u._wpQueue.length > 0 && u.tx === undefined) {
                if (u.retreatToBase || u.supplyReturn) continue;
                this._nextWaypoint(u);
            }
        }

        // ===== СТАРТ =====
        if (this.timer === 180) {
            const base = this.getAIMainBase();
            if (base && base.defenseLevel === 0 && !base.upgrading) {
                const cpIndex = this.G.cps.indexOf(base);
                if (cpIndex !== -1) {
                    this.G.upgradeTerritoryDefense(cpIndex);
                }
            }
            this.spawnSpecialSupportVehicles();
        }
        if (this.timer === 7200) this.spawnEngineerAndTruck();

        if (this.timer % 600 === 0) {
            const aiUnits = this.G.units.filter(u => u.faction === this.G.ai && u.hp > 0);
            const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
            const playerPts = this.G.cps.filter(c => c.owner === this.G.faction).length;
            const arts = aiUnits.filter(u => u.aoe).length;
            aiLog(`[AI][STATUS] t=${this.timer} режим=${this.defenseMode ? 'ОБОРОНА' : 'АТАКА'} силы=${this.accumulatedForces}/${this.attackThreshold} сложность=${this.difficulty} юнитов=${aiUnits.length} арт=${arts} точки(ИИ/игрок)=${aiPoints}/${playerPts} res: s=${Math.floor(this.aiResources.s)} c=${Math.floor(this.aiResources.c)} m=${Math.floor(this.aiResources.m)}`);
        }
        this.difficulty = Math.min(3, 1 + Math.floor(this.timer / 4000));

        this.updateAIResources();

        const canProduceInfantry = this.G.canProduceUnit('infantry', this.G.ai);

        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;
        const totalPoints = this.G.cps.length;
        const playerDominance = playerPoints > totalPoints * 0.5;

        const baseInfantryInterval = 600;
        const baseVehicleInterval = 1100;
        const spawnMultiplier = playerDominance ? 1.4 : 1.0;
        const actualInfantryInterval = Math.round(baseInfantryInterval * spawnMultiplier);
        const actualVehicleInterval = Math.round(baseVehicleInterval * spawnMultiplier);

        const INF_PER_VEHICLE = 3;
        let spawnedThisTick = false;

        const liveInf = this.G.units.filter(u => u.faction === this.G.ai && isInfUnit(u) && u.hp > 0).length;
        const liveVeh = this.G.units.filter(u => u.faction === this.G.ai && isTechUnit(u)).length;
        const liveArt = this.G.units.filter(u => u.faction === this.G.ai && u.hp > 0 && u.aoe).length;
        const debtTarget = liveVeh * INF_PER_VEHICLE;
        const needsCatchUp = liveInf > debtTarget;
        const needsInfCatchUp = liveVeh > 0 && liveInf < debtTarget;

        const noArtMode = aiRestriction(this.G) === 'no_artillery';
        const preferArtillery = playerDominance && !noArtMode;

        const hasFactory = this.G.buildings.some(b => b.faction === this.G.ai && b.type === 'factory');
        const canVehicleSlot = this.G.canProduceUnit('vehicle', this.G.ai);
        const canAffordVeh = this.canAffordVehicle();
        const quotaMet = this.infantrySpawned >= this.vehicleDebtTarget;
        const vehiclePossible = hasFactory && canVehicleSlot && canAffordVeh;

        const allowInf = () => canProduceInfantry &&
            this.G.canProduceUnit('infantry', this.G.ai) && this.canAffordInfantry();

        const wantVehicle = (liveVeh * INF_PER_VEHICLE) < liveInf;

        if (!classesCoexist(this.G)) {
            const onlyInfantry = aiRestriction(this.G) === 'infantry_only';
            if (onlyInfantry) {
                if (this.timer % actualInfantryInterval === 0 && allowInf()) {
                    this.spawnInfantrySquad();
                    this.infantrySpawned += this.squadSizeOf(this.difficulty);
                    this.accumulatedForces++;
                    spawnedThisTick = true;
                }
            } else {
                if (vehiclePossible && this.timer % actualVehicleInterval === 0) {
                    const before = this.G.units.length;
                    this.spawnVehicle(false);
                    if (this.G.units.length > before) {
                        this.vehicleCount++;
                        this.accumulatedForces += 2;
                        spawnedThisTick = true;
                    }
                }
            }
            this.expandAndCapture();
            this.maintainGarrisons();
            this.maintainBaseDefense();
            this.manageSnipers();
            this.strategicBehavior();
            this.manageArtillery();
            this.manageLogistics();
            this.handleDamagedVehicles();
            this.buildFortifications();
            this.manageRaiders();
            if (!spawnedThisTick) this.defensiveReactions();
            return;
        }

        const affordableVehType = this.pickAffordableVehicleType();
        const wantVehicleNow = vehiclePossible && (wantVehicle || quotaMet);
        const godLoaderWanted = this.shouldSeekGodLoader();
        const vehicleBlockedByMode = !hasFactory || !canVehicleSlot ||
            !this.getCheapestAllowedVehicleCost();

        if (godLoaderWanted && vehiclePossible && affordableVehType !== null) {
            const glCost = VEHICLE_COSTS.god_loader;
            if (this.aiResources.s >= glCost.s && this.aiResources.c >= glCost.c &&
                this.aiResources.m >= glCost.m) {
                if (this.spawnGodLoader()) {
                    this.vehicleCount++;
                    this.infantrySpawned = 0;
                    this.accumulatedForces += 4;
                    spawnedThisTick = true;
                }
            }
        } else if (preferArtillery && vehiclePossible && this.timer % actualVehicleInterval === 0) {
            const combatTotal = liveVeh || 1;
            const artCap = Math.max(2, Math.round(combatTotal * 0.4));
            if (this.spawnDoctrineArtillery(liveArt, artCap)) {
                spawnedThisTick = true;
            } else if (wantVehicle || quotaMet) {
                this.spawnVehicle(true);
                this.vehicleCount++;
                this.infantrySpawned = 0;
                this.accumulatedForces += 2;
                spawnedThisTick = true;
            }
        } else if (wantVehicleNow) {
            const before = this.G.units.length;
            this.spawnVehicle(false);
            if (this.G.units.length > before) {
                this.vehicleCount++;
                this.infantrySpawned = 0;
                this.accumulatedForces += 2;
                spawnedThisTick = true;
            }
        } else if (vehiclePossible && !vehicleBlockedByMode &&
                   this.timer % actualVehicleInterval === 0) {
            if (affordableVehType !== null) {
                const before = this.G.units.length;
                this.spawnVehicle(preferArtillery);
                if (this.G.units.length > before) {
                    this.vehicleCount++;
                    this.infantrySpawned = 0;
                    this.accumulatedForces += 2;
                    spawnedThisTick = true;
                }
            }
        } else if (this.timer % actualInfantryInterval === 0 && allowInf()) {
            const mustHoldInfantryLine = needsInfCatchUp ||
                liveInf > (liveVeh + 1) * INF_PER_VEHICLE;
            if (!vehicleBlockedByMode && !mustHoldInfantryLine) {
                // ждём/копим технику
            } else {
                this.spawnInfantrySquad();
                this.infantrySpawned += this.squadSizeOf(this.difficulty);
                this.accumulatedForces++;
                spawnedThisTick = true;
            }
        }

        this.expandAndCapture();
        this.maintainGarrisons();
        this.maintainBaseDefense();
        this.manageSnipers();
        this.strategicBehavior();
        this.manageArtillery();
        this.manageLogistics();
        this.handleDamagedVehicles();
        this.buildFortifications();
        this.manageCityDefenses();
        this.manageRaiders();
        if (!spawnedThisTick) this.defensiveReactions();
    }

    // ===== СПЕЦТЕХНИКА =====
    spawnSpecialSupportVehicles() {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory' && b.hp > 0);
        if (!factory) return;
        const base = this.getAIMainBase();

        if (!this.G.units.some(u => u.faction === this.G.ai && u.type === 'construction_truck' && u.hp > 0)) {
            const cost = VEHICLE_COSTS.construction_truck || { s: 60, c: 40, m: 30 };
            if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                this.spendResources(cost);
                const unit = createVehicle('construction_truck', this.G.ai, factory.x + 60, factory.y + 60);
                this.G.units.push(unit);
                if (base) {
                    unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.6;
                    unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.6;
                }
            }
        }
        if (!this.G.units.some(u => u.faction === this.G.ai && u.type === 'fire_truck' && u.hp > 0)) {
            const cost = VEHICLE_COSTS.fire_truck || { s: 50, c: 30, m: 20 };
            if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                this.spendResources(cost);
                const unit = createVehicle('fire_truck', this.G.ai, factory.x + 80, factory.y + 60);
                this.G.units.push(unit);
                if (base) {
                    unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.6;
                    unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.6;
                }
            }
        }
    }

    spawnEngineerAndTruck() {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory' && b.hp > 0);
        if (!factory) return;
        const base = this.getAIMainBase();

        if (!this.G.units.some(u => u.faction === this.G.ai && u.type === 'engineer' && u.hp > 0)) {
            const cost = VEHICLE_COSTS.engineer || { s: 20, c: 35, m: 10 };
            if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                this.spendResources(cost);
                const unit = createVehicle('engineer', this.G.ai, factory.x + 60, factory.y + 60);
                this.G.units.push(unit);
                if (base) {
                    unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.5;
                    unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.5;
                }
            }
        }
        if (!this.G.units.some(u => u.faction === this.G.ai && u.type === 'truck' && u.hp > 0)) {
            const cost = VEHICLE_COSTS.truck || { s: 25, c: 15, m: 5 };
            if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                this.spendResources(cost);
                const unit = createVehicle('truck', this.G.ai, factory.x + 80, factory.y + 60);
                this.G.units.push(unit);
                if (base) {
                    unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.5;
                    unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.5;
                }
            }
        }
    }

    manageCityDefenses() {
        if (this.timer % 60 !== 0) return;
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        const base = this.getAIMainBase();

        for (const cp of aiPoints) {
            const ownedTime = this.timer - (cp._capturedAt || 0);
            if (cp._capturedAt === undefined) cp._capturedAt = this.timer;

            if (cp.defenseHp !== undefined && cp._defMaxHp !== undefined) {
                const integrity = cp.defenseHp / cp._defMaxHp;
                if (integrity < 0.95 && !cp.repairDefense) cp.repairDefense = true;
            }

            if (this.timer - (cp._lastDefUpgradeAt || 0) > 10800) {
                if (cp.defenseLevel < 3 && !cp.upgrading) {
                    const costs = [
                        { s: 50, c: 30, m: 40 },
                        { s: 100, c: 60, m: 80 },
                        { s: 150, c: 90, m: 120 },
                    ];
                    const cost = costs[cp.defenseLevel];
                    if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                        if (cp === base || base.defenseLevel >= 1) {
                            this.aiResources.s -= cost.s;
                            this.aiResources.c -= cost.c;
                            this.aiResources.m -= cost.m;
                            const cpIndex = this.G.cps.indexOf(cp);
                            this.G.upgradeTerritoryDefense(cpIndex);
                            cp._lastDefUpgradeAt = this.timer;
                        }
                    }
                }
            }

            if (ownedTime > 10800) {
                const enemyNear = this.G.units.some(u =>
                    u.faction === this.G.faction && u.hp > 0 &&
                    dist(u.x, u.y, cp.x, cp.y) <= 450
                );
                if (enemyNear) {
                    if (cp.defenseLevel === 0 && !cp.upgrading) {
                        const cost = { s: 50, c: 30, m: 40 };
                        if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                            this.aiResources.s -= cost.s;
                            this.aiResources.c -= cost.c;
                            this.aiResources.m -= cost.m;
                            const cpIndex = this.G.cps.indexOf(cp);
                            this.G.upgradeTerritoryDefense(cpIndex);
                        }
                    }

                    const consTruck = this.G.units.find(u =>
                        u.faction === this.G.ai && u.type === 'construction_truck' && u.hp > 0);
                    if (consTruck) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = cp.radius * 0.6;
                        consTruck.tx = cp.x + Math.cos(angle) * r;
                        consTruck.ty = cp.y + Math.sin(angle) * r;
                        consTruck.garrisonedAt = null;
                        consTruck.baseDefender = false;
                    }
                    const fireTruck = this.G.units.find(u =>
                        u.faction === this.G.ai && u.type === 'fire_truck' && u.hp > 0);
                    if (fireTruck) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = cp.radius * 0.6;
                        fireTruck.tx = cp.x + Math.cos(angle) * r;
                        fireTruck.ty = cp.y + Math.sin(angle) * r;
                        fireTruck.garrisonedAt = null;
                        fireTruck.baseDefender = false;
                    }
                }
            }
        }
    }

    // ===== АКТИВНОЕ РАСШИРЕНИЕ =====
    expandAndCapture() {
        if (this.timer % 120 !== 0) return;
        const targets = this.G.cps.filter(c => c.owner !== this.G.ai);
        if (targets.length === 0) return;

        const idle = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            u.tx === undefined && !u.aoe &&
            !this.isSupportUnit(u)
        );
        if (idle.length === 0) return;

        const sorted = targets.slice().sort((a, b) => {
            const na = (a.owner === 'neutral' ? -1000 : 0);
            const nb = (b.owner === 'neutral' ? -1000 : 0);
            return na - nb;
        });

        const squadSize = Math.min(6, idle.length);
        for (let i = 0; i < squadSize; i++) {
            const u = idle[i];
            const cp = sorted[i % Math.min(sorted.length, 3)];
            const canEnter = cp.owner === 'neutral' || this.G.isCityDefenseBroken(cp);
            let tx, ty;
            if (canEnter) {
                tx = cp.x + (Math.random() - 0.5) * cp.radius;
                ty = cp.y + (Math.random() - 0.5) * cp.radius;
            } else {
                const a = Math.atan2(u.y - cp.y, u.x - cp.x) || 0;
                tx = cp.x + Math.cos(a) * (cp.radius + 40);
                ty = cp.y + Math.sin(a) * (cp.radius + 40);
            }
            this._issueRoadMarch(u, tx, ty);
            u.captureTarget = cp;
        }
    }

    isPointThreatened(cp) {
        return this.G.units.some(u =>
            u.faction === this.G.faction && u.hp > 0 &&
            dist(u.x, u.y, cp.x, cp.y) < cp.radius + 180
        );
    }

    maintainGarrisons() {
        if (this.timer % 300 !== 0) return;
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);

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
                u.hp > 0 && u.faction === this.G.ai &&
                isInfUnit(u) &&
                dist(u.x, u.y, cp.x, cp.y) <= cp.radius + 40
            );
            this.garrison.set(key, current);

            const base = this.getAIMainBase();
            const dBase = base ? dist(base.x, base.y, cp.x, cp.y) : 0;
            const isMainBase = (cp === base);
            let desired;
            if (isMainBase) desired = 5;
            else if (dBase < 700) desired = 3;
            else if (dBase < 1200) desired = 2;
            else desired = 1;
            if (this.isPointThreatened(cp)) desired = Math.min(5, desired + 2);
            desired = Math.max(1, Math.min(5, desired));

            if (current.length >= desired) continue;

            const candidates = this.G.units.filter(u =>
                u.faction === this.G.ai && u.hp > 0 && isInfUnit(u) &&
                !u.aoe && !u.garrisonedAt && u.isScout !== true &&
                !u.baseDefender && !u.isSniperPost
            ).sort((a, b) => {
                const oa = (a.tx === undefined ? 0 : 1);
                const ob = (b.tx === undefined ? 0 : 1);
                if (oa !== ob) return oa - ob;
                return dist(a.x, a.y, cp.x, cp.y) - dist(b.x, b.y, cp.x, cp.y);
            });

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

    maintainBaseDefense() {
        if (this.timer % 180 !== 0) return;
        const base = this.getAIMainBase();
        if (!base) return;

        const combatVehicles = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && !isInfUnit(u) &&
            !this.isSupportUnit(u)
        );
        const extra = combatVehicles.length > 6 ? 1 : 0;
        const desired = 2 + extra;

        if (!this.baseDefenders) this.baseDefenders = [];
        this.baseDefenders = this.baseDefenders.filter(u => {
            if (u.hp <= 0 || u.faction !== this.G.ai || u.baseDefender !== true) return false;
            if (dist(u.x, u.y, base.x, base.y) > base.radius + 260) {
                u.baseDefender = false;
                return false;
            }
            return true;
        });

        const isArtLike = (u) => u.aoe === true || u.isArtillery === true || u.isMortar === true;
        const tanksAssigned = this.baseDefenders.filter(u => !isArtLike(u)).length;

        const freeSpots = desired - this.baseDefenders.length;
        if (freeSpots > 0) {
            const candidates = this.G.units.filter(u =>
                u.faction === this.G.ai && u.hp > 0 && !isInfUnit(u) &&
                !this.isSupportUnit(u) && !u.baseDefender &&
                !u.garrisonedAt && u.orderOrigin === undefined &&
                !u.retreatToBase && u.hp >= (u.maxHp || 100) * 0.5
            ).sort((a, b) => {
                const ta = isArtLike(a) ? 1 : 0;
                const tb = isArtLike(b) ? 1 : 0;
                if (tanksAssigned < 2 && ta !== tb) return ta - tb;
                return dist(a.x, a.y, base.x, base.y) - dist(b.x, b.y, base.x, base.y);
            });

            for (const u of candidates) {
                if (this.baseDefenders.length >= desired) break;
                const isTank = !isArtLike(u);
                if (!isTank) {
                    if (this.baseDefenders.length < 2 || extra === 0) continue;
                    if (u.isMortar && !u.aoe) continue;
                }
                u.baseDefender = true;
                u.garrisonedAt = null;
                if (u.fuel !== undefined && u.fuel <= 0) u.fuel = u.maxFuel * 0.5;
                const idx = this.baseDefenders.length;
                const angle = (idx / Math.max(3, desired)) * Math.PI * 2;
                const r = base.radius * 0.8;
                u.tx = base.x + Math.cos(angle) * r;
                u.ty = base.y + Math.sin(angle) * r;
                this.baseDefenders.push(u);
            }
        }

        for (const u of this.baseDefenders) {
            if (u.hp <= 0) continue;
            if (isArtLike(u)) continue;
            if (u.orderOrigin !== undefined) {
                u.baseDefender = false;
                continue;
            }
            u.captureTarget = undefined;
            u.squadAttack = false;
            const onPost = dist(u.x, u.y, base.x, base.y) <= base.radius + 40 &&
                u.tx === undefined;
            if (!onPost) {
                const idx = this.baseDefenders.indexOf(u);
                const angle = ((idx < 0 ? 0 : idx) / Math.max(3, desired)) * Math.PI * 2;
                const r = base.radius * 0.8;
                u.tx = base.x + Math.cos(angle) * r;
                u.ty = base.y + Math.sin(angle) * r;
            }
        }
    }

    // ===== ЛОГИСТИКА =====
    manageLogistics() {
        const hasConstruction = this.G.units.some(u => u.faction === this.G.ai && u.type === 'construction_truck' && u.hp > 0);
        if (!hasConstruction) {
            const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory' && b.hp > 0);
            if (factory) {
                const cost = VEHICLE_COSTS.construction_truck || { s: 60, c: 40, m: 30 };
                if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                    this.spendResources(cost);
                    const unit = createVehicle('construction_truck', this.G.ai, factory.x + 60, factory.y + 60);
                    this.G.units.push(unit);
                    const base = this.getAIMainBase();
                    if (base) {
                        unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.6;
                        unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.6;
                    }
                }
            }
        }
        const hasFireTruck = this.G.units.some(u => u.faction === this.G.ai && u.type === 'fire_truck' && u.hp > 0);
        if (!hasFireTruck) {
            const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory' && b.hp > 0);
            if (factory) {
                const cost = VEHICLE_COSTS.fire_truck || { s: 50, c: 30, m: 20 };
                if (this.aiResources.s >= cost.s && this.aiResources.c >= cost.c && this.aiResources.m >= cost.m) {
                    this.spendResources(cost);
                    const unit = createVehicle('fire_truck', this.G.ai, factory.x + 60, factory.y + 60);
                    this.G.units.push(unit);
                    const base = this.getAIMainBase();
                    if (base) {
                        unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.6;
                        unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.6;
                    }
                }
            }
        }
        if (!getModeFlags(this.G).logisticsAllowed) return;
        if (this.timer % 90 !== 0) return;

        const hasMedic = this.G.units.some(u =>
            u.faction === this.G.ai && u.type === 'medic_truck' && u.hp > 0);
        if (!hasMedic) {
            const factory = this.G.buildings.find(b =>
                b.faction === this.G.ai && b.type === 'factory' && b.hp > 0);
            if (factory) {
                const cost = VEHICLE_COSTS.medic_truck;
                if (cost &&
                    this.aiResources.s >= cost.s &&
                    this.aiResources.c >= cost.c &&
                    this.aiResources.m >= cost.m) {
                    this.spendResources(cost);
                    const unit = createVehicle('medic_truck', this.G.ai,
                        factory.x + 60, factory.y + 60);
                    this.G.units.push(unit);
                    const base = this.getAIMainBase();
                    if (base) {
                        unit.tx = base.x + (Math.random() - 0.5) * base.radius * 0.5;
                        unit.ty = base.y + (Math.random() - 0.5) * base.radius * 0.5;
                    }
                }
            }
        }

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
            if (h.tx !== undefined && dist(h.x, h.y, needy.x, needy.y) < 60) return;
            h.tx = needy.x + (Math.random() - 0.5) * 20;
            h.ty = needy.y + (Math.random() - 0.5) * 20;
        };

        sendToNeedy('engineer', u => u.hp < (u.maxHp || 100) * 0.6);
        sendToNeedy('truck', u => u.ammo !== undefined && u.maxAmmo !== undefined && u.ammo < u.maxAmmo * 0.3);
        sendToNeedy('fuel_truck', u => u.fuel !== undefined && u.maxFuel !== undefined && u.fuel < u.maxFuel * 0.3);
        sendToNeedy('flatbed', u => !!u.aoe);
        this.sendMedicToWoundedInfantry();
    }

    sendMedicToWoundedInfantry() {
        const medics = this.G.units.filter(u =>
            u.faction === this.G.ai && u.type === 'medic_truck' && u.hp > 0);
        if (medics.length === 0) return;

        const infantryInAttack = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && isInfUnit(u) &&
            u.tx !== undefined
        ).length;

        if (infantryInAttack <= 5) {
            const base = this.getAIMainBase();
            if (base) {
                for (const m of medics) {
                    if (m.tx === undefined) {
                        m.tx = base.x + (Math.random() - 0.5) * base.radius * 0.5;
                        m.ty = base.y + (Math.random() - 0.5) * base.radius * 0.5;
                    }
                }
            }
            return;
        }

        const wounded = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && isInfUnit(u) &&
            u.hp < (u.maxHp || 100) * 0.6
        ).sort((a, b) => a.hp / (a.maxHp || 1) - b.hp / (b.maxHp || 1));
        if (wounded.length === 0) return;

        for (const m of medics) {
            const nearest = wounded.reduce((best, u) =>
                dist(m.x, m.y, u.x, u.y) < dist(m.x, m.y, best.x, best.y) ? u : best);
            if (!nearest) continue;
            if (m.tx !== undefined && dist(m.x, m.y, nearest.x, nearest.y) < 60) continue;
            m.tx = nearest.x + (Math.random() - 0.5) * 20;
            m.ty = nearest.y + (Math.random() - 0.5) * 20;
        }
    }

    // ===== ОТВОД =====
    getHoldGroundChance() {
        const aiPts = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const plPts = this.G.cps.filter(c => c.owner === this.G.faction).length;
        const BASE = 0.2;
        const MAXHOLD = 0.95;
        if (plPts <= 0) return Math.min(MAXHOLD, BASE + 0.4);
        const ratio = aiPts / plPts;
        if (ratio >= 1) return BASE;
        const slope = (0.8 - BASE) / (1 - 0.5);
        const chance = BASE + (1 - ratio) * slope;
        return Math.max(BASE, Math.min(MAXHOLD, chance));
    }

    makeRetreatDecisions() {
        if (this.timer % 120 !== 0) return;
        const holdChance = this.getHoldGroundChance();
        const vehicles = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            !isInfUnit(u) && !this.isSupportUnit(u)
        );
        for (const v of vehicles) {
            if (v.orderOrigin !== undefined) continue;
            const maxHp = v.maxHp || 100;
            if (v.hp >= maxHp * 0.5) {
                v.holdPosition = false;
                v.retreatDecisionAt = undefined;
                continue;
            }
            if (v.holdPosition !== undefined && v.retreatDecisionAt !== undefined) continue;
            const stay = Math.random() < holdChance;
            v.holdPosition = stay;
            v.retreatDecisionAt = this.timer;
        }
    }

    handleDamagedVehicles() {
        const base = this.getAIMainBase();
        if (!base) return;

        const damaged = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            !isInfUnit(u) && !this.isSupportUnit(u) &&
            u.hp < (u.maxHp || 100) * 0.5
        );
        if (damaged.length === 0) return;

        const enemyVehiclesAtBase = this.G.units.filter(u =>
            u.faction === this.G.faction && u.hp > 0 && !isInfUnit(u) &&
            dist(u.x, u.y, base.x, base.y) <= base.radius + 150
        );
        if (enemyVehiclesAtBase.length > 0) {
            const focus = enemyVehiclesAtBase.reduce((best, e) =>
                dist(e.x, e.y, base.x, base.y) < dist(best.x, best.y, base.x, base.y) ? e : best);
            const attackers = this.G.units.filter(u =>
                u.faction === this.G.ai && u.hp > 0 && !u.aoe &&
                !this.isSupportUnit(u) &&
                dist(u.x, u.y, base.x, base.y) < 1600
            );
            attackers.forEach(u => {
                u.tx = focus.x + (Math.random() - 0.5) * 70;
                u.ty = focus.y + (Math.random() - 0.5) * 70;
                u.holdPosition = true;
                u.retreatDecisionAt = this.timer;
            });
        }

        for (const v of damaged) {
            if (v.holdPosition === true) continue;
            if (v.holdPosition === undefined) continue;
            if (v.isScout) continue;
            if (dist(v.x, v.y, base.x, base.y) <= base.radius + 120) continue;
            if (v.tx !== undefined) continue;

            const angle = Math.atan2(base.y - v.y, base.x - v.x);
            const stopDist = base.radius * 0.5;
            v.tx = base.x - Math.cos(angle) * stopDist;
            v.ty = base.y - Math.sin(angle) * stopDist;
            v.retreatToBase = true;
        }
    }

    defensiveReactions() {
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
            !u.retreatToBase &&
            !this.isSupportUnit(u)
        );
        idle.slice(0, 4).forEach(u => {
            const tx = target.x + (Math.random() - 0.5) * 60;
            const ty = target.y + (Math.random() - 0.5) * 60;
            this._issueRoadMarch(u, tx, ty);
        });
    }

    unitCategory(u) {
        if (!u || !u.type) return 'other';
        const t = u.type;
        if (t === 'infantry') return 'infantry';
        if (t.includes('artillery')) return 'artillery';
        if (t === 'truck' || t === 'fuel_truck' || t === 'flatbed' || t === 'medic_truck' || t === 'construction_truck' || t === 'fire_truck') return 'supply';
        if (t === 'engineer') return 'engineer';
        if (t === 'niska' || t === 'javelin') return 'apc';
        if (u.isMortar || t === 'hoplite' || t === 'devitt_mmr') return 'artillery';
        return 'tank';
    }

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

    getDesiredBunkerCount(cp) {
        const base = this.getAIMainBase();
        if (!base) return 1;
        const dBase = dist(base.x, base.y, cp.x, cp.y);
        const isMainBase = (cp === base);
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length || 1;
        const playerDominates = this.G.cps.filter(c => c.owner === this.G.faction).length > aiPoints;

        let desired;
        if (isMainBase) desired = 4;
        else if (dBase < 700) desired = 3;
        else if (dBase < 1200) desired = 2;
        else desired = 1;
        if ((playerDominates || this.isPointThreatened(cp)) && !isMainBase && desired < 3) desired += 1;
        if (isMainBase && (playerDominates || this.isPointThreatened(cp))) desired = 5;
        return desired;
    }

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
        if (this.timer % 120 !== 0) return;
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;

        const aiMainBase = this.getAIMainBase();

        const counts = new Map();
        for (const cp of aiPoints) {
            const n = this.G.buildings.filter(b =>
                b.faction === this.G.ai && b.type && b.type.startsWith('bunker_') &&
                dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80
            ).length;
            counts.set(cp.id || cp.name, n);
        }

        let best = null, bestScore = -Infinity;
        for (const cp of aiPoints) {
            const have = counts.get(cp.id || cp.name) || 0;
            const need = this.getDesiredBunkerCount(cp);
            const deficit = need - have;
            if (deficit <= 0) continue;
            const dBase = aiMainBase ? dist(aiMainBase.x, aiMainBase.y, cp.x, cp.y) : 0;
            const score = deficit * 100 - dBase * 0.1;
            if (score > bestScore) { bestScore = score; best = cp; }
        }
        if (!best) return;

        const have = counts.get(best.id || best.name) || 0;
        const type = this.pickBunkerType(best, have);
        if (!type) return;

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

        const fortification = this.G.buildFortification(type, bx, by, this.G.ai, this.aiResources);
        if (fortification) fortification.buildTime *= 1.3;
    }

    updateAIResources() {
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const modeMultiplier = this.G.gameMode === 'realism' ? 0.3 : this.G.gameMode === 'fast' ? 2.5 : 1.0;
        const flags = getModeFlags(this.G);
        const farmMult = flags.farmMultiplier ? flags.farmMultiplier(this.G.time) : 1;

        let mineS = 0, mineC = 0, mineM = 0;
        for (const mine of (this.G.mines || [])) {
            if (mine.owner !== this.G.ai) continue;
            if (mine.type === 'supplies') mineS += 0.05;
            else if (mine.type === 'components') mineC += 0.03;
            else if (mine.type === 'materials') mineM += 0.03;
        }

        this.aiResources.s += (aiPoints * 0.03 + mineS) * this.aiResourceRate * modeMultiplier * farmMult;
        this.aiResources.c += (aiPoints * 0.015 + mineC) * this.aiResourceRate * modeMultiplier * farmMult;
        this.aiResources.m += (aiPoints * 0.01 + mineM) * this.aiResourceRate * modeMultiplier * farmMult;
    }

    canAffordInfantry() {
        const cost = VEHICLE_COSTS.infantry;
        return this.aiResources.s >= cost.s &&
               this.aiResources.c >= cost.c &&
               this.aiResources.m >= cost.m;
    }

    vehicleRoster() {
        return this.G.ai === 'wardens'
            ? ['devitt', 'niska', 'king_spire', 'silverhand', 'gallagher_highwayman', 'gallagher_outlaw']
            : ['hatchet', 'javelin', 'scorpion', 'nemesis', 'falchion', 'spatha'];
    }

    getCheapestAllowedVehicleCost() {
        let best = null;
        for (const t of this.vehicleRoster()) {
            const c = VEHICLE_COSTS[t];
            if (!c || !aiAllow(this.G, t)) continue;
            if (!best || c.s < best.s) best = c;
        }
        return best;
    }

    pickAffordableVehicleType() {
        const affordable = this.vehicleRoster().filter(t => {
            const c = VEHICLE_COSTS[t];
            return c && aiAllow(this.G, t) &&
                this.aiResources.s >= c.s && this.aiResources.c >= c.c && this.aiResources.m >= c.m;
        });
        if (affordable.length === 0) return null;
        return affordable[Math.floor(Math.random() * affordable.length)];
    }

    canAffordVehicle() {
        if (!classesCoexist(this.G) && aiRestriction(this.G) === 'infantry_only') return false;
        const cheapestVehicle = this.getCheapestAllowedVehicleCost();
        if (!cheapestVehicle) return false;
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

        const squadSize = this.squadSizeOf(this.difficulty);
        let types = [];
        for (let i = 0; i < squadSize; i++) types.push(this.pickInfantryType(role));
        while (types.length > 0 && !this.canAffordSquad(types)) {
            const idx = types.reduce((best, t, i) =>
                (VEHICLE_COSTS[t].s > VEHICLE_COSTS[types[best]].s ? i : best), 0);
            if (types[idx] === 'rifleman') types.pop();
            else types[idx] = 'rifleman';
        }
        if (types.length === 0) return;

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

        if (this.defenseMode) {
            this.assignDefensivePositions(spawned);
        } else {
            const target = this.findDefensiveTarget(barracks.x, barracks.y);
            if (target) {
                spawned.forEach(u => {
                    const tx = target.x + (Math.random() - 0.5) * 40;
                    const ty = target.y + (Math.random() - 0.5) * 40;
                    this._issueRoadMarch(u, tx, ty);
                });
            }
        }
        this.staffGarrisonFromUnits(spawned);
    }

    staffGarrisonFromUnits(units) {
        const infOnly = units.filter(u => u.hp > 0 && isInfUnit(u) && !u.garrisonedAt);
        if (infOnly.length === 0) return;
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;

        const base = this.getAIMainBase();
        let cursor = 0;
        for (const cp of aiPoints) {
            if (cursor >= infOnly.length) break;
            const key = cp.id || cp.name;
            const current = (this.garrison.get(key) || []).filter(u =>
                u.hp > 0 && u.faction === this.G.ai && dist(u.x, u.y, cp.x, cp.y) <= cp.radius + 40);
            const dBase = base ? dist(base.x, base.y, cp.x, cp.y) : 0;
            const desired = (cp === base) ? 5 : (dBase < 700 ? 3 : (dBase < 1200 ? 2 : 1));
            while (current.length < Math.min(5, desired) && cursor < infOnly.length) {
                const u = infOnly[cursor++];
                u.garrisonedAt = key;
                u.tx = cp.x + (Math.random() - 0.5) * cp.radius * 0.6;
                u.ty = cp.y + (Math.random() - 0.5) * cp.radius * 0.6;
                current.push(u);
            }
            this.garrison.set(key, current);
        }
    }

    // ===== СНАЙПЕРЫ =====
    manageSnipers() {
        if (this.timer - this.lastSniperScanAt < 120) return;
        this.lastSniperScanAt = this.timer;

        const enemyCities = this.G.cps.filter(c => c.owner === this.G.faction);

        for (const [key, id] of [...this.sniperAssignments.entries()]) {
            const cp = this.G.cps.find(c => (c.id || c.name) === key);
            const stillEnemy = cp && cp.owner === this.G.faction;
            const sniperAlive = this.G.units.some(u => u.id === id && u.hp > 0);
            if (!stillEnemy || !sniperAlive) this.sniperAssignments.delete(key);
        }

        const unstaffed = enemyCities.filter(
            c => !this.sniperAssignments.has(c.id || c.name));
        if (unstaffed.length === 0) return;

        const snipers = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            (u.type === 'sniper' || u.type === 'poacher_colonist') &&
            u.isSniperPost
        );
        if (snipers.length >= unstaffed.length) {
            for (const cp of unstaffed) {
                const best = snipers.find(u =>
                    !u._assignedCp && !this.sniperAssignments.has(cp.id || cp.name));
                if (!best) break;
                this._assignSniperToPost(best, cp);
                this.sniperAssignments.set(cp.id || cp.name, best.id);
            }
            return;
        }

        const cost = VEHICLE_COSTS.sniper || VEHICLE_COSTS.infantry;
        const RESERVE = 60;
        if (this.aiResources.s < cost.s + RESERVE ||
            this.aiResources.c < cost.c + RESERVE ||
            this.aiResources.m < cost.m + RESERVE) return;

        const target = unstaffed[0];
        const unit = this.spawnSniper();
        if (!unit) return;

        this._assignSniperToPost(unit, target);
        this.sniperAssignments.set(target.id || target.name, unit.id);
        aiLog(`[AI][SNIPER] т.${this.timer}: ${unit.label} → "${target.name}"`);
    }

    _assignSniperToPost(unit, city) {
        if (!unit || !city) return;
        const r = unit.range || 200;
        const distRatio = 0.5 + Math.random() * 0.3;
        const radius = r * distRatio;

        let bestAngle = 0, bestScore = -Infinity;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
            const px = city.x + Math.cos(a) * radius;
            const py = city.y + Math.sin(a) * radius;
            let roadPenalty = 0;
            const near = this._nearestRoadPoint(px, py);
            if (near) roadPenalty = Math.max(0, 80 - near.d) * 0.5;
            let coverBonus = 0;
            if (isInBush(px, py)) coverBonus = 60;
            const distToUnit = dist(unit.x, unit.y, px, py);
            const approachBonus = Math.max(0, 400 - distToUnit) * 0.2;
            const score = coverBonus + approachBonus - roadPenalty;
            if (score > bestScore) { bestScore = score; bestAngle = a; }
        }

        const tx = city.x + Math.cos(bestAngle) * radius;
        const ty = city.y + Math.sin(bestAngle) * radius;

        this._queueWaypoints(unit, this._stealthApproach(unit.x, unit.y, tx, ty));
        unit.isSniperPost = true;
        unit._assignedCp = city.id || city.name;
        unit.holdPosition = true;
    }

    spawnSniper() {
        const barracks = this.G.buildings.find(b =>
            b.faction === this.G.ai && b.type === 'barracks' && b.hp > 0);
        if (!barracks) return null;
        if (!this.G.canProduceUnit('infantry', this.G.ai)) return null;
        if (!aiAllow(this.G, 'sniper')) return null;

        const cost = VEHICLE_COSTS.sniper || VEHICLE_COSTS.infantry;
        if (this.aiResources.s < cost.s || this.aiResources.c < cost.c ||
            this.aiResources.m < cost.m) return null;
        this.spendResources(cost);

        const unit = createVehicle('sniper', this.G.ai,
            barracks.x + 40, barracks.y + 40);
        this.G.units.push(unit);
        this.infantryCount++;
        return unit;
    }

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

    // ===== GOD LOADER =====
    shouldSeekGodLoader() {
        if (this.G.ai !== 'colonials') return false;
        if (!aiAllow(this.G, 'god_loader')) return false;
        const TEN_MIN = 60 * 60 * 10;
        if ((this.G.time || 0) < TEN_MIN) return false;

        const playerUnits = this.G.units.filter(u => u.faction === this.G.faction && u.hp > 0);
        const playerTanks = playerUnits.filter(u => !isInfUnit(u) && !u.aoe &&
            !this.isSupportUnit(u)).length;
        const massThreshold = playerTanks >= 10 || playerUnits.length > 30;
        if (!massThreshold) return false;

        const glLive = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && u.type === 'god_loader').length;
        return glLive < 2;
    }

    spawnGodLoader() {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory');
        if (!factory) return false;
        if (!this.G.canProduceUnit('vehicle', this.G.ai)) return false;
        if (!aiAllow(this.G, 'god_loader')) return false;

        const cost = VEHICLE_COSTS.god_loader;
        if (this.aiResources.s < cost.s || this.aiResources.c < cost.c ||
            this.aiResources.m < cost.m) return false;

        this.spendResources(cost);
        const unit = createVehicle('god_loader', this.G.ai, factory.x + 60, factory.y + 60);
        this.G.units.push(unit);
        unit.isArtillery = true;
        this.accumulatedForces += 4;
        return true;
    }

    spawnVehicle(useArtilleryBias = false) {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory');
        if (!factory) return;

        let types = [];
        if (this.G.ai === 'wardens') {
            types = ['devitt', 'niska'];
            if (this.difficulty >= 1) types.push('king_spire');
            if (this.difficulty >= 2) {
                types.push('silverhand', 'gallagher_highwayman', 'gallagher_outlaw');
            }
        } else {
            types = ['hatchet', 'javelin'];
            if (this.difficulty >= 1) types.push('scorpion');
            if (this.difficulty >= 2) {
                types.push('nemesis', 'falchion', 'spatha');
            }
        }

        if (this.difficulty >= 1) {
            const artChance = useArtilleryBias ? 0.6 : 0.15;
            if (Math.random() < artChance) {
                const combatTotal = this.G.units.filter(u => u.faction === this.G.ai && isTechUnit(u)).length;
                const liveArtNow = this.G.units.filter(u => u.faction === this.G.ai && u.hp > 0 && u.aoe).length;
                if (this.spawnDoctrineArtillery(liveArtNow, Math.max(2, Math.round(combatTotal * (useArtilleryBias ? 0.45 : 0.3))))) return;
            }
        }

        types = types.filter(t => aiAllow(this.G, t));
        let type = null;
        if (!classesCoexist(this.G) && aiRestriction(this.G) === 'vehicles_only') {
            type = this.pickAffordableVehicleType();
            if (!type) type = types[Math.floor(Math.random() * types.length)];
        } else {
            type = types[Math.floor(Math.random() * types.length)];
        }
        if (!type) return;
        const cost = VEHICLE_COSTS[type];
        if (this.aiResources.s < cost.s || this.aiResources.c < cost.c || this.aiResources.m < cost.m) {
            return;
        }
        this.spendResources(cost);

        const unit = createVehicle(type, this.G.ai, factory.x + 60, factory.y + 60);
        this.G.units.push(unit);

        if (unit.revealRadius) {
            this.assignScoutPatrol(unit);
            return;
        }

        if (this.defenseMode) {
            this.assignPatrolRoute(unit);
        } else {
            const target = this.findDefensiveTarget(factory.x, factory.y);
            if (target) {
                const tx = target.x + (Math.random() - 0.5) * 40;
                const ty = target.y + (Math.random() - 0.5) * 40;
                this._issueRoadMarch(unit, tx, ty);
            }
        }
    }

    spawnDoctrineArtillery(currentArt = 0, artCap = 99) {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory');
        if (!factory) return false;
        if (!this.G.canProduceUnit('vehicle', this.G.ai)) return false;
        if (currentArt >= artCap) return false;

        const w = this.G.ai === 'wardens';
        const barrelType = Math.random() < 0.5
            ? (w ? 'warden_artillery150' : 'colonial_artillery150')
            : (w ? 'warden_artillery120' : 'colonial_artillery120');
        const mortarType = w ? 'devitt_mmr' : 'hoplite';

        for (const t of [barrelType, mortarType]) {
            if (!aiAllow(this.G, t)) continue;
            const cost = VEHICLE_COSTS[t];
            if (!cost) continue;
            if (this.aiResources.s < cost.s || this.aiResources.c < cost.c ||
                this.aiResources.m < cost.m) continue;

            this.spendResources(cost);
            const unit = createVehicle(t, this.G.ai, factory.x + 60, factory.y + 60);
            this.G.units.push(unit);
            unit.isArtillery = true;
            if (t === 'hoplite' || t === 'devitt_mmr') unit.isMortar = true;
            this.accumulatedForces += 3;
            return true;
        }
        return false;
    }

    assignScoutPatrol(unit) {
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;
        const point = aiPoints[Math.floor(Math.random() * aiPoints.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = point.radius * 1.5;
        unit.tx = point.x + Math.cos(angle) * radius;
        unit.ty = point.y + Math.sin(angle) * radius;
        unit.patrolCenter = point;
        unit.patrolAngle = angle;
        unit.isScout = true;
    }

    assignArtilleryPosition(unit) {
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction);
        if (aiPoints.length === 0 || playerPoints.length === 0) return;

        const centerX = aiPoints.reduce((sum, cp) => sum + cp.x, 0) / aiPoints.length;
        const centerY = aiPoints.reduce((sum, cp) => sum + cp.y, 0) / aiPoints.length;

        const nearestEnemy = playerPoints.reduce((closest, cp) => {
            const d = dist(centerX, centerY, cp.x, cp.y);
            return d < closest.dist ? { cp, dist: d } : closest;
        }, { cp: null, dist: Infinity });

        if (!nearestEnemy.cp) return;

        const angle = Math.atan2(nearestEnemy.cp.y - centerY, nearestEnemy.cp.x - centerX);
        const optimalDist = unit.range * 0.75;
        unit.tx = centerX + Math.cos(angle) * optimalDist;
        unit.ty = centerY + Math.sin(angle) * optimalDist;
    }

    getIdleAttackers() {
        return this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 && !u.aoe && u.tx === undefined &&
            !u.retreatToBase && !u.garrisonedAt &&
            !this.isSupportUnit(u) &&
            !u.baseDefender && !u.isSniperPost && !u.raiderSquad
        );
    }

    pickBestTarget(fromX, fromY) {
        const neutral = this.G.cps.filter(c => c.owner === 'neutral');
        const enemy = this.G.cps.filter(c => c.owner === this.G.faction);
        const nearestOf = (list) => list.length ? list.reduce((best, cp) =>
            dist(fromX, fromY, cp.x, cp.y) < dist(fromX, fromY, best.x, best.y) ? cp : best) : null;

        if (neutral.length) return nearestOf(neutral);
        const broken = enemy.filter(cp => this.G.isCityDefenseBroken(cp));
        if (broken.length) return nearestOf(broken);
        if (enemy.length) return nearestOf(enemy);
        return null;
    }

    sendIdleSquadToTarget() {
        const idle = this.getIdleAttackers();
        if (idle.length < 3) return;

        const base = this.getAIMainBase();
        const sorted = idle.sort((a, b) =>
            dist(a.x, a.y, base?.x ?? a.x, base?.y ?? a.y) -
            dist(b.x, b.y, base?.x ?? b.x, base?.y ?? b.y));

        const squadSize = Math.min(3 + Math.floor(this.difficulty), sorted.length);
        const vehicles = sorted.filter(u => !isInfUnit(u));
        const infantry = sorted.filter(u => isInfUnit(u));
        const squad = [...vehicles, ...infantry].slice(0, squadSize);

        const leader = squad[0];
        const target = this.pickBestTarget(leader.x, leader.y);
        if (!target) return;

        squad.forEach((u, i) => {
            const angle = (i / squad.length) * Math.PI * 2;
            const canEnter = target.owner === 'neutral' ||
                this.G.isCityDefenseBroken(target);
            const spread = canEnter ? target.radius * 0.5 : target.radius + 40;
            const tx = target.x + Math.cos(angle) * spread;
            const ty = target.y + Math.sin(angle) * spread;
            this._issueRoadMarch(u, tx, ty);
            u.captureTarget = target;
            u.squadAttack = true;
        });
    }

    strategicBehavior() {
        if (this.timer % 1500 === 0) {
            this.defenseMode = !this.defenseMode;
        }

        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;

        if (playerPoints > aiPoints + 4 && !this.defenseMode) {
            this.defenseMode = true;
        }

        const idleSquadCount = this.getIdleAttackers().length;
        if (idleSquadCount >= 3 && this.timer - this.lastAttackTime > 600) {
            this.lastAttackTime = this.timer;
            this.sendIdleSquadToTarget();
        }

        if (!this.defenseMode && idleSquadCount >= 4 && this.timer - this.lastAttackTime > 900) {
            this.lastAttackTime = this.timer;
            this.launchAttack();
        }

        if (this.accumulatedForces >= this.attackThreshold && this.timer - this.lastAttackTime > 1200) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
            this.accumulatedForces = 0;
            this.launchAttack();
        }

        if (aiPoints > playerPoints + 1 && this.timer - this.lastAttackTime > 3000) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
            this.launchAttack();
        }
    }

    launchAttack() {
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction);
        if (playerPoints.length === 0) return;

        const target = playerPoints.reduce((best, cp) => {
            const value = cp.radius + (cp.type === 'town_hall' ? 100 : 0);
            return value > best.value ? { cp, value } : best;
        }, { cp: null, value: 0 }).cp;

        if (!target) return;

        const aiUnits = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            !u.aoe &&
            !u.baseDefender &&
            !this.isSupportUnit(u) &&
            !u.garrisonedAt &&
            !u.isSniperPost
        );
        aiUnits.forEach(unit => {
            const tx = target.x + (Math.random() - 0.5) * 50;
            const ty = target.y + (Math.random() - 0.5) * 50;
            this._issueRoadMarch(unit, tx, ty);
        });
    }

    manageArtillery() {
        const artillery = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            (u.isArtillery === true || u.isMortar === true || u.aoe === true)
        );
        if (artillery.length === 0) return;

        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction);
        if (playerPoints.length === 0) return;

        artillery.forEach(art => {
            const target = playerPoints.reduce((closest, cp) => {
                const d = dist(art.x, art.y, cp.x, cp.y);
                return d < closest.dist ? { cp, dist: d } : closest;
            }, { cp: null, dist: Infinity });

            if (!target.cp) return;

            const targetDist = dist(art.x, art.y, target.cp.x, target.cp.y);
            const minRange = art.minRange || 100;

            if (targetDist <= art.range && targetDist >= minRange) {
                const isGodLoader = art.type === 'god_loader' || /god\s*loader/i.test(art.label || '');
                const cdElapsed = this.G.time - (art.lastAtk || 0);
                if (!isGodLoader || cdElapsed >= (art.cd || 0)) {
                    art.aoeTarget = { x: target.cp.x, y: target.cp.y };
                }
                this.sendEscortToArtillery(art);
            } else if (targetDist < minRange) {
                if (!art.retreatOrder) {
                    const retreatAngle = Math.atan2(art.y - target.cp.y, art.x - target.cp.x);
                    art.retreatOrder = {
                        x: art.x + Math.cos(retreatAngle) * (minRange + 60 - targetDist),
                        y: art.y + Math.sin(retreatAngle) * (minRange + 60 - targetDist),
                    };
                    art.tx = art.retreatOrder.x;
                    art.ty = art.retreatOrder.y;
                }
            } else if (targetDist > art.range) {
                if (!art.moveOrder && art.tx === undefined) {
                    const moveAngle = Math.atan2(target.cp.y - art.y, target.cp.x - art.x);
                    const parkDist = Math.max(target.cp.radius + 40, art.range - 60);
                    art.moveOrder = {
                        x: target.cp.x - Math.cos(moveAngle) * parkDist,
                        y: target.cp.y - Math.sin(moveAngle) * parkDist,
                    };
                    art.tx = art.moveOrder.x;
                    art.ty = art.moveOrder.y;
                }
            }
        });

        const anyTargetable = playerPoints.length > 0;
        if (!anyTargetable) {
            const pushTargets = this.G.cps.filter(c => c.owner !== this.G.ai);
            if (pushTargets.length > 0) {
                artillery.forEach(art => {
                    if (art.tx !== undefined || art.moveOrder) return;
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
        if (artillery.lastEscortAt !== undefined && this.timer - artillery.lastEscortAt < 180) return;
        artillery.lastEscortAt = this.timer;

        const availableUnits = this.G.units.filter(u =>
            u.faction === this.G.ai &&
            u.hp > 0 &&
            u.tx === undefined &&
            u !== artillery &&
            !this.isSupportUnit(u) &&
            (isInfUnit(u) || u.type === 'devitt' || u.type === 'hatchet' ||
             u.type === 'gallagher_highwayman' || u.type === 'falchion' ||
             u.type === 'niska' || u.type === 'javelin')
        );

        const escortCount = Math.min(3, availableUnits.length);
        for (let i = 0; i < escortCount; i++) {
            const escort = availableUnits[i];
            const angle = (i / escortCount) * Math.PI * 2;
            const escortDist = 50;
            escort.tx = artillery.x + Math.cos(angle) * escortDist;
            escort.ty = artillery.y + Math.sin(angle) * escortDist;
        }
    }

    findDefensiveTarget(fromX, fromY) {
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        const neutralPoints = this.G.cps.filter(c => c.owner === 'neutral');

        const threatenedPoints = aiPoints.filter(cp => {
            const playerUnits = this.G.units.filter(u =>
                u.faction === this.G.faction &&
                dist(u.x, u.y, cp.x, cp.y) < cp.radius * 2
            );
            return playerUnits.length > 0;
        });

        if (threatenedPoints.length > 0) {
            return threatenedPoints.reduce((closest, cp) => {
                const d = dist(fromX, fromY, cp.x, cp.y);
                return d < dist(fromX, fromY, closest.x, closest.y) ? cp : closest;
            });
        }
        if (neutralPoints.length > 0) {
            return neutralPoints.reduce((closest, cp) => {
                const d = dist(fromX, fromY, cp.x, cp.y);
                return d < dist(fromX, fromY, closest.x, closest.y) ? cp : closest;
            });
        }
        return null;
    }

    assignDefensivePositions(units) {
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        units.forEach((unit, index) => {
            if (aiPoints.length === 0) return;
            const point = aiPoints[index % aiPoints.length];
            const angle = (index / units.length) * Math.PI * 2;
            const radius = point.radius * 0.7;
            unit.tx = point.x + Math.cos(angle) * radius;
            unit.ty = point.y + Math.sin(angle) * radius;
        });
    }

    assignPatrolRoute(unit) {
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;
        const point = aiPoints[Math.floor(Math.random() * aiPoints.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = point.radius * 0.8;
        unit.tx = point.x + Math.cos(angle) * radius;
        unit.ty = point.y + Math.sin(angle) * radius;
        unit.patrolCenter = point;
        unit.patrolAngle = angle;
    }

    assignSquadToTarget(units, target) {
        units.forEach(unit => {
            const tx = target.x + (Math.random() - 0.5) * 40;
            const ty = target.y + (Math.random() - 0.5) * 40;
            this._issueRoadMarch(unit, tx, ty);
        });
    }

    // ===== ДИВЕРСИОННЫЕ ОТРЯДЫ =====
    manageRaiders() {
        if (this.timer % 1800 !== 0) return;
        if (!getModeFlags(this.G).fogEnabled) return;

        const pool = this.G.units.filter(u =>
            u.faction === this.G.ai && u.hp > 0 &&
            isInfUnit(u) && u.tx === undefined &&
            !u.isSniperPost && !u.isMedic &&
            u.type !== 'sniper' && u.type !== 'poacher_colonist' &&
            u.garrisonedAt === undefined && !u.baseDefender &&
            !u.raiderSquad
        );
        if (pool.length < 3) return;

        const squads = this._splitIntoMixedSquads(pool, 3, 5);
        if (squads.length === 0) return;

        const enemyCities = this.G.cps.filter(c => c.owner === this.G.faction);
        if (enemyCities.length === 0) return;

        for (const squad of squads) {
            const leader = squad[0];
            const target = enemyCities.reduce((best, cp) =>
                dist(leader.x, leader.y, cp.x, cp.y) < dist(leader.x, leader.y, best.x, best.y) ? cp : best);

            const flank = this._pickFlankAroundCity(target, leader);
            squad.forEach((u, i) => {
                const angle = flank + (i - squad.length / 2) * 0.25;
                const radius = target.radius + 80 + Math.random() * 60;
                const tx = target.x + Math.cos(angle) * radius;
                const ty = target.y + Math.sin(angle) * radius;

                const perp = angle + Math.PI / 2;
                const mid = {
                    x: (u.x + tx) / 2 + Math.cos(perp) * 180,
                    y: (u.y + ty) / 2 + Math.sin(perp) * 180,
                };
                this._queueWaypoints(u, [mid, { x: tx, y: ty }]);

                u.raiderSquad = true;
                u.captureTarget = target;
            });
            aiLog(`[AI][RAID] т.${this.timer}: отряд ${squad.length} (${squad.map(u=>u.type).join(',')}) выдвинулся в обход к "${target.name}"`);
        }
    }

    _splitIntoMixedSquads(pool, minSize, maxSize) {
        const byType = new Map();
        for (const u of pool) {
            if (!byType.has(u.type)) byType.set(u.type, []);
            byType.get(u.type).push(u);
        }
        const types = [...byType.keys()];
        if (types.length < 2) return [];
        const squads = [];
        const used = new Set();
        let idx = 0;
        while (true) {
            const squad = [];
            const size = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
            for (let k = 0; k < size; k++) {
                let taken = false;
                for (let t = 0; t < types.length; t++) {
                    const type = types[(idx + t) % types.length];
                    const arr = byType.get(type);
                    const cand = arr.find(u => !used.has(u.id));
                    if (cand) {
                        squad.push(cand);
                        used.add(cand.id);
                        taken = true;
                        break;
                    }
                }
                if (!taken) break;
            }
            idx++;
            if (squad.length < minSize) break;
            squads.push(squad);
        }
        return squads;
    }

    _pickFlankAroundCity(city, fromUnit) {
        const angles = [];
        const samples = this._getRoadSamples();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
            let onRoad = false;
            for (let r = 100; r <= 300; r += 40) {
                const px = city.x + Math.cos(a) * r;
                const py = city.y + Math.sin(a) * r;
                for (const s of samples) {
                    if (dist(px, py, s.x, s.y) < 40) { onRoad = true; break; }
                }
                if (onRoad) break;
            }
            if (!onRoad) angles.push(a);
        }
        if (angles.length === 0) {
            return Math.atan2(fromUnit.y - city.y, fromUnit.x - city.x) + Math.PI;
        }
        const angleToUnit = Math.atan2(fromUnit.y - city.y, fromUnit.x - city.x);
        return angles.reduce((best, a) =>
            Math.abs(((a - angleToUnit + Math.PI * 3) % (Math.PI * 2)) - Math.PI) <
            Math.abs(((best - angleToUnit + Math.PI * 3) % (Math.PI * 2)) - Math.PI) ? a : best
        );
    }
}