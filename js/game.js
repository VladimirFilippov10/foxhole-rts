// ===== GAME LOGIC =====
import { dist, distToSeg, GAME_MODES, SUPPLY_SYSTEM, getModeFlags,
    isUnitAllowedByRestriction, isBuildingAllowedByRestriction,
    DEFAULT_RESTRICTION, DEFAULT_ECONOMY, DEFAULT_FOG,
    MAP_W, MAP_H, detailScale, CORPSE_LIFETIME } from './constants.js';
import { getConcealZoneAt, isInBush } from './map.js';
import { AI } from './ai.js';
import { createVehicle, isInfUnit, isTechVehicle, INFANTRY_TYPES,
    getDefenseDamageVsTech, getUnitAttackDamage, ARTILLERY_TYPES,
    LOGISTICS_TYPES } from './vehicles.js';

    const VEHICLE_HARD_DETECT_RADIUS = 50;

function isVehicleTarget(u) {
    if (!u) return false;
    return !isInfUnit(u);
}
const DS = () => detailScale();

function baseSupplyRadius() { return SUPPLY_SYSTEM.baseSupplyRadius * DS(); }

function aiLog(...args) {
    if (typeof window !== 'undefined' && window.AI_LOG === false) return;
    console.log(...args);
}

export class Game {
    constructor(faction, gameMode = 'normal', restriction = DEFAULT_RESTRICTION,
        economy = DEFAULT_ECONOMY, fog = DEFAULT_FOG) {
        this.faction = faction;
        this.ai = faction === 'wardens' ? 'colonials' : 'wardens';
        this.gameMode = gameMode;
        this.restriction = restriction || DEFAULT_RESTRICTION;
        this.economy = economy || DEFAULT_ECONOMY;
        this.fog = fog || DEFAULT_FOG;
        this.fogEnabled = this.fog === 'on';
        this.units = [];
        this.corpses = [];
        this.buildings = [];
        this.debris = [];
        this.cps = [];
        this.rockets = [];
        this.mines = [];
        this.selected = [];
        this.cam = { x: 0, y: 0 };
        this.time = 0;
        this.over = false;
        this.winner = null;
        this.particles = [];
        this.moveMode = false;
        this.mousePos = { x: 0, y: 0 };

        this.aiController = null;
        this.productionQueue = [];
        this.unitLimits = { infantry: 20, vehicles: 10 };
        this.tracers = [];
        this.cityEnterGuard = new Map();
        this.revealedAreas = [];
        this.visibleEnemyIds = null;
    }

    init(cps, mines, buildings, units) {
        this.cps = cps;
        this.mines = mines;
        this.buildings = buildings;
        this.units = units;

        const playerBase = this.cps.find(cp => cp.owner === this.faction);
        if (playerBase) {
            this.cam.x = Math.max(0, playerBase.x - window.innerWidth / 2);
            this.cam.y = Math.max(0, playerBase.y - window.innerHeight / 2);
        }

        this.aiController = new AI(this);
        this.initCityHouses();
        this.updateVisibility();
    }

    initCityHouses() {
        const HOUSE_BURN_DURATION = 60 * 120;
        for (const cp of this.cps) {
            if (cp.houses && cp.houses.length > 0) continue;
            const houses = [];
            const n = 8 + Math.floor(Math.random() * 7);
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
                const r = cp.radius * (0.25 + Math.random() * 0.55);
                houses.push({
                    x: cp.x + Math.cos(a) * r,
                    y: cp.y + Math.sin(a) * r,
                    size: 10 + Math.random() * 8,
                    angle: 0,
                    hp: 100, maxHp: 100,
                    burning: false,
                    burnStart: 0,
                    destroyed: false,
                    seed: Math.random() * Math.PI * 2,
                });
            }
            cp.houses = houses;
            cp.burnDuration = HOUSE_BURN_DURATION;
            cp.repairDefense = cp.repairDefense || false;
            cp._lastRepairAt = 0;
        }
    }

    damageCityHouses(cp, dmg, fromX, fromY) {
        if (!cp || !cp.houses || cp.houses.length === 0) return;
        const d = Number(dmg);
        if (!Number.isFinite(d) || d <= 0) return;
        const count = 1 + Math.floor(Math.random() * 3);
        const cx = Number.isFinite(fromX) ? fromX : cp.x;
        const cy = Number.isFinite(fromY) ? fromY : cp.y;
        const sorted = cp.houses
            .filter(h => !h.destroyed)
            .sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy));
        for (let i = 0; i < count && i < sorted.length; i++) {
            const h = sorted[i];
            h.hp = Math.max(0, h.hp - d);
            if (!h.burning && h.hp <= h.maxHp * 0.5) {
                h.burning = true;
                h.burnStart = this.time;
            }
            if (h.hp <= 0) {
                h.destroyed = true;
                if (!h.burning) {
                    h.burning = true;
                    h.burnStart = this.time;
                }
            }
        }
    }

    updateCityFires() {
        for (const cp of this.cps) {
            if (!cp.houses) continue;
            const burnDur = cp.burnDuration || 7200;
            for (const h of cp.houses) {
                if (h.burning && !h.ruin) {
                    const elapsed = this.time - h.burnStart;
                    if (elapsed >= burnDur) {
                        h.burning = false;
                        h.ruin = true;
                    }
                }
            }
        }
    }

    getRepairCostPer1Pct(level) {
        const lvl = Number(level) || 0;
        if (lvl <= 1) return 3;
        if (lvl === 2) return 5;
        return 10;
    }

    updateDefenseRepair() {
        for (const cp of this.cps) {
            if (!cp.repairDefense) continue;
            if (cp.owner !== this.faction) { cp.repairDefense = false; continue; }

            this.refreshCityDefenseHp(cp);
            const maxHp = cp._defMaxHp || 0;

            const hasBrokenHouses = cp.houses && cp.houses.some(h => h.ruin || h.destroyed || h.hp < h.maxHp);
            if (cp.defenseHp >= maxHp && !hasBrokenHouses) {
                cp.repairDefense = false;
                this.notify?.(`${cp.name}: оборона и город полностью восстановлены!`);
                continue;
            }

            if (this.time - (cp._lastRepairAt || 0) < this.REPAIR_INTERVAL) continue;
            cp._lastRepairAt = this.time;

            const constructionTrucks = this.units.filter(u =>
                u.faction === cp.owner &&
                u.type === 'construction_truck' &&
                u.hp > 0 &&
                dist(u.x, u.y, cp.x, cp.y) <= cp.radius
            );

            let speedMultiplier = 1;
            let requiredMaterials = 0;

            if (constructionTrucks.length >= 2) {
                speedMultiplier = 3;
                requiredMaterials = 3;
            } else if (constructionTrucks.length === 1) {
                speedMultiplier = 2;
                requiredMaterials = 1;
            }

            const baseCost = this.getRepairCostPer1Pct(cp.defenseLevel || 0);
            const actualCost = baseCost * speedMultiplier;

            if (this.res.s < actualCost) {
                this.notify?.(`Не хватает материалов для ремонта (${cp.name})`);
                continue;
            }
            this.res.s -= actualCost;

            if (requiredMaterials > 0) {
                let materialsNeeded = requiredMaterials;
                for (const truck of constructionTrucks) {
                    if (materialsNeeded <= 0) break;
                    const take = Math.min(truck.currentCargo, materialsNeeded);
                    truck.currentCargo -= take;
                    materialsNeeded -= take;
                }
                if (materialsNeeded > 0) {
                    speedMultiplier = 1;
                    this.notify?.(`Строймашины в ${cp.name} исчерпали запас!`);
                }
            }

            if (cp.defenseHp < maxHp && maxHp > 0) {
                const onePct = Math.max(1, Math.floor(maxHp * 0.01));
                cp.defenseHp = Math.min(maxHp, cp.defenseHp + onePct * speedMultiplier);
            }

            if (hasBrokenHouses) {
                const houseToFix = cp.houses.find(h => h.ruin)
                                || cp.houses.find(h => h.destroyed)
                                || cp.houses.find(h => h.hp < h.maxHp);
                if (houseToFix) {
                    if (houseToFix.ruin || houseToFix.destroyed) {
                        houseToFix.hp = houseToFix.maxHp;
                        houseToFix.ruin = false;
                        houseToFix.destroyed = false;
                        houseToFix.burning = false;
                    } else {
                        houseToFix.hp = Math.min(houseToFix.maxHp, houseToFix.hp + houseToFix.maxHp * (0.5 * speedMultiplier));
                    }
                }
            }
        }
    }

    spawnCorpse(u) {
        if (!u || !Number.isFinite(u.x) || !Number.isFinite(u.y)) return;
        const isInf = isInfUnit(u);
        const lifetime = isInf ? CORPSE_LIFETIME.infantry : CORPSE_LIFETIME.vehicle;
        this.corpses.push({
            x: u.x,
            y: u.y,
            type: u.type,
            faction: u.faction,
            direction: u.direction || 0,
            size: u.size || (isInf ? 8 : 20),
            label: u.label || '',
            isInfantry: isInf,
            isArtillery: u.isArtillery === true,
            isMortar: u.isMortar === true,
            bornAt: this.time,
            lifetime,
        });
    }

    update() {
        if (this.over) return;
        try {
            this.updateInner();
        } catch (err) {
            console.error('[GAME][ERROR] Ошибка игрового цикла:', err);
        }
    }

    updateInner() {
        this.sanitizeAllPositions();
        this.time++;

        const spd = 7;
        if (this.keys?.['w'] || this.keys?.['arrowup']) this.cam.y -= spd;
        if (this.keys?.['s'] || this.keys?.['arrowdown']) this.cam.y += spd;
        if (this.keys?.['a'] || this.keys?.['arrowleft']) this.cam.x -= spd;
        if (this.keys?.['d'] || this.keys?.['arrowright']) this.cam.x += spd;

        const mapW = 3000, mapH = 2250;
        this.cam.x = Math.max(0, Math.min(mapW - window.innerWidth, this.cam.x));
        this.cam.y = Math.max(0, Math.min(mapH - window.innerHeight, this.cam.y));

        const pts = this.cps.filter(c => c.owner === this.faction).length;
        const modeMultiplier = getModeFlags(this).farmMultiplier(this.time);
        this.farmMult = modeMultiplier;
        this.res.s += pts * 0.03 * modeMultiplier;
        this.res.c += pts * 0.015 * modeMultiplier;
        this.res.m += pts * 0.01 * modeMultiplier;

        this.updateProduction();
        this.updateConstruction();
        this.updateReveal();
        this.updateBoost();
        this.updateVisibility();
        this.updateUnits();

        this.units = this.units.filter(u => {
            if (u.hp > 0) return true;

            const turretlessTypes = [
                'noble_widow', 'niska', 'niska_blinder', 'javelin', 'hoplite',
                'warden_artillery120', 'warden_artillery150',
                'colonial_artillery120', 'colonial_artillery150', 'god_loader'
            ];
            const hasTurret = !turretlessTypes.includes(u.type);

            const currentTurrets = this.debris.filter(d => d.type === 'turret').length;
            if (!isInfUnit(u) && hasTurret && u.lastHitDmg >= u.maxHp * 0.4 && currentTurrets < 60) {
                const angle = Math.random() * Math.PI * 2;
                const distVal = 15 + Math.random() * 25;
                this.debris.push({
                    type: 'turret',
                    x: u.x, y: u.y,
                    vx: Math.cos(angle) * (distVal / 30),
                    vy: Math.sin(angle) * (distVal / 30),
                    angle: u.turretDirection || u.direction || 0,
                    rot: 0,
                    life: 999999, maxLife: 999999,
                    faction: u.faction,
                    size: u.size
                });
                this.addParticles(u.x, u.y, '#ff8800', 15);
                this.addParticles(u.x, u.y, '#ffcc00', 10);
            }

            if (u.type.includes('artillery') && u.type !== 'hoplite' && u.type !== 'devitt_mmr') {
                this.debris.push({ type: 'explosion', x: u.x, y: u.y, life: 60, maxLife: 60 });
                const numDebris = 5 + Math.floor(Math.random() * 8);
                for (let i = 0; i < numDebris; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const r = Math.random() * 25;
                    this.debris.push({
                        type: 'fire_debris',
                        x: u.x + Math.cos(a) * r,
                        y: u.y + Math.sin(a) * r,
                        vx: Math.cos(a) * (Math.random() * 0.8),
                        vy: Math.sin(a) * (Math.random() * 0.8),
                        angle: Math.random() * Math.PI * 2,
                        rot: (Math.random() - 0.5) * 0.3,
                        life: 600, maxLife: 600,
                        size: 2 + Math.random() * 3
                    });
                }
                this.addParticles(u.x, u.y, '#ff0000', 20);
                this.addParticles(u.x, u.y, '#f97316', 20);
            }

            if (!u._corpseSpawned) {
                this.spawnCorpse(u);
                u._corpseSpawned = true;
            }
            return false;
        });
        this.buildings = this.buildings.filter(b => b.hp > 0);

        this.updateCapturePoints();
        this.enforceCityZoneBoundaries();
        this.updateMines();
        this.updateUnitLimits();

        if (this.aiController) this.aiController.update();

        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life--;
            return p.life > 0;
        });

        this.debris = this.debris.filter(d => {
            if (Math.abs(d.vx) > 0.01 || Math.abs(d.vy) > 0.01) {
                d.x += d.vx;
                d.y += d.vy;
                d.vx *= 0.96;
                d.vy *= 0.96;
            }
            d.rot = 0;

            if (d.type === 'turret') {
                d.life = (d.life || 0) - 1;
                if (d.life < 0) return false;
                if (d.x < -500 || d.x > 3500 || d.y < -500 || d.y > 2750) return false;
                return true;
            }
            d.life--;
            return d.life > 0;
        });

        this.corpses = this.corpses.filter(c => this.time - c.bornAt < c.lifetime);
        this.updateCityFires();
        this.updateDefenseRepair();
        this.updateCityFiresAndDamage();
        this.updateTracers();
        this._updateRockets();
        this.checkWinCondition();
    }

    REPAIR_INTERVAL = 180;
    DEFENSE_INTEGRITY_MULT = 3;

    getCityDefenseMaxIntegrity(cp) {
        if (!cp || cp.owner === 'neutral') return 0;
        let maxHp = 0;
        this.buildings.forEach(b => {
            if (b.faction === cp.owner && b.type && b.type.startsWith('bunker_')) {
                if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80) {
                    maxHp += Math.max(0, b.maxHp || b.hp || 0);
                }
            }
        });
        const stats = this.getTerritoryDefenseStats(cp.defenseLevel || 0);
        maxHp += stats.hp;
        return maxHp * this.DEFENSE_INTEGRITY_MULT;
    }

    updateCityFiresAndDamage() {
        for (const cp of this.cps) {
            if (!cp.houses) continue;
            const burningHouses = cp.houses.filter(h => h.burning);
            if (burningHouses.length === 0) continue;

            const fireTrucks = this.units.filter(u =>
                u.faction === cp.owner &&
                u.type === 'fire_truck' &&
                u.hp > 0 &&
                dist(u.x, u.y, cp.x, cp.y) <= cp.radius
            );

            if (fireTrucks.length > 0) {
                for (const truck of fireTrucks) {
                    if (truck.currentCargo >= 5) {
                        const houseToExtinguish = cp.houses.find(h => h.burning && !h.ruin);
                        if (houseToExtinguish) {
                            houseToExtinguish.burning = false;
                            if (houseToExtinguish.hp <= 0) houseToExtinguish.hp = 1;
                            truck.currentCargo -= 5;
                        }
                    }
                }
            }

            if (this.time % 100 === 0) {
                const unitsInCity = this.units.filter(u =>
                    u.hp > 0 && dist(u.x, u.y, cp.x, cp.y) <= cp.radius
                );
                for (const u of unitsInCity) {
                    u.hp -= 2;
                    if (Math.random() < 0.5) this.addParticles(u.x, u.y, '#ef4444', 2);
                }
            }
        }
    }

    refreshCityDefenseHp(cp) {
        if (!cp || cp.owner === 'neutral') return;
        const maxNow = this.getCityDefenseMaxIntegrity(cp);
        if (cp.defenseHp === undefined || cp.defenseHp === null) {
            cp.defenseHp = maxNow;
            cp._defRebuilt = false;
        } else if (cp._defMaxHp === undefined || maxNow !== cp._defMaxHp) {
            const delta = maxNow - (cp._defMaxHp || 0);
            if (cp._defRebuilt) {
                cp._defRebuilt = false;
            } else {
                cp.defenseHp = Math.min(maxNow, Math.max(0, cp.defenseHp + Math.max(0, delta)));
            }
            cp._defMaxHp = maxNow;
        }
    }

    getCityDefenseIntegrity(cp) {
        if (!cp || cp.owner === 'neutral') return 0;
        if (cp.defenseHp === undefined || cp.defenseHp === null) this.refreshCityDefenseHp(cp);
        return Math.max(0, cp.defenseHp);
    }

    damageCityDefense(cp, dmg, fromX, fromY) {
        if (!cp || cp.owner === 'neutral') return 0;
        const d = Number(dmg);
        if (!Number.isFinite(d) || d <= 0) return 0;
        if (cp.defenseHp === undefined || cp.defenseHp === null) this.refreshCityDefenseHp(cp);
        cp.defenseHp = Math.max(0, (cp.defenseHp || 0) - d);
        this.damageCityHouses(cp, Math.max(1, Math.floor(d * 0.3)), fromX, fromY);
        if (Number.isFinite(fromX) && Number.isFinite(fromY)) {
            this.addTracer(fromX, fromY, cp.x, cp.y, 'artillery');
        }
        this.addParticles(cp.x, cp.y, '#ff6b00', 8);
        if (cp.defenseHp <= 0 && !cp._defenseBrokenNotified) {
            cp._defenseBrokenNotified = true;
            this.notify?.(`${cp.name}: оборона сломлена! Город можно захватить.`);
        }
        return cp.defenseHp;
    }

    getOwningCpIndexForBuilding(b) {
        for (let i = 0; i < this.cps.length; i++) {
            const cp = this.cps[i];
            if (cp.owner === 'neutral' || cp.owner !== b.faction) continue;
            if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80) return i;
        }
        return -1;
    }

    isPointDefenseActive(cp) { return this.getCityDefenseIntegrity(cp) > 0; }

    registerCityEnterGuard(cpIndex, newOwner) {
        if (!this.cityEnterGuard) this.cityEnterGuard = new Map();
        const cp = this.cps[cpIndex];
        if (!cp) return;
        const units = new Set();
        const buildings = new Set();
        for (const u of this.units) {
            if (u.faction !== newOwner || u.hp <= 0) continue;
            if (dist(u.x, u.y, cp.x, cp.y) <= cp.radius) units.add(u.id);
        }
        for (const b of this.buildings) {
            if (b.faction !== newOwner || !(b.hp > 0)) continue;
            if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius) buildings.add(b.id);
        }
        if (units.size || buildings.size) {
            this.cityEnterGuard.set(newOwner + '|' + cpIndex, {
                tick: this.time, units, buildings,
            });
        }
    }

    hasCityEnterGuard(unit, cpIndex) {
        const g = this.cityEnterGuard && this.cityEnterGuard.get(unit.faction + '|' + cpIndex);
        if (!g) return false;
        if (!g.units.has(unit.id)) return false;
        const cp = this.cps[cpIndex];
        if (cp && dist(unit.x, unit.y, cp.x, cp.y) <= cp.radius) {
            g.tick = this.time;
            return true;
        }
        return (this.time - g.tick) < 120;
    }

    isCityZoneBlockedFor(x, y, unit) {
        for (let i = 0; i < this.cps.length; i++) {
            const cp = this.cps[i];
            if (cp.owner === 'neutral' || cp.owner === unit.faction) continue;
            const d = dist(x, y, cp.x, cp.y);
            if (!Number.isFinite(d)) continue;
            if (d <= cp.radius && this.getCityDefenseIntegrity(cp) > 0) {
                if (this.hasCityEnterGuard(unit, i)) continue;
                return true;
            }
        }
        return false;
    }

    isCityDefenseBroken(cp) { return this.getCityDefenseIntegrity(cp) <= 0; }

    getCityZoneExitTarget(u, cp) {
        const dx = u.x - cp.x, dy = u.y - cp.y;
        const d = Math.hypot(dx, dy);
        if (!Number.isFinite(d)) return null;
        let nx = dx, ny = dy;
        if (d < 1) { nx = 1; ny = 0; } else { nx /= d; ny /= d; }
        return { x: cp.x + nx * (cp.radius + 6), y: cp.y + ny * (cp.radius + 6) };
    }

    enforceCityZoneBoundaries() {
        for (const u of this.units) {
            if (u.hp <= 0) continue;
            if (isInfUnit(u)) continue;
            for (let i = 0; i < this.cps.length; i++) {
                const cp = this.cps[i];
                if (cp.owner === 'neutral' || cp.owner === u.faction) continue;
                if (this.getCityDefenseIntegrity(cp) <= 0) continue;
                if (this.hasCityEnterGuard(u, i)) continue;
                const dx = u.x - cp.x, dy = u.y - cp.y;
                const d = Math.hypot(dx, dy);
                if (!Number.isFinite(d)) break;
                if (d <= cp.radius) {
                    const exit = this.getCityZoneExitTarget(u, cp);
                    if (!exit) break;
                    const step = Math.max(2, (u.spd || 1) * 2);
                    const ed = dist(u.x, u.y, exit.x, exit.y);
                    if (ed <= step) {
                        u.x = exit.x;
                        u.y = exit.y;
                    } else {
                        u.x += (exit.x - u.x) / ed * step;
                        u.y += (exit.y - u.y) / ed * step;
                    }
                    if (u.tx !== undefined && this.isCityZoneBlockedFor(u.tx, u.ty, u)) {
                        u.tx = undefined; u.ty = undefined;
                        u.detourSide = undefined; u.detourTicks = undefined;
                        u.orderOrigin = undefined;
                    }
                    break;
                }
            }
        }
    }

    updateUnits() {
        if (this.aiController && typeof this.aiController.makeRetreatDecisions === 'function') {
            this.aiController.makeRetreatDecisions();
        }
        this.units.forEach(u => {
            try {
                this.updateUnit(u);
            } catch (err) {
                console.error('[GAME][ERROR] Ошибка обновления юнита ' + (u.type || '?') + '/' + (u.id || '?') + ':', err);
            }
        });
    }

    updateUnit(u) {
        if (u.hp <= 0) return;

        if (!u.aoe && !u.retreatToBase && u.tx === undefined &&
            u.canAttack && u.canMove &&
            (!u.canAttack() || !u.canMove())) {
            const home = this.buildings.find(b =>
                b.faction === u.faction && b.type === 'town_hall' && b.hp > 0);
            if (home) {
                u.tx = home.x + (Math.random() - 0.5) * 80;
                u.ty = home.y + (Math.random() - 0.5) * 80;
                u.supplyReturn = true;
            }
        }

        u.gameTime = this.time;

        if (u.holdPosition && u.hp >= (u.maxHp || 100) * 0.5) {
            u.holdPosition = false;
            u.retreatDecisionAt = undefined;
        }

        if (u.retreatToBase && dist(u.x, u.y, u.tx, u.ty) <= 15) {
            u.retreatToBase = false;
        }

        if (u.aoe && u.tx !== undefined) {
            if (!Number.isFinite(u.tx) || !Number.isFinite(u.ty)) {
                u.tx = undefined; u.ty = undefined;
                u.detourSide = undefined; u.detourTicks = undefined;
                u.orderOrigin = undefined;
                u.retreatOrder = null; u.moveOrder = null;
            } else {
                const dToOrder = dist(u.x, u.y, u.tx, u.ty);
                if (dToOrder < 10) {
                    u.tx = undefined;
                    u.ty = undefined;
                    u.detourSide = undefined;
                    u.detourTicks = undefined;
                    u.stuckCounter = 0;
                    if (u.retreatOrder) u.retreatOrder = null;
                    if (u.moveOrder) u.moveOrder = null;
                }
            }
        }

        const isInBase = this.buildings.some(b =>
            b.faction === u.faction &&
            b.type === 'town_hall' &&
            dist(u.x, u.y, b.x, b.y) < SUPPLY_SYSTEM.baseSupplyRadius
        );
        if (isInBase) {
            if (u.regenerateAtBase) u.regenerateAtBase(this.time);
            if (u.replenishAtBase) u.replenishAtBase(this.time);
            if (u.supplyReturn && u.canAttack && u.canMove &&
                u.canAttack() && u.canMove()) {
                u.supplyReturn = false;
                u.tx = undefined;
                u.ty = undefined;
            }
        }

        if (u.type === 'truck' || u.type === 'fuel_truck' || u.type === 'engineer' ||
            u.type === 'flatbed' || u.type === 'medic_truck') {
            this.handleLogistics(u);
        }

        if (u.isMedic && u.hp > 0) {
            if (this.time - u.lastHealTime >= u.healInterval) {
                let target = null;
                let minDist = u.healRange;
                for (const ally of this.units) {
                    if (ally.faction === u.faction && ally.hp > 0 && isInfUnit(ally) && ally.hp < ally.maxHp) {
                        const d = dist(u.x, u.y, ally.x, ally.y);
                        if (d < minDist) { minDist = d; target = ally; }
                    }
                }
                if (target) {
                    const healAmount = Math.min(u.healRate * u.healInterval, target.maxHp - target.hp);
                    target.hp += healAmount;
                    u.lastHealTime = this.time;
                    this.addParticles(target.x, target.y, '#22c55e', 2);
                }
            }
        }

        // ===== ПОИСК ЦЕЛИ (С УЧЁТОМ ТУМАНА) =====
        let nearest = null, nearDist = Infinity;
        const fogEnabled = this.fogEnabled;
        const visibleSet = this.visibleEnemyIds;

        this.units.forEach(e => {
            if (e.faction !== u.faction && e.hp > 0) {
                if (fogEnabled) {
                    if (u.faction === this.faction) {
                        const isVisible = visibleSet && visibleSet.has(e.id);
                        const canArtySee = u.aoe && e._lastKnownPos && (this.time - e._lastKnownPos.time < 300);
                        if (!isVisible && !canArtySee) return;
                    } else {
                        if (!this.unitDetectsEnemy(u, e)) {
                            const canArtySee = u.aoe && e._lastKnownPos && (this.time - e._lastKnownPos.time < 300);
                            if (!canArtySee) return;
                        }
                    }
                }
                const d = dist(u.x, u.y, e.x, e.y);
                if (d < nearDist) { nearDist = d; nearest = e; }
            }
        });

        this.buildings.forEach(b => {
            if (b.faction !== u.faction && b.hp > 0) {
                if (fogEnabled) {
                    if (u.faction === this.faction) {
                        if (!visibleSet || !visibleSet.has(b.id)) return;
                    } else {
                        if (!this.factionCanSee(u.faction, b)) return;
                    }
                }
                const d = dist(u.x, u.y, b.x, b.y);
                if (d < nearDist) { nearDist = d; nearest = b; }
            }
        });

        let attackTarget = null;
        let canAttack = false;

        // ===== РСЗО: специальная логика залпа =====
        if (u.isRSZO) {
            if (u.aoeTarget && !u._rocketQueue) {
                if (u.canAttack()) {
                    const targetDist = dist(u.x, u.y, u.aoeTarget.x, u.aoeTarget.y);
                    const minR = u.minRange || 100;
                    if (targetDist >= minR && targetDist <= u.range) {
                        u._volleyStartAt = this.time;
                        u.lastAtk = this.time;      // фиксируем момент залпа → работает КД
                        this._issueRocketVolley(u);
                    }
                }
            }
            if (u._rocketQueue) {
                this._updateRocketVolley(u);
                u.tx = undefined;
                u.ty = undefined;
            }
        }
        else if (u.aoe && u.aoeTarget) {
            const targetDist = dist(u.x, u.y, u.aoeTarget.x, u.aoeTarget.y);
            const minRange = u.minRange || 100;
            if (targetDist >= minRange && targetDist <= u.range) {
                const spread = 30;
                const randomX = u.aoeTarget.x + (Math.random() - 0.5) * spread;
                const randomY = u.aoeTarget.y + (Math.random() - 0.5) * spread;
                attackTarget = { x: randomX, y: randomY };
                canAttack = true;
                if (u.shotsFired === undefined) u.shotsFired = 0;
            } else if (targetDist < minRange) {
                if (!u.retreatOrder && u.tx === undefined && !u.holdPosition) {
                    const retreatAngle = Math.atan2(u.y - u.aoeTarget.y, u.x - u.aoeTarget.x);
                    u.retreatOrder = { x: u.x + Math.cos(retreatAngle) * (minRange + 60), y: u.y + Math.sin(retreatAngle) * (minRange + 60) };
                    u.tx = u.retreatOrder.x;
                    u.ty = u.retreatOrder.y;
                }
                u.aoeTarget = null;
                u.shotsFired = 0;
            }
        } else if (nearest && nearest.hp > 0) {
            const targetDist = dist(u.x, u.y, nearest.x, nearest.y);
            const minRange = u.minRange || 0;
            if (targetDist <= u.range && targetDist >= minRange && u.dmg > 0 && u.cd > 0) {
                attackTarget = nearest;
                canAttack = true;
            } else if (targetDist < minRange && u.aoe) {
                if (u.aoeTarget && !u.retreatOrder && u.tx === undefined && !u.holdPosition) {
                    const retreatAngle = Math.atan2(u.y - u.aoeTarget.y, u.x - u.aoeTarget.x);
                    u.retreatOrder = { x: u.x + Math.cos(retreatAngle) * (minRange + 60), y: u.y + Math.sin(retreatAngle) * (minRange + 60) };
                    u.tx = u.retreatOrder.x;
                    u.ty = u.retreatOrder.y;
                }
            }
        }

        let isAttacking = false;
        if (canAttack && attackTarget) {
            const timeSinceLastAttack = this.time - u.lastAtk;
            if (timeSinceLastAttack >= u.cd) {
                if (!u.canAttack || u.canAttack()) {
                    isAttacking = true;
                    u.lastAtk = this.time;
                    if (u.useAmmo) u.useAmmo();

                    if (u.aoe && u.aoeRadius && !u.isRSZO) {
                        this.addTracer(u.x, u.y, attackTarget.x, attackTarget.y, 'artillery');

                        this.units.forEach(enemy => {
                            if (enemy.faction !== u.faction && enemy.hp > 0) {
                                const distToTarget = dist(attackTarget.x, attackTarget.y, enemy.x, enemy.y);
                                if (distToTarget <= u.aoeRadius) {
                                    const damageMultiplier = 1 - (distToTarget / u.aoeRadius) * 0.5;
                                    enemy.takeDamage(Math.floor(u.dmg * damageMultiplier), u, this);
                                }
                            }
                        });

                        this.addParticles(attackTarget.x, attackTarget.y, '#ff6b00', 20);
                        this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 15);
                        this.addParticles(attackTarget.x, attackTarget.y, '#ff0000', 10);

                        for (let ci = 0; ci < this.cps.length; ci++) {
                            const cp = this.cps[ci];
                            if (cp.owner === 'neutral' || cp.owner === u.faction) continue;
                            const dCp = dist(attackTarget.x, attackTarget.y, cp.x, cp.y);
                            if (dCp <= u.aoeRadius + cp.radius * 0.4) {
                                const falloff = Math.max(0.25, 1 - (dCp / (cp.radius + u.aoeRadius)) * 0.5);
                                this.damageCityDefense(cp, Math.floor(u.dmg * falloff), u.x, u.y);
                            }
                        }

                        this.buildings.forEach(b => {
                            if (b.faction === u.faction || !(b.hp > 0)) return;
                            const dB = dist(attackTarget.x, attackTarget.y, b.x, b.y);
                            if (dB > u.aoeRadius) return;
                            const mult = 1 - (dB / u.aoeRadius) * 0.5;
                            const dmgB = Math.floor(u.dmg * mult);
                            const cbi = this.getOwningCpIndexForBuilding(b);
                            if (cbi >= 0) {
                                b.hp = Math.max(0, b.hp - dmgB);
                                this.damageCityDefense(this.cps[cbi], dmgB, u.x, u.y);
                            } else {
                                b.hp -= dmgB;
                            }
                        });

                        if (u.shotsFired === undefined) u.shotsFired = 0;
                        u.shotsFired++;

                        const isGodLoader = u.type === 'god_loader' || /god\s*loader/i.test(u.label || '');
                        if (isGodLoader || u.shotsFired >= 5) {
                            u.aoeTarget = null;
                            u.shotsFired = 0;
                        }
                    } else {
                        if (typeof attackTarget.takeDamage !== 'function') {
                            if (attackTarget.hp > 0 && Number.isFinite(attackTarget.x)) {
                                let dmgB = Math.floor(u.dmg);
                                if (u.antiInfantry && !isInfUnit(attackTarget)) {
                                    dmgB = Math.max(1, Math.floor(dmgB * 0.25));
                                }
                                attackTarget.hp = Math.max(0, attackTarget.hp - dmgB);
                                const ci = this.getOwningCpIndexForBuilding(attackTarget);
                                if (ci >= 0) this.damageCityDefense(this.cps[ci], dmgB, u.x, u.y);
                                this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 4);
                            }
                        } else {
                            let tracerType = 'bullet';
                            if (u.type === 'warden_artillery' || u.type === 'colonial_artillery') {
                                tracerType = 'shell';
                            } else if (u.type === 'silverhand') {
                                tracerType = 'shell';
                            } else if (u.type === 'nemesis' && u.grenadeLauncher) {
                                tracerType = 'grenade';
                            }

                            this.addTracer(u.x, u.y, attackTarget.x, attackTarget.y, tracerType);

                            let damage = u.dmg;
                            damage = getUnitAttackDamage(u, attackTarget, damage);

                            if (u.antiInfantry && isInfUnit(attackTarget)) {
                                damage *= u.infantryMultiplier || 2.5;
                            }

                            if (u.dualGun) {
                                attackTarget.takeDamage(damage, u, this);
                                if (attackTarget.hp > 0) {
                                    attackTarget.takeDamage(Math.floor(damage * 0.7), u, this);
                                }
                            }

                            if (u.grenadeLauncher && isInfUnit(attackTarget)) {
                                this.units.forEach(enemy => {
                                    if (enemy.faction !== u.faction && enemy.hp > 0 && isInfUnit(enemy)) {
                                        const distToTarget = dist(attackTarget.x, attackTarget.y, enemy.x, enemy.y);
                                        if (distToTarget <= (u.grenadeRadius || 40)) {
                                            enemy.takeDamage(Math.floor(damage * 0.6), u, this);
                                        }
                                    }
                                });
                                this.addParticles(attackTarget.x, attackTarget.y, '#9c27b0', 8);
                            }

                            attackTarget.takeDamage(damage, u, this);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 4);
                        }
                    }
                }
            }
        }

        if (isAttacking && attackTarget && Number.isFinite(attackTarget.x)) {
            for (const hcp of this.cps) {
                if (hcp.owner === 'neutral') continue;
                if (dist(hcp.x, hcp.y, attackTarget.x, attackTarget.y) <= hcp.radius + 40) {
                    this.damageCityHouses(hcp, 4, u.x, u.y);
                }
            }
        }
        if (isAttacking && u.tx === undefined) {
            u.stuckCounter = 0;
            if (!Number.isFinite(u.lastX) || !Number.isFinite(u.lastY)) {
                u.lastX = Number.isFinite(u.x) ? u.x : undefined;
                u.lastY = Number.isFinite(u.y) ? u.y : undefined;
            }
        }

        if (!isAttacking && u.aoe && u.tx !== undefined) {
            if (!Number.isFinite(u.tx) || !Number.isFinite(u.ty)) {
                u.tx = undefined; u.ty = undefined;
                u.detourSide = undefined; u.detourTicks = undefined;
                u.orderOrigin = undefined;
                if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                    u.lastX = u.x;
                    u.lastY = u.y;
                }
            } else {
                if (u.aoeTarget) {
                    const dShot = dist(u.x, u.y, u.aoeTarget.x, u.aoeTarget.y);
                    if (dShot < (u.minRange || 100) - 10 || dShot > u.range) {
                        u.aoeTarget = null;
                        u.retreatOrder = null;
                    }
                }
                const dA = dist(u.x, u.y, u.tx, u.ty);
                if (dA > 5) {
                    if (u.canMove && !u.canMove()) {
                        u.tx = undefined; u.ty = undefined;
                    } else {
                        const step = Math.min(dA, (u.spd || 1) * 2);
                        const nx = u.x + (u.tx - u.x) / dA * step;
                        const ny = u.y + (u.ty - u.y) / dA * step;
                        if (!this.isBlockedForVehicle(nx, ny, u)) {
                            u.direction = Math.atan2(ny - u.y, nx - u.x);
                            u.x = nx; u.y = ny;
                            if (u.useFuel) u.useFuel();
                        } else {
                            const side = u.detourSide ?? (u.detourSide = Math.random() > 0.5 ? 1 : -1);
                            const toGoal = Math.atan2(u.ty - u.y, u.tx - u.x);
                            const a = toGoal + side * Math.PI / 4;
                            const bx = u.x + Math.cos(a) * step, by = u.y + Math.sin(a) * step;
                            if (!this.isBlockedForVehicle(bx, by, u)) {
                                u.direction = a;
                                u.x = bx; u.y = by;
                                if (u.useFuel) u.useFuel();
                            }
                        }
                    }
                } else {
                    u.tx = undefined; u.ty = undefined; u.detourSide = undefined;
                    u.detourTicks = undefined;
                    u.orderOrigin = undefined;
                    u.moveOrder = null; u.retreatOrder = null;
                }
            }
        }

        if (!isAttacking && !u.aoe && u.tx !== undefined) {
            if (!Number.isFinite(u.tx) || !Number.isFinite(u.ty)) {
                u.tx = undefined; u.ty = undefined;
                u.detourSide = undefined; u.detourTicks = undefined;
                u.orderOrigin = undefined; u.stuckCounter = 0;
                if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                    u.lastX = u.x;
                    u.lastY = u.y;
                }
            } else {
                const d = dist(u.x, u.y, u.tx, u.ty);
                if (d > 5) {
                    if (u.canMove && !u.canMove()) {
                        u.tx = undefined;
                        u.ty = undefined;
                    } else {
                        const prevX = u.x, prevY = u.y;
                        if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                            u.lastX = u.x;
                            u.lastY = u.y;
                        } else if (!Number.isFinite(u.lastX) || !Number.isFinite(u.lastY)) {
                            u.lastX = undefined;
                            u.lastY = undefined;
                        }
                        if (u.stuckCounter === undefined) u.stuckCounter = 0;

                        const movedDist = dist(prevX, prevY, u.x, u.y);
                        if (!(movedDist > 0.5)) u.stuckCounter++;
                        else u.stuckCounter = 0;

                        if (u.stuckCounter > 30) {
                            if (u.orderOrigin === undefined) u.orderOrigin = { x: u.tx, y: u.ty };
                            if (u.detourSide === undefined) {
                                u.detourSide = ((u.id || '').toString().charCodeAt(0) % 2) ? 1 : -1;
                            }
                            u.detourTicks = 90;
                            u.stuckCounter = 0;
                        }

                        const effectiveSpeed = u.spd * this.getSpeedModifier(u);
                        const r = effectiveSpeed / d;
                        let nx = u.x + (u.tx - u.x) * r;
                        let ny = u.y + (u.ty - u.y) * r;

                        if (u.detourTicks && u.detourTicks > 0) {
                            u.detourTicks--;
                            const toGoalA = Math.atan2(u.ty - u.y, u.tx - u.x);
                            const a = toGoalA + u.detourSide * Math.PI / 4;
                            const ox = u.x + Math.cos(a) * effectiveSpeed;
                            const oy = u.y + Math.sin(a) * effectiveSpeed;
                            if (!this.isBlockedForVehicle(ox, oy, u) &&
                                !(u.aoe ? false : this.isCityZoneBlockedFor(ox, oy, u))) {
                                nx = ox; ny = oy;
                            } else {
                                const a2 = toGoalA - u.detourSide * Math.PI / 4;
                                const ox2 = u.x + Math.cos(a2) * effectiveSpeed;
                                const oy2 = u.y + Math.sin(a2) * effectiveSpeed;
                                if (!this.isBlockedForVehicle(ox2, oy2, u) &&
                                    !(u.aoe ? false : this.isCityZoneBlockedFor(ox2, oy2, u))) {
                                    nx = ox2; ny = oy2;
                                }
                            }
                        }

                        const blockedAhead = this.isBlockedForVehicle(nx, ny, u) ||
                            (u.aoe ? false : this.isCityZoneBlockedFor(nx, ny, u));
                        if (blockedAhead && !(u.detourTicks && u.detourTicks > 0)) {
                            if (u.detourSide === undefined) {
                                u.detourSide = ((u.id || '').toString().charCodeAt(0) % 2) ? 1 : -1;
                            }
                            const toGoalA = Math.atan2(u.ty - u.y, u.tx - u.x);
                            let found = false;
                            for (const s of [u.detourSide, -u.detourSide]) {
                                const a = toGoalA + s * Math.PI / 4;
                                const ox = u.x + Math.cos(a) * effectiveSpeed;
                                const oy = u.y + Math.sin(a) * effectiveSpeed;
                                if (!this.isBlockedForVehicle(ox, oy, u) &&
                                    !(u.aoe ? false : this.isCityZoneBlockedFor(ox, oy, u))) {
                                    nx = ox; ny = oy; found = true; break;
                                }
                            }
                            if (!found) u.stuckCounter = (u.stuckCounter || 0) + 5;
                        }

                        if (Number.isFinite(nx) && Number.isFinite(ny) &&
                            (nx !== u.x || ny !== u.y)) {
                            u.direction = Math.atan2(ny - u.y, nx - u.x);
                            u.x = nx;
                            u.y = ny;
                            if (u.useFuel) u.useFuel();
                        }

                        if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                            u.lastX = u.x;
                            u.lastY = u.y;
                        }
                    }
                } else {
                    u.tx = undefined;
                    u.ty = undefined;
                    u.detourSide = undefined;
                    u.detourTicks = undefined;
                    u.orderOrigin = undefined;
                    u.stuckCounter = 0;
                }
            }
        }

        this.applySeparation(u);
        this.sanitizeUnitPosition(u);
    }

    applySeparation(u) {
        if (u.hp <= 0) return;
        const hasOrder = (u.tx !== undefined) || !!u.retreatOrder || !!u.moveOrder;
        if (!hasOrder) return;
        const minGap = (u.aoe || isInfUnit(u)) ? 16 : 24;
        for (const o of this.units) {
            if (o === u || o.hp <= 0 || o.faction !== u.faction) continue;
            const dx = o.x - u.x, dy = o.y - u.y;
            const d = Math.hypot(dx, dy);
            if (d >= minGap || d < 0.001) continue;
            const push = (minGap - d) * 0.5;
            const nx = o.x + (dx / d) * push;
            const ny = o.y + (dy / d) * push;
            if (!this.isBlockedForVehicle(nx, ny, o) &&
                !this.isCityZoneBlockedFor(nx, ny, o)) { o.x = nx; o.y = ny; }
        }
    }

    getSafeRestoreAnchor(u) {
        const ok = (v) => Number.isFinite(v);
        const candidates = [];
        if (ok(u.lastX) && ok(u.lastY)) candidates.push({ x: u.lastX, y: u.lastY });
        const base = (this.cps && this.cps.find(cp => cp.owner === u.faction)) || null;
        if (base && ok(base.x) && ok(base.y)) candidates.push({ x: base.x, y: base.y });

        const isBadSpot = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
            const vehicleCheck = isInfUnit(u) ? false : this.isBlockedForVehicle(x, y, u);
            if (vehicleCheck) return true;
            for (let i = 0; i < this.cps.length; i++) {
                const cp = this.cps[i];
                if (cp.owner === 'neutral' || cp.owner === u.faction) continue;
                if (this.getCityDefenseIntegrity(cp) <= 0) continue;
                if (isInfUnit(u)) continue;
                if (dist(x, y, cp.x, cp.y) <= cp.radius + 8) return true;
            }
            return false;
        };

        if (ok(u.x) || ok(u.y)) {
            const cx = ok(u.x) ? u.x : (ok(u.lastX) ? u.lastX : 1000);
            const cy = ok(u.y) ? u.y : (ok(u.lastY) ? u.lastY : 1000);
            if (!isBadSpot(cx, cy)) return { x: cx, y: cy };
            for (let r = 20; r <= 160; r += 20) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                    if (!isBadSpot(x, y)) return { x, y };
                }
            }
        }

        if (!candidates.length) return null;

        for (const c of candidates) {
            if (!isBadSpot(c.x, c.y)) return c;
            const maxR = (c === candidates[0]) ? 160 : 40;
            for (let r = 20; r <= maxR; r += 20) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
                    if (!isBadSpot(x, y)) return { x, y };
                }
            }
        }
        return candidates[0];
    }

    sanitizeUnitPosition(u) {
        const ok = (v) => Number.isFinite(v);
        if (ok(u.x) && ok(u.y)) {
            const gap = ok(u.lastX) && ok(u.lastY)
                ? dist(u.x, u.y, u.lastX, u.lastY) : Infinity;
            if (!(gap <= 4)) {
                u.lastX = u.x;
                u.lastY = u.y;
            }
            return;
        }
        console.warn('[GAME][FIX] Повреждены координаты у ' + (u.type || '?') + '/' + (u.id || '?') + ' — позиция восстановлена');
        const anchor = this.getSafeRestoreAnchor(u);
        if (anchor) {
            u.x = anchor.x;
            u.y = anchor.y;
        } else if (this.cps && this.cps.length) {
            const cp = this.cps[0];
            u.x = cp.x;
            u.y = cp.y;
        } else {
            u.x = 1000;
            u.y = 1000;
        }
        u.tx = undefined;
        u.ty = undefined;
        u.orderOrigin = undefined;
        u.detourSide = undefined;
        u.detourTicks = undefined;
        u.stuckCounter = 0;
        u.retreatOrder = null;
        u.moveOrder = null;
        u.retreatToBase = false;
        u.supplyReturn = false;
        u.captureTarget = undefined;
        if (u.aoe && u.aoeTarget && (!ok(u.aoeTarget.x) || !ok(u.aoeTarget.y))) {
            u.aoeTarget = null;
            u.shotsFired = 0;
        }
        u.lastX = u.x;
        u.lastY = u.y;
    }

    sanitizeAllPositions() {
        for (const u of this.units) this.sanitizeUnitPosition(u);
        const ok = (v) => Number.isFinite(v);
        for (const b of this.buildings) {
            if (ok(b.x) && ok(b.y)) continue;
            const anchor = (this.cps && this.cps[0]) || { x: 1000, y: 1000 };
            b.x = ok(b.x) ? b.x : anchor.x;
            b.y = ok(b.y) ? b.y : anchor.y;
        }
    }

    // ===== ТУМАН ВОЙНЫ =====
    getUnitVisibilityRange(u) {
        if (!u) return 0;
        if (u.aoe || u.isArtillery || u.isMortar) return 100;
        return Math.round((u.range || 0) * 1.2);
    }

    getUnitDetectRange(u) {
        if (!u) return 0;
        if (Number.isFinite(u.detectRange)) return u.detectRange;
        if (isInfUnit(u)) return 80;
        return Math.round((u.range || 0) * 0.8);
    }

    getUnitStealth(u) {
        if (!u) return 0;
        if (Number.isFinite(u.stealth)) return u.stealth;
        return isInfUnit(u) ? 20 : 40;
    }

    isUnitInCover(u) {
        if (!u) return false;
        if (isInBush(u.x, u.y)) return true;
        return !!getConcealZoneAt(u.x, u.y);
    }

    isUnitMoving(u) {
        if (!u) return false;
        if (u.tx === undefined || u.ty === undefined) return false;
        return dist(u.x, u.y, u.tx, u.ty) > 5;
    }

    isUnitShooting(u) {
        if (!u) return false;
        return (this.time - (u.lastAtk || 0)) < 60;
    }

    getEffectiveStealth(u) {
        if (!u) return 0;
        let base = this.getUnitStealth(u);
        const inBush = this.isUnitInCover(u);
        const moving = this.isUnitMoving(u);
        const shooting = this.isUnitShooting(u);

        if (inBush) {
            if (shooting) base *= 1.5;
            else if (moving) base *= 4;
            else base *= 10;
        } else if (shooting) {
            base *= 0.25;
        }
        return base;
    }

    getMinDetectRadius(target) {
        if (!target) return 0;
        if (target.isScoutInfantry) {
            if (this.isUnitInCover(target) && !this.isUnitMoving(target)) return 5;
            return 50;
        }
        if (this.isUnitShooting(target)) return 40;
        if (this.isUnitInCover(target) && !this.isUnitMoving(target)) return 18;
        return 0;
    }

    unitDetectsEnemy(viewer, target) {
        if (!viewer || !target || viewer.hp <= 0 || target.hp <= 0) return false;
        if (viewer.faction === target.faction) return true;
        if (!this.fogEnabled) return true;

        const d = dist(viewer.x, viewer.y, target.x, target.y);
        if (!Number.isFinite(d)) return false;

        if (d <= VEHICLE_HARD_DETECT_RADIUS && isVehicleTarget(target)) return true;

        const detectRange = this.getUnitDetectRange(viewer);
        if (d > detectRange) return false;

        const stealth = this.getEffectiveStealth(target);
        const minDetect = this.getMinDetectRadius(target);

        let effectiveRange = detectRange - stealth;
        if (effectiveRange < minDetect) effectiveRange = minDetect;

        return d <= effectiveRange;
    }

    factionCanSee(faction, target) {
        if (!target || target.hp <= 0) return false;
        if (target.faction === faction) return true;
        if (!this.fogEnabled) return true;

        for (const cp of this.cps) {
            if (cp.owner !== faction) continue;
            let detectRadius = 70;
            if (cp.defenseLevel > 0) {
                const stats = this.getTerritoryDefenseStats(cp.defenseLevel);
                detectRadius = Math.max(detectRadius, stats.range);
            }
            if (dist(cp.x, cp.y, target.x, target.y) <= detectRadius) return true;
        }

        for (const b of this.buildings) {
            if (b.faction !== faction || b.hp <= 0) continue;
            if (dist(b.x, b.y, target.x, target.y) <= 400) return true;
        }

        for (const u of this.units) {
            if (u.faction !== faction || u.hp <= 0) continue;
            if (this.unitDetectsEnemy(u, target)) return true;
        }
        return false;
    }

    updateVisibility() {
        if (!this.fogEnabled) {
            this.visibleEnemyIds = null;
            this.visibleEnemyBuildings = null;
            return;
        }

        const setUnits = new Set();
        const setBuildings = new Set();
        const allyViewers = this.units.filter(u => u.faction === this.faction && u.hp > 0);

        for (const enemy of this.units) {
            if (enemy.faction === this.faction || enemy.hp <= 0) continue;
            let visible = false;
            for (const viewer of allyViewers) {
                if (this.unitDetectsEnemy(viewer, enemy)) { visible = true; break; }
            }
            if (!visible && this.factionCanSee(this.faction, enemy)) visible = true;
            if (visible) {
                setUnits.add(enemy.id);
                enemy._lastKnownPos = { x: enemy.x, y: enemy.y, time: this.time };
            }
        }

        for (const b of this.buildings) {
            if (b.faction === this.faction || !(b.hp > 0)) continue;
            if (this.factionCanSee(this.faction, b)) setBuildings.add(b.id);
        }

        this.visibleEnemyIds = setUnits;
        this.visibleEnemyBuildings = setBuildings;
    }

    getConcealDefenseBonus(unit) {
        if (!this.fogEnabled || !unit) return 0;
        if (!this.isUnitInCover(unit)) return 0;
        return isInfUnit(unit) ? 0.25 : 0.10;
    }

    getSpeedModifier(u) {
        const onRoad = this.isOnRoad(u.x, u.y);
        if (onRoad) {
            if (u.tracked) return 0.7;
            return 1.1;
        }
        if (u.tracked) return 1.0;
        return 0.7;
    }

    updateCapturePoints() {
        this.cps.forEach(cp => { if (cp.owner !== 'neutral') this.refreshCityDefenseHp(cp); });
        this.cps.forEach((cp, cpIndex) => {
            const pU = this.units.filter(u => u.faction === this.faction && dist(u.x, u.y, cp.x, cp.y) <= cp.radius);
            const aU = this.units.filter(u => u.faction === this.ai && dist(u.x, u.y, cp.x, cp.y) <= cp.radius);

            const defenseBroken = cp.owner === 'neutral' || this.isCityDefenseBroken(cp);

            if (pU.length > 0 && aU.length === 0 && cp.owner !== this.faction && defenseBroken) {
                cp.progress = Math.min(100, cp.progress + pU.length * 0.2);
                cp.capturing = this.faction;
                if (cp.progress >= 100) {
                    cp.owner = this.faction;
                    cp.defenseLevel = 0;
                    cp.defenseHp = 0;
                    cp._defRebuilt = true;
                    cp._defMaxHp = this.getCityDefenseMaxIntegrity(cp);
                    cp.repairDefense = false;
                    cp._defenseBrokenNotified = false;
                    this.registerCityEnterGuard(cpIndex, this.ai);
                    this.notify?.(cp.name + ' захвачен!');
                }
            } else if (aU.length > 0 && pU.length === 0 && cp.owner !== this.ai && defenseBroken) {
                cp.progress = Math.min(100, cp.progress + aU.length * 0.15);
                cp.capturing = this.ai;
                if (cp.progress >= 100) {
                    cp.owner = this.ai;
                    cp.defenseLevel = 0;
                    cp.defenseHp = 0;
                    cp._defRebuilt = true;
                    cp._defMaxHp = this.getCityDefenseMaxIntegrity(cp);
                    cp.repairDefense = false;
                    cp._defenseBrokenNotified = false;
                    this.registerCityEnterGuard(cpIndex, this.faction);
                }
            } else {
                cp.capturing = null;
            }
        });
    }

    updateMines() {
        this.mines.forEach(mine => {
            const pU = this.units.filter(u => u.faction === this.faction && dist(u.x, u.y, mine.x, mine.y) <= mine.radius);
            const aU = this.units.filter(u => u.faction === this.ai && dist(u.x, u.y, mine.x, mine.y) <= mine.radius);

            if (pU.length > 0 && aU.length === 0 && mine.owner !== this.faction) {
                mine.progress = Math.min(100, mine.progress + pU.length * 0.3);
                if (mine.progress >= 100) {
                    mine.owner = this.faction;
                    this.notify?.(mine.name + ' захвачена!');
                }
            } else if (aU.length > 0 && pU.length === 0 && mine.owner !== this.ai) {
                mine.progress = Math.min(100, mine.progress + aU.length * 0.2);
                if (mine.progress >= 100) mine.owner = this.ai;
            }
        });

        this.mines.forEach(mine => {
            if (mine.owner === this.faction) {
                if (mine.type === 'supplies') this.res.s += 0.05;
                if (mine.type === 'components') this.res.c += 0.03;
                if (mine.type === 'materials') this.res.m += 0.03;
            }
        });
    }

    updateUnitLimits() {
        const playerPoints = this.cps.filter(c => c.owner === this.faction).length;
        const aiPoints = this.cps.filter(c => c.owner === this.ai).length;

        this.unitLimits.infantry = 20 + playerPoints * 3;
        this.unitLimits.vehicles = 10 + playerPoints * 2;
        this.unitLimits.combatVehicles = this.unitLimits.vehicles;
        this.unitLimits.logistics = 10;

        this.aiUnitLimits = {
            infantry: 20 + aiPoints * 3,
            vehicles: 10 + aiPoints * 2,
            combatVehicles: 10 + aiPoints * 2,
            logistics: 7,
        };
    }

    getIncomePerSec() {
        const pts = this.cps.filter(c => c.owner === this.faction).length;
        const mult = this.farmMult ?? 1;
        let mineS = 0, mineC = 0, mineM = 0;
        for (const mine of this.mines) {
            if (mine.owner !== this.faction) continue;
            if (mine.type === 'supplies') mineS += 0.05;
            if (mine.type === 'components') mineC += 0.03;
            if (mine.type === 'materials') mineM += 0.03;
        }
        return {
            s: (pts * 0.03 + mineS) * mult,
            c: (pts * 0.015 + mineC) * mult,
            m: (pts * 0.01 + mineM) * mult,
        };
    }

    canProduceUnit(type, faction) {
        const flags = getModeFlags(this);
        if (!flags.allowUnit(type)) return false;

        const limits = faction === this.faction ? this.unitLimits : this.aiUnitLimits;
        const LOG_TYPES = ['truck', 'fuel_truck', 'engineer', 'flatbed', 'medic_truck', 'construction_truck', 'fire_truck'];
        const units = this.units.filter(u => u.faction === faction && u.hp > 0);

        if (type === 'infantry' || INFANTRY_TYPES.includes(type)) {
            const infantryCount = units.filter(u => isInfUnit(u)).length;
            return infantryCount < limits.infantry;
        } else {
            const combatVeh = units.filter(u => !isInfUnit(u) && !LOG_TYPES.includes(u.type)).length;
            if (limits.combatVehicles !== undefined) return combatVeh < limits.combatVehicles;
            return combatVeh < limits.vehicles;
        }
    }

    getUnitLimits(faction) { return faction === this.faction ? this.unitLimits : this.aiUnitLimits; }

    getUnitCounts(faction) {
        const units = this.units.filter(u => u.faction === faction);
        return {
            infantry: units.filter(u => isInfUnit(u)).length,
            vehicles: units.filter(u => !isInfUnit(u)).length,
        };
    }

    isBlockedForVehicle(x, y, unit) {
        if (isInfUnit(unit)) return false;

        const CITY_ZONES = [
            { col: 1, row: 2, radius: 120 },
            { col: 9, row: 1, radius: 80 },
            { col: 4, row: 4, radius: 80 },
            { col: 9, row: 4, radius: 80 },
            { col: 1, row: 5, radius: 70 },
            { col: 1, row: 8, radius: 70 },
            { col: 6, row: 8, radius: 70 },
            { col: 5, row: 11, radius: 70 },
            { col: 9, row: 9, radius: 70 },
            { col: 7, row: 11, radius: 120 },
        ];

        for (const zone of CITY_ZONES) {
            const cx = zone.col * 250 + 125;
            const cy = zone.row * 150 + 75;
            const d = dist(x, y, cx, cy);
            if (d < zone.radius * 0.2) return true;
        }
        return false;
    }

    isOnRoad(x, y) {
        const ROADS = [
            { from: [1, 2], to: [2, 1.5], curve: 0.3 },
            { from: [2, 1.5], to: [4, 1.2], curve: 0.2 },
            { from: [4, 1.2], to: [5, 2], curve: 0.4 },
            { from: [5, 2], to: [7, 1.5], curve: 0.3 },
            { from: [7, 1.5], to: [9, 1], curve: 0.2 },
            { from: [9, 1], to: [9, 2], curve: 0.1 },
            { from: [9, 2], to: [9, 4], curve: 0.2 },
            { from: [9, 4], to: [9, 5], curve: 0.1 },
            { from: [9, 5], to: [9, 6], curve: 0.3 },
            { from: [9, 6], to: [9, 9], curve: 0.2 },
            { from: [1, 2], to: [1, 5], curve: 0.2 },
            { from: [1, 5], to: [1, 8], curve: 0.3 },
            { from: [1, 8], to: [1, 11], curve: 0.2 },
            { from: [4, 1.2], to: [4, 4], curve: 0.3 },
            { from: [4, 4], to: [5, 4], curve: 0.1 },
            { from: [5, 4], to: [5, 5], curve: 0.2 },
            { from: [5, 2], to: [5, 4], curve: 0.4 },
            { from: [1, 8], to: [2, 9], curve: 0.3 },
            { from: [2, 9], to: [2, 11], curve: 0.2 },
            { from: [2, 11], to: [5, 11], curve: 0.3 },
            { from: [5, 11], to: [7, 11], curve: 0.2 },
            { from: [9, 9], to: [5, 11], curve: 0.4 },
        ];

        const roadWidth = 15;
        for (const road of ROADS) {
            const fromX = road.from[0] * 250 + 125;
            const fromY = road.from[1] * 150 + 75;
            const toX = road.to[0] * 250 + 125;
            const toY = road.to[1] * 150 + 75;
            const midX = (fromX + toX) / 2 + (toY - fromY) * road.curve;
            const midY = (fromY + toY) / 2 - (toX - fromX) * road.curve;

            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const px = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * midX + t * t * toX;
                const py = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * midY + t * t * toY;
                if (dist(x, y, px, py) < roadWidth) return true;
            }
        }
        return false;
    }

    handleLogistics(unit) {
        if (!getModeFlags(this).logisticsAllowed) return;

        const needsResource = (u) => {
            switch (unit.type) {
                case 'truck': return u.ammo !== undefined && u.maxAmmo !== undefined && u.ammo < u.maxAmmo - 0.5;
                case 'fuel_truck': return u.fuel !== undefined && u.maxFuel !== undefined && u.fuel < u.maxFuel - 0.5;
                case 'engineer': return u.hp < u.maxHp - 0.5;
                case 'medic_truck': return isInfUnit(u) && u.hp < u.maxHp - 0.5;
                case 'flatbed': return !!u.aoe && u.ammo !== undefined && u.maxAmmo !== undefined && u.ammo < u.maxAmmo - 0.5;
                default: return false;
            }
        };

        let target = null, tDist = Infinity;
        this.units.forEach(u => {
            if (u.faction !== unit.faction || u.id === unit.id || u.hp <= 0) return;
            if (!needsResource(u)) return;
            const d = dist(unit.x, unit.y, u.x, u.y);
            if (d < tDist) { tDist = d; target = u; }
        });
        if (!target) return;

        const range = unit.type === 'engineer' ? (unit.repairRange || 100) : 60;
        if (tDist > range) return;

        if (unit.type === 'truck') unit.supplyAmmo(target);
        else if (unit.type === 'fuel_truck') unit.supplyFuel(target);
        else if (unit.type === 'engineer') unit.repairUnit(target);
        else if (unit.type === 'flatbed') unit.supplyArtillery(target);
        else if (unit.type === 'medic_truck') unit.healUnit(target);
    }

    getDefenseUpgradeTime(targetLevel) { return [0, 15, 25, 40][targetLevel] || 30; }

    upgradeTerritoryDefense(cpIndex) {
        const cp = this.cps[cpIndex];
        if (!cp || cp.owner !== this.faction) return false;
        if (cp.defenseLevel >= 3) return false;
        if (cp.upgrading) return false;

        const upgradeCosts = [
            { s: 50, c: 30, m: 40 },
            { s: 100, c: 60, m: 80 },
            { s: 150, c: 90, m: 120 },
        ];
        const cost = upgradeCosts[cp.defenseLevel];
        if (this.res.s < cost.s || this.res.c < cost.c || this.res.m < cost.m) return false;

        this.res.s -= cost.s;
        this.res.c -= cost.c;
        this.res.m -= cost.m;

        const targetLevel = cp.defenseLevel + 1;
        cp.upgrading = {
            targetLevel,
            startTime: this.time,
            buildTime: this.getDefenseUpgradeTime(targetLevel) * 60,
        };
        return true;
    }

    updateDefenseUpgrades() {
        this.cps.forEach(cp => {
            if (cp.upgrading) {
                const elapsed = this.time - cp.upgrading.startTime;
                if (elapsed >= cp.upgrading.buildTime) {
                    cp.defenseLevel = cp.upgrading.targetLevel;
                    cp.upgrading = null;
                    this.notify?.(`${cp.name}: оборона улучшена до уровня ${cp.defenseLevel}!`);
                }
            }
        });
    }

    getDefenseUpgradeProgress(cp) {
        if (!cp || !cp.upgrading) return null;
        const elapsed = this.time - cp.upgrading.startTime;
        return {
            percent: Math.min(100, (elapsed / cp.upgrading.buildTime) * 100),
            remaining: Math.max(0, Math.ceil((cp.upgrading.buildTime - elapsed) / 60)),
            targetLevel: cp.upgrading.targetLevel,
        };
    }

    getTerritoryDefenseStats(defenseLevel) {
        const stats = [
            { damage: 0, range: 0, hp: 0 },
            { damage: 15, range: 240, hp: 300 },
            { damage: 25, range: 300, hp: 600 },
            { damage: 40, range: 360, hp: 1000 },
        ];
        return stats[defenseLevel] || stats[0];
    }

    getCityDefenseBonus(unit) {
        if (!unit || unit.hp <= 0) return 0;
        let maxBonus = 0;
        for (const cp of this.cps) {
            if (cp.owner !== unit.faction) continue;
            if (dist(unit.x, unit.y, cp.x, cp.y) <= cp.radius) {
                const lvl = cp.defenseLevel || 0;
                let bonus = isInfUnit(unit) ? 0.10 + (lvl * 0.15) : 0.05 + (lvl * 0.10);
                if (bonus > maxBonus) maxBonus = bonus;
            }
        }
        return Math.min(0.75, maxBonus);
    }

    getCityDefenseDisplayInfo(cp) {
        if (!cp || cp.owner === 'neutral') return null;
        const integrity = this.getCityDefenseIntegrity(cp);
        const stats = this.getTerritoryDefenseStats(cp.defenseLevel || 0);
        return {
            integrity: Math.floor(integrity),
            defenseRange: stats.range,
            level: cp.defenseLevel || 0,
            broken: integrity <= 0,
        };
    }

    buildFortification(type, x, y, faction, aiResources = null) {
        const FORTIFICATION_COSTS = {
            bunker_light: { s: 30, c: 20, m: 25, hp: 300, defense: 10, range: 240, buildTime: 10 },
            bunker_medium: { s: 60, c: 40, m: 50, hp: 600, defense: 20, range: 300, buildTime: 15 },
            bunker_heavy: { s: 100, c: 70, m: 80, hp: 1000, defense: 35, range: 360, buildTime: 20 },
        };
        const cost = FORTIFICATION_COSTS[type];
        if (!cost) return null;

        const payPool = aiResources || this.res;
        if (payPool.s < cost.s || payPool.c < cost.c || payPool.m < cost.m) return null;

        const inCapturedZone = this.cps.some(cp => {
            const distance = dist(x, y, cp.x, cp.y);
            return cp.owner === faction && distance <= cp.radius + 150;
        });
        if (!inCapturedZone) return null;

        payPool.s -= cost.s;
        payPool.c -= cost.c;
        payPool.m -= cost.m;

        const construction = {
            id: 'fort_' + Math.random().toString(36).substr(2, 9),
            type, faction, x, y,
            hp: cost.hp, maxHp: cost.hp,
            defense: cost.defense, range: cost.range,
            level: 1, lastAtk: 0,
            buildProgress: 0,
            buildTime: cost.buildTime * 60,
            isBuilding: true,
        };
        this.buildings.push(construction);
        return construction;
    }

    updateConstruction() {
        const livingUnits = this.units.filter(u => u.hp > 0);

        this.buildings.forEach(b => {
            if (b.isBuilding && b.buildProgress !== undefined) {
                b.buildProgress += 100 / b.buildTime;
                if (b.buildProgress >= 100) {
                    b.buildProgress = 100;
                    b.isBuilding = false;
                    b.hp = b.maxHp;
                } else {
                    b.hp = Math.floor(b.maxHp * (b.buildProgress / 100));
                }
            }

            if (b.type && b.type.startsWith('bunker_') && !b.isBuilding && b.range > 0) {
                if (!Number.isFinite(b.lastAtk) || b.lastAtk > this.time) b.lastAtk = 0;
                if (this.time - b.lastAtk < 120) return;

                let nearestEnemy = null;
                let nearestDist = Infinity;
                let bestVehicle = null;
                let bestVehicleDist = Infinity;

                for (const u of livingUnits) {
                    if (u.faction === b.faction) continue;
                    if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) continue;
                    const d = dist(b.x, b.y, u.x, u.y);
                    if (d > b.range) continue;
                    if (isTechVehicle(u)) {
                        if (d < bestVehicleDist) { bestVehicleDist = d; bestVehicle = u; }
                    } else if (d < nearestDist) {
                        nearestDist = d; nearestEnemy = u;
                    }
                }
                if (bestVehicle) nearestEnemy = bestVehicle;

                if (nearestEnemy) {
                    b.lastAtk = this.time;
                    let damage = b.defense || 10;
                    damage = getDefenseDamageVsTech(damage, nearestEnemy);
                    nearestEnemy.takeDamage(damage, null, this);
                    this.addTracer(b.x, b.y, nearestEnemy.x, nearestEnemy.y, 'defense');
                    this.addParticles(nearestEnemy.x, nearestEnemy.y, '#ffcc00', 3);
                }
            }
        });

        this.updateDefenseUpgrades();

        this.cps.forEach(cp => {
            if (cp.owner !== 'neutral' && cp.defenseLevel > 0 && !cp.upgrading) {
                const stats = this.getTerritoryDefenseStats(cp.defenseLevel);
                if (cp.lastAtk === undefined) cp.lastAtk = 0;
                if (this.time - cp.lastAtk < 120) return;

                let nearestEnemy = null;
                let nearestDist = Infinity;
                let bestVehicle = null;
                let bestVehicleDist = Infinity;

                for (const u of livingUnits) {
                    if (u.faction === cp.owner) continue;
                    if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) continue;
                    const d = dist(cp.x, cp.y, u.x, u.y);
                    if (d > stats.range) continue;
                    if (isTechVehicle(u)) {
                        if (d < bestVehicleDist) { bestVehicleDist = d; bestVehicle = u; }
                    } else if (d < nearestDist) {
                        nearestDist = d; nearestEnemy = u;
                    }
                }
                if (bestVehicle) nearestEnemy = bestVehicle;

                if (nearestEnemy) {
                    cp.lastAtk = this.time;
                    this.addTracer(cp.x, cp.y, nearestEnemy.x, nearestEnemy.y, 'defense');
                    let defDamage = stats.damage;
                    defDamage = getDefenseDamageVsTech(defDamage, nearestEnemy);
                    nearestEnemy.takeDamage(defDamage, null, this);
                    for (const hcp of this.cps) {
                        if (hcp.owner === 'neutral') continue;
                        if (dist(hcp.x, hcp.y, nearestEnemy.x, nearestEnemy.y) <= hcp.radius + 60) {
                            this.damageCityHouses(hcp, 6, hcp.x, hcp.y);
                        }
                    }
                    this.addParticles(nearestEnemy.x, nearestEnemy.y, '#ffcc00', 3);
                }

                if (cp.defenseLevel === 3) {
                    if (cp.lastAntiArtillery === undefined) cp.lastAntiArtillery = 0;
                    if (this.time - cp.lastAntiArtillery >= 1200) {
                        let enemyArtillery = null;
                        let artilleryDist = Infinity;

                        this.units.forEach(u => {
                            if (u.faction !== cp.owner && u.hp > 0 &&
                                typeof u.type === 'string' && u.type.includes('artillery')) {
                                if (u.aoeTarget && dist(u.aoeTarget.x, u.aoeTarget.y, cp.x, cp.y) < cp.radius) {
                                    const d = dist(cp.x, cp.y, u.x, u.y);
                                    if (d < artilleryDist) {
                                        artilleryDist = d;
                                        enemyArtillery = u;
                                    }
                                }
                            }
                        });

                        if (enemyArtillery) {
                            cp.lastAntiArtillery = this.time;
                            enemyArtillery.takeDamage(70, null, this);
                            this.addParticles(enemyArtillery.x, enemyArtillery.y, '#ff6600', 5);
                        }
                    }
                }
            }
        });
    }

    upgradeFortification(fortification) {
        const upgradeCost = {
            s: 20 * fortification.level,
            c: 15 * fortification.level,
            m: 20 * fortification.level,
        };
        if (this.res.s < upgradeCost.s || this.res.c < upgradeCost.c || this.res.m < upgradeCost.m) return false;
        if (fortification.level >= 3) return false;

        this.res.s -= upgradeCost.s;
        this.res.c -= upgradeCost.c;
        this.res.m -= upgradeCost.m;

        fortification.level++;
        fortification.maxHp += 200;
        fortification.hp = fortification.maxHp;
        fortification.defense += 10;
        fortification.range += 20;
        return true;
    }

    updateProduction() {
        const completed = [];
        this.productionQueue.forEach((item, index) => {
            const elapsed = this.time - item.startTime;
            const buildTimeTicks = item.buildTime * 60;
            if (elapsed >= buildTimeTicks) {
                const building = this.buildings.find(b => b.id === item.buildingId);
                if (building) {
                    const unit = this.createUnitFromQueue(item.type, item.faction, building);
                    if (unit) {
                        this.units.push(unit);
                        completed.push(index);
                    }
                }
            }
        });
        completed.reverse().forEach(index => { this.productionQueue.splice(index, 1); });
    }

    createUnitFromQueue(type, faction, building) {
        const unit = createVehicle(type, faction, building.x + 50, building.y + 50);
        unit.game = this;
        return unit;
    }

    addToProductionQueue(type, faction, buildingId, buildTime) {
        this.productionQueue.push({
            type, faction, buildingId,
            startTime: this.time,
            buildTime,
        });
    }

    getProductionProgress(buildingId) {
        return this.productionQueue.filter(item => item.buildingId === buildingId);
    }

    checkWinCondition() {
        const playerPoints = this.cps.filter(c => c.owner === this.faction).length;
        const aiPoints = this.cps.filter(c => c.owner === this.ai).length;
        if (playerPoints === 0) { this.over = true; this.winner = this.ai; }
        if (aiPoints === 0) { this.over = true; this.winner = this.faction; }
    }

    addParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 15 + Math.random() * 10,
                maxLife: 25,
                color,
                size: 2 + Math.random() * 3,
            });
        }
    }

    // ===== РСЗО: очередь ракет =====
    _issueRocketVolley(u) {
        if (!u.aoeTarget) return;
        if (u._rocketQueue && u._rocketQueue.length > 0) return;

        const tx = u.aoeTarget.x;
        const ty = u.aoeTarget.y;
        const spread = u.rocketSpreadRadius || 90;
        const count = u.rocketsPerVolley || 8;

        // БК списывается сразу — иначе счётчик не сработает
        const actualShots = Math.min(count, Math.floor(u.ammo));
        if (actualShots <= 0) return;
        u.ammo = Math.max(0, u.ammo - actualShots);

        const queue = [];
        for (let i = 0; i < actualShots; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * spread;
            queue.push({
                targetX: tx + Math.cos(ang) * r,
                targetY: ty + Math.sin(ang) * r,
                delay: i * (u.rocketDelay || 6),
                launched: false,
                impactDone: false,
            });
        }
        u._rocketQueue = queue;
        u.volleyShotsFired = 0;
        u.aoeTarget = null;
        u.shotsFired = 0;
    }

    _updateRocketVolley(u) {
        if (!u._rocketQueue || u._rocketQueue.length === 0) return;
        if (this.time < (u._volleyStartAt || 0)) return;

        for (const rocket of u._rocketQueue) {
            if (rocket.launched) continue;
            if (this.time - u._volleyStartAt < rocket.delay) continue;
            rocket.launched = true;
            u.volleyShotsFired++;
            this._spawnRocket(u, rocket.targetX, rocket.targetY);
        }

        if (u._rocketQueue.every(r => r.launched)) u._rocketQueue = null;
    }

    _spawnRocket(owner, targetX, targetY) {
        const startX = owner.x;
        const startY = owner.y;
        const baseAng = Math.atan2(targetY - startY, targetX - startX);
        const launchAng = baseAng + (Math.random() - 0.5) * 1.1;
        const speed = 3.5 + Math.random() * 1.5;
        const distToTarget = Math.hypot(targetX - startX, targetY - startY);
        const life = Math.max(30, Math.ceil(distToTarget / speed));

        this.rockets.push({
            x: startX, y: startY,
            vx: Math.cos(launchAng) * speed,
            vy: Math.sin(launchAng) * speed,
            targetX, targetY,
            owner,
            faction: owner.faction,
            dmg: owner.dmg,
            radius: owner.aoeRadius,
            life, maxLife: life,
            smokeSeed: Math.random() * Math.PI * 2,
            turnRate: 0.08 + Math.random() * 0.06,
        });
    }

    _updateRockets() {
        if (!this.rockets || this.rockets.length === 0) return;

        this.rockets = this.rockets.filter(rk => {
            const dx = rk.targetX - rk.x;
            const dy = rk.targetY - rk.y;
            const d = Math.hypot(dx, dy);

            if (d < 8) { this._rocketImpact(rk); return false; }

            const desiredAng = Math.atan2(dy, dx);
            const currentAng = Math.atan2(rk.vy, rk.vx);
            let delta = desiredAng - currentAng;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;

            const turn = Math.sign(delta) * Math.min(Math.abs(delta), rk.turnRate);
            const newAng = currentAng + turn;
            const speed = Math.hypot(rk.vx, rk.vy);

            rk.vx = Math.cos(newAng) * speed;
            rk.vy = Math.sin(newAng) * speed;
            rk.x += rk.vx;
            rk.y += rk.vy;
            rk.life--;

            if (rk.life <= 0) { this._rocketImpact(rk); return false; }
            return true;
        });
    }

    _rocketImpact(rk) {
        const radius = rk.radius || 50;
        const dmg = rk.dmg || 55;

        for (const enemy of this.units) {
            if (enemy.faction === rk.faction || enemy.hp <= 0) continue;
            const d = dist(rk.x, rk.y, enemy.x, enemy.y);
            if (d <= radius) {
                const mult = 1 - (d / radius) * 0.5;
                enemy.takeDamage(Math.floor(dmg * mult), rk.owner, this);
            }
        }

        for (const b of this.buildings) {
            if (b.faction === rk.faction || !(b.hp > 0)) continue;
            const d = dist(rk.x, rk.y, b.x, b.y);
            if (d <= radius) {
                const mult = 1 - (d / radius) * 0.5;
                const dmgB = Math.floor(dmg * mult);
                b.hp = Math.max(0, b.hp - dmgB);
                const ci = this.getOwningCpIndexForBuilding(b);
                if (ci >= 0) this.damageCityDefense(this.cps[ci], dmgB, rk.x, rk.y);
            }
        }

        for (const cp of this.cps) {
            if (cp.owner === 'neutral' || cp.owner === rk.faction) continue;
            const d = dist(rk.x, rk.y, cp.x, cp.y);
            if (d <= radius + cp.radius * 0.4) {
                const falloff = Math.max(0.25, 1 - (d / (cp.radius + radius)) * 0.5);
                this.damageCityDefense(cp, Math.floor(dmg * falloff), rk.x, rk.y);
            }
        }

        this.addParticles(rk.x, rk.y, '#ff6b00', 14);
        this.addParticles(rk.x, rk.y, '#ffcc00', 10);
        this.addParticles(rk.x, rk.y, '#ff0000', 6);
        this.addParticles(rk.x, rk.y, '#888888', 8);

        this.debris.push({
            type: 'explosion',
            x: rk.x, y: rk.y,
            life: 30, maxLife: 30,
        });
    }

    addTracer(fromX, fromY, toX, toY, type = 'bullet') {
        const tracers = {
            bullet: { color: '#ffeb3b', width: 2, speed: 15, life: 10 },
            shell: { color: '#ff9800', width: 3, speed: 12, life: 15 },
            artillery: { color: '#f44336', width: 4, speed: 8, life: 20 },
            defense: { color: '#4caf50', width: 2, speed: 14, life: 12 },
            grenade: { color: '#9c27b0', width: 3, speed: 10, life: 18 }
        };
        const config = tracers[type] || tracers.bullet;
        this.tracers.push({
            fromX, fromY, toX, toY,
            currentX: fromX, currentY: fromY,
            color: config.color,
            width: config.width,
            speed: config.speed,
            life: config.life,
            maxLife: config.life,
            type
        });
    }

    updateTracers() {
        this.tracers = this.tracers.filter(tracer => {
            const dx = tracer.toX - tracer.currentX;
            const dy = tracer.toY - tracer.currentY;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < tracer.speed) {
                tracer.currentX = tracer.toX;
                tracer.currentY = tracer.toY;
                tracer.life--;
            } else {
                tracer.currentX += (dx / d) * tracer.speed;
                tracer.currentY += (dy / d) * tracer.speed;
            }
            return tracer.life > 0;
        });
    }

    updateReveal() {
        this.revealedAreas = this.revealedAreas.filter(area => this.time - area.time < 180);
        this.units.forEach(u => {
            if (u.revealRadius && u.hp > 0) {
                const existingArea = this.revealedAreas.find(area =>
                    dist(area.x, area.y, u.x, u.y) < area.radius * 0.5
                );
                if (!existingArea) {
                    this.revealedAreas.push({
                        x: u.x, y: u.y,
                        radius: u.revealRadius,
                        time: this.time,
                        faction: u.faction
                    });
                }
            }
        });
    }

    updateBoost() {
        this.units.forEach(u => {
            if (u.canBoost) {
                if (!u.boosting) {
                    const nearbyEnemy = this.units.find(enemy =>
                        enemy.faction !== u.faction &&
                        enemy.hp > 0 &&
                        dist(u.x, u.y, enemy.x, enemy.y) < 150
                    );
                    if (nearbyEnemy && u.fuel > 30) u.activateBoost();
                }
                if (u.boosting) {
                    const nearbyEnemy = this.units.find(enemy =>
                        enemy.faction !== u.faction &&
                        enemy.hp > 0 &&
                        dist(u.x, u.y, enemy.x, enemy.y) < 200
                    );
                    if (!nearbyEnemy || u.fuel < 10) u.deactivateBoost();
                    else u.fuel = Math.max(0, u.fuel - u.boostFuelCost);
                }
            }
        });
    }
}