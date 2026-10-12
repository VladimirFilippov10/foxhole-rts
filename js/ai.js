// ===== AI SYSTEM - DEFENSIVE BEHAVIOR =====
import { dist } from './constants.js';
import { createVehicle } from './vehicles.js';

export class AI {
    constructor(gameState) {
        this.G = gameState;
        this.timer = 0;
        this.difficulty = 1;
        this.defenseMode = true; // Начинаем в оборонительном режиме
        this.lastAttackTime = 0;
    }

    update() {
        this.timer++;
        this.difficulty = Math.min(3, 1 + Math.floor(this.timer / 3000)); // Медленнее растёт

        // Проверка лимитов перед производством
        if (!this.G.canProduceUnit('infantry', this.G.ai)) {
            return; // Пропускаем производство если достигнут лимит
        }

        // Спавн пехоты каждые 400 тиков (было 300)
        if (this.timer % 400 === 0) {
            this.spawnInfantrySquad();
        }

        // Спавн техники каждые 700 тиков (было 500)
        if (this.timer % 700 === 0) {
            if (this.G.canProduceUnit('vehicle', this.G.ai)) {
                this.spawnVehicle();
            }
        }

        // Оборонительное поведение
        this.defensiveBehavior();
    }

    spawnInfantrySquad() {
        const barracks = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'barracks');
        if (!barracks) return;

        // Меньше пехоты за раз
        const squadSize = 2 + Math.floor(this.difficulty / 2);
        
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

        // Используем технику своей фракции
        const types = this.G.ai === 'wardens' 
            ? ['devitt', 'niska'] 
            : ['hatchet', 'hoplite'];
        
        if (this.difficulty >= 2) {
            if (this.G.ai === 'wardens') types.push('gallagher');
            else types.push('falchion');
        }
        
        const type = types[Math.floor(Math.random() * types.length)];
        const unit = createVehicle(type, this.G.ai, factory.x + 60, factory.y + 60);
        this.G.units.push(unit);

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

    defensiveBehavior() {
        // Переключение между режимами каждые 2000 тиков
        if (this.timer % 2000 === 0) {
            this.defenseMode = !this.defenseMode;
        }

        // Проверяем, нужно ли перейти в оборону
        const aiPoints = this.G.cps.filter(c => c.owner === this.G.ai).length;
        const playerPoints = this.G.cps.filter(c => c.owner === this.G.faction).length;
        
        // Если у игрока больше точек - переходим в оборону
        if (playerPoints > aiPoints + 2) {
            this.defenseMode = true;
        }
        
        // Если у нас больше точек и прошло достаточно времени - атакуем
        if (aiPoints > playerPoints + 2 && this.timer - this.lastAttackTime > 3000) {
            this.defenseMode = false;
            this.lastAttackTime = this.timer;
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
