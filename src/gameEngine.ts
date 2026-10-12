import { GameState, Faction, Unit, Building, CapturePoint, Position, UnitType, BuildingType, UNIT_STATS, BUILDING_STATS, Resource } from './types';

let nextId = 1;
const getId = () => `entity_${nextId++}`;

export function createInitialState(playerFaction: Faction): GameState {
  const mapWidth = 3000;
  const mapHeight = 2000;
  const aiFaction: Faction = playerFaction === 'wardens' ? 'colonials' : 'wardens';

  const capturePoints: CapturePoint[] = [
    { id: getId(), name: 'Clanshead Valley', position: { x: 400, y: 400 }, radius: 80, owner: playerFaction, captureProgress: 100, capturingFaction: undefined },
    { id: getId(), name: 'Godcrofts', position: { x: 900, y: 600 }, radius: 80, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
    { id: getId(), name: 'Oar\'s Rest', position: { x: 1500, y: 400 }, radius: 80, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
    { id: getId(), name: 'Merentis', position: { x: 1500, y: 1000 }, radius: 90, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
    { id: getId(), name: 'Fisherman\'s Row', position: { x: 2100, y: 700 }, radius: 80, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
    { id: getId(), name: 'Callahan\'s Passage', position: { x: 2100, y: 1300 }, radius: 80, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
    { id: getId(), name: 'Basrash', position: { x: 2600, y: 1000 }, radius: 90, owner: aiFaction, captureProgress: 100, capturingFaction: undefined },
    { id: getId(), name: 'Kalokai', position: { x: 1200, y: 1500 }, radius: 80, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
    { id: getId(), name: 'Allod\'s Reach', position: { x: 700, y: 1400 }, radius: 80, owner: 'neutral', captureProgress: 0, capturingFaction: undefined },
  ];

  const buildings: Building[] = [
    { id: getId(), type: 'town_hall', faction: playerFaction, position: { x: 300, y: 350 }, health: 1000, maxHealth: 1000 },
    { id: getId(), type: 'barracks', faction: playerFaction, position: { x: 500, y: 350 }, health: 400, maxHealth: 400 },
    { id: getId(), type: 'town_hall', faction: aiFaction, position: { x: 2700, y: 1000 }, health: 1000, maxHealth: 1000 },
    { id: getId(), type: 'barracks', faction: aiFaction, position: { x: 2500, y: 1000 }, health: 400, maxHealth: 400 },
    { id: getId(), type: 'factory', faction: aiFaction, position: { x: 2600, y: 1150 }, health: 500, maxHealth: 500 },
  ];

  const units: Unit[] = [
    ...createSquad(playerFaction, { x: 350, y: 450 }, 'infantry', 5),
    ...createSquad(aiFaction, { x: 2650, y: 1050 }, 'infantry', 5),
    ...createSquad(aiFaction, { x: 2550, y: 950 }, 'light_tank', 2),
  ];

  return {
    playerFaction,
    resources: { supplies: 200, components: 100, materials: 80 },
    units,
    buildings,
    capturePoints,
    selectedUnits: [],
    selectedBuilding: null,
    gameTime: 0,
    gameOver: false,
    winner: null,
    cameraOffset: { x: 0, y: 0 },
    mapWidth,
    mapHeight,
  };
}

function createSquad(faction: Faction, position: Position, type: UnitType, count: number): Unit[] {
  const stats = UNIT_STATS[type];
  const units: Unit[] = [];
  for (let i = 0; i < count; i++) {
    units.push({
      id: getId(),
      type,
      faction,
      position: {
        x: position.x + (i % 3) * 30 - 30,
        y: position.y + Math.floor(i / 3) * 30 - 15,
      },
      health: stats.health,
      maxHealth: stats.health,
      damage: stats.damage,
      range: stats.range,
      speed: stats.speed,
      attackCooldown: type === 'artillery' ? 120 : 60,
      lastAttack: 0,
    });
  }
  return units;
}

function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function moveTowards(from: Position, to: Position, speed: number): Position {
  const dist = distance(from, to);
  if (dist < speed) return { ...to };
  const ratio = speed / dist;
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

export function updateGameState(state: GameState): GameState {
  if (state.gameOver) return state;

  const newState = { ...state, gameTime: state.gameTime + 1 };
  const aiFaction: Faction = state.playerFaction === 'wardens' ? 'colonials' : 'wardens';

  // Resource generation from capture points
  const playerPoints = state.capturePoints.filter(p => p.owner === state.playerFaction).length;
  newState.resources = {
    supplies: state.resources.supplies + playerPoints * 0.5,
    components: state.resources.components + playerPoints * 0.2,
    materials: state.resources.materials + playerPoints * 0.15,
  };

  // Update unit movement and combat
  newState.units = state.units.map(unit => {
    let updatedUnit = { ...unit };

    // Find nearest enemy
    const enemies = state.units.filter(u => u.faction !== unit.faction && u.health > 0);
    const nearestEnemy = enemies.reduce<Unit | null>((nearest, enemy) => {
      const dist = distance(unit.position, enemy.position);
      if (!nearest || dist < distance(unit.position, nearest.position)) return enemy;
      return nearest;
    }, null);

    // Check for enemy buildings
    const enemyBuildings = state.buildings.filter(b => b.faction !== unit.faction && b.health > 0);
    const nearestBuilding = enemyBuildings.reduce<Building | null>((nearest, building) => {
      const dist = distance(unit.position, building.position);
      if (!nearest || dist < distance(unit.position, nearest.position)) return building;
      return nearest;
    }, null);

    // Attack logic
    if (nearestEnemy && distance(unit.position, nearestEnemy.position) <= unit.range) {
      if (newState.gameTime - unit.lastAttack >= unit.attackCooldown) {
        updatedUnit.lastAttack = newState.gameTime;
        // Damage will be applied separately
      }
    } else if (unit.targetPosition) {
      // Move to target
      if (distance(unit.position, unit.targetPosition) > 5) {
        updatedUnit.position = moveTowards(unit.position, unit.targetPosition, unit.speed);
      } else {
        updatedUnit.targetPosition = undefined;
      }
    } else if (nearestEnemy && unit.faction === aiFaction) {
      // AI units move toward nearest enemy
      updatedUnit.position = moveTowards(unit.position, nearestEnemy.position, unit.speed);
    }

    return updatedUnit;
  });

  // Apply combat damage
  const unitsToRemove: string[] = [];
  newState.units.forEach((unit, i) => {
    const enemies = newState.units.filter(u => u.faction !== unit.faction && u.health > 0);
    const target = enemies.reduce<Unit | null>((nearest, enemy) => {
      const dist = distance(unit.position, enemy.position);
      if (dist <= unit.range && (!nearest || dist < distance(unit.position, nearest.position))) return enemy;
      return nearest;
    }, null);

    if (target && newState.gameTime - unit.lastAttack >= unit.attackCooldown) {
      const targetIdx = newState.units.findIndex(u => u.id === target.id);
      if (targetIdx >= 0) {
        newState.units[targetIdx] = { ...newState.units[targetIdx], health: newState.units[targetIdx].health - unit.damage };
        if (newState.units[targetIdx].health <= 0) {
          unitsToRemove.push(newState.units[targetIdx].id);
        }
      }
    }
  });

  // Remove dead units
  newState.units = newState.units.filter(u => u.health > 0);

  // Building damage from nearby enemy units
  newState.buildings = state.buildings.map(building => {
    let updatedBuilding = { ...building };
    const nearbyEnemies = newState.units.filter(u => u.faction !== building.faction && distance(u.position, building.position) < u.range);
    nearbyEnemies.forEach(enemy => {
      if (newState.gameTime - enemy.lastAttack >= enemy.attackCooldown) {
        updatedBuilding.health -= enemy.damage * 0.3;
      }
    });
    return updatedBuilding;
  }).filter(b => b.health > 0);

  // Capture point logic
  newState.capturePoints = state.capturePoints.map(point => {
    const updatedPoint = { ...point };
    const playerUnitsNear = newState.units.filter(u => u.faction === state.playerFaction && distance(u.position, point.position) <= point.radius);
    const aiUnitsNear = newState.units.filter(u => u.faction !== state.playerFaction && distance(u.position, point.position) <= point.radius);

    if (playerUnitsNear.length > 0 && aiUnitsNear.length === 0 && point.owner !== state.playerFaction) {
      updatedPoint.captureProgress = Math.min(100, point.captureProgress + playerUnitsNear.length * 0.3);
      updatedPoint.capturingFaction = state.playerFaction;
      if (updatedPoint.captureProgress >= 100) {
        updatedPoint.owner = state.playerFaction;
      }
    } else if (aiUnitsNear.length > 0 && playerUnitsNear.length === 0 && point.owner !== aiFaction) {
      updatedPoint.captureProgress = Math.min(100, point.captureProgress + aiUnitsNear.length * 0.2);
      updatedPoint.capturingFaction = aiFaction;
      if (updatedPoint.captureProgress >= 100) {
        updatedPoint.owner = aiFaction;
      }
    } else if (playerUnitsNear.length === 0 && aiUnitsNear.length === 0) {
      updatedPoint.capturingFaction = undefined;
    }

    return updatedPoint;
  });

  // AI Logic - escalating difficulty
  const aiDifficulty = Math.min(3, 1 + Math.floor(newState.gameTime / 3000));

  if (newState.gameTime % Math.max(100, 300 - aiDifficulty * 50) === 0) {
    const aiBarracks = newState.buildings.filter(b => b.faction === aiFaction && b.type === 'barracks');
    const aiFactory = newState.buildings.filter(b => b.faction === aiFaction && b.type === 'factory');

    if (aiBarracks.length > 0) {
      const spawnPos = aiBarracks[0].position;
      const squadSize = 2 + aiDifficulty;
      const newUnits = createSquad(aiFaction, { x: spawnPos.x + 60, y: spawnPos.y + 60 }, 'infantry', squadSize);
      // Send toward nearest contested or player point
      const targets = newState.capturePoints.filter(p => p.owner !== aiFaction);
      if (targets.length > 0) {
        const target = targets.reduce((nearest, p) => {
          const dist = distance(spawnPos, p.position);
          if (!nearest || dist < distance(spawnPos, nearest.position)) return p;
          return nearest;
        });
        newUnits.forEach(u => { u.targetPosition = { ...target.position }; });
      }
      newState.units = [...newState.units, ...newUnits];
    }

    if (aiFactory.length > 0 && newState.gameTime % Math.max(200, 600 - aiDifficulty * 100) === 0) {
      const spawnPos = aiFactory[0].position;
      const tankType: UnitType = aiDifficulty >= 2 ? (Math.random() > 0.4 ? 'heavy_tank' : 'light_tank') : 'light_tank';
      const tankCount = aiDifficulty >= 3 ? 2 : 1;
      const newTanks = createSquad(aiFaction, { x: spawnPos.x + 60, y: spawnPos.y + 60 }, tankType, tankCount);
      const targets = newState.capturePoints.filter(p => p.owner !== aiFaction);
      if (targets.length > 0) {
        const target = targets.reduce((nearest, p) => {
          const dist = distance(spawnPos, p.position);
          if (!nearest || dist < distance(spawnPos, nearest.position)) return p;
          return nearest;
        });
        newTanks.forEach(u => { u.targetPosition = { ...target.position }; });
      }
      newState.units = [...newState.units, ...newTanks];
    }

    // AI builds artillery at higher difficulty
    if (aiDifficulty >= 2 && newState.gameTime % 900 === 0) {
      const spawnPos = aiFactory.length > 0 ? aiFactory[0].position : newState.buildings.find(b => b.faction === aiFaction)?.position || { x: 2600, y: 1000 };
      const newArtillery = createSquad(aiFaction, { x: spawnPos.x + 80, y: spawnPos.y + 80 }, 'artillery', 1);
      const targets = newState.capturePoints.filter(p => p.owner !== aiFaction);
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        newArtillery.forEach(u => { u.targetPosition = { x: target.position.x + 100, y: target.position.y + 100 }; });
      }
      newState.units = [...newState.units, ...newArtillery];
    }
  }

  // Win condition
  const capturedPlayer = newState.capturePoints.filter(p => p.owner === state.playerFaction).length;
  const capturedAi = newState.capturePoints.filter(p => p.owner === aiFaction).length;
  if (capturedPlayer >= 7) {
    newState.gameOver = true;
    newState.winner = state.playerFaction;
  } else if (capturedAi >= 7) {
    newState.gameOver = true;
    newState.winner = aiFaction;
  }

  // Check if town hall destroyed
  const playerTownHall = newState.buildings.find(b => b.faction === state.playerFaction && b.type === 'town_hall');
  const aiTownHall = newState.buildings.find(b => b.faction !== state.playerFaction && b.type === 'town_hall');
  if (!playerTownHall) {
    newState.gameOver = true;
    newState.winner = aiFaction;
  }
  if (!aiTownHall) {
    newState.gameOver = true;
    newState.winner = state.playerFaction;
  }

  return newState;
}

export function canAfford(resources: Resource, cost: Resource): boolean {
  return resources.supplies >= cost.supplies &&
    resources.components >= cost.components &&
    resources.materials >= cost.materials;
}

export function spendResources(resources: Resource, cost: Resource): Resource {
  return {
    supplies: resources.supplies - cost.supplies,
    components: resources.components - cost.components,
    materials: resources.materials - cost.materials,
  };
}

export function createUnit(state: GameState, type: UnitType, buildingId: string): GameState | null {
  const building = state.buildings.find(b => b.id === buildingId);
  if (!building) return null;

  const cost = UNIT_STATS[type].cost;
  if (!canAfford(state.resources, cost)) return null;

  const stats = UNIT_STATS[type];
  const newUnit: Unit = {
    id: getId(),
    type,
    faction: state.playerFaction,
    position: { x: building.position.x + 60, y: building.position.y + 60 },
    health: stats.health,
    maxHealth: stats.health,
    damage: stats.damage,
    range: stats.range,
    speed: stats.speed,
    attackCooldown: type === 'artillery' ? 120 : 60,
    lastAttack: 0,
  };

  return {
    ...state,
    resources: spendResources(state.resources, cost),
    units: [...state.units, newUnit],
  };
}

export function placeBuilding(state: GameState, type: BuildingType, position: Position): GameState | null {
  const cost = BUILDING_STATS[type].cost;
  if (!canAfford(state.resources, cost)) return null;

  const newBuilding: Building = {
    id: getId(),
    type,
    faction: state.playerFaction,
    position,
    health: BUILDING_STATS[type].health,
    maxHealth: BUILDING_STATS[type].health,
  };

  return {
    ...state,
    resources: spendResources(state.resources, cost),
    buildings: [...state.buildings, newBuilding],
  };
}

export function moveSelectedUnits(state: GameState, targetPosition: Position): GameState {
  const updatedUnits = state.units.map(unit => {
    if (state.selectedUnits.includes(unit.id)) {
      return { ...unit, targetPosition: { ...targetPosition } };
    }
    return unit;
  });
  return { ...state, units: updatedUnits };
}
