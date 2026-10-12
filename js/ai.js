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
        // Prioritize: uncaptured points > enemy buildings > enemy units
        const uncaptured = this.G.cps.filter(cp => cp.owner !== this.G.ai);
        if (uncaptured.length > 0) {
            return uncaptured.sort((a, b) => 
                dist(fromX, fromY, a.x, a.y) - dist(fromX, fromY, b.x, b.y)
            )[0];
        }

        const enemyBuildings = this.G.buildings.filter(b => b.faction !== this.G.ai);
        if (enemyBuildings.length > 0) {
            return enemyBuildings.sort((a, b) => 
                dist(fromX, fromY, a.x, a.y) - dist(fromX, fromY, b.x, b.y)
            )[0];
        }

        return null;
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
        const path = [];
        
        // Check if direct path crosses water
        if (!this.crossesWater(fromX, fromY, toX, toY)) {
            return []; // Direct path is fine
        }

        // Need to go through a bridge
        const nearestBridge = BRIDGES.reduce((nearest, bridge) => {
            const d = dist(fromX, fromY, bridge.x, bridge.y) + 
                      dist(bridge.x, bridge.y, toX, toY);
            if (!nearest || d < nearest.dist) {
                return { bridge, dist: d };
            }
            return nearest;
        }, null);

        if (nearestBridge) {
            // Path: current -> bridge -> target
            path.push({ x: nearestBridge.bridge.x, y: nearestBridge.bridge.y });
            path.push({ x: toX, y: toY });
        }

        return path;
    }

    crossesWater(x1, y1, x2, y2) {
        // Check if line segment crosses any river segment
        // Use larger distance (30) to account for river width
        for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
            const p1 = RIVER_POINTS[i];
            const p2 = RIVER_POINTS[i + 1];
            
            // Check multiple points along the line
            const steps = 20;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const px = x1 + (x2 - x1) * t;
                const py = y1 + (y2 - y1) * t;
                
                if (distToSeg(px, py, p1.x, p1.y, p2.x, p2.y) < 30) {
                    return true;
                }
            }
        }
        return false;
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
