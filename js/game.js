// ===== GAME LOGIC =====
import { dist, distToSeg, GAME_MODES, SUPPLY_SYSTEM } from './constants.js';
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
        
        const mapW = 4500, mapH = 3375; // Увеличенная карта (1.5x)
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
        
        // Update construction
        this.updateConstruction();
        
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
            
            // Пополнение БК/топлива в базе (постепенное, с большим радиусом)
            const isInBase = this.buildings.some(b => 
                b.faction === u.faction && 
                b.type === 'town_hall' && 
                dist(u.x, u.y, b.x, b.y) < SUPPLY_SYSTEM.baseSupplyRadius
            );
            if (isInBase) {
                // Постепенное пополнение каждый тик
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
            
            // Find nearest enemy (units or buildings)
            let nearest = null, nearDist = Infinity;
            
            // Check enemy units
            this.units.forEach(e => {
                if (e.faction !== u.faction && e.hp > 0) {
                    const d = dist(u.x, u.y, e.x, e.y);
                    if (d < nearDist) {
                        nearDist = d;
                        nearest = e;
                    }
                }
            });
            
            // Check enemy buildings
            this.buildings.forEach(b => {
                if (b.faction !== u.faction && b.hp > 0) {
                    const d = dist(u.x, u.y, b.x, b.y);
                    if (d < nearDist) {
                        nearDist = d;
                        nearest = b;
                    }
                }
            });

            // Attack logic - only attack if target is in range
            let attackTarget = null;
            let canAttack = false;
            
            // For artillery, check if aoeTarget is set
            if (u.aoe && u.aoeTarget) {
                const targetDist = dist(u.x, u.y, u.aoeTarget.x, u.aoeTarget.y);
                // Artillery has minimum range - can't shoot at close targets
                const minRange = u.minRange || 100;
                if (targetDist >= minRange && targetDist <= u.range) {
                    attackTarget = { x: u.aoeTarget.x, y: u.aoeTarget.y };
                    canAttack = true;
                } else if (targetDist < minRange) {
                    // Target too close - retreat instead of spinning
                    const retreatAngle = Math.atan2(u.y - u.aoeTarget.y, u.x - u.aoeTarget.x);
                    u.tx = u.x + Math.cos(retreatAngle) * 100;
                    u.ty = u.y + Math.sin(retreatAngle) * 100;
                    u.aoeTarget = null; // Clear target
                }
            } else if (nearest && nearest.hp > 0) {
                const targetDist = dist(u.x, u.y, nearest.x, nearest.y);
                const minRange = u.minRange || 0;
                
                // Check if target is in attack range
                if (targetDist <= u.range && targetDist >= minRange && u.dmg > 0 && u.cd > 0) {
                    attackTarget = nearest;
                    canAttack = true;
                } else if (targetDist < minRange && u.aoe) {
                    // Artillery: target too close - retreat
                    const retreatAngle = Math.atan2(u.y - nearest.y, u.x - nearest.x);
                    u.tx = u.x + Math.cos(retreatAngle) * 100;
                    u.ty = u.y + Math.sin(retreatAngle) * 100;
                }
            }
            
            // Attack if possible
            if (canAttack && attackTarget) {
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
            // Move to target if not attacking or target is out of range
            else if (u.tx !== undefined) {
                const d = dist(u.x, u.y, u.tx, u.ty);
                if (d > 5) {
                    // Проверка топлива
                    if (u.canMove && !u.canMove()) {
                        u.tx = undefined;
                        u.ty = undefined;
                    } else {
                        // Инициализация счётчика застревания
                        if (u.stuckCounter === undefined) {
                            u.stuckCounter = 0;
                            u.lastX = u.x;
                            u.lastY = u.y;
                        }
                        
                        // Проверка застревания
                        const movedDist = dist(u.x, u.y, u.lastX, u.lastY);
                        if (movedDist < 0.5) {
                            u.stuckCounter++;
                        } else {
                            u.stuckCounter = 0;
                        }
                        
                        // Если застряли слишком долго - пробуем обход
                        if (u.stuckCounter > 30) {
                            // Пытаемся обойти препятствие
                            const angle = Math.atan2(u.ty - u.y, u.tx - u.x);
                            const detourAngle = angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                            const detourDist = 50;
                            u.tx = u.x + Math.cos(detourAngle) * detourDist;
                            u.ty = u.y + Math.sin(detourAngle) * detourDist;
                            u.stuckCounter = 0;
                        }
                        
                        u.lastX = u.x;
                        u.lastY = u.y;
                        
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
                        } else {
                            // Если заблокировано - увеличиваем счётчик застревания
                            u.stuckCounter = (u.stuckCounter || 0) + 5;
                        }
                    }
                } else {
                    u.tx = undefined;
                    u.ty = undefined;
                    u.stuckCounter = 0;
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
    
    updateUnitLimits() {
        // Лимиты увеличиваются с каждой захваченной точкой
        const playerPoints = this.cps.filter(c => c.owner === this.faction).length;
        const aiPoints = this.cps.filter(c => c.owner === this.ai).length;
        
        // Базовые лимиты + 3 за каждую точку
        this.unitLimits.infantry = 20 + playerPoints * 3;
        this.unitLimits.vehicles = 10 + playerPoints * 2;
        
        // Лимиты для ИИ
        this.aiUnitLimits = {
            infantry: 20 + aiPoints * 3,
            vehicles: 10 + aiPoints * 2,
        };
    }
    
    canProduceUnit(type, faction) {
        const limits = faction === this.faction ? this.unitLimits : this.aiUnitLimits;
        const units = this.units.filter(u => u.faction === faction);
        
        if (type === 'infantry') {
            const infantryCount = units.filter(u => u.type === 'infantry').length;
            return infantryCount < limits.infantry;
        } else {
            const vehicleCount = units.filter(u => u.type !== 'infantry').length;
            return vehicleCount < limits.vehicles;
        }
    }
    
    getUnitLimits(faction) {
        return faction === this.faction ? this.unitLimits : this.aiUnitLimits;
    }
    
    getUnitCounts(faction) {
        const units = this.units.filter(u => u.faction === faction);
        return {
            infantry: units.filter(u => u.type === 'infantry').length,
            vehicles: units.filter(u => u.type !== 'infantry').length,
        };
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
    
    // Система обороны территорий
    upgradeTerritoryDefense(cpIndex) {
        const cp = this.cps[cpIndex];
        if (!cp || cp.owner !== this.faction) return false;
        if (cp.defenseLevel >= 3) return false; // Максимум 3 уровня
        
        const upgradeCosts = [
            { s: 50, c: 30, m: 40 },   // Уровень 1
            { s: 100, c: 60, m: 80 },  // Уровень 2
            { s: 150, c: 90, m: 120 }, // Уровень 3
        ];
        
        const cost = upgradeCosts[cp.defenseLevel];
        if (this.res.s < cost.s || this.res.c < cost.c || this.res.m < cost.m) {
            return false;
        }
        
        this.res.s -= cost.s;
        this.res.c -= cost.c;
        this.res.m -= cost.m;
        cp.defenseLevel++;
        
        return true;
    }
    
    getTerritoryDefenseStats(defenseLevel) {
        const stats = [
            { damage: 0, range: 0, hp: 0 },      // Уровень 0 - нет обороны
            { damage: 15, range: 120, hp: 300 },  // Уровень 1
            { damage: 25, range: 150, hp: 600 },  // Уровень 2
            { damage: 40, range: 180, hp: 1000 }, // Уровень 3
        ];
        return stats[defenseLevel] || stats[0];
    }
    
    // Система укреплений (старая - можно удалить)
    buildFortification(type, x, y, faction) {
        const FORTIFICATION_COSTS = {
            bunker_light: { s: 30, c: 20, m: 25, hp: 300, defense: 10, range: 120, buildTime: 10 },
            bunker_medium: { s: 60, c: 40, m: 50, hp: 600, defense: 20, range: 150, buildTime: 15 },
            bunker_heavy: { s: 100, c: 70, m: 80, hp: 1000, defense: 35, range: 180, buildTime: 20 },
        };
        
        const cost = FORTIFICATION_COSTS[type];
        if (!cost) {
            console.error('❌ Неизвестный тип укрепления:', type);
            return null;
        }
        
        // Проверка ресурсов
        if (this.res.s < cost.s || this.res.c < cost.c || this.res.m < cost.m) {
            console.log('⚠️ Недостаточно ресурсов для строительства');
            return null;
        }
        
        // Проверка что строительство происходит в захваченной зоне (увеличен радиус)
        const inCapturedZone = this.cps.some(cp => {
            const distance = dist(x, y, cp.x, cp.y);
            const canBuild = cp.owner === faction && distance <= cp.radius + 150;
            if (canBuild) {
                console.log(`✅ Можно строить в зоне ${cp.name} (расстояние: ${Math.floor(distance)})`);
            }
            return canBuild;
        });
        
        if (!inCapturedZone) {
            console.log('⚠️ Нельзя строить здесь - не в захваченной зоне');
            return null;
        }
        
        // Списываем ресурсы
        this.res.s -= cost.s;
        this.res.c -= cost.c;
        this.res.m -= cost.m;
        
        // Добавляем в очередь строительства (не строим мгновенно)
        const construction = {
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
            buildProgress: 0, // 0-100%
            buildTime: cost.buildTime * 60, // В тиках (60 FPS)
            isBuilding: true,
        };
        
        this.buildings.push(construction);
        console.log(`🏗️ Бункер ${type} добавлен в очередь строительства. Всего зданий: ${this.buildings.length}`);
        return construction;
    }
    
    updateConstruction() {
        this.buildings.forEach(b => {
            if (b.isBuilding && b.buildProgress !== undefined) {
                b.buildProgress += 100 / b.buildTime;
                
                if (b.buildProgress >= 100) {
                    b.buildProgress = 100;
                    b.isBuilding = false;
                    b.hp = b.maxHp; // Полное HP после завершения
                } else {
                    // Во время строительства HP пропорционально прогрессу
                    b.hp = Math.floor(b.maxHp * (b.buildProgress / 100));
                }
            }
            
            // Бункеры атакуют врагов в радиусе действия (только если достроены)
            if (b.type && b.type.startsWith('bunker_') && !b.isBuilding && b.range > 0) {
                // Инициализация таймера атаки
                if (b.lastAtk === undefined) b.lastAtk = 0;
                
                // Проверяем кулдаун (2 секунды между выстрелами)
                if (this.time - b.lastAtk < 120) return;
                
                // Ищем ближайшего врага в радиусе действия
                let nearestEnemy = null;
                let nearestDist = Infinity;
                
                this.units.forEach(u => {
                    if (u.faction !== b.faction && u.hp > 0) {
                        const d = dist(b.x, b.y, u.x, u.y);
                        if (d <= b.range && d < nearestDist) {
                            nearestDist = d;
                            nearestEnemy = u;
                        }
                    }
                });
                
                // Атакуем если нашли врага
                if (nearestEnemy) {
                    b.lastAtk = this.time;
                    const damage = b.defense || 10;
                    nearestEnemy.takeDamage(damage);
                    
                    // Визуальный эффект выстрела
                    this.addParticles(nearestEnemy.x, nearestEnemy.y, '#ffcc00', 3);
                }
            }
        });
        
        // Оборона территорий атакует врагов
        this.cps.forEach(cp => {
            if (cp.owner !== 'neutral' && cp.defenseLevel > 0) {
                const stats = this.getTerritoryDefenseStats(cp.defenseLevel);
                
                // Инициализация таймера атаки
                if (cp.lastAtk === undefined) cp.lastAtk = 0;
                
                // Проверяем кулдаун (2 секунды между выстрелами)
                if (this.time - cp.lastAtk < 120) return;
                
                // Ищем ближайшего врага в радиусе действия
                let nearestEnemy = null;
                let nearestDist = Infinity;
                
                this.units.forEach(u => {
                    if (u.faction !== cp.owner && u.hp > 0) {
                        const d = dist(cp.x, cp.y, u.x, u.y);
                        if (d <= stats.range && d < nearestDist) {
                            nearestDist = d;
                            nearestEnemy = u;
                        }
                    }
                });
                
                // Атакуем если нашли врага
                if (nearestEnemy) {
                    cp.lastAtk = this.time;
                    nearestEnemy.takeDamage(stats.damage);
                    
                    // Визуальный эффект выстрела
                    this.addParticles(nearestEnemy.x, nearestEnemy.y, '#ffcc00', 3);
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
        // Проверяем наличие территорий у каждой стороны
        const playerPoints = this.cps.filter(c => c.owner === this.faction).length;
        const aiPoints = this.cps.filter(c => c.owner === this.ai).length;
        
        // Если у игрока нет территорий - он проиграл
        if (playerPoints === 0) {
            this.over = true;
            this.winner = this.ai;
        }
        
        // Если у ИИ нет территорий - игрок победил
        if (aiPoints === 0) {
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
