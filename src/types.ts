export type Faction = 'wardens' | 'colonials';

export interface Position {
  x: number;
  y: number;
}

export interface Resource {
  supplies: number;
  components: number;
  materials: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  faction: Faction;
  position: Position;
  targetPosition?: Position;
  health: number;
  maxHealth: number;
  damage: number;
  range: number;
  speed: number;
  attackCooldown: number;
  lastAttack: number;
  selected?: boolean;
}

export type UnitType = 'infantry' | 'light_tank' | 'heavy_tank' | 'truck' | 'artillery' | 'halftrack';

export interface Building {
  id: string;
  type: BuildingType;
  faction: Faction;
  position: Position;
  health: number;
  maxHealth: number;
  productionQueue?: UnitType[];
  productionProgress?: number;
  captured?: boolean;
}

export type BuildingType = 'town_hall' | 'factory' | 'barracks' | 'refinery' | 'garrison' | 'artillery_outpost';

export interface CapturePoint {
  id: string;
  name: string;
  position: Position;
  radius: number;
  owner: Faction | 'neutral';
  captureProgress: number;
  capturingFaction?: Faction;
}

export interface GameState {
  playerFaction: Faction;
  resources: Resource;
  units: Unit[];
  buildings: Building[];
  capturePoints: CapturePoint[];
  selectedUnits: string[];
  selectedBuilding: string | null;
  gameTime: number;
  gameOver: boolean;
  winner: Faction | null;
  cameraOffset: Position;
  mapWidth: number;
  mapHeight: number;
}

export const UNIT_STATS: Record<UnitType, { health: number; damage: number; range: number; speed: number; cost: Resource; buildTime: number }> = {
  infantry: { health: 50, damage: 8, range: 120, speed: 1.5, cost: { supplies: 10, components: 0, materials: 0 }, buildTime: 60 },
  light_tank: { health: 200, damage: 25, range: 150, speed: 2, cost: { supplies: 30, components: 20, materials: 10 }, buildTime: 180 },
  heavy_tank: { health: 400, damage: 45, range: 160, speed: 1.2, cost: { supplies: 50, components: 40, materials: 30 }, buildTime: 300 },
  truck: { health: 100, damage: 0, range: 0, speed: 2.5, cost: { supplies: 20, components: 10, materials: 5 }, buildTime: 120 },
  artillery: { health: 150, damage: 60, range: 300, speed: 0.8, cost: { supplies: 40, components: 30, materials: 20 }, buildTime: 240 },
  halftrack: { health: 250, damage: 15, range: 140, speed: 1.8, cost: { supplies: 35, components: 25, materials: 15 }, buildTime: 150 },
};

export const BUILDING_STATS: Record<BuildingType, { health: number; cost: Resource; buildTime: number; size: number }> = {
  town_hall: { health: 1000, cost: { supplies: 0, components: 0, materials: 0 }, buildTime: 0, size: 50 },
  factory: { health: 500, cost: { supplies: 50, components: 30, materials: 40 }, buildTime: 300, size: 45 },
  barracks: { health: 400, cost: { supplies: 40, components: 20, materials: 20 }, buildTime: 200, size: 40 },
  refinery: { health: 300, cost: { supplies: 30, components: 15, materials: 30 }, buildTime: 250, size: 40 },
  garrison: { health: 600, cost: { supplies: 60, components: 40, materials: 50 }, buildTime: 350, size: 50 },
  artillery_outpost: { health: 350, cost: { supplies: 45, components: 35, materials: 25 }, buildTime: 280, size: 35 },
};

export const FACTION_COLORS = {
  wardens: { primary: '#2563eb', secondary: '#1d4ed8', accent: '#60a5fa', dark: '#1e3a5f' },
  colonials: { primary: '#dc2626', secondary: '#b91c1c', accent: '#f87171', dark: '#5f1e1e' },
  neutral: { primary: '#6b7280', secondary: '#4b5563', accent: '#9ca3af', dark: '#374151' },
};
