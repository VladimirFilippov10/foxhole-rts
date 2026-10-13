// ===== AI SYSTEM - STRATEGIC BEHAVIOR =====
import { dist, VEHICLE_COSTS } from './constants.js';
import { createVehicle } from './vehicles.js';

export class AI {
    constructor(gameState) {
        this.G = gameState;
        this.timer = 0;
        this.difficulty = 1;
        this.defenseMode = true; // Начинаем в оборонительном режиме
        this.lastAttackTime = 0;
        this.accumulatedForces = 0; // Счётчик накопленных сил
        this.attackThreshold = 12; // Увеличен порог для начала атаки
        this.artilleryPositions = []; // Позиции для артиллерии
        
        // Система ресурсов ИИ (медленнее чем у игрока)
        this.aiResources = {
            s: 150, // Начальные ресурсы
            c: 75,
            m: 60,
        };
        this.aiResourceRate = 0.6; // Множитель скорости фарма (60% от игрока)
    }

    update() {
        this.timer++;
        this.difficulty = Math.min(3, 1 + Math.floor(this.timer / 4000)); // Ещё медленнее растёт
        
        // Генерация ресурсов ИИ (медленнее чем у игрока)
        this.updateAIResources();

        // Проверка доминирования игрока (больше 50% точек)
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;
        const totalPoints = this.G.cps.length;
        const playerDominance = playerPoints > totalPoints * 0.5;
        
        // Базовые интервалы спавна
        const baseInfantryInterval = 900;
        const baseVehicleInterval = 1500;
        
        // До 50% точек: ИИ спавнит в 3 раза медленнее базового
        // После 50% точек: ИИ спавнит в 2 раза медленнее базового
        const spawnMultiplier = playerDominance ? 2 : 3;
        const actualInfantryInterval = baseInfantryInterval * spawnMultiplier;
        const actualVehicleInterval = baseVehicleInterval * spawnMultiplier;

        // Спавн пехоты (с учётом доминирования И лимита пехоты).
        // ВАЖНО: лимит блокирует только производство, но НЕ вывод из строя всего ИИ.
        // (раньше здесь был `return` — при достижении лимита пехоты ИИ полностью
        //  замирал: переставал атаковать, управлять артиллерией и строить укрепления)
        let spawnedThisTick = false;
        if (this.timer % actualInfantryInterval === 0) {
            if (this.G.canProduceUnit('infantry', this.G.ai) && this.canAffordInfantry()) {
                this.spawnInfantrySquad();
                this.accumulatedForces++;
                spawnedThisTick = true;
            }
        }

        // Спавн техники (с учётом доминирования)
        if (this.timer % actualVehicleInterval === 0) {
            if (this.G.canProduceUnit('vehicle', this.G.ai) && this.canAffordVehicle()) {
                this.spawnVehicle();
                this.accumulatedForces += 2; // Техника ценнее
                spawnedThisTick = true;
            }
        }

        // Стратегическое поведение
        this.strategicBehavior();
        
        // Управление артиллерией
        this.manageArtillery();
        
        // Строительство укреплений (медленнее чем игрок)
        this.buildFortifications();
        // Оборонительные действия (не зависят от лимитов производства)
        if (!spawnedThisTick) this.defensiveReactions();
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
            u.faction === this.G.ai && u.hp > 0 && u.tx === undefined && !u.aoe
        );
        idle.slice(0, 4).forEach(u => {
            u.tx = target.x + (Math.random() - 0.5) * 60;
            u.ty = target.y + (Math.random() - 0.5) * 60;
        });
    }
    
    buildFortifications() {
        // ИИ строит бункеры каждые 2000 тиков (медленнее чем игрок)
        if (this.timer % 2000 !== 0) return;
        
        // Проверяем ресурсы на бункер
        const bunkerCost = { s: 30, c: 20, m: 25 }; // Лёгкий бункер
        if (this.aiResources.s < bunkerCost.s || 
            this.aiResources.c < bunkerCost.c || 
            this.aiResources.m < bunkerCost.m) {
            return;
        }
        
        // Находим свои территории
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai);
        if (aiPoints.length === 0) return;
        
        // Выбираем случайную территорию для защиты
        const targetPoint = aiPoints[Math.floor(Math.random() * aiPoints.length)];
        
        // Проверяем сколько уже бункеров рядом
        const nearbyBunkers = this.G.buildings.filter(b => 
            b.faction === this.G.ai && 
            b.type && b.type.startsWith('bunker_') &&
            dist(b.x, b.y, targetPoint.x, targetPoint.y) < targetPoint.radius + 80
        );
        
        // Строим максимум 2 бункера на точку
        if (nearbyBunkers.length >= 2) return;
        
        // Выбираем позицию для бункера
        const angle = Math.random() * Math.PI * 2;
        const distance = targetPoint.radius * 0.6;
        const buildX = targetPoint.x + Math.cos(angle) * distance;
        const buildY = targetPoint.y + Math.sin(angle) * distance;
        
        // Строим бункер (ИИ строит медленнее - увеличиваем время строительства)
        const fortification = this.G.buildFortification('bunker_light', buildX, buildY, this.G.ai);
        if (fortification) {
            // Увеличиваем время строительства для ИИ
            fortification.buildTime *= 1.5; // ИИ строит в 1.5 раза медленнее
            this.spendResources(bunkerCost);
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
                
                // Артиллерия остаётся в оборонительной позиции
                this.assignArtilleryPosition(unit);
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
        // Переключение между режимами каждые 3000 тиков (было 2000)
        if (this.timer % 3000 === 0) {
            this.defenseMode = !this.defenseMode;
        }

        // Проверяем, нужно ли перейти в оборону
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;
        
        // Если у игрока больше точек - переходим в оборону
        if (playerPoints > aiPoints + 2) {
            this.defenseMode = true;
        }
        
        // Стратегия накопления сил и атаки (более консервативная)
        if (this.accumulatedForces >= this.attackThreshold && this.timer - this.lastAttackTime > 6000) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
            this.accumulatedForces = 0; // Сбрасываем счётчик после атаки
            this.launchAttack();
        }
        
        // Если у нас больше точек и прошло достаточно времени - атакуем (реже)
        if (aiPoints > playerPoints + 3 && this.timer - this.lastAttackTime > 5000) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
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
    }
    
    manageArtillery() {
        // Находим всю артиллерию ИИ
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
            
            // Если цель в радиусе атаки - стреляем
            const targetDist = dist(art.x, art.y, target.cp.x, target.cp.y);
            if (targetDist <= art.range && targetDist >= (art.minRange || 100)) {
                // Устанавливаем цель для AoE атаки
                art.aoeTarget = { x: target.cp.x, y: target.cp.y };
                
                // Отправляем сопровождение к артиллерии
                this.sendEscortToArtillery(art);
            }
            // Если цель слишком близко - отступаем ОДИН раз и стоим (без кругов)
            else if (targetDist < (art.minRange || 100)) {
                if (art.tx === undefined && !art.retreatOrder) {
                    const retreatAngle = Math.atan2(art.y - target.cp.y, art.x - target.cp.x);
                    art.retreatOrder = { x: art.x + Math.cos(retreatAngle) * 150, y: art.y + Math.sin(retreatAngle) * 150 };
                    art.tx = art.retreatOrder.x;
                    art.ty = art.retreatOrder.y;
                }
            }
            // Если цель далеко - двигаемся ближе (только если ещё нет приказа движения).
            // Точку выбираем ЗА ПРЕДЕЛАМИ вражеского города: раньше артиллерия ехала
            // в центр точки (cp.x ± 100), упиралась в стену обороны и «внезапно
            // пропадала» — гибла под обстрелом обороны сразу после начала движения.
            else if (targetDist > art.range) {
                if (art.tx === undefined) {
                    const moveAngle = Math.atan2(target.cp.y - art.y, target.cp.x - art.x);
                    // Останавливаемся на дистанции чуть меньше дальности стрельбы,
                    // но не ближе радиуса города (+ запас), чтобы не заезжать в оборону.
                    const parkDist = Math.max(target.cp.radius + 40, art.range - 60);
                    art.tx = target.cp.x - Math.cos(moveAngle) * parkDist;
                    art.ty = target.cp.y - Math.sin(moveAngle) * parkDist;
                }
            }
        });
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
