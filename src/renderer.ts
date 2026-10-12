import { GameState, FACTION_COLORS, UNIT_STATS, BuildingType, UnitType } from './types';

const TILE_SIZE = 50;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

let particles: Particle[] = [];
let lastAttackFrame: Record<string, number> = {};

function addExplosion(x: number, y: number, color: string, count: number = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 15,
      maxLife: 35,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life--;
    return p.life > 0;
  });
}

function renderParticles(ctx: CanvasRenderingContext2D) {
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
  placingBuilding: BuildingType | null,
  mousePos: { x: number; y: number }
) {
  const cam = state.cameraOffset;

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Background - terrain
  ctx.fillStyle = '#2d4a2e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const startX = -(cam.x % TILE_SIZE);
  const startY = -(cam.y % TILE_SIZE);
  for (let x = startX; x < canvasWidth; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }
  for (let y = startY; y < canvasHeight; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  // Terrain features (rivers, roads)
  ctx.strokeStyle = '#3a6b8a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(1500 - cam.x, 0 - cam.y);
  ctx.bezierCurveTo(1400 - cam.x, 500 - cam.y, 1600 - cam.x, 1000 - cam.y, 1500 - cam.x, 1500 - cam.y);
  ctx.bezierCurveTo(1450 - cam.x, 1700 - cam.y, 1550 - cam.x, 1800 - cam.y, 1500 - cam.x, 2000 - cam.y);
  ctx.stroke();

  // River glow
  ctx.strokeStyle = '#4a8baa30';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(1500 - cam.x, 0 - cam.y);
  ctx.bezierCurveTo(1400 - cam.x, 500 - cam.y, 1600 - cam.x, 1000 - cam.y, 1500 - cam.x, 1500 - cam.y);
  ctx.bezierCurveTo(1450 - cam.x, 1700 - cam.y, 1550 - cam.x, 1800 - cam.y, 1500 - cam.x, 2000 - cam.y);
  ctx.stroke();

  // Roads
  ctx.strokeStyle = '#5a5040';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(0 - cam.x, 1000 - cam.y);
  ctx.lineTo(3000 - cam.x, 1000 - cam.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1500 - cam.x, 0 - cam.y);
  ctx.lineTo(1500 - cam.x, 2000 - cam.y);
  ctx.stroke();

  // Road markings
  ctx.strokeStyle = '#6a6050';
  ctx.lineWidth = 1;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(0 - cam.x, 1000 - cam.y);
  ctx.lineTo(3000 - cam.x, 1000 - cam.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trees (deterministic placement based on position)
  const treeSeed = [
    { x: 200, y: 800 }, { x: 250, y: 850 }, { x: 180, y: 900 },
    { x: 600, y: 200 }, { x: 650, y: 180 }, { x: 700, y: 250 },
    { x: 1100, y: 300 }, { x: 1150, y: 350 }, { x: 1050, y: 280 },
    { x: 1800, y: 500 }, { x: 1850, y: 550 }, { x: 1900, y: 480 },
    { x: 2200, y: 400 }, { x: 2250, y: 350 }, { x: 2300, y: 420 },
    { x: 800, y: 1200 }, { x: 850, y: 1250 }, { x: 750, y: 1180 },
    { x: 1300, y: 1600 }, { x: 1350, y: 1650 }, { x: 1250, y: 1580 },
    { x: 2400, y: 1400 }, { x: 2450, y: 1450 }, { x: 2350, y: 1380 },
    { x: 400, y: 1600 }, { x: 450, y: 1650 }, { x: 350, y: 1580 },
    { x: 2700, y: 600 }, { x: 2750, y: 550 }, { x: 2800, y: 620 },
    { x: 100, y: 1200 }, { x: 150, y: 1250 }, { x: 50, y: 1180 },
    { x: 2000, y: 1600 }, { x: 2050, y: 1650 }, { x: 1950, y: 1580 },
  ];

  treeSeed.forEach(tree => {
    const tx = tree.x - cam.x;
    const ty = tree.y - cam.y;
    if (tx < -30 || tx > canvasWidth + 30 || ty < -30 || ty > canvasHeight + 30) return;

    // Tree shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(tx + 3, ty + 12, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tree trunk
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(tx - 2, ty, 4, 12);

    // Tree canopy
    ctx.fillStyle = '#1a5c1a';
    ctx.beginPath();
    ctx.arc(tx, ty - 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#228b22';
    ctx.beginPath();
    ctx.arc(tx - 2, ty - 4, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Rocks
  const rockPositions = [
    { x: 500, y: 700 }, { x: 1200, y: 800 }, { x: 1700, y: 1200 },
    { x: 2300, y: 900 }, { x: 900, y: 1500 }, { x: 1600, y: 300 },
    { x: 2500, y: 1600 }, { x: 300, y: 1100 },
  ];

  rockPositions.forEach(rock => {
    const rx = rock.x - cam.x;
    const ry = rock.y - cam.y;
    if (rx < -20 || rx > canvasWidth + 20 || ry < -20 || ry > canvasHeight + 20) return;

    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.ellipse(rx, ry, 12, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.ellipse(rx - 2, ry - 2, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Render capture points
  state.capturePoints.forEach(point => {
    const x = point.position.x - cam.x;
    const y = point.position.y - cam.y;

    // Capture circle
    ctx.beginPath();
    ctx.arc(x, y, point.radius, 0, Math.PI * 2);
    const ownerColor = point.owner === 'neutral' ? FACTION_COLORS.neutral :
      FACTION_COLORS[point.owner];
    ctx.fillStyle = ownerColor.primary + '20';
    ctx.fill();
    ctx.strokeStyle = ownerColor.primary;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Capture progress bar
    if (point.capturingFaction) {
      const captureColor = FACTION_COLORS[point.capturingFaction];
      ctx.beginPath();
      ctx.arc(x, y, point.radius * 0.7, -Math.PI / 2, -Math.PI / 2 + (point.captureProgress / 100) * Math.PI * 2);
      ctx.strokeStyle = captureColor.accent;
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Point name
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(point.name, x, y - point.radius - 8);

    // Flag icon
    ctx.fillStyle = ownerColor.primary;
    ctx.fillRect(x - 3, y - 15, 6, 20);
    ctx.fillStyle = ownerColor.accent;
    ctx.fillRect(x + 3, y - 15, 12, 8);
  });

  // Render buildings
  state.buildings.forEach(building => {
    const x = building.position.x - cam.x;
    const y = building.position.y - cam.y;
    const colors = FACTION_COLORS[building.faction];
    const size = 40;

    // Building shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - size / 2 + 3, y - size / 2 + 3, size, size);

    // Building body
    ctx.fillStyle = colors.dark;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    // Building type indicator
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = getBuildingIcon(building.type);
    ctx.fillText(icon, x, y);

    // Health bar
    const healthPercent = building.health / building.maxHealth;
    ctx.fillStyle = '#333';
    ctx.fillRect(x - size / 2, y + size / 2 + 4, size, 4);
    ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(x - size / 2, y + size / 2 + 4, size * healthPercent, 4);

    // Selection indicator
    if (state.selectedBuilding === building.id) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - size / 2 - 5, y - size / 2 - 5, size + 10, size + 10);
      ctx.setLineDash([]);
    }
  });

  // Render units
  state.units.forEach(unit => {
    const x = unit.position.x - cam.x;
    const y = unit.position.y - cam.y;
    const colors = FACTION_COLORS[unit.faction];

    // Skip if off screen
    if (x < -50 || x > canvasWidth + 50 || y < -50 || y > canvasHeight + 50) return;

    const size = getUnitSize(unit.type);

    // Unit shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 2, size / 2, size / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Unit body
    ctx.fillStyle = colors.primary;
    if (unit.type === 'infantry') {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Vehicle
      ctx.fillRect(x - size / 2, y - size / 3, size, size * 0.65);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - size / 2, y - size / 3, size, size * 0.65);

      // Turret for tanks
      if (unit.type === 'light_tank' || unit.type === 'heavy_tank') {
        ctx.fillStyle = colors.secondary;
        ctx.beginPath();
        ctx.arc(x, y, size / 4, 0, Math.PI * 2);
        ctx.fill();
        // Gun barrel
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + size / 2, y);
        ctx.stroke();
      }

      // Artillery marker
      if (unit.type === 'artillery') {
        ctx.fillStyle = colors.accent;
        ctx.fillRect(x - 2, y - size / 2, 4, size / 3);
      }
    }

    // Selection ring
    if (state.selectedUnits.includes(unit.id)) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Health bar
    if (unit.health < unit.maxHealth) {
      const healthPercent = unit.health / unit.maxHealth;
      const barWidth = size;
      ctx.fillStyle = '#333';
      ctx.fillRect(x - barWidth / 2, y - size / 2 - 8, barWidth, 3);
      ctx.fillStyle = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(x - barWidth / 2, y - size / 2 - 8, barWidth * healthPercent, 3);
    }
  });

  // Attack effects
  state.units.forEach(unit => {
    if (unit.lastAttack === state.gameTime && unit.damage > 0) {
      const enemies = state.units.filter(u => u.faction !== unit.faction && u.health > 0);
      const target = enemies.reduce<{ unit: typeof enemies[0] | null; dist: number }>((nearest, enemy) => {
        const dist = distance(unit.position, enemy.position);
        if (dist <= unit.range && (!nearest.unit || dist < nearest.dist)) return { unit: enemy, dist };
        return nearest;
      }, { unit: null, dist: Infinity });

      if (target.unit) {
        const tx = target.unit.position.x - cam.x;
        const ty = target.unit.position.y - cam.y;
        const ux = unit.position.x - cam.x;
        const uy = unit.position.y - cam.y;

        // Draw attack line
        ctx.strokeStyle = unit.type === 'artillery' ? '#ff6b00' : '#ffcc00';
        ctx.lineWidth = unit.type === 'artillery' ? 3 : 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(ux, uy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Add explosion at target
        const key = `${unit.id}_${state.gameTime}`;
        if (!lastAttackFrame[key]) {
          lastAttackFrame[key] = state.gameTime;
          const color = unit.type === 'artillery' ? '#ff6b00' : '#ffcc00';
          addExplosion(tx, ty, color, unit.type === 'artillery' ? 15 : 6);
        }
      }
    }
  });

  // Update and render particles
  updateParticles();
  renderParticles(ctx);

  // Placing building preview
  if (placingBuilding) {
    const x = mousePos.x;
    const y = mousePos.y;
    const size = 40;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getBuildingIcon(placingBuilding), x, y);
  }

  // Minimap
  renderMinimap(ctx, state, canvasWidth, canvasHeight);

  ctx.restore();
}

function renderMinimap(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number, canvasHeight: number) {
  const mmWidth = 180;
  const mmHeight = 120;
  const mmX = canvasWidth - mmWidth - 10;
  const mmY = canvasHeight - mmHeight - 10;
  const scaleX = mmWidth / state.mapWidth;
  const scaleY = mmHeight / state.mapHeight;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(mmX - 2, mmY - 2, mmWidth + 4, mmHeight + 4);
  ctx.fillStyle = '#1a2e1a';
  ctx.fillRect(mmX, mmY, mmWidth, mmHeight);

  // Capture points
  state.capturePoints.forEach(point => {
    const x = mmX + point.position.x * scaleX;
    const y = mmY + point.position.y * scaleY;
    const color = point.owner === 'neutral' ? '#6b7280' :
      point.owner === 'wardens' ? '#2563eb' : '#dc2626';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Buildings
  state.buildings.forEach(building => {
    const x = mmX + building.position.x * scaleX;
    const y = mmY + building.position.y * scaleY;
    ctx.fillStyle = building.faction === 'wardens' ? '#2563eb' : '#dc2626';
    ctx.fillRect(x - 2, y - 2, 4, 4);
  });

  // Units
  state.units.forEach(unit => {
    const x = mmX + unit.position.x * scaleX;
    const y = mmY + unit.position.y * scaleY;
    ctx.fillStyle = unit.faction === state.playerFaction ? '#60a5fa' : '#f87171';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  });

  // Camera viewport
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mmX + state.cameraOffset.x * scaleX,
    mmY + state.cameraOffset.y * scaleY,
    canvasWidth * scaleX,
    canvasHeight * scaleY
  );

  // Border
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 2;
  ctx.strokeRect(mmX - 2, mmY - 2, mmWidth + 4, mmHeight + 4);
}

function getBuildingIcon(type: BuildingType): string {
  switch (type) {
    case 'town_hall': return 'HQ';
    case 'factory': return 'FAC';
    case 'barracks': return 'BAR';
    case 'refinery': return 'REF';
    case 'garrison': return 'GAR';
    case 'artillery_outpost': return 'ART';
  }
}

function getUnitSize(type: UnitType): number {
  switch (type) {
    case 'infantry': return 10;
    case 'light_tank': return 22;
    case 'heavy_tank': return 28;
    case 'truck': return 20;
    case 'artillery': return 24;
    case 'halftrack': return 22;
  }
}
