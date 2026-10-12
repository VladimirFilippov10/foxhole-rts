import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Faction, BuildingType, UnitType, UNIT_STATS, BUILDING_STATS, FACTION_COLORS } from './types';
import { createInitialState, updateGameState, createUnit, placeBuilding, moveSelectedUnits, canAfford } from './gameEngine';
import { renderGame } from './renderer';
import { playBuildSound, playSelectSound } from './audio';

type Screen = 'menu' | 'game' | 'gameover';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [playerFaction, setPlayerFaction] = useState<Faction>('wardens');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [placingBuilding, setPlacingBuilding] = useState<BuildingType | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showTrainMenu, setShowTrainMenu] = useState(false);
  const [notification, setNotification] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const gameStateRef = useRef<GameState | null>(null);
  const placingBuildingRef = useRef<BuildingType | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { placingBuildingRef.current = placingBuilding; }, [placingBuilding]);
  useEffect(() => { mousePosRef.current = mousePos; }, [mousePos]);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  const startGame = (faction: Faction) => {
    setPlayerFaction(faction);
    const state = createInitialState(faction);
    setGameState(state);
    setScreen('game');
    showNotification(`Welcome, Commander! You lead the ${faction === 'wardens' ? 'Wardens' : 'Colonials'}. Capture 7 territories to win!`);
  };

  // Game loop
  useEffect(() => {
    if (screen !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = 0;
    const TICK_RATE = 1000 / 30;

    const gameLoop = (time: number) => {
      if (time - lastTime >= TICK_RATE) {
        lastTime = time;
        setGameState(prev => {
          if (!prev) return prev;
          const newState = updateGameState(prev);
          if (newState.gameOver && !prev.gameOver) {
            setTimeout(() => setScreen('gameover'), 1000);
          }
          return newState;
        });
      }

      // Render using refs for current values
      const currentState = gameStateRef.current;
      if (canvas && ctx && currentState) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderGame(ctx, currentState, canvas.width, canvas.height, placingBuildingRef.current, mousePosRef.current);
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [screen]);

  // Camera movement with keyboard
  useEffect(() => {
    if (screen !== 'game') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const moveCamera = () => {
      setGameState(prev => {
        if (!prev) return prev;
        const speed = 8;
        let dx = 0, dy = 0;
        if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= speed;
        if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += speed;
        if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= speed;
        if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += speed;

        if (dx === 0 && dy === 0) return prev;

        return {
          ...prev,
          cameraOffset: {
            x: Math.max(0, Math.min(prev.mapWidth - window.innerWidth, prev.cameraOffset.x + dx)),
            y: Math.max(0, Math.min(prev.mapHeight - window.innerHeight, prev.cameraOffset.y + dy)),
          }
        };
      });
      requestAnimationFrame(moveCamera);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const animFrame = requestAnimationFrame(moveCamera);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animFrame);
    };
  }, [screen]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      // Right click - move units or cancel placement
      if (placingBuilding) {
        setPlacingBuilding(null);
        return;
      }
      if (gameState && gameState.selectedUnits.length > 0) {
        const worldPos = {
          x: e.clientX + gameState.cameraOffset.x,
          y: e.clientY + gameState.cameraOffset.y,
        };
        setGameState(prev => prev ? moveSelectedUnits(prev, worldPos) : prev);
      }
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle click or shift+click - start drag
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (placingBuilding && gameState) {
      const worldPos = {
        x: e.clientX + gameState.cameraOffset.x,
        y: e.clientY + gameState.cameraOffset.y,
      };
      const newState = placeBuilding(gameState, placingBuilding, worldPos);
      if (newState) {
        setGameState(newState);
        playBuildSound();
        showNotification(`${placingBuilding.replace('_', ' ')} constructed!`);
        setPlacingBuilding(null);
      } else {
        showNotification('Not enough resources!');
      }
      return;
    }

    // Left click - select units
    if (gameState) {
      const worldPos = {
        x: e.clientX + gameState.cameraOffset.x,
        y: e.clientY + gameState.cameraOffset.y,
      };

      // Check if clicked on a unit
      const clickedUnit = gameState.units.find(u => {
        const dist = Math.sqrt((u.position.x - worldPos.x) ** 2 + (u.position.y - worldPos.y) ** 2);
        return dist < 20 && u.faction === gameState.playerFaction;
      });

      // Check if clicked on a building
      const clickedBuilding = gameState.buildings.find(b => {
        const dist = Math.sqrt((b.position.x - worldPos.x) ** 2 + (b.position.y - worldPos.y) ** 2);
        return dist < 30 && b.faction === gameState.playerFaction;
      });

      if (clickedUnit) {
        setGameState(prev => prev ? { ...prev, selectedUnits: [clickedUnit.id], selectedBuilding: null } : prev);
        playSelectSound();
        setShowTrainMenu(false);
        setShowBuildMenu(false);
      } else if (clickedBuilding) {
        setGameState(prev => prev ? { ...prev, selectedBuilding: clickedBuilding.id, selectedUnits: [] } : prev);
        setShowBuildMenu(true);
        setShowTrainMenu(false);
      } else {
        // Box select - find all player units in area
        const selected = gameState.units.filter(u => {
          const dist = Math.sqrt((u.position.x - worldPos.x) ** 2 + (u.position.y - worldPos.y) ** 2);
          return dist < 60 && u.faction === gameState.playerFaction;
        }).map(u => u.id);

        setGameState(prev => prev ? { ...prev, selectedUnits: selected, selectedBuilding: null } : prev);
        setShowBuildMenu(false);
        setShowTrainMenu(false);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cameraOffset: {
            x: Math.max(0, Math.min(prev.mapWidth - window.innerWidth, prev.cameraOffset.x - dx)),
            y: Math.max(0, Math.min(prev.mapHeight - window.innerHeight, prev.cameraOffset.y - dy)),
          }
        };
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTrainUnit = (type: UnitType) => {
    if (!gameState || !gameState.selectedBuilding) return;
      const newState = createUnit(gameState, type, gameState.selectedBuilding);
    if (newState) {
      setGameState(newState);
      playBuildSound();
      showNotification(`${type.replace('_', ' ')} deployed!`);
    } else {
      showNotification('Not enough resources!');
    }  };

  const handleBuildStructure = (type: BuildingType) => {
    if (!gameState) return;
    if (!canAfford(gameState.resources, BUILDING_STATS[type].cost)) {
      showNotification('Not enough resources!');
      return;
    }
    setPlacingBuilding(type);
    setShowBuildMenu(false);
    showNotification(`Click on map to place ${type.replace('_', ' ')}. Right-click to cancel.`);
  };

  // Menu Screen
  if (screen === 'menu') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-red-500 rounded-full blur-3xl"></div>
        </div>

        {/* Title */}
        <div className="relative z-10 text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-2 tracking-wider">
            WAR OF THE CONTINENT
          </h1>
          <p className="text-gray-400 text-lg">A Foxhole-inspired 2D Real-Time Strategy</p>
          <div className="mt-4 text-sm text-gray-500 max-w-lg mx-auto">
            <p>Two nations clash for supremacy. Build your war machine, capture territories, and crush the enemy.</p>
          </div>
        </div>

        {/* Faction Selection */}
        <div className="relative z-10 flex gap-8">
          {/* Wardens */}
          <button
            onClick={() => startGame('wardens')}
            className="group relative w-72 h-80 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-blue-700/50 group-hover:border-blue-400/70 transition-colors"></div>
            <div className="relative z-10 p-6 flex flex-col items-center h-full">
              <div className="text-5xl mb-4">🛡️</div>
              <h2 className="text-2xl font-bold text-blue-300 mb-2">WARDENS</h2>
              <p className="text-blue-200/70 text-sm text-center mb-4">
                The established order. Masters of heavy armor and industrial warfare.
              </p>
              <div className="mt-auto space-y-1 text-xs text-blue-300/60">
                <p>⚔️ Superior heavy tanks</p>
                <p>🏭 Advanced industry</p>
                <p>🎯 Long-range artillery</p>
              </div>
              <div className="mt-4 px-6 py-2 bg-blue-600/30 rounded-lg border border-blue-500/50 text-blue-200 text-sm font-semibold">
                SELECT FACTION
              </div>
            </div>
          </button>

          {/* Colonials */}
          <button
            onClick={() => startGame('colonials')}
            className="group relative w-72 h-80 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-900 to-red-950 border-2 border-red-700/50 group-hover:border-red-400/70 transition-colors"></div>
            <div className="relative z-10 p-6 flex flex-col items-center h-full">
              <div className="text-5xl mb-4">⚔️</div>
              <h2 className="text-2xl font-bold text-red-300 mb-2">COLONIALS</h2>
              <p className="text-red-200/70 text-sm text-center mb-4">
                The revolutionary force. Agile, adaptive, and relentless.
              </p>
              <div className="mt-auto space-y-1 text-xs text-red-300/60">
                <p>🚗 Fast halftracks</p>
                <p>💪 Guerrilla tactics</p>
                <p>🔧 Rapid production</p>
              </div>
              <div className="mt-4 px-6 py-2 bg-red-600/30 rounded-lg border border-red-500/50 text-red-200 text-sm font-semibold">
                SELECT FACTION
              </div>
            </div>
          </button>
        </div>

        {/* Lore Panel */}
        <div className="relative z-10 mt-8 max-w-2xl mx-auto bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
          <h3 className="text-gray-300 text-sm font-bold mb-2 text-center">⚔️ THE WAR OF THE CONTINENT ⚔️</h3>
          <p className="text-gray-400 text-xs text-center leading-relaxed">
            For decades, the <span className="text-blue-400 font-semibold">Wardens</span> have maintained order through industrial might and heavy armor.
            But the <span className="text-red-400 font-semibold">Colonials</span> have risen — a revolutionary force fighting for freedom through guerrilla tactics and rapid production.
            Now, the continent burns as both factions clash for supremacy over strategic territories, factories, and supply lines.
            Build your war machine. Capture the land. Crush the enemy.
          </p>
        </div>

        {/* Controls info */}
        <div className="relative z-10 mt-6 text-center text-gray-500 text-xs space-y-1">
          <p><span className="text-gray-400">WASD/Arrows</span> - Move Camera | <span className="text-gray-400">Left Click</span> - Select | <span className="text-gray-400">Right Click</span> - Move/Cancel</p>
          <p><span className="text-gray-400">Shift+Drag</span> - Pan Camera | Capture 7 territories to win</p>
        </div>
      </div>
    );
  }

  // Game Over Screen
  if (screen === 'gameover' && gameState) {
    const won = gameState.winner === playerFaction;
    const factionColors = FACTION_COLORS[playerFaction];
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center">
        <div className={`text-8xl mb-6`}>{won ? '🏆' : '💀'}</div>
        <h1 className={`text-5xl font-bold mb-4 ${won ? 'text-yellow-400' : 'text-red-400'}`}>
          {won ? 'VICTORY!' : 'DEFEAT'}
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          {won
            ? `The ${playerFaction === 'wardens' ? 'Wardens' : 'Colonials'} have secured the continent!`
            : `The ${playerFaction === 'wardens' ? 'Colonials' : 'Wardens'} have overwhelmed your forces.`
          }
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => startGame(playerFaction)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
          >
            Play Again
          </button>
          <button
            onClick={() => setScreen('menu')}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            Main Menu
          </button>
        </div>
      </div>
    );
  }

  // Game Screen
  return (
    <div className="w-full h-screen relative overflow-hidden select-none" onContextMenu={e => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* Top HUD - Resources */}
      {gameState && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          <div className="flex items-center gap-6 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">📦</span>
              <span className="text-white font-mono text-sm">{Math.floor(gameState.resources.supplies)}</span>
              <span className="text-gray-400 text-xs">SUP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-lg">⚙️</span>
              <span className="text-white font-mono text-sm">{Math.floor(gameState.resources.components)}</span>
              <span className="text-gray-400 text-xs">COMP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-lg">🪨</span>
              <span className="text-white font-mono text-sm">{Math.floor(gameState.resources.materials)}</span>
              <span className="text-gray-400 text-xs">MAT</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="text-gray-300 text-sm font-mono">
              Territories: {gameState.capturePoints.filter(p => p.owner === playerFaction).length}/9
            </div>
            <div className={`px-3 py-1 rounded text-xs font-bold ${
              playerFaction === 'wardens' ? 'bg-blue-900/80 text-blue-300' : 'bg-red-900/80 text-red-300'
            }`}>
              {playerFaction === 'wardens' ? '🛡️ WARDENS' : '⚔️ COLONIALS'}
            </div>
          </div>
        </div>
      )}

      {/* Bottom HUD - Unit Info & Actions */}
      {gameState && (
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          {/* Selected units info */}
          <div className="pointer-events-auto">
            {gameState.selectedUnits.length > 0 && (
              <div className="bg-gray-900/90 rounded-lg p-3 border border-gray-700 mb-2">
                <p className="text-gray-300 text-xs mb-1">Selected: {gameState.selectedUnits.length} units</p>
                <div className="flex gap-2 flex-wrap">
                  {gameState.selectedUnits.slice(0, 8).map(id => {
                    const unit = gameState.units.find(u => u.id === id);
                    if (!unit) return null;
                    return (
                      <div key={id} className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                        {unit.type.replace('_', ' ')}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {gameState.selectedBuilding && (
              <div className="bg-gray-900/90 rounded-lg p-3 border border-gray-700 mb-2">
                {(() => {
                  const building = gameState.buildings.find(b => b.id === gameState.selectedBuilding);
                  if (!building) return null;
                  return (
                    <div>
                      <p className="text-gray-300 text-sm font-bold">{building.type.replace('_', ' ').toUpperCase()}</p>
                      <p className="text-gray-500 text-xs">HP: {Math.floor(building.health)}/{building.maxHealth}</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pointer-events-auto">
            {gameState.selectedBuilding && (
              <div className="bg-gray-900/90 rounded-lg p-2 border border-gray-700">
                <p className="text-gray-400 text-xs mb-2 text-center">Train Units</p>
                <div className="flex gap-1 flex-wrap">
                  {(['infantry', 'light_tank', 'heavy_tank', 'halftrack', 'artillery'] as UnitType[]).map(type => {
                    const cost = UNIT_STATS[type].cost;
                    const affordable = canAfford(gameState.resources, cost);
                    const building = gameState.buildings.find(b => b.id === gameState.selectedBuilding);
                    const canBuild = building?.type === 'barracks' && (type === 'infantry') ||
                      building?.type === 'factory' && (type !== 'infantry') ||
                      building?.type === 'garrison' && (type === 'infantry' || type === 'halftrack');
                    if (!canBuild) return null;
                    return (
                      <button
                        key={type}
                        onClick={() => handleTrainUnit(type)}
                        disabled={!affordable}
                        className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                          affordable
                            ? 'bg-green-900/60 text-green-300 hover:bg-green-800/80 border border-green-700/50'
                            : 'bg-gray-800/60 text-gray-600 border border-gray-700/50 cursor-not-allowed'
                        }`}
                        title={`${type} - S:${cost.supplies} C:${cost.components} M:${cost.materials}`}
                      >
                        {type.replace('_', ' ').slice(0, 6)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Build menu */}
            <div className="bg-gray-900/90 rounded-lg p-2 border border-gray-700">
              <p className="text-gray-400 text-xs mb-2 text-center">Build</p>
              <div className="flex gap-1 flex-wrap">
                {(['barracks', 'factory', 'refinery', 'garrison', 'artillery_outpost'] as BuildingType[]).map(type => {
                  const cost = BUILDING_STATS[type].cost;
                  const affordable = canAfford(gameState.resources, cost);
                  return (
                    <button
                      key={type}
                      onClick={() => handleBuildStructure(type)}
                      disabled={!affordable}
                      className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                        affordable
                          ? 'bg-blue-900/60 text-blue-300 hover:bg-blue-800/80 border border-blue-700/50'
                          : 'bg-gray-800/60 text-gray-600 border border-gray-700/50 cursor-not-allowed'
                      }`}
                      title={`${type} - S:${cost.supplies} C:${cost.components} M:${cost.materials}`}
                    >
                      {type.replace('_', ' ').slice(0, 6)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-gray-600 rounded-lg px-6 py-3 text-white text-sm animate-pulse shadow-xl">
          {notification}
        </div>
      )}

      {/* Placing building indicator */}
      {placingBuilding && (
        <div className="absolute top-16 left-4 bg-green-900/90 border border-green-500 rounded-lg px-4 py-2 text-green-300 text-sm">
          Placing: {placingBuilding.replace('_', ' ')} | Right-click to cancel
        </div>
      )}

      {/* Quick help */}
      <div className="absolute top-12 right-4 text-gray-500 text-xs text-right space-y-0.5 pointer-events-none">
        <p>WASD - Camera</p>
        <p>Click - Select</p>
        <p>Right-click - Move</p>
        <p>Shift+Drag - Pan</p>
      </div>
    </div>
  );
}

export default App;
