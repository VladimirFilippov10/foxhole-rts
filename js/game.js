// ===== GAME LOGIC =====
import { dist, distToSeg, GAME_MODES } from './constants.js';
import { AI } from './ai.js';
import { createVehicle } from './vehicles.js';

export class Game {
    constructor(faction, gameMode = 'normal') {
        this.faction = faction;
        this.ai = faction === 'wardens' ? 'colonials' : 'wardens';
        this.gameMode = gameMode;
        this.units = [];
        this.buildings = [];
        this.cps = [];
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
        
        // Система производства
        this.productionQueue = []; // Очередь производства [{type, faction, buildingId, startTime, buildTime}]
        
        // Система лимитов юнитов
        this.unitLimits = {
            infantry: 20, // Базовый лимит пехоты
            vehicles: 10, // Базовый лимит техники
        };
    }

    init(cps, mines, buildings, units) {
        this.cps = cps;
        this.mines = mines;
        this.buildings = buildings;
        this.units = units;
        
        // Set initial ownership
        const playerBase = this.cps.find(cp => cp.owner === this.faction);
        const aiBase = this.cps.find(cp => cp.owner === this.ai);
        
        if (playerBase) {
            this.cam.x = Math.max(0, playerBase.x - window.innerWidth / 2);
            this.cam.y = Math.max(0, playerBase.y - window.innerHeight / 2);
        }
        
        this.aiController = new AI(this);
    }

    update() {
        if (this.over) return;
        
        this.time++;
        
        // Camera movement
        const spd = 7;
        if (this.keys?.['w'] || this.keys?.['arrowup']) this.cam.y -= spd;
        if (this.keys?.['s'] || this.keys?.['arrowdown']) this.cam.y += spd;
        if (this.keys?.['a'] || this.keys?.['arrowleft']) this.cam.x -= spd;
        if (this.keys?.['d'] || this.keys?.['arrowright']) this.cam.x += spd;
        
        const mapW = 3000, mapH = 2250;
        this.cam.x = Math.max(0, Math.min(mapW - window.innerWidth, this.cam.x));
        this.cam.y = Math.max(0, Math.min(mapH - window.innerHeight, this.cam.y));

        // Resource generation with game mode multiplier
        const pts = this.cps.filter(c => c.owner === this.faction).length;
        const modeMultiplier = GAME_MODES[this.gameMode].resourceMultiplier;
        this.res.s += pts * 0.03 * modeMultiplier;
        this.res.c += pts * 0.015 * modeMultiplier;
        this.res.m += pts * 0.01 * modeMultiplier;

        // Update production queue
        this.updateProduction();
        
        // Update units
        this.updateUnits();
        
        // Remove dead
        this.units = this.units.filter(u => u.hp > 0);
        this.buildings = this.buildings.filter(b => b.hp > 0);

        // Capture points
        this.updateCapturePoints();
        
        // Mines
        this.updateMines();
        
        // Update unit limits based on captured points
        this.updateUnitLimits();

        // AI
        if (this.aiController) {
            this.aiController.update();
        }

        // Particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.life--;
            return p.life > 0;
        });

        // Win check
        this.checkWinCondition();
    }

    updateUnits() {
        this.units.forEach(u => {
            // Update game time for reload calculation
            u.gameTime = this.time;
            
            // Пополнение БК/топлива в базе
            const isInBase = this.buildings.some(b => 
                b.faction === u.faction && 
                b.type === 'town_hall' && 
                dist(u.x, u.y, b.x, b.y) < 100
            );
            if (isInBase) {
                if (u.regenerateAtBase) {
                    u.regenerateAtBase();
                }
                // Пополнение логистики на базе
                if (u.replenishAtBase) {
                    u.replenishAtBase();
                }
            }
            
            // Логистика: грузовики, бензовозы, инженеры, flatbed
            if (u.type === 'truck' || u.type === 'fuel_truck' || u.type === 'engineer' || 
                u.type === 'flatbed') {
                this.handleLogistics(u);
            }
            
            // Find nearest enemy
            let nearest = null, nearDist = Infinity;
            this.units.forEach(e => {
                if (e.faction !== u.faction && e.hp > 0) {
                    const d = dist(u.x, u.y, e.x, e.y);
                    if (d < nearDist) {
                        nearDist = d;
                        nearest = e;
                    }
                }
            });

            // Attack - simplified logic
            // For artillery, check if aoeTarget is set
            let attackTarget = nearest;
            if (u.aoe && u.aoeTarget) {
                // Use aoeTarget instead of nearest enemy
                const targetDist = dist(u.x, u.y, u.aoeTarget.x, u.aoeTarget.y);
                if (targetDist <= u.range) {
                    attackTarget = { x: u.aoeTarget.x, y: u.aoeTarget.y };
                }
            }
            
            if (attackTarget && dist(u.x, u.y, attackTarget.x, attackTarget.y) <= u.range && u.dmg > 0 && u.cd > 0) {
                const timeSinceLastAttack = this.time - u.lastAtk;
                if (timeSinceLastAttack >= u.cd) {
                    // Проверка БК перед атакой
                    if (!u.canAttack || u.canAttack()) {
                        u.lastAtk = this.time;
                        
                        // Расход БК при атаке
                        if (u.useAmmo) {
                            u.useAmmo();
                        }
                        
                        // Artillery AoE attack
                        if (u.aoe && u.aoeRadius) {
                            // Damage all enemies in radius around target
                            this.units.forEach(enemy => {
                                if (enemy.faction !== u.faction && enemy.hp > 0) {
                                    const distToTarget = dist(attackTarget.x, attackTarget.y, enemy.x, enemy.y);
                                    if (distToTarget <= u.aoeRadius) {
                                        // Damage decreases with distance from center
                                        const damageMultiplier = 1 - (distToTarget / u.aoeRadius) * 0.5;
                                        enemy.takeDamage(Math.floor(u.dmg * damageMultiplier));
                                    }
                                }
                            });
                            
                            // Big explosion effect
                            this.addParticles(attackTarget.x, attackTarget.y, '#ff6b00', 20);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 15);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ff0000', 10);
                            
                            // Clear aoeTarget after firing
                            if (u.aoeTarget) {
                                u.aoeTarget = null;
                            }
                        } else {
                            // Normal single target attack
                            attackTarget.takeDamage(u.dmg);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 4);
                        }
                    }
                }
            }
            // Move to target
            if (u.tx !== undefined) {
                const d = dist(u.x, u.y, u.tx, u.ty);
                if (d > 5) {
                    // Проверка топлива
                    if (u.canMove && !u.canMove()) {
                        u.tx = undefined;
                        u.ty = undefined;
                    } else {
                        const r = u.spd / d;
                        const nx = u.x + (u.tx - u.x) * r;
                        const ny = u.y + (u.ty - u.y) * r;
                        // Check buildings (vehicles only)
                        const blockedByBuilding = this.isBlockedForVehicle(nx, ny, u);
                        
                        if (!blockedByBuilding) {
                            // Update direction based on movement
                            u.direction = Math.atan2(ny - u.y, nx - u.x);
                            u.x = nx;
                            u.y = ny;
                            
                            // Расход топлива при движении
                            if (u.useFuel) {
                                u.useFuel();
                            }
                        }
                        // If blocked by building, keep trying (will go around)
                    }
                } else {
                    u.tx = undefined;
                    u.ty = undefined;
                }
            }
        });
    }

    updateCapturePoints() {
        this.cps.forEach(cp => {
            const pU = this.units.filter(u => u.faction === this.faction && dist(u.x, u.y, cp.x, cp.y) <= cp.radius);
            const aU = this.units.filter(u => u.faction === this.ai && dist(u.x, u.y, cp.x, cp.y) <= cp.radius);
            
            if (pU.length > 0 && aU.length === 0 && cp.owner !== this.faction) {
                cp.progress = Math.min(100, cp.progress + pU.length * 0.2);
                cp.capturing = this.faction;
                if (cp.progress >= 100) {
                    cp.owner = this.faction;
                    this.notify?.(cp.name + ' захвачен!');
                }
            } else if (aU.length > 0 && pU.length === 0 && cp.owner !== this.ai) {
                cp.progress = Math.min(100, cp.progress + aU.length * 0.15);
                cp.capturing = this.ai;
                if (cp.progress >= 100) cp.owner = this.ai;
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
        
        // Bonus resources
        this.mines.forEach(mine => {
            if (mine.owner === this.faction) {
                if (mine.type === 'supplies') this.res.s += 0.05;
                if (mine.type === 'components') this.res.c += 0.03;
                if (mine.type === 'materials') this.res.m += 0.03;
            }
        });
    }

    isBlockedForVehicle(x, y, unit) {
        // Infantry can pass through buildings
        if (unit.type === 'infantry') return false;
        
        // Check city zones (buildings block vehicles)
        // Only block in the very center where buildings actually are
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
            // Vehicles blocked only in the very center (20% of radius)
            if (d < zone.radius * 0.2) return true;
        }
        
        return false;
    }
    
    handleLogistics(unit) {
        // Найти ближайшую дружественную технику
        let nearestAlly = null;
        let nearestDist = Infinity;
        
        this.units.forEach(u => {
            if (u.faction === unit.faction && u.id !== unit.id && u.hp > 0) {
                const d = dist(unit.x, unit.y, u.x, u.y);
                if (d < nearestDist && d < 50) { // Радиус взаимодействия
                    nearestDist = d;
                    nearestAlly = u;
                }
            }
        });
        
        if (!nearestAlly) return;
        
        // Грузовик пополняет БК
        if (unit.type === 'truck' && unit.supplyAmmo) {
            unit.supplyAmmo(nearestAlly);
        }
        
        // Бензовоз пополняет топливо
        if (unit.type === 'fuel_truck' && unit.supplyFuel) {
            unit.supplyFuel(nearestAlly);
        }
        
        // Инженерная машина ремонтирует
        if (unit.type === 'engineer' && unit.repairUnit) {
            if (dist(unit.x, unit.y, nearestAlly.x, nearestAlly.y) < unit.repairRange) {
                unit.repairUnit(nearestAlly);
            }
        }
        
        // Flatbed пополняет БК артиллерии
        if (unit.type === 'flatbed' && unit.supplyArtillery) {
            // Ищем ближайшую артиллерию
            let nearestArtillery = null;
            let artilleryDist = Infinity;
            this.units.forEach(u => {
                if (u.faction === unit.faction && u.hp > 0 && 
                    (u.type === 'warden_artillery' || u.type === 'colonial_artillery')) {
                    const d = dist(unit.x, unit.y, u.x, u.y);
                    if (d < artilleryDist && d < 60) {
                        artilleryDist = d;
                        nearestArtillery = u;
                    }
                }
            });
            if (nearestArtillery) {
                unit.supplyArtillery(nearestArtillery);
            }
        }
    }
    
    // Система укреплений
    buildFortification(type, x, y, faction) {
        const FORTIFICATION_COSTS = {
            bunker_light: { s: 30, c: 20, m: 25, hp: 300, defense: 10, range: 120 },
            bunker_medium: { s: 60, c: 40, m: 50, hp: 600, defense: 20, range: 150 },
            bunker_heavy: { s: 100, c: 70, m: 80, hp: 1000, defense: 35, range: 180 },
        };
        
        const cost = FORTIFICATION_COSTS[type];
        if (!cost) return null;
        
        // Проверка ресурсов
        if (this.res.s < cost.s || this.res.c < cost.c || this.res.m < cost.m) {
            return null;
        }
        
        // Построение укрепления
        this.res.s -= cost.s;
        this.res.c -= cost.c;
        this.res.m -= cost.m;
        
        const fortification = {
            id: 'fort_' + Math.random().toString(36).substr(2, 9),
            type: type,
            faction: faction,
            x: x,
            y: y,
            hp: cost.hp,
            maxHp: cost.hp,
            defense: cost.defense,
            range: cost.range,
            level: 1,
            lastAtk: 0,
        };
        
        this.buildings.push(fortification);
        return fortification;
    }
    
    upgradeFortification(fortification) {
        const upgradeCost = {
            s: 20 * fortification.level,
            c: 15 * fortification.level,
            m: 20 * fortification.level,
        };
        
        if (this.res.s < upgradeCost.s || this.res.c < upgradeCost.c || this.res.m < upgradeCost.m) {
            return false;
        }
        
        if (fortification.level >= 3) return false; // Максимум 3 уровня
        
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
    
    // Система производства
    updateProduction() {
        const completed = [];
        
        this.productionQueue.forEach((item, index) => {
            const elapsed = this.time - item.startTime;
            const buildTimeTicks = item.buildTime * 60; // Конвертируем секунды в тики
            
            if (elapsed >= buildTimeTicks) {
                // Производство завершено
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
        
        // Удаляем завершённые производства (в обратном порядке)
        completed.reverse().forEach(index => {
            this.productionQueue.splice(index, 1);
        });
    }
    
    createUnitFromQueue(type, faction, building) {
        const spawnX = building.x + 50;
        const spawnY = building.y + 50;
        return createVehicle(type, faction, spawnX, spawnY);
    }
    
    addToProductionQueue(type, faction, buildingId, buildTime) {
        this.productionQueue.push({
            type,
            faction,
            buildingId,
            startTime: this.time,
            buildTime,
        });
    }
    
    getProductionProgress(buildingId) {
        return this.productionQueue.filter(item => item.buildingId === buildingId);
    }

    checkWinCondition() {
        // Победа только при уничтожении базы противника
        const playerTownHall = this.buildings.find(b => b.faction === this.faction && b.type === 'town_hall');
        const aiTownHall = this.buildings.find(b => b.faction === this.ai && b.type === 'town_hall');
        
        if (!playerTownHall) {
            this.over = true;
            this.winner = this.ai;
        }
        if (!aiTownHall) {
            this.over = true;
            this.winner = this.faction;
        }
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
}
