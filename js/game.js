// ===== GAME LOGIC =====
import { dist, distToSeg, GAME_MODES, SUPPLY_SYSTEM } from './constants.js';
import { AI } from './ai.js';
import { createVehicle } from './vehicles.js';

// Логирование (console.log) — используется и здесь, и в ai.js.
// ИСПРАВЛЕНИЕ: раньше game.js вызывал aiLog(...), который был определён только
// внутри модуля ai.js как локальная функция (не экспортировался). Это давало
// "ReferenceError: aiLog is not defined" ровно в тот момент, когда артиллерия
// прибывала на позицию после движения — игровой цикл падал, и юнит «пропадал».
function aiLog(...args) {
    if (typeof window !== 'undefined' && window.AI_LOG === false) return;
    console.log(...args);
}

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
        
        // Система трассеров
        this.tracers = []; // Массив трассеров
        
        // Система разведки
        this.revealedAreas = []; // Области, раскрытые разведкой
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
        
        // Update construction
        this.updateConstruction();
        
        // Update reveal (scout tanks)
        this.updateReveal();
        
        // Update boost (Gallagher Highwayman)
        this.updateBoost();
        
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
        
        // Tracers
        this.updateTracers();

        // Win check
        this.checkWinCondition();
    }

    // ===== Оборона территории: прочность и правила захвата/въезда =====
    // Возвращает суммарную прочность обороны города (бункеры + уровень обороны точки)
    getCityDefenseIntegrity(cp) {
        if (!cp || cp.owner === 'neutral') return 0;
        let integrity = 0;
        // Бункеры в радиусе города дают очки прочности
        this.buildings.forEach(b => {
            if (b.faction === cp.owner && b.type && b.type.startsWith('bunker_') && b.hp > 0) {
                if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80) integrity += Math.max(0, b.hp);
            }
        });
        // Уровень обороны территории тоже даёт очки прочности
        const stats = this.getTerritoryDefenseStats(cp.defenseLevel || 0);
        integrity += stats.hp;
        return integrity;
    }

    // Вражеская техника не может заехать на территорию города, пока цела оборона
    isCityZoneBlockedFor(x, y, unit) {
        if (unit.type === 'infantry') return false; // Пехота может проходить
        for (const cp of this.cps) {
            if (cp.owner === 'neutral' || cp.owner === unit.faction) continue;
            const d = dist(x, y, cp.x, cp.y);
            if (d <= cp.radius && this.getCityDefenseIntegrity(cp) > 0) return true;
        }
        return false;
    }

    // Захват возможен только если уничтожена вся оборона города
    isCityDefenseBroken(cp) {
        return this.getCityDefenseIntegrity(cp) <= 0;
    }

    updateUnits() {
        // Централизованные решения об отводе повреждённой техники ИИ.
        // Раньше техника ИИ начинала отводиться даже после небольшого урона,
        // теперь порог — 50% HP + шанс остаться на позиции (см. ai.shouldRetreat).
        if (this.aiController && typeof this.aiController.makeRetreatDecisions === 'function') {
            this.aiController.makeRetreatDecisions();
        }

        this.units.forEach(u => {
            // Update game time for reload calculation
            u.gameTime = this.time;

            // Если юнит долечился выше порога — снимаем с него решение «держать позицию»
            if (u.holdPosition && u.hp >= (u.maxHp || 100) * 0.5) {
                u.holdPosition = false;
                u.retreatDecisionAt = undefined;
            }

            // Артиллерия сама не ездит кругами: без приказа она стоит на месте
            // (стрельба обрабатывается ниже по aoeTarget / автоатаке)
            // ИСПРАВЛЕНИЕ «арта крутится на месте и почти не едет»: раньше по
            // пути к цели арта останавливалась у стены обороны города
            // (isCityZoneBlockedFor) или у чужих юнитов, а детour-логика
            // каждые ~30 тиков разворачивала её на ±60°, из-за чего она
            // вращалась вокруг своей цели вместо движения. Теперь артиллерия
            // игнорирует блокировку зоной обороны при движении (она всё равно
            // не может стрелять в упор — minRange сам отодвинет её назад) и
            // при застревании делает ОДИН плавный шаг в сторону, продолжая
            // движение к цели.
            // Прибытие: снимаем отметку «отводится на базу», иначе юнит не сможет
            // получить новые приказы (см. defensiveReactions / expandAndCapture).
            if (u.retreatToBase && dist(u.x, u.y, u.tx, u.ty) <= 15) {
                u.retreatToBase = false;
            }
            if (u.aoe && u.tx !== undefined) {
                const dToOrder = dist(u.x, u.y, u.tx, u.ty);
                if (dToOrder < 10) {
                    // Прибыли к цели приказа — приказ выполнен
                    u.tx = undefined;
                    u.ty = undefined;
                    u.detourSide = undefined;
                    u.stuckCounter = 0;
                    if (u.retreatOrder) {
                        aiLog(`[GAME][ARTILLERY] ${u.label}: отъехала на позицию (${Math.round(u.x)}, ${Math.round(u.y)})`);
                        u.retreatOrder = null;
                    }
                    if (u.moveOrder) {
                        aiLog(`[GAME][ARTILLERY] ${u.label}: выдвинулась на огневую позицию (${Math.round(u.x)}, ${Math.round(u.y)}), стоит и ждёт цель в зоне ${u.minRange}-${u.range}`);
                        u.moveOrder = null;
                    }
                }
            }
            
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
                    // Add random spread to artillery shots
                    const spread = 30; // Random spread in pixels
                    const randomX = u.aoeTarget.x + (Math.random() - 0.5) * spread;
                    const randomY = u.aoeTarget.y + (Math.random() - 0.5) * spread;
                    attackTarget = { x: randomX, y: randomY };
                    canAttack = true;
                    
                    // Track shots fired
                    if (u.shotsFired === undefined) u.shotsFired = 0;
                    u.shotsFired++;
                    
                    // After 5 shots, clear target
                    if (u.shotsFired >= 5) {
                        u.aoeTarget = null;
                        u.shotsFired = 0;
                    }
                } else if (targetDist < minRange) {
                    // Цель слишком близко — отъезжаем РОВНО ОДИН раз (пока нет
                    // активного приказа) и стоим. Раньше условие было инвертировано
                    // и приказ переставлялся каждый тик — арта «ехала на месте».
                    // holdPosition: ИИ решил держать позицию до конца — не отъезжаем.
                    if (!u.retreatOrder && u.tx === undefined && !u.holdPosition) {
                        const retreatAngle = Math.atan2(u.y - u.aoeTarget.y, u.x - u.aoeTarget.x);
                        u.retreatOrder = { x: u.x + Math.cos(retreatAngle) * (minRange + 60), y: u.y + Math.sin(retreatAngle) * (minRange + 60) };
                        u.tx = u.retreatOrder.x;
                        u.ty = u.retreatOrder.y;
                    }
                    u.aoeTarget = null; // Clear target
                    u.shotsFired = 0;
                }
            } else if (nearest && nearest.hp > 0) {
                const targetDist = dist(u.x, u.y, nearest.x, nearest.y);
                const minRange = u.minRange || 0;
                
                // Check if target is in attack range
                if (targetDist <= u.range && targetDist >= minRange && u.dmg > 0 && u.cd > 0) {
                    attackTarget = nearest;
                    canAttack = true;
                } else if (targetDist < minRange && u.aoe) {
                    // Artillery: цель слишком близко. ИСПРАВЛЕНИЕ «крутится на
                    // месте»: раньше арта при ЛЮБОМ движении автоматически
                    // отъезжала от ближайшей цели (даже если игрок просто гнал
                    // её через карту к точке X — она сворачивала с приказа и
                    // начинала отъезжать/разворачиваться от каждого встречного
                    // юнита). Теперь смещение для атаки не нужно: авто-отъезд
                    // происходит ТОЛЬКО когда у артцели стоит явный приказ огня
                    // (aoeTarget) или когда арта стоит без приказа движения.
                    // Если едет по приказу — просто едет дальше.
                    if (u.aoeTarget && !u.retreatOrder && u.tx === undefined && !u.holdPosition) {
                        const retreatAngle = Math.atan2(u.y - u.aoeTarget.y, u.x - u.aoeTarget.y);
                        u.retreatOrder = { x: u.x + Math.cos(retreatAngle) * (minRange + 60), y: u.y + Math.sin(retreatAngle) * (minRange + 60) };
                        u.tx = u.retreatOrder.x;
                        u.ty = u.retreatOrder.y;
                    }
                }
            }
            
            // Attack if possible
            let isAttacking = false;
            if (canAttack && attackTarget) {
                const timeSinceLastAttack = this.time - u.lastAtk;
                if (timeSinceLastAttack >= u.cd) {
                    // Проверка БК перед атакой
                    if (!u.canAttack || u.canAttack()) {
                        isAttacking = true;
                        u.lastAtk = this.time;
                        
                        // Расход БК при атаке
                        if (u.useAmmo) {
                            u.useAmmo();
                        }
                        
                        // Artillery AoE attack
                        if (u.aoe && u.aoeRadius) {
                            // Add artillery tracer
                            this.addTracer(u.x, u.y, attackTarget.x, attackTarget.y, 'artillery');
                            
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
                            // Защита от падения: у построек (зданий) нет takeDamage —
                            // раньше юниты, стреляющие по зданию, роняли весь игровой цикл
                            // (TypeError), из-за чего игра «змирала»: ИИ переставал работать,
                            // а артиллерия seemed to disappear.
                            if (typeof attackTarget.takeDamage !== 'function') {
                                canAttack = false;
                                isAttacking = false;
                            } else {
                            // Add tracer based on unit type
                            let tracerType = 'bullet';
                            if (u.type === 'warden_artillery' || u.type === 'colonial_artillery') {
                                tracerType = 'shell';
                            } else if (u.type === 'silverhand') {
                                tracerType = 'shell';
                            } else if (u.type === 'nemesis' && u.grenadeLauncher) {
                                tracerType = 'grenade';
                            }
                            
                            this.addTracer(u.x, u.y, attackTarget.x, attackTarget.y, tracerType);
                            
                            // Special attack handling
                            let damage = u.dmg;
                            
                            // Scorpion: increased damage to infantry
                            if (u.antiInfantry && attackTarget.type === 'infantry') {
                                damage *= u.infantryMultiplier || 2.5;
                            }
                            
                            // Silverhand: dual gun attack (two shots)
                            if (u.dualGun) {
                                attackTarget.takeDamage(damage);
                                // Second shot with slight delay effect
                                setTimeout(() => {
                                    if (attackTarget.hp > 0) {
                                        attackTarget.takeDamage(Math.floor(damage * 0.7)); // Second gun does 70% damage
                                    }
                                }, 100);
                            }
                            
                            // Nemesis: grenade launcher AoE
                            if (u.grenadeLauncher && attackTarget.type === 'infantry') {
                                // Grenade affects nearby infantry
                                this.units.forEach(enemy => {
                                    if (enemy.faction !== u.faction && enemy.hp > 0 && enemy.type === 'infantry') {
                                        const distToTarget = dist(attackTarget.x, attackTarget.y, enemy.x, enemy.y);
                                        if (distToTarget <= (u.grenadeRadius || 40)) {
                                            enemy.takeDamage(Math.floor(damage * 0.6));
                                        }
                                    }
                                });
                                // Grenade explosion effect
                                this.addParticles(attackTarget.x, attackTarget.y, '#9c27b0', 8);
                            }
                            
                            attackTarget.takeDamage(damage);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 4);
                            }
                        }
                    }
                }
            }
            
            // Move to target - can move even if enemy is nearby but out of range
            // Only stop moving if actively attacking
            if (!isAttacking && u.tx !== undefined) {
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
                            // ИСПРАВЛЕНИЕ «артиллерия крутится на месте и не едет»:
                            // раньше детour ПЕРЕЗАПИСЫВАЛ цель приказа (tx/ty) коротким
                            // шагом в сторону — приказ терялся, а попытка «вернуть» его
                            // зацикливала арту между двумя точками. Теперь приказ при
                            // застревании НЕ меняется вообще: делаем лишь короткий
                            // боковой СДВИГ ПОЗИЦИИ (шаг в сторону), после чего юнит
                            // продолжает движение к исходной точке приказа.
                            if (u.aoe) {
                                const toGoal = Math.atan2(u.ty - u.y, u.tx - u.x);
                                if (u.detourSide === undefined) {
                                    u.detourSide = Math.random() > 0.5 ? 1 : -1;
                                }
                                const sideAngle = toGoal + u.detourSide * Math.PI / 2;
                                const step = 30;
                                const sx = u.x + Math.cos(sideAngle) * step;
                                const sy = u.y + Math.sin(sideAngle) * step;
                                if (!this.isBlockedForVehicle(sx, sy, u)) {
                                    u.x = sx; u.y = sy;
                                } else {
                                    // в другую сторону
                                    const sa2 = toGoal - u.detourSide * Math.PI / 2;
                                    const bx = u.x + Math.cos(sa2) * step;
                                    const by = u.y + Math.sin(sa2) * step;
                                    if (!this.isBlockedForVehicle(bx, by, u)) { u.x = bx; u.y = by; }
                                }
                                u.stuckCounter = 0;
                            } else {
                                // Обычные юниты: классический обходной манёвр
                                const angle = Math.atan2(u.ty - u.y, u.tx - u.x);
                                const detourAngle = angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                                const detourDist = 50;
                                u.tx = u.x + Math.cos(detourAngle) * detourDist;
                                u.ty = u.y + Math.sin(detourAngle) * detourDist;
                                u.stuckCounter = 0;
                            }
                        }

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
                            // СМЕНА ПРИКАЗА (пользователем или ИИ) — старый
                            // orderOrigin недостижим: забываем детour-состояние,
                            // иначе юнит «зацикливается» между временной точкой
                            // и несуществующей старой целью (фикс «арта не едет
                            // к новой точке и крутится на месте»).
                            if (u.orderOrigin !== undefined &&
                                dist(u.x, u.y, u.orderOrigin.x, u.orderOrigin.y) > 600) {
                                u.orderOrigin = undefined;
                                u.detourSide = undefined;
                            }
                            if (u.aoe) {
                                // ИСПРАВЛЕНИЕ «артиллерия крутится на месте и почти
                                // не едет»: раньше каждый «застрявший» детour
                                // перезаписывал u.tx/u.ty коротким шагом в сторону —
                                // приказ терялся, арта описывала circle-траектории и
                                // топталась. Теперь: исходная точка приказа сохраняется
                                // (orderOrigin) и ВСЕГДА восстанавливается после шага
                                // в сторону — арта просто едет к цели, огибая помеху.
                                if (u.orderOrigin === undefined) {
                                    u.orderOrigin = { x: u.tx, y: u.ty };
                                }
                                const ox = u.orderOrigin.x, oy = u.orderOrigin.y;
                                const toGoal = Math.atan2(oy - u.y, ox - u.x);
                                // сторона обхода фиксируется один раз на приказ
                                if (u.detourSide === undefined) {
                                    u.detourSide = Math.random() > 0.5 ? 1 : -1;
                                }
                                const detourAngle = toGoal + u.detourSide * Math.PI / 3;
                                const step = 70;
                                u.tx = u.x + Math.cos(detourAngle) * step;
                                u.ty = u.y + Math.sin(detourAngle) * step;
                                u.stuckCounter = 0;
                            } else {
                                // Пытаемся обойти препятствие
                                const angle = Math.atan2(u.ty - u.y, u.tx - u.x);
                                const detourAngle = angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                                const detourDist = 50;
                                u.tx = u.x + Math.cos(detourAngle) * detourDist;
                                u.ty = u.y + Math.sin(detourAngle) * detourDist;
                                u.stuckCounter = 0;
                            }
                        }
                        
                        u.lastX = u.x;
                        u.lastY = u.y;
                        
                        // Проверяем, находится ли юнит на дороге
                        const onRoad = this.isOnRoad(u.x, u.y);
                        
                        // Применяем модификаторы скорости
                        let speedModifier = 1.0;
                        if (onRoad) {
                            speedModifier = 1.1; // +10% на дорогах для всех
                            if (u.tracked) {
                                speedModifier = 0.7; // -30% для гусеничных на дорогах
                            }
                        } else {
                            speedModifier = 0.7; // -30% на земле для всех
                            if (u.tracked) {
                                speedModifier = 1.0; // Гусеничные не теряют скорость на земле
                            }
                        }
                        
                        const effectiveSpeed = u.spd * speedModifier;
                        const r = effectiveSpeed / d;
                        const nx = u.x + (u.tx - u.x) * r;
                        const ny = u.y + (u.ty - u.y) * r;
                        // Check buildings (vehicles only)
                        const blockedByBuilding = this.isBlockedForVehicle(nx, ny, u);
                        // Вражеская техника не может заехать на территорию города, пока цела оборона.
                        const blockedByDefense = u.aoe ? false : this.isCityZoneBlockedFor(nx, ny, u);
                        
                        if (!blockedByBuilding && !blockedByDefense) {
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
                    u.detourSide = undefined;
                    u.stuckCounter = 0;
                }
            }
        });
    }

    updateCapturePoints() {
        this.cps.forEach(cp => {
            const pU = this.units.filter(u => u.faction === this.faction && dist(u.x, u.y, cp.x, cp.y) <= cp.radius);
            const aU = this.units.filter(u => u.faction === this.ai && dist(u.x, u.y, cp.x, cp.y) <= cp.radius);
            
            // Захват чужого города возможен только если уничтожена вся его оборона
            const defenseBroken = cp.owner === 'neutral' || this.isCityDefenseBroken(cp);
            
            if (pU.length > 0 && aU.length === 0 && cp.owner !== this.faction && defenseBroken) {
                cp.progress = Math.min(100, cp.progress + pU.length * 0.2);
                cp.capturing = this.faction;
                if (cp.progress >= 100) {
                    cp.owner = this.faction;
                    cp.defenseLevel = 0; // Новая оборона строится с нуля
                    this.notify?.(cp.name + ' захвачен!');
                }
            } else if (aU.length > 0 && pU.length === 0 && cp.owner !== this.ai && defenseBroken) {
                cp.progress = Math.min(100, cp.progress + aU.length * 0.15);
                cp.capturing = this.ai;
                if (cp.progress >= 100) {
                    cp.owner = this.ai;
                    cp.defenseLevel = 0;
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
    
    isOnRoad(x, y) {
        // Import ROADS from map.js
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
        
        const roadWidth = 15; // Half of road width (24px / 2 + margin)
        
        for (const road of ROADS) {
            const fromX = road.from[0] * 250 + 125;
            const fromY = road.from[1] * 150 + 75;
            const toX = road.to[0] * 250 + 125;
            const toY = road.to[1] * 150 + 75;
            
            // Calculate control point for quadratic curve
            const midX = (fromX + toX) / 2 + (toY - fromY) * road.curve;
            const midY = (fromY + toY) / 2 - (toX - fromX) * road.curve;
            
            // Check distance to road using multiple points along the curve
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                // Quadratic bezier curve formula
                const px = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * midX + t * t * toX;
                const py = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * midY + t * t * toY;
                
                const d = dist(x, y, px, py);
                if (d < roadWidth) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    handleLogistics(unit) {
        // ИСПРАВЛЕНИЕ «чинит/пополняет один раз и не полностью»:
        // 1) раньше цель выбиралась как «ближайший сосед на дистанции <50» —
        //    инженер мог «чинить» уже целого юнита или самого себя косвенно,
        //    а реально повреждённая техника оставалась без помощи;
        // 2) пополнение шло одному ближайшему соседу и прекращалось, когда
        //    у логиста кончался заряд (ёмкость была МЕНЬШЕ maxHp/maxAmmo
        //    техники — даже одного полного ремонта не хватало).
        // Теперь: цель = ближайший НУЖДАЮЩИЙСЯ союзник (именно в этом ресурсе),
        // пополнение идёт НЕПРЕРЫВНО каждый тик, пока логист стоит рядом,
        // ёмкости логистов увеличены (см. SUPPLY_SYSTEM).

        const needsResource = (u) => {
            switch (unit.type) {
                case 'truck':      return u.ammo !== undefined && u.maxAmmo !== undefined && u.ammo < u.maxAmmo - 0.5;
                case 'fuel_truck': return u.fuel !== undefined && u.maxFuel !== undefined && u.fuel < u.maxFuel - 0.5;
                case 'engineer':   return u.hp < u.maxHp - 0.5;
                case 'flatbed':    return !!u.aoe && u.ammo !== undefined && u.maxAmmo !== undefined && u.ammo < u.maxAmmo - 0.5;
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

        // Радиус работы: инженер — repairRange, остальные — вплотную (60px)
        const range = unit.type === 'engineer' ? (unit.repairRange || 100) : 60;
        if (tDist > range) return; // ещё едет к цели — дистанционно не пополняем

        // НЕПРЕРЫВНОЕ пополнение каждый тик, пока оба живы и рядом
        if (unit.type === 'truck') unit.supplyAmmo(target);
        else if (unit.type === 'fuel_truck') unit.supplyFuel(target);
        else if (unit.type === 'engineer') unit.repairUnit(target);
        else if (unit.type === 'flatbed') unit.supplyArtillery(target);
    }

    // Система обороны территорий (улучшение занимает время)
    getDefenseUpgradeTime(targetLevel) {
        // Время улучшения в секундах для 1-2-3 уровней
        return [0, 15, 25, 40][targetLevel] || 30;
    }

    upgradeTerritoryDefense(cpIndex) {
        const cp = this.cps[cpIndex];
        if (!cp || cp.owner !== this.faction) return false;
        if (cp.defenseLevel >= 3) return false; // Максимум 3 уровня
        if (cp.upgrading) return false; // Уже идёт улучшение
        
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
        
        // Ставим улучшение в очередь - оно завершится через buildTime секунд
        const targetLevel = cp.defenseLevel + 1;
        cp.upgrading = {
            targetLevel,
            startTime: this.time,
            buildTime: this.getDefenseUpgradeTime(targetLevel) * 60, // тики
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
            { damage: 0, range: 0, hp: 0 },      // Уровень 0 - нет обороны
            { damage: 15, range: 120, hp: 300 },  // Уровень 1
            { damage: 25, range: 150, hp: 600 },  // Уровень 2
            { damage: 40, range: 180, hp: 1000 }, // Уровень 3 + защита от артиллерии
        ];
        return stats[defenseLevel] || stats[0];
    }
    
    // Прочность обороны города для отображения (очки прочности)
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
    
    // Система укреплений (старая - можно удалить)
    buildFortification(type, x, y, faction, aiResources = null) {
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
        
        // Проверка ресурсов. ИИ платит из своего отдельного пула (aiController.aiResources),
        // иначе он тратил ресурсы игрока и никогда не мог позволить себе
        // средние/тяжёлые бункеры (линия обороны у базы не строилась).
        const payPool = aiResources || this.res;
        if (payPool.s < cost.s || payPool.c < cost.c || payPool.m < cost.m) {
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
        
        // Списываем ресурсы (у ИИ — из его пула)
        payPool.s -= cost.s;
        payPool.c -= cost.c;
        payPool.m -= cost.m;
        
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
                    this.addTracer(b.x, b.y, nearestEnemy.x, nearestEnemy.y, 'defense');
                    this.addParticles(nearestEnemy.x, nearestEnemy.y, '#ffcc00', 3);
                }
            }
        });
        
        // Очередь улучшения обороны территорий (с временем улучшения)
        this.updateDefenseUpgrades();
        
        // Оборона территорий атакует врагов
        this.cps.forEach(cp => {
            if (cp.owner !== 'neutral' && cp.defenseLevel > 0 && !cp.upgrading) {
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
                    
                    // Add defense tracer
                    this.addTracer(cp.x, cp.y, nearestEnemy.x, nearestEnemy.y, 'defense');
                    
                    nearestEnemy.takeDamage(stats.damage);
                    
                    // Визуальный эффект выстрела
                    this.addParticles(nearestEnemy.x, nearestEnemy.y, '#ffcc00', 3);
                }
                
                // Уровень 3: защита от артиллерии (каждые 20 секунд)
                if (cp.defenseLevel === 3) {
                    if (cp.lastAntiArtillery === undefined) cp.lastAntiArtillery = 0;
                    
                    // Проверяем кулдаун (20 секунд = 1200 тиков)
                    if (this.time - cp.lastAntiArtillery >= 1200) {
                        // Ищем вражескую артиллерию которая обстреливает эту точку
                        let enemyArtillery = null;
                        let artilleryDist = Infinity;
                        
                        this.units.forEach(u => {
                            if (u.faction !== cp.owner && u.hp > 0 && 
                                (u.type === 'warden_artillery' || u.type === 'colonial_artillery')) {
                                // Проверяем если артиллерия обстреливает эту точку
                                if (u.aoeTarget && dist(u.aoeTarget.x, u.aoeTarget.y, cp.x, cp.y) < cp.radius) {
                                    const d = dist(cp.x, cp.y, u.x, u.y);
                                    if (d < artilleryDist) {
                                        artilleryDist = d;
                                        enemyArtillery = u;
                                    }
                                }
                            }
                        });
                        
                        // Атакуем вражескую артиллерию
                        if (enemyArtillery) {
                            cp.lastAntiArtillery = this.time;
                            const antiArtilleryDamage = 50; // Урон по артиллерии
                            enemyArtillery.takeDamage(antiArtilleryDamage);
                            
                            // Визуальный эффект
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
            fromX, fromY,
            toX, toY,
            currentX: fromX,
            currentY: fromY,
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
            // Двигаем трассер к цели
            const dx = tracer.toX - tracer.currentX;
            const dy = tracer.toY - tracer.currentY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < tracer.speed) {
                tracer.currentX = tracer.toX;
                tracer.currentY = tracer.toY;
                tracer.life--;
            } else {
                tracer.currentX += (dx / dist) * tracer.speed;
                tracer.currentY += (dy / dist) * tracer.speed;
            }
            
            return tracer.life > 0;
        });
    }
    
    // Обновление разведки от танков с revealRadius
    updateReveal() {
        // Очищаем старые разведданные (старше 180 тиков = 3 секунды)
        this.revealedAreas = this.revealedAreas.filter(area => this.time - area.time < 180);
        
        // Добавляем новые разведданные от разведывательных танков
        this.units.forEach(u => {
            if (u.revealRadius && u.hp > 0) {
                // Проверяем, есть ли уже разведданные в этой области
                const existingArea = this.revealedAreas.find(area => 
                    dist(area.x, area.y, u.x, u.y) < area.radius * 0.5
                );
                
                if (!existingArea) {
                    this.revealedAreas.push({
                        x: u.x,
                        y: u.y,
                        radius: u.revealRadius,
                        time: this.time,
                        faction: u.faction
                    });
                }
            }
        });
    }
    
    // Обновление буста для Gallagher Highwayman
    updateBoost() {
        this.units.forEach(u => {
            if (u.canBoost) {
                // Автоматически активируем буст если враг близко и есть топливо
                if (!u.boosting) {
                    const nearbyEnemy = this.units.find(enemy => 
                        enemy.faction !== u.faction && 
                        enemy.hp > 0 && 
                        dist(u.x, u.y, enemy.x, enemy.y) < 150
                    );
                    
                    if (nearbyEnemy && u.fuel > 30) {
                        u.activateBoost();
                    }
                }
                
                // Деактивируем буст если нет топлива или врагов поблизости
                if (u.boosting) {
                    const nearbyEnemy = this.units.find(enemy => 
                        enemy.faction !== u.faction && 
                        enemy.hp > 0 && 
                        dist(u.x, u.y, enemy.x, enemy.y) < 200
                    );
                    
                    if (!nearbyEnemy || u.fuel < 10) {
                        u.deactivateBoost();
                    } else {
                        // Дополнительный расход топлива при бусте
                        u.fuel = Math.max(0, u.fuel - u.boostFuelCost);
                    }
                }
            }
        });
    }
}
