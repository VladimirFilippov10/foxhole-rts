// ===== GAME LOGIC =====
import { dist, distToSeg } from './constants.js';
import { RIVER_POINTS } from './map.js';
import { AI } from './ai.js';

export class Game {
    constructor(faction) {
        this.faction = faction;
        this.ai = faction === 'wardens' ? 'colonials' : 'wardens';
        this.res = { s: 200, c: 100, m: 80 };
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

        // Resource generation
        const pts = this.cps.filter(c => c.owner === this.faction).length;
        this.res.s += pts * 0.03;
        this.res.c += pts * 0.015;
        this.res.m += pts * 0.01;

        // Update units
        this.updateUnits();
        
        // Remove dead
        this.units = this.units.filter(u => u.hp > 0);
        this.buildings = this.buildings.filter(b => b.hp > 0);

        // Capture points
        this.updateCapturePoints();
        
        // Mines
        this.updateMines();

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

            // Attack
            if (nearest && nearDist <= u.range && u.dmg > 0) {
                if (this.time - u.lastAtk >= u.cd) {
                    u.lastAtk = this.time;
                    
                    // Artillery AoE attack
                    if (u.aoe && u.aoeRadius) {
                        // Damage all enemies in radius
                        this.units.forEach(enemy => {
                            if (enemy.faction !== u.faction && enemy.hp > 0) {
                                const distToTarget = dist(nearest.x, nearest.y, enemy.x, enemy.y);
                                if (distToTarget <= u.aoeRadius) {
                                    // Damage decreases with distance from center
                                    const damageMultiplier = 1 - (distToTarget / u.aoeRadius) * 0.5;
                                    enemy.takeDamage(Math.floor(u.dmg * damageMultiplier));
                                }
                            }
                        });
                        
                        // Big explosion effect
                        this.addParticles(nearest.x, nearest.y, '#ff6b00', 20);
                        this.addParticles(nearest.x, nearest.y, '#ffcc00', 15);
                        this.addParticles(nearest.x, nearest.y, '#ff0000', 10);
                    } else {
                        // Normal single target attack
                        nearest.takeDamage(u.dmg);
                        this.addParticles(nearest.x, nearest.y, '#ffcc00', 4);
                    }
                }
            }
            // Move to target
            else if (u.tx !== undefined) {
                const d = dist(u.x, u.y, u.tx, u.ty);
                if (d > 5) {
                    const r = u.spd / d;
                    const nx = u.x + (u.tx - u.x) * r;
                    const ny = u.y + (u.ty - u.y) * r;
                    // Check water (all units) and buildings (vehicles only)
                    if (!this.isWater(nx, ny) && !this.isBlockedForVehicle(nx, ny, u)) {
                        u.x = nx;
                        u.y = ny;
                    } else {
                        u.tx = undefined;
                        u.ty = undefined;
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

    isWater(x, y) {
        for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
            const p1 = RIVER_POINTS[i];
            const p2 = RIVER_POINTS[i + 1];
            if (distToSeg(x, y, p1.x, p1.y, p2.x, p2.y) < 20) return true;
        }
        return false;
    }

    isBlockedForVehicle(x, y, unit) {
        // Infantry can pass through buildings
        if (unit.type === 'infantry') return false;
        
        // Check city zones (buildings block vehicles)
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
            // Vehicles blocked in inner part of city (where buildings are)
            if (d < zone.radius * 0.4) return true;
        }
        
        return false;
    }

    checkWinCondition() {
        const pPts = this.cps.filter(c => c.owner === this.faction).length;
        const aPts = this.cps.filter(c => c.owner === this.ai).length;
        
        if (pPts >= 7) {
            this.over = true;
            this.winner = this.faction;
        }
        if (aPts >= 7) {
            this.over = true;
            this.winner = this.ai;
        }
        if (!this.buildings.find(b => b.faction === this.faction && b.type === 'town_hall')) {
            this.over = true;
            this.winner = this.ai;
        }
        if (!this.buildings.find(b => b.faction === this.ai && b.type === 'town_hall')) {
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
