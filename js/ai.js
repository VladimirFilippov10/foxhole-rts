// ===== AI SYSTEM WITH PATHFINDING =====
import { dist, distToSeg } from './constants.js';
import { createVehicle } from './vehicles.js';
import { RIVER_POINTS, BRIDGES } from './map.js';

export class AI {
    constructor(gameState) {
        this.G = gameState;
        this.timer = 0;
        this.difficulty = 1;
        this.squadTargets = new Map(); // Track squad objectives
    }

    update() {
        this.timer++;
        this.difficulty = Math.min(3, 1 + Math.floor(this.timer / 2000));

        // Spawn infantry every 300 ticks
        if (this.timer % 300 === 0) {
            this.spawnInfantrySquad();
        }

        // Spawn vehicles every 500 ticks
        if (this.timer % 500 === 0) {
            this.spawnVehicle();
        }

        // Update unit movement with pathfinding
        this.updateUnitMovement();
    }

    spawnInfantrySquad() {
        const barracks = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'barracks');
        if (!barracks) return;

        const squadSize = 3 + this.difficulty;
        for (let i = 0; i < squadSize; i++) {
            const unit = createVehicle('infantry', this.G.ai, 
                barracks.x + 50 + (i % 3) * 20, 
                barracks.y + 50 + Math.floor(i / 3) * 20);
            this.G.units.push(unit);
        }

        // Assign target
        const target = this.findBestTarget(barracks.x, barracks.y);
        if (target) {
            this.assignSquadToTarget(this.G.units.slice(-squadSize), target);
        }
    }

    spawnVehicle() {
        const factory = this.G.buildings.find(b => b.faction === this.G.ai && b.type === 'factory');
        if (!factory) return;

        // Use faction-specific vehicles
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

        const target = this.findBestTarget(factory.x, factory.y);
        if (target) {
            this.assignSquadToTarget([unit], target);
        }
    }

    findBestTarget(fromX, fromY) {
        // Smart targeting: consider distance, value, and strategic importance
        const uncaptured = this.G.cps.filter(cp => cp.owner !== this.G.ai);
        if (uncaptured.length === 0) return null;

        // Score each target based on multiple factors
        const scored = uncaptured.map(cp => {
            const distance = dist(fromX, fromY, cp.x, cp.y);
            let score = 0;
            
            // Prefer closer targets (inverse distance)
            score += 1000 / (distance + 100);
            
            // Prefer targets that are being captured by player (defend/contest)
            if (cp.capturing === this.G.faction) {
                score += 500;
            }
            
            // Prefer strategic positions (larger radius = more important)
            score += cp.radius * 2;
            
            // Add some randomness to avoid predictable behavior
            score += Math.random() * 100;
            
            // Prefer targets on different sides of the map (diversify attacks)
            const myBase = this.G.cps.find(c => c.owner === this.G.ai);
            if (myBase) {
                const targetSide = cp.x < 1500 ? 'left' : 'right';
                const mySide = myBase.x < 1500 ? 'left' : 'right';
                if (targetSide !== mySide) {
                    score += 200; // Bonus for attacking opposite side
                }
            }
            
            return { target: cp, score };
        });

        // Sort by score and pick the best
        scored.sort((a, b) => b.score - a.score);
        return scored[0].target;
    }

    assignSquadToTarget(units, target) {
        const targetPos = { x: target.x, y: target.y };
        units.forEach(unit => {
            // Calculate path with bridge awareness
            const path = this.calculatePath(unit.x, unit.y, targetPos.x, targetPos.y);
            if (path.length > 0) {
                // Set first waypoint
                unit.tx = path[0].x;
                unit.ty = path[0].y;
                unit.path = path; // Store full path for multi-waypoint movement
                unit.pathIndex = 0;
            } else {
                // Direct movement if no path needed
                unit.tx = targetPos.x + (Math.random() - 0.5) * 40;
                unit.ty = targetPos.y + (Math.random() - 0.5) * 40;
            }
        });
    }

    calculatePath(fromX, fromY, toX, toY) {
        // No rivers now, so direct path is always fine
        return [];
    }

    updateUnitMovement() {
        this.G.units.forEach(unit => {
            if (unit.faction !== this.G.ai) return;
            if (unit.tx === undefined) return;

            // Check if reached current waypoint
            const d = dist(unit.x, unit.y, unit.tx, unit.ty);
            if (d < 10 && unit.path && unit.pathIndex < unit.path.length - 1) {
                // Move to next waypoint
                unit.pathIndex++;
                unit.tx = unit.path[unit.pathIndex].x;
                unit.ty = unit.path[unit.pathIndex].y;
            }
        });
    }
}
