// ===== GAME LOGIC =====
import { dist, distToSeg, GAME_MODES, SUPPLY_SYSTEM, getModeFlags, isUnitAllowedByRestriction, isBuildingAllowedByRestriction, DEFAULT_RESTRICTION, DEFAULT_ECONOMY } from './constants.js';
import { AI } from './ai.js';
import { createVehicle, isInfUnit, isTechVehicle, INFANTRY_TYPES, getDefenseDamageVsTech, getUnitAttackDamage, ARTILLERY_TYPES, LOGISTICS_TYPES } from './vehicles.js';

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

        // ===== ФИКС NaN-КООРДИНАТ: «страховка въезда» в зоны городов =====
        // Ключ "faction|cpIndex" -> { tick, units:Set<id>, buildings:Set<id> }.
        // Фиксирует технику фракции, которая УЖЕ стоит на территории города
        // в момент его захвата (или смены владельца). Такая техника НЕ
        // выталкивается за блок-линию и получает персональный разрешение-проход
        // через isCityZoneBlockedFor, чтобы она могла спокойно выехать или
        // остаться. Страховка живёт 120 тиков после захвата — этого хватает,
        // чтобы юнит на границе зоны успел сделать первый шаг наружу и не был
        // «вытолкнут» телепортом (именно этот телепорт раньше ломал координаты
        // при резком пересечении границы/препятствий).
        this.cityEnterGuard = new Map();
        
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

        // ===== ФИКС «ЮНИТЫ ПРОПАДАЮТ» №1 =====
        // Раньше любое исключение внутри этого метода прерывало шаг логики
        // ДО строки «Remove dead»: ИИ и движение замирали, юниты визуально
        // «исчезали». Теперь весь шаг обёрнут в try/catch — ошибка
        // логируется с полным стеком, но игровой цикл продолжает работать.
        try {
            this.updateInner();
        } catch (err) {
            console.error('[GAME][ERROR] Ошибка игрового цикла:', err);
        }
    }

    updateInner() {
        // ===== ФИКС NaN-КООРДИНАТ =====
        // Централизованная санация ВСЕХ юнитов и зданий в начале каждого тика,
        // ДО любых расчётов движения/ИИ/сепарации. Раньше sanitizeUnitPosition
        // вызывался только в конце updateUnit(), и NaN, появившийся вне этого
        // метода (приказы ИИ, сепарация, трассеры), успевал «заразить» соседей
        // и весь цикл движения до следующей санации.
        this.sanitizeAllPositions();

        this.time++;
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

        // Аварийное выталкивание юнитов из зон вражеских городов с целой
        // обороной (гарантия, что юнит не «залипнет» за блок-линией и не
        // погибнет незаметно для игрока — «юнит попал на линию и исчез»)
        this.enforceCityZoneBoundaries();
        
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
    // Прочность обороны ХРАНИТСЯ на самой точке (cp.defenseHp) — как HP у
    // юнита. Раньше «прочность» была производной величиной (сумма HP бункеров
    // + константа уровня из getTerritoryDefenseStats), которую никто не мог
    // уменьшить: ни артиллерия ИИ, ни юниты игрока не наносили урона обороне,
    // поэтому город с 1 уровнем вечно показывал 300 и захват был невозможен.
    // Теперь любой урон по оборонным объектам города (через
    // damageCityDefense) вычитается из cp.defenseHp, при 0 оборона считается
    // сломленной: укрепления визуально разрушены, стрельба обороны
    // прекращается, въезд техники и захват становятся возможны.
    DEFENSE_INTEGRITY_MULT = 3;

    getCityDefenseMaxIntegrity(cp) {
        if (!cp || cp.owner === 'neutral') return 0;
        let maxHp = 0;
        // Бункеры в радиусе города дают очки прочности
        this.buildings.forEach(b => {
            if (b.faction === cp.owner && b.type && b.type.startsWith('bunker_')) {
                if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80) {
                    maxHp += Math.max(0, b.maxHp || b.hp || 0);
                }
            }
        });
        // Уровень обороны территории тоже даёт очки прочности
        const stats = this.getTerritoryDefenseStats(cp.defenseLevel || 0);
        maxHp += stats.hp;
        return maxHp * this.DEFENSE_INTEGRITY_MULT;
    }

    // Актуализация хранимого HP обороны при смене уровня / строительстве
    // бункеров / смене владельца. При апгрейде добавляем дельту максимума
    // (новый уровень «достраивается» поверх целой обороны).
    refreshCityDefenseHp(cp) {
        if (!cp || cp.owner === 'neutral') return;
        const maxNow = this.getCityDefenseMaxIntegrity(cp);
        if (cp.defenseHp === undefined || cp.defenseHp === null) {
            cp.defenseHp = maxNow;
            cp._defRebuilt = false;
        } else if (cp._defMaxHp === undefined || maxNow !== cp._defMaxHp) {
            const delta = maxNow - (cp._defMaxHp || 0);
             if (cp._defRebuilt) {
                // Оборону перестроили заново — прочность НЕ восстанавливаем,
                // пока игрок/ИИ не включит ремонт.
                cp._defRebuilt = false;
            } else {
                cp.defenseHp = Math.min(maxNow, Math.max(0, cp.defenseHp + Math.max(0, delta)));
            }
            cp._defMaxHp = maxNow;
        }
    }

    getCityDefenseIntegrity(cp) {
        if (!cp || cp.owner === 'neutral') return 0;
        // Гарантируем инициализацию хранимого HP обороны
        if (cp.defenseHp === undefined || cp.defenseHp === null) {
            this.refreshCityDefenseHp(cp);
        }
        return Math.max(0, cp.defenseHp);
    }

    // ===== НАНЕСЕНИЕ УРОНА ПО ОБОРОНЕ ТЕРРИТОРИИ =====
    // Вызывается при попадании по укреплениям города: AoE-артиллерия, прямой
    // огонь по оборонному зданию/флагу, обстрел площади. Урон вычитается из
    // хранимой прочности cp.defenseHp.
    damageCityDefense(cp, dmg, fromX, fromY) {
        if (!cp || cp.owner === 'neutral') return 0;
        const d = Number(dmg);
        if (!Number.isFinite(d) || d <= 0) return 0;
        if (cp.defenseHp === undefined || cp.defenseHp === null) {
            this.refreshCityDefenseHp(cp);
        }
        cp.defenseHp = Math.max(0, (cp.defenseHp || 0) - d);
        // Визуальная обратная связь: трассер к центру обороны и обломки
        if (Number.isFinite(fromX) && Number.isFinite(fromY)) {
            this.addTracer(fromX, fromY, cp.x, cp.y, 'artillery');
        }
        this.addParticles(cp.x, cp.y, '#ff6b00', 8);
        if (cp.defenseHp <= 0 && !cp._defenseBrokenNotified) {
            cp._defenseBrokenNotified = true;
            this.notify?.(`${cp.name}: оборона сломлена! Город можно захватить.`);
        }
        return cp.defenseHp;
    }

    // Индекс точки захвата, чьей обороной является данное здание/укрепление
    // (для перенаправления урона по оборонным объектам в cp.defenseHp)
    getOwningCpIndexForBuilding(b) {
        for (let i = 0; i < this.cps.length; i++) {
            const cp = this.cps[i];
            if (cp.owner === 'neutral' || cp.owner !== b.faction) continue;
            if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius + 80) return i;
        }
        return -1;
    }

    isPointDefenseActive(cp) {
        // Оборона стреляет только пока её прочность цела
        return this.getCityDefenseIntegrity(cp) > 0;
    }

    // ===== ФИКС «КОООРДИНАТЫ ЛОМАЮТСЯ ПРИ ЗАЕЗДЕ В ГОРОД» =====
    // Регистрирует технику фракции, которая УЖЕ стоит на территории города в
    // момент захвата (смены владельца). Такая техника получает «страховку»:
    // она не выталкивается за блок-линию и может спокойно выехать или остаться.
    registerCityEnterGuard(cpIndex, newOwner) {
        if (!this.cityEnterGuard) this.cityEnterGuard = new Map();
        const cp = this.cps[cpIndex];
        if (!cp) return;
        const units = new Set();
        const buildings = new Set();
        for (const u of this.units) {
            if (u.faction !== newOwner || u.hp <= 0) continue;
            if (dist(u.x, u.y, cp.x, cp.y) <= cp.radius) units.add(u.id);
        }
        for (const b of this.buildings) {
            if (b.faction !== newOwner || !(b.hp > 0)) continue;
            if (dist(b.x, b.y, cp.x, cp.y) <= cp.radius) buildings.add(b.id);
        }
        if (units.size || buildings.size) {
            this.cityEnterGuard.set(newOwner + '|' + cpIndex, {
                tick: this.time, units, buildings,
            });
        }
    }

    // Жива ли ещё страховка въезда для юнита на этой точке (120 тиков после
    // захвата, плюс бесконечно — пока юнит реально стоит внутри зоны).
    hasCityEnterGuard(unit, cpIndex) {
        const g = this.cityEnterGuard && this.cityEnterGuard.get(unit.faction + '|' + cpIndex);
        if (!g) return false;
        if (!g.units.has(unit.id)) return false;
        // Страховка истекла, но юнит всё ещё внутри зоны — продлеваем её,
        // чтобы «старый жилец» города никогда не был вытолкнут телепортом.
        const cp = this.cps[cpIndex];
        if (cp && dist(unit.x, unit.y, cp.x, cp.y) <= cp.radius) {
            g.tick = this.time;
            return true;
        }
        return (this.time - g.tick) < 120;
    }

    // Вражеская техника не может заехать на территорию города, пока цела оборона.
    // НЕЙТРАЛЬНЫЙ городок проходим для любого юнита — там нет обороны.
    // Во ВРАЖЕСКИЙ город можно въехать только после уничтожения всей обороны.
    // ИСКЛЮЧЕНИЕ (фикс повреждаемых координат при заезде): если город захватили
    // то время как техника другой фракции уже стояла на его территории — она
    // там и остаётся (или спокойно выезжает): для неё зона не блокируется.
    isCityZoneBlockedFor(x, y, unit) {
        for (let i = 0; i < this.cps.length; i++) {
            const cp = this.cps[i];
            // нейтральные и свои точки никогда не блокируют проезд
            if (cp.owner === 'neutral' || cp.owner === unit.faction) continue;
            const d = dist(x, y, cp.x, cp.y);
            if (!Number.isFinite(d)) continue; // битые координаты — санация разберётся
            if (d <= cp.radius && this.getCityDefenseIntegrity(cp) > 0) {
                // Техника, попавшая в зону ДО захвата — не блокируем: она имеет
                // право остаться или выехать без принудительного выталкивания.
                if (this.hasCityEnterGuard(unit, i)) continue;
                return true;
            }
        }
        return false;
    }

    // Захват возможен только если уничтожена вся оборона города
    isCityDefenseBroken(cp) {
        return this.getCityDefenseIntegrity(cp) <= 0;
    }

    // ===== ФИКС «КООРДИНАТЫ ЛОМАЮТСЯ ПРИ ЗАЕЗДЕ В ГОРОД»: ПЛАВНЫЙ ВЫЕЗД =====
    // Если техника оказалась внутри зоны вражеского города с целой обороной
    // (её туда вытолкнула сепарация, перенесло шагом, или город захватили,
    // когда она уже стояла внутри), раньше её каждый тик TELEPORT-ом
    // перебрасывало за границу на радиус+4 px. На большой скорости/при
    // резком пересечении препятствий такие скачки и порождали повреждённые
    // координаты ([GAME][FIX] Повреждены координаты у devitt/vabjo36kt1).
    // Теперь юнит «страхуется»: он плавно шагает наружу к краю зоны со своей
    // обычной скоростью — без телепорта, пока не окажется за блок-линией.
    getCityZoneExitTarget(u, cp) {
        const dx = u.x - cp.x, dy = u.y - cp.y;
        const d = Math.hypot(dx, dy);
        if (!Number.isFinite(d)) return null;
        let nx = dx, ny = dy;
        if (d < 1) { nx = 1; ny = 0; } else { nx /= d; ny /= d; }
        return { x: cp.x + nx * (cp.radius + 6), y: cp.y + ny * (cp.radius + 6) };
    }

    enforceCityZoneBoundaries() {
        for (const u of this.units) {
            if (u.hp <= 0) continue;
            // ===== ФИКС «ЮНИТЫ ПРОПАДАЮТ» №5 =====
            // Пехота может законно находиться в любой зоне (ей defence-линия
            // проезда не запрещает), а выталкивание каждый тик утаскивало её
            // телепортом за край зоны — визуально юнит «исчезал» с поля зрения.
            if (isInfUnit(u)) continue;
            for (let i = 0; i < this.cps.length; i++) {
                const cp = this.cps[i];
                if (cp.owner === 'neutral' || cp.owner === u.faction) continue;
                if (this.getCityDefenseIntegrity(cp) <= 0) continue;
                // Техника, стоявшая в зоне ДО захвата города другой фракцией,
                // имеет право там остаться или спокойно выехать своим приказом —
                // не выталкиваем её вовсе («страховка въезда»).
                if (this.hasCityEnterGuard(u, i)) continue;
                const dx = u.x - cp.x, dy = u.y - cp.y;
                const d = Math.hypot(dx, dy);
                if (!Number.isFinite(d)) break; // повреждённые координаты — санация разберётся
                if (d <= cp.radius) {
                    const exit = this.getCityZoneExitTarget(u, cp);
                    if (!exit) break;
                    // Плавный шаг наружу вместо телепорта: скорость обычная,
                    // координаты не «перескакивают» через препятствия.
                    const step = Math.max(2, (u.spd || 1) * 2);
                    const ed = dist(u.x, u.y, exit.x, exit.y);
                    if (ed <= step) {
                        // Последний короткий шаг — ставим ровно за край зоны.
                        u.x = exit.x;
                        u.y = exit.y;
                    } else {
                        u.x += (exit.x - u.x) / ed * step;
                        u.y += (exit.y - u.y) / ed * step;
                    }
                    // Заодно снимаем битый приказ внутрь зоны, иначе цикл
                    // движения снова поведёт юнита назад под блок-линию.
                    if (u.tx !== undefined && this.isCityZoneBlockedFor(u.tx, u.ty, u)) {
                        u.tx = undefined; u.ty = undefined;
                        u.detourSide = undefined; u.detourTicks = undefined;
                        u.orderOrigin = undefined;
                    }
                    // Вытолкнули (плавно) — выходим, иначе при нескольких зонах
                    // юнита мотало бы между ними туда-сюда каждый тик.
                    break;
                }
            }
        }
    }

    updateUnits() {
        // Централизованные решения об отводе повреждённой техники ИИ.
        // Раньше техника ИИ начинала отводиться даже после небольшого урона,
        // теперь порог — 50% HP + шанс остаться на позиции (см. ai.shouldRetreat).
        if (this.aiController && typeof this.aiController.makeRetreatDecisions === 'function') {
            this.aiController.makeRetreatDecisions();
        }

        this.units.forEach(u => {
            // ===== ФИКС «ЮНИТЫ ПРОПАДАЮТ» №2 =====
            // Каждый юнит обновляется изолированно: если у одного из них
            // данные повреждены (undefined/NaN), это больше не роняет
            // обновление ВСЕХ остальных юнитов в этом тике.
            try {
                this.updateUnit(u);
            } catch (err) {
                console.error('[GAME][ERROR] Ошибка обновления юнита ' + (u.type || '?') + '/' + (u.id || '?') + ':', err);
            }
        });
    }

    updateUnit(u) {
            // ===== ФИКС «КООРДИНАТЫ ПОВРЕЖДАЮТСЯ ПОСЛЕ УРОНА» (devitt/vdhkflaj7w) =====
            // Мёртвый юнит (hp <= 0 после takeDamage в этом же тике — по нему
            // стреляли AoE/пулемёты соседей до его собственного обновления)
            // больше не проходит через движение/сепарацию: иначе расталкивание
            // и выталкивание из зон портили его x/y (NaN), а санация успевала
            // сработать ДО фильтра удаления — в консоли появлялось
            // «[GAME][FIX] Повреждены координаты ... — позиция восстановлена»
            // ровно в момент получения урона. Теперь труп просто ждёт фильтра.
            if (u.hp <= 0) return;

            // ===== ФИКС «ЮНИТЫ ПРОПАДАЮТ» №6 =====
            // Если у юнита кончились БК или топливо, а снабжения нет рядом,
            // он раньше просто останавливался навсегда: без приказа его не
            // видно в бою, но формально он жив — выглядело как «юниты
            // исчезают с карты». Теперь такой юнит самостоятельно возвращается
            // на базу (town_hall) своей фракции за БК/топливом.
            if (!u.aoe && !u.retreatToBase && u.tx === undefined &&
                u.canAttack && u.canMove &&
                (!u.canAttack() || !u.canMove())) {
                const home = this.buildings.find(b =>
                    b.faction === u.faction && b.type === 'town_hall' && b.hp > 0);
                if (home) {
                    u.tx = home.x + (Math.random() - 0.5) * 80;
                    u.ty = home.y + (Math.random() - 0.5) * 80;
                    u.supplyReturn = true;
                }
            }

            // Update game time for reload calculation
            u.gameTime = this.time;

            // Если юнит долечился выше порога — снимаем с него решение «держать позицию»
            if (u.holdPosition && u.hp >= (u.maxHp || 100) * 0.5) {
                u.holdPosition = false;
                u.retreatDecisionAt = undefined;
            }

            // ===== ФИКС «ЮНИТЫ ПРЫГАЮТ ВЛЕВО-ВПРАВО, А НЕ ЕДУТ» =====
            // Раньше боковые обходы (прыжки влево-вправо каждые ~30 тиков)
            // выполнялись скачком на 30-40 px за один кадр, тогда как обычный
            // шаг движения составлял всего ~1-2 px/тик. Визуально это
            // выглядело как «зигзаг прыжками». Теперь обход — это тоже
            // обычный ПЛАВНЫЙ ШАГ с нормальной скоростью: позиция никогда не
            // телепортируется, юнит просто плавно огибает препятствие дугой.
            // Прибытие: снимаем отметку «отводится на базу», иначе юнит не сможет
            // получить новые приказы (см. defensiveReactions / expandAndCapture).
            if (u.retreatToBase && dist(u.x, u.y, u.tx, u.ty) <= 15) {
                u.retreatToBase = false;
            }
            if (u.aoe && u.tx !== undefined) {
                // ===== ФИКС NaN-КООРДИНАТ: валидация целевых координат =====
                // Приказ с tx/ty = NaN — главный источник повторяющихся
                // повреждений: арифметика движения (nx = x + (tx-x)/d*step)
                // мгновенно передавала NaN позиции юнита. Проверяем цель ДО
                // движения и сбрасываем битый приказ.
                if (!Number.isFinite(u.tx) || !Number.isFinite(u.ty)) {
                    console.warn('[GAME][FIX] Битый приказ (tx/ty) у ' + (u.type || '?') + '/' + (u.id || '?') + ' — приказ снят');
                    u.tx = undefined; u.ty = undefined;
                    u.detourSide = undefined; u.detourTicks = undefined;
                    u.orderOrigin = undefined;
                    u.retreatOrder = null; u.moveOrder = null;
                } else {
                const dToOrder = dist(u.x, u.y, u.tx, u.ty);
                if (dToOrder < 10) {
                    // Прибыли к цели приказа — приказ выполнен
                    u.tx = undefined;
                    u.ty = undefined;
                    u.detourSide = undefined;
                    u.detourTicks = undefined;
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
                } // else (валидные tx/ty) — конец проверки приказа артиллерии
            }
            
            // Пополнение БК/топлива в базе (постепенное, с большим радиусом)
            const isInBase = this.buildings.some(b => 
                b.faction === u.faction && 
                b.type === 'town_hall' && 
                dist(u.x, u.y, b.x, b.y) < SUPPLY_SYSTEM.baseSupplyRadius
            );
            if (isInBase) {
                // Постепенное пополнение: передаём gameTime, иначе троттлинг
                // regenerateAtBase не срабатывал и база чинила по 1% КАЖДЫЙ тик
                // (полный ремонт за ~100 тиков вместо ~10000).
                if (u.regenerateAtBase) {
                    u.regenerateAtBase(this.time);
                }
                // Пополнение логистики на базе (тоже с gameTime — тот же троттлинг)
                if (u.replenishAtBase) {
                    u.replenishAtBase(this.time);
                }
                // Юнит доехал до базы за БК/топливом — пополнение выполнен,
                // снимаем приказ возврата, чтобы он снова мог получать бои.
                if (u.supplyReturn && u.canAttack && u.canMove &&
                    u.canAttack() && u.canMove()) {
                    u.supplyReturn = false;
                    u.tx = undefined;
                    u.ty = undefined;
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
                                        enemy.takeDamage(Math.floor(u.dmg * damageMultiplier), u);
                                    }
                                }
                            });
                            
                            // Big explosion effect
                            this.addParticles(attackTarget.x, attackTarget.y, '#ff6b00', 20);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 15);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ff0000', 10);

                            // ===== ФИКС «АРТА НЕ ЛОМАЕТ ОБОРОНУ ГОРОДА» =====
                            // Раньше артиллерия (и ИИ, и игрока) наносила урон
                            // только по юнитам — прочность обороны города была
                            // производной константой уровня и никогда не
                            // уменьшалась («долбит город с 1 уровнем, а там как
                            // было 300, так и осталось»). Теперь попадания по
                            // чужому городу и его зданиям вычитают урон из
                            // хранимой прочности обороны cp.defenseHp.
                            for (let ci = 0; ci < this.cps.length; ci++) {
                                const cp = this.cps[ci];
                                if (cp.owner === 'neutral' || cp.owner === u.faction) continue;
                                const dCp = dist(attackTarget.x, attackTarget.y, cp.x, cp.y);
                                if (dCp <= u.aoeRadius + cp.radius * 0.4) {
                                    const falloff = Math.max(0.25, 1 - (dCp / (cp.radius + u.aoeRadius)) * 0.5);
                                    this.damageCityDefense(cp, Math.floor(u.dmg * falloff), u.x, u.y);
                                }
                            }
                            // Попадания по вражеским зданиям в зоне разлёта:
                            // укрепления города одновременно списывают и HP
                            // здания, и прочность обороны территории.
                            this.buildings.forEach(b => {
                                if (b.faction === u.faction || !(b.hp > 0)) return;
                                const dB = dist(attackTarget.x, attackTarget.y, b.x, b.y);
                                if (dB > u.aoeRadius) return;
                                const mult = 1 - (dB / u.aoeRadius) * 0.5;
                                const dmgB = Math.floor(u.dmg * mult);
                                const cbi = this.getOwningCpIndexForBuilding(b);
                                if (cbi >= 0) {
                                    b.hp = Math.max(0, b.hp - dmgB);
                                    this.damageCityDefense(this.cps[cbi], dmgB, u.x, u.y);
                                } else {
                                    b.hp -= dmgB;
                                }
                            });

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
                                // ===== ФИКС «ИГРОК НЕ ЛОМАЕТ ОБОРОНУ» =====
                                // Цель — постройка/укрепление города (нет
                                // takeDamage). Раньше такой выстрел просто
                                // игнорировался: ни танки, ни пехота не могли
                                // повредить оборону. Теперь прямой огонь по
                                // зданиям списывает HP постройки, а если это
                                // оборонный объект города — урон идёт ещё и в
                                // прочность обороны территории (cp.defenseHp).
                                if (attackTarget.hp > 0 && Number.isFinite(attackTarget.x)) {
                                    let dmgB = Math.floor(u.dmg);
                                    if (u.antiInfantry && !isInfUnit(attackTarget)) {
                                        // пулемёты почти не эффективны по бетону
                                        dmgB = Math.max(1, Math.floor(dmgB * 0.25));
                                    }
                                    attackTarget.hp = Math.max(0, attackTarget.hp - dmgB);
                                    const ci = this.getOwningCpIndexForBuilding(attackTarget);
                                    if (ci >= 0) {
                                        this.damageCityDefense(this.cps[ci], dmgB, u.x, u.y);
                                    }
                                    this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 4);
                                }
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

                            // Noble Widow: +25% урона по технике противника
                            // (базовый dmg * 1.25, см. vehicles.js)
                            damage = getUnitAttackDamage(u, attackTarget, damage);
                            
                            // Scorpion: increased damage to infantry
                            if (u.antiInfantry && isInfUnit(attackTarget)) {
                                damage *= u.infantryMultiplier || 2.5;
                            }
                            
                            // Silverhand: dual gun attack (two shots)
                            if (u.dualGun) {
                                attackTarget.takeDamage(damage,u);
                                // Second shot with slight delay effect
                                // ===== ФИКС «ЮНИТЫ ПРОПАДАЮТ» №4 =====
                                // Проверка, что цель ещё жива И всё ещё в списке
                                // юнитов (не удалена фильтром hp > 0), иначе
                                // takeDamage применяется к «призраку» — визуально
                                // юнит исчезает, но продолжает существовать в памяти.
                                setTimeout(() => {
                                    if (attackTarget.hp > 0 && this.units.includes(attackTarget)) {
                                        attackTarget.takeDamage(Math.floor(damage * 0.7)); // Second gun does 70% damage
                                    }
                                }, 100);
                            }
                            
                            // Nemesis: grenade launcher AoE
                            if (u.grenadeLauncher && isInfUnit(attackTarget)) {
                                // Grenade affects nearby infantry
                                this.units.forEach(enemy => {
                                    if (enemy.faction !== u.faction && enemy.hp > 0 && isInfUnit(enemy)) {
                                        const distToTarget = dist(attackTarget.x, attackTarget.y, enemy.x, enemy.y);
                                        if (distToTarget <= (u.grenadeRadius || 40)) {
                                            enemy.takeDamage(Math.floor(damage * 0.6), u);
                                        }
                                    }
                                });
                                // Grenade explosion effect
                                this.addParticles(attackTarget.x, attackTarget.y, '#9c27b0', 8);
                            }
                            
                            attackTarget.takeDamage(damage, u);
                            this.addParticles(attackTarget.x, attackTarget.y, '#ffcc00', 4);
                            }
                        }
                    }
                }
            }
            
            // Move to target - can move even if enemy is nearby but out of range
            // Only stop moving if actively attacking
            // Фикс «пехота толпится и топчется у базы»: юнит, который стоит на
            // месте и стреляет в ближайшего врага (вне приказа), НЕ должен
            // считать себя «застрявшим» — раньше stuckCounter рос просто от
            // простоя, каждые ~30 тиков выдавался рандомный детour-приказ и
            // юнит начинал крутиться/уезжать по кругу вместо боя.
            if (isAttacking && u.tx === undefined) {
                u.stuckCounter = 0;
                // ЯКОРЬ САНации (lastX/lastY) обновляем ТОЛЬКО когда он
                // повреждён или ещё не задан. Раньше здесь была безусловная
                // запись — при бое с NaN-целью (битый приказ/AoE-точка)
                // lastX/lastY портились в тот же тик, и санация на следующем
                // тике телепортировала юнита к базе/первой точке захвата
                // («Повреждены координаты ... позиция восстановлена»).
                if (!Number.isFinite(u.lastX) || !Number.isFinite(u.lastY)) {
                    u.lastX = Number.isFinite(u.x) ? u.x : undefined;
                    u.lastY = Number.isFinite(u.y) ? u.y : undefined;
                }
            }

            // ===== ФИКС «вражеская артиллерия не ездит и не обстреливает точки» =====
            // Раньше арта ИИ, выдвигаясь к огневой позиции, упиралась в зону
            // обороны города (isCityZoneBlockedFor) и застревала: stuckCounter-обход
            // давал рандомные развороты, приказ терялся. Теперь у артиллерии —
            // приоритетный прямой проход к цели приказа (она всё равно не может
            // стрелять ближе minRange — стрельба сама отодвинет её назад).
            if (!isAttacking && u.aoe && u.tx !== undefined) {
                // ===== ФИКС NaN-КООРДИНАТ: валидация цели перед движением =====
                if (!Number.isFinite(u.tx) || !Number.isFinite(u.ty)) {
                    // Битый приказ сам по себе не портит координаты (dist()
                    // возвращает Infinity для NaN), но юнит с таким приказом
                    // больше никогда не заведёт валидный якорь lastX/lastY —
                    // и при первом же повреждении x/y санация телепортирует его
                    // к базе/первой точке захвата («телепорт с восстановлением
                    // координат» на ходу, devitt/va0l9tx5ge). Сносим битый
                    // приказ и заводим якорь от текущей валидной позиции.
                    console.warn('[GAME][FIX] Битый приказ движения (tx/ty) у ' + (u.type || '?') + '/' + (u.id || '?') + ' — приказ снят');
                    u.tx = undefined; u.ty = undefined;
                    u.detourSide = undefined; u.detourTicks = undefined;
                    u.orderOrigin = undefined;
                    if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                        u.lastX = u.x;
                        u.lastY = u.y;
                    }
                } else {
                // Если цель приказа ушла за пределы досягаемости огня (например,
                // игрок отменил приказ AoE-огня) — арта просто едет к новой цели
                // приказа обычным порядком, без «смещения для атаки».
                if (u.aoeTarget) {
                    const dShot = dist(u.x, u.y, u.aoeTarget.x, u.aoeTarget.y);
                    if (dShot < (u.minRange || 100) - 10 || dShot > u.range) {
                        u.aoeTarget = null;
                        u.retreatOrder = null;
                    }
                }
                const dA = dist(u.x, u.y, u.tx, u.ty);
                if (dA > 5) {
                    if (u.canMove && !u.canMove()) {
                        u.tx = undefined; u.ty = undefined;
                    } else {
                        // ФИКС «прыжков»: шаг обхода теперь такой же величины,
                        // как обычный шаг движения — без телепортации вбок.
                        const step = Math.min(dA, (u.spd || 1) * 2);
                        const nx = u.x + (u.tx - u.x) / dA * step;
                        const ny = u.y + (u.ty - u.y) / dA * step;
                        if (!this.isBlockedForVehicle(nx, ny, u)) {
                            u.direction = Math.atan2(ny - u.y, nx - u.x);
                            u.x = nx; u.y = ny;
                            if (u.useFuel) u.useFuel();
                        } else {
                            const side = u.detourSide ?? (u.detourSide = Math.random() > 0.5 ? 1 : -1);
                            // Плавное огибание: направление = цель + 45° в сторону
                            // обхода (было 90° чистым боком), шаг = обычный.
                            const toGoal = Math.atan2(u.ty - u.y, u.tx - u.x);
                            const a = toGoal + side * Math.PI / 4;
                            const bx = u.x + Math.cos(a) * step, by = u.y + Math.sin(a) * step;
                            if (!this.isBlockedForVehicle(bx, by, u)) {
                                u.direction = a;
                                u.x = bx; u.y = by;
                                if (u.useFuel) u.useFuel();
                            }
                        }
                    }
                } else {
                    // Прибыли на позицию — приказ выполнен, снимаем его полностью,
                    // чтобы manageArtillery мог next тик выдать огонь/новый манёвр.
                    u.tx = undefined; u.ty = undefined; u.detourSide = undefined;
                    u.detourTicks = undefined;
                    u.orderOrigin = undefined;
                    u.moveOrder = null; u.retreatOrder = null;
                }
                } // else (валидные tx/ty) — конец прямого прохода артиллерии
            }

            if (!isAttacking && !u.aoe && u.tx !== undefined) {
                // ===== ФИКС NaN-КООРДИНАТ: валидация цели перед движением =====
                if (!Number.isFinite(u.tx) || !Number.isFinite(u.ty)) {
                    console.warn('[GAME][FIX] Битый приказ движения (tx/ty) у ' + (u.type || '?') + '/' + (u.id || '?') + ' — приказ снят');
                    u.tx = undefined; u.ty = undefined;
                    u.detourSide = undefined; u.detourTicks = undefined;
                    u.orderOrigin = undefined; u.stuckCounter = 0;
                    // Заводим якорь санации от текущей валидной позиции,
                    // иначе битый приказ блокирует его обновление и первое
                    // же повреждение x/y «восстановится» телепортом к базе.
                    if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                        u.lastX = u.x;
                        u.lastY = u.y;
                    }
                } else {
                const d = dist(u.x, u.y, u.tx, u.ty);
                if (d > 5) {
                    // Проверка топлива
                    if (u.canMove && !u.canMove()) {
                        u.tx = undefined;
                        u.ty = undefined;
                    } else {
                        // ===== ФИКС «ТЕЛЕПОРТ С ВОССТАНОВЛЕНИЕМ КООРДИНАТ» =====
                        // lastX/lastY — это ЯКОРЬ санации повреждённых координат
                        // (sanitizeUnitPosition восстанавливает юнита именно туда).
                        // Якорь обязан ВСЕГДА отставать от текущей позиции не
                        // более чем на один шаг движения, иначе «восстановление»
                        // выглядит как телепорт назад. Раньше при каждом НОВОМ
                        // приказе, выданном на ходу, якорь перезаписывался/
                        // сбрасывался и мог «замереть» на старой точке приказа;
                        // если после этого координаты портились (битый источник
                        // NaN), юнит телепортировался на старую точку
                        // («восстановление координат»). Теперь: снимок позиции в
                        // начале тика (prevX/prevY) служит эталоном для детектора
                        // застревания, а якорь обновляется ТОЛЬКО валидной
                        // позиацией — новый приказ поверх движения его больше
                        // никогда не «отматывает» назад.
                        const prevX = u.x, prevY = u.y;
                        if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                            u.lastX = u.x;
                            u.lastY = u.y;
                        } else if (!Number.isFinite(u.lastX) || !Number.isFinite(u.lastY)) {
                            u.lastX = undefined;
                            u.lastY = undefined;
                        }
                        // Инициализация счётчика застревания
                        if (u.stuckCounter === undefined) {
                            u.stuckCounter = 0;
                        }

                        // Проверка застревания: смещение за ЭТОТ тик
                        // (снимок начала тика против текущей позиции)
                        const movedDist = dist(prevX, prevY, u.x, u.y);
                        if (!(movedDist > 0.5)) {
                            u.stuckCounter++;
                        } else {
                            u.stuckCounter = 0;
                        }
                        
                        // Если застряли слишком долго - пробуем обход
                        // ===== ФИКС «ЮНИТЫ ПРЫГАЮТ ВЛЕВО-ВПРАВО» =====
                        // Раньше здесь выполнялся МГНОВЕННЫЙ боковой телепорт на
                        // 30-40 px каждые ~30 тиков — юнит «прыгал» влево-вправо.
                        // Теперь вместо телепорта включается режим плавного
                        // огибания (detourTicks): следующие ~90 тиков юнит шагает
                        // под углом 45° к цели с ОБЫЧНОЙ скоростью, затем сам
                        // возвращается на прямую к приказу. Приказ не меняется.
                        if (u.stuckCounter > 30) {
                            // Помним исходную точку приказа (выдаётся один раз)
                            if (u.orderOrigin === undefined) {
                                u.orderOrigin = { x: u.tx, y: u.ty };
                            }
                            // Стабильная сторона обхода для этого приказа
                            if (u.detourSide === undefined) {
                                u.detourSide = ((u.id || '').toString().charCodeAt(0) % 2) ? 1 : -1;
                            }
                            u.detourTicks = 90; // ~1.5 секунды плавной дуги
                            u.stuckCounter = 0;
                        }

                        // Движение к цели приказа
                        const effectiveSpeed = u.spd * this.getSpeedModifier(u);
                        const r = effectiveSpeed / d;
                        let nx = u.x + (u.tx - u.x) * r;
                        let ny = u.y + (u.ty - u.y) * r;

                        // Активный режим плавного обхода (после «застревания»)
                        if (u.detourTicks && u.detourTicks > 0) {
                            u.detourTicks--;
                            const toGoalA = Math.atan2(u.ty - u.y, u.tx - u.x);
                            const a = toGoalA + u.detourSide * Math.PI / 4;
                            const ox = u.x + Math.cos(a) * effectiveSpeed;
                            const oy = u.y + Math.sin(a) * effectiveSpeed;
                            if (!this.isBlockedForVehicle(ox, oy, u) &&
                                !(u.aoe ? false : this.isCityZoneBlockedFor(ox, oy, u))) {
                                nx = ox; ny = oy;
                            } else {
                                // и в эту сторону нельзя — пробуем зеркальную
                                const a2 = toGoalA - u.detourSide * Math.PI / 4;
                                const ox2 = u.x + Math.cos(a2) * effectiveSpeed;
                                const oy2 = u.y + Math.sin(a2) * effectiveSpeed;
                                if (!this.isBlockedForVehicle(ox2, oy2, u) &&
                                    !(u.aoe ? false : this.isCityZoneBlockedFor(ox2, oy2, u))) {
                                    nx = ox2; ny = oy2;
                                }
                            }
                        }

                        // ===== ФИКС «ЮНИТЫ ПРЫГАЮТ ВЛЕВО-ВПРАВО» =====
                        // Прямой шаг заблокирован (препятствие/оборона города) —
                        // плавно огибаем: направление поворачиваем на 45° в сторону
                        // обхода, но ШАГ остаётся обычным (effectiveSpeed). Никаких
                        // боковых телепортаций на 30-40 px — юнит едет дугой.
                        const blockedAhead = this.isBlockedForVehicle(nx, ny, u) ||
                            (u.aoe ? false : this.isCityZoneBlockedFor(nx, ny, u));
                        if (blockedAhead && !(u.detourTicks && u.detourTicks > 0)) {
                            if (u.detourSide === undefined) {
                                u.detourSide = ((u.id || '').toString().charCodeAt(0) % 2) ? 1 : -1;
                            }
                            const toGoalA = Math.atan2(u.ty - u.y, u.tx - u.x);
                            let found = false;
                            for (const s of [u.detourSide, -u.detourSide]) {
                                const a = toGoalA + s * Math.PI / 4;
                                const ox = u.x + Math.cos(a) * effectiveSpeed;
                                const oy = u.y + Math.sin(a) * effectiveSpeed;
                                if (!this.isBlockedForVehicle(ox, oy, u) &&
                                    !(u.aoe ? false : this.isCityZoneBlockedFor(ox, oy, u))) {
                                    nx = ox; ny = oy; found = true; break;
                                }
                            }
                            if (!found) {
                                // Оба варианта вбок тоже заблокированы — стоим,
                                // счётчик застревания продолпит поиск обхода выше.
                                u.stuckCounter = (u.stuckCounter || 0) + 5;
                            }
                        }

                        if (Number.isFinite(nx) && Number.isFinite(ny) &&
                            (nx !== u.x || ny !== u.y)) {
                            u.direction = Math.atan2(ny - u.y, nx - u.x);
                            u.x = nx;
                            u.y = ny;
                            // Расход топлива при движении
                            if (u.useFuel) {
                                u.useFuel();
                            }
                        }

                        // ЯКОРЬ САНации: обновляем lastX/lastY ТОЛЬКО валидной
                        // позицией. Безусловная запись могла повредить сам якорь
                        // (если x/y уже NaN) — и тогда санация телепортировала
                        // юнита к базе/первой точке захвата вместо продолжения
                        // движения («телепорт с восстановлением координат»).
                        if (Number.isFinite(u.x) && Number.isFinite(u.y)) {
                            u.lastX = u.x;
                            u.lastY = u.y;
                        }
                    }
                } else {
                    // Достигли цели — сбрасываем приказ и детour-состояние
                    u.tx = undefined;
                    u.ty = undefined;
                    u.detourSide = undefined;
                    u.detourTicks = undefined;
                    u.orderOrigin = undefined;
                    u.stuckCounter = 0;
                }
                } // else (валидные tx/ty) — конец движения обычных юнитов
            }

            // ===== РАЗДВИГАЮЩАЯ СЕПАРАЦИЯ =====
            // Юниты (особенно техника) раньше буквально вставали друг в друга:
            // приказы «перетягивали» соседей, из-за чего колонна расходилась
            // черт знает куда. Теперь каждый юнит, имеющий приказ движения,
            // мягко расталкивает стоящих на его пути союзников в стороны —
            // они сходят с трассы, но свой приказ НЕ теряют.
            this.applySeparation(u);

            // ===== ФИКС «ЮНИТЫ ПРОПАДАЮТ» №3 =====
            // Если координаты повредились (NaN/Infinity) — юнит перестаёт
            // отрисовываться и выглядит «исчезнувшим». Восстанавливаем его
            // на последнюю валидную позицию.
            this.sanitizeUnitPosition(u);
    }

    applySeparation(u) {
        if (u.hp <= 0) return;
        const hasOrder = (u.tx !== undefined) || !!u.retreatOrder || !!u.moveOrder;
        if (!hasOrder) return;
        const minGap = (u.aoe || isInfUnit(u)) ? 16 : 24;
        for (const o of this.units) {
            if (o === u || o.hp <= 0 || o.faction !== u.faction) continue;
            const dx = o.x - u.x, dy = o.y - u.y;
            const d = Math.hypot(dx, dy);
            if (d >= minGap || d < 0.001) continue;
            // Толкаем соседа вдоль линии от нас к нему
            const push = (minGap - d) * 0.5;
            const nx = o.x + (dx / d) * push;
            const ny = o.y + (dy / d) * push;
            // НЕ толкаем юнитов через линию обороны вражеского города —
            // раньше сепарация могла «вытолкнуть» союзника за блок-границу
            // прямо в зону обороны, где он моментально погибал («юнит попал
            // на линию городка и исчез»).
            if (!this.isBlockedForVehicle(nx, ny, o) &&
                !this.isCityZoneBlockedFor(nx, ny, o)) { o.x = nx; o.y = ny; }
        }
    }

    /**
     * Безопасная точка для восстановления повреждённых (NaN/Infinity)
     * координат юнита. Берётся последняя валидная позиция (lastX/lastY),
     * но если она «протухла» — юнит с момента её записи ушёл бы далеко
     * (например, стоял в бою и lastX помнит место ещё до приказа), либо
     * оказалась внутри зоны вражеской обороны / в непроходимой клетке —
     * ищем ближайшую свободную точку вокруг неё или вокруг базы фракции.
     * Так «восстановление позиции» после урона больше не выглядит как
     * телепорт через всю карту.
     */
    getSafeRestoreAnchor(u) {
        const ok = (v) => Number.isFinite(v);
        const candidates = [];
        if (ok(u.lastX) && ok(u.lastY)) candidates.push({ x: u.lastX, y: u.lastY });
        // Позиция приказа — НЕ кандидат на восстановление! Раньше сюда же
        // подставлялись tx/ty и база фракции: если якорь lastX/lastY по
        // какой-то причине был повреждён или «протух» (юнит ехал, новый
        // приказ посреди пути), санация телепортировала юнита то ли в
        // исходную точку маршрута, то ли через всю карту на базу — это и
        // есть баг «телепортируется с восстановлением координат». Теперь
        // при отсутствии валидного якоря точка восстановления ищётся
        // КРУГ ТЕКУЩЕЙ позиции (см. ниже), а не далеко от неё.
        // Свой городок/база фракции — крайний, но всегда валидный якорь
        const base = (this.cps && this.cps.find(cp => cp.owner === u.faction)) || null;
        if (base && ok(base.x) && ok(base.y)) candidates.push({ x: base.x, y: base.y });

        const isBadSpot = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
            // Только для техники: пехота легально стоит где угодно
            const vehicleCheck = isInfUnit(u) ? false : this.isBlockedForVehicle(x, y, u);
            if (vehicleCheck) return true;
            for (let i = 0; i < this.cps.length; i++) {
                const cp = this.cps[i];
                if (cp.owner === 'neutral' || cp.owner === u.faction) continue;
                if (this.getCityDefenseIntegrity(cp) <= 0) continue;
                // Пехоте зона обороны не запрещена — не считаем её «плохой»
                if (isInfUnit(u)) continue;
                if (dist(x, y, cp.x, cp.y) <= cp.radius + 8) return true;
            }
            return false;
        };

        // Если сам юнит ещё имеет ХОТЬ ОДНУ валидную координату (например,
        // x нормальный, а y = NaN) — ищем свободную точку вокруг него:
        // восстановление рядом с местом гибели приказа, без телепорта.
        if (ok(u.x) || ok(u.y)) {
            const cx = ok(u.x) ? u.x : (ok(u.lastX) ? u.lastX : 1000);
            const cy = ok(u.y) ? u.y : (ok(u.lastY) ? u.lastY : 1000);
            if (!isBadSpot(cx, cy)) return { x: cx, y: cy };
            for (let r = 20; r <= 160; r += 20) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                    if (!isBadSpot(x, y)) return { x, y };
                }
            }
        }

        if (!candidates.length) return null;

        for (const c of candidates) {
            if (!isBadSpot(c.x, c.y)) return c;
            // Точка непригодна — спиралим наружу в поисках свободной точки.
            // Первый кандидат (lastX/tx) обычно рядом с местом боя — ищем
            // близко; дальние якоря (база) проверяем без развёрнутого поиска.
            const maxR = (c === candidates[0]) ? 160 : 40;
            for (let r = 20; r <= maxR; r += 20) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
                    if (!isBadSpot(x, y)) return { x, y };
                }
            }
        }
        return candidates[0]; // хотя бы куда-то валидному
    }

    /**
     * Санация координат юнита. Если из-за любого бага (деление на 0, битые
     * данные цели и т.п.) x/y превратились в NaN/Infinity, юнит переставал
     * отрисовываться — визуально он «исчезал», хотя был жив и даже получал
     * урон. Теперь такие координаты чинятся: юнит возвращается на последнюю
     * валидную позицию (lastX/lastY), а если и она повреждена — к точке
     * захвата рядом с ним или в центр карты.
     */
    sanitizeUnitPosition(u) {
        const ok = (v) => Number.isFinite(v);
        if (ok(u.x) && ok(u.y)) {
            // Запоминаем последнюю хорошую позицию для восстановления.
            // Якорь ведёт себя «как цепь»: он может ОТСТАВАТЬ от юнита не
            // более чем на один шаг движения (санация восстанавливает юнита
            // именно сюда, и большой разрыв выглядел бы как телепорт назад).
            // Поэтому записываем только если якорь повреждён/отсутствует ИЛИ
            // юнит ушёл от него дальше одного тика — новый приказ игрока
            // посреди пути больше не «замораживает» старый якорь.
            const gap = ok(u.lastX) && ok(u.lastY)
                ? dist(u.x, u.y, u.lastX, u.lastY) : Infinity;
            if (!(gap <= 4)) {
                u.lastX = u.x;
                u.lastY = u.y;
            }
            return;
        }
        console.warn('[GAME][FIX] Повреждены координаты у ' + (u.type || '?') + '/' + (u.id || '?') + ' — позиция восстановлена');
        // ===== ФИКС «ПУГАНЬ» ПОСЛЕ ПОЛУЧЕНИЯ УРОНА (devitt/vdhkflaj7w) =====
        // lastX/lastY — служебные поля детектора застревания: они обновляются
        // ТОЛЬКО в циклах движения. Юнит, стоящий на месте и ведущий бой
        // (арта на огневой позиции, танк в засаде), получал урон — и в этот
        // момент ни одно из движущихся значений не обновлялось. Если NaN
        // приходил из любого места (сепарация от соседа, чужой битый приказ,
        // трассер), санация телепортировала юнита на ПОСЛЕДНЮЮ ПОЗИЦИЮ ДО
        // приказа — через всю карту («координаты повреждены после урона»).
        // Теперь восстановление идёт к безопасной якорной точке рядом с
        // текущим местом боя, а не через всю карту.
        const anchor = this.getSafeRestoreAnchor(u);
        if (anchor) {
            u.x = anchor.x;
            u.y = anchor.y;
        } else if (this.cps && this.cps.length) {
            const cp = this.cps[0];
            u.x = cp.x;
            u.y = cp.y;
        } else {
            u.x = 1000;
            u.y = 1000;
        }
        // ===== ФИКС ПРИЧИН ПОВРЕЖДЕНИЯ КООРДИНАТ (источник №1) =====
        // Восстановление касалось только x/y, но сам «битный» приказ
        // (tx/ty = NaN) оставался у юнита. В enforceCityZoneBoundaries была
        // защита (!Number.isFinite(d)), а в главных циклах движения — НЕТ:
        // dist(x,y,NaN,NaN) = NaN → NaN > 5 === false, и юнит каждый тик
        // перезаписывал себе x = x + (NaN - x)/NaN * step = NaN. То есть
        // один раз повредившись, юнит ПОЛУЧАЛ БЕСКОНЕЧНЫЙ ИСТОЧНИК новых
        // повреждений — санация не лечила причину. Теперь при санации
        // сбрасываются ВСЕ связанные с позицией данные: цель приказа,
        // точка возврата на базу, AoE-цель, orders ИИ и детour-состояние.
        u.tx = undefined;
        u.ty = undefined;
        u.orderOrigin = undefined;
        u.detourSide = undefined;
        u.detourTicks = undefined;
        u.stuckCounter = 0;
        u.retreatOrder = null;
        u.moveOrder = null;
        u.retreatToBase = false;
        u.supplyReturn = false;
        u.captureTarget = undefined;
        if (u.aoe && u.aoeTarget && (!ok(u.aoeTarget.x) || !ok(u.aoeTarget.y))) {
            u.aoeTarget = null;
            u.shotsFired = 0;
        }
        // lastX/lastY теперь гарантированно валидны — повторное повреждение
        // не будет восстанавливаться в ту же битную точку.
        u.lastX = u.x;
        u.lastY = u.y;
    }

    // ===== ФИКС ПРИЧИН ПОВРЕЖДЕНИЯ КООРДИНАТ: ГЛОБАЛЬНАЯ САНЦИЯ =====
    // Раньше sanitizeUnitPosition вызывался только внутри updateUnit() для
    // живых юнитов в этом же тике. Но NaN мог прийти из кода вне updateUnit
    // (сепарация, приказы ИИ, трассеры), и тогда:
    //  1) applySeparation/enforceCityZoneBoundaries расталкивали соседей от
    //     юнита с NaN — передавая NaN всей стоящей рядом группе (цепное
    //     заражение: devitt получал NaN «в наследство» от соседей);
    //  2) ИИ считал dist() от повреждённых координат и выдавал tx/ty = NaN;
    //  3) мёртвые/снятые фильтром юниты вообще никогда не санировались.
    // Теперь перед каждым тиком логики нормализуются позиции ВСЕХ юнитов и
    // зданий — каналы заражения перекрываются централизованно.
    sanitizeAllPositions() {
        for (const u of this.units) this.sanitizeUnitPosition(u);
        const ok = (v) => Number.isFinite(v);
        for (const b of this.buildings) {
            if (ok(b.x) && ok(b.y)) continue;
            console.warn('[GAME][FIX] Повреждены координаты у здания ' +
                (b.type || '?') + '/' + (b.id || '?') + ' — позиция восстановлена');
            const anchor = (this.cps && this.cps[0]) || { x: 1000, y: 1000 };
            b.x = ok(b.x) ? b.x : anchor.x;
            b.y = ok(b.y) ? b.y : anchor.y;
        }
    }

    getSpeedModifier(u) {
        const onRoad = this.isOnRoad(u.x, u.y);
        if (onRoad) {
            if (u.tracked) return 0.7;   // гусеничные на дороге медленнее
            return 1.1;                  // колёсная техника/пехота быстрее
        }
        if (u.tracked) return 1.0;       // гусеничные в поле без штрафа
        return 0.7;                      // остальные в поле медленнее
    }

    updateCapturePoints() {
         // Актуализация прочности обороны ДО проверки захвата: при смене
        // владельца defenseLevel обнуляется и максимум падает — без этого
        // шага точка ещё тик хранила бы старую (целую) прочность.
        this.cps.forEach(cp => { if (cp.owner !== 'neutral') this.refreshCityDefenseHp(cp); });
        this.cps.forEach((cp, cpIndex) => {
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
                    // ===== ФИКС «КООРДИНАТЫ ЛОМАЮТСЯ ПРИ ЗАЕЗДЕ В ГОРОД» =====
                    // Если в момент захвата на территории города уже стояла
                    // техника ПРОТИВНИКА — она там и остаётся: регистрируем её
                    // в «страховке въезда», чтобы enforceCityZoneBoundaries не
                    // выталкивал её телепортом за блок-линию (именно это
                    // выталкивание повреждало координаты), и чтобы из-за целой
                    // новой обороны она могла спокойно выехать своим приказом.
                      // Заново отстроенная оборона стартует БЕЗ очков прочности:
                    // после перезахвата очки НЕ возвращаются сами — их нужно
                    // восстанавливать кнопкой «Ремонт обороны» за материалы.
                    cp.defenseHp = 0;
                    cp._defRebuilt = true;
                    cp._defMaxHp = this.getCityDefenseMaxIntegrity(cp);
                    cp.repairDefense = false;
                    cp._defenseBrokenNotified = false;
                    this.registerCityEnterGuard(cpIndex, this.ai);
                    this.notify?.(cp.name + ' захвачен!');
                }
            } else if (aU.length > 0 && pU.length === 0 && cp.owner !== this.ai && defenseBroken) {
                cp.progress = Math.min(100, cp.progress + aU.length * 0.15);
                cp.capturing = this.ai;
                if (cp.progress >= 100) {
                    cp.owner = this.ai;
                    cp.defenseLevel = 0;
                     // Симметрично ИИ: новая оборона без очков прочности.
                    cp.defenseHp = 0;
                    cp._defRebuilt = true;
                    cp._defMaxHp = this.getCityDefenseMaxIntegrity(cp);
                    cp.repairDefense = false;
                    cp._defenseBrokenNotified = false;
                    // Симметрично: техника игрока, стоявшая в зоне до захвата,
                    // остаётся и может свободно выехать или остаться.
                    this.registerCityEnterGuard(cpIndex, this.faction);
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
        this.unitLimits.combatVehicles = this.unitLimits.vehicles;
        this.unitLimits.logistics = 4;
        
        // Лимиты для ИИ (combatVehicles — только боевая техника, без логистики)
        this.aiUnitLimits = {
            infantry: 20 + aiPoints * 3,
            vehicles: 10 + aiPoints * 2,
            combatVehicles: 10 + aiPoints * 2,
            logistics: 4,
        };
    }
    
    canProduceUnit(type, faction) {
        const limits = faction === this.faction ? this.unitLimits : this.aiUnitLimits;
        const LOGISTICS_TYPES = ['truck', 'fuel_truck', 'engineer', 'flatbed'];
        const units = this.units.filter(u => u.faction === faction && u.hp > 0);

        if (type === 'infantry' || INFANTRY_TYPES.includes(type)) {
            const infantryCount = units.filter(u => isInfUnit(u)).length;
            return infantryCount < limits.infantry;
        } else {
            // ИСПРАВЛЕНИЕ: раньше в «технику» попадали ВСЕ не-пехотные юниты,
            // включая логистику (ремонтники/бензовозы/грузовики БК/flatbed).
            // Логистика набивала лимит vehicles (10 + 2*точки) — и бот физически
            // не мог производить боевую технику («не спавнит технику»,
            // «техника=1 при пехоте=23»). Теперь лимит считается только по
            // БОЕВОЙ технике; логистика ограничена отдельным небольшим лимитом.
            const combatVeh = units.filter(u => !isInfUnit(u) && !LOGISTICS_TYPES.includes(u.type)).length;
            if (limits.combatVehicles !== undefined) return combatVeh < limits.combatVehicles;
            return combatVeh < limits.vehicles;
        }
    }
    
    getUnitLimits(faction) {
        return faction === this.faction ? this.unitLimits : this.aiUnitLimits;
    }
    
    getUnitCounts(faction) {
        const units = this.units.filter(u => u.faction === faction);
        return {
            infantry: units.filter(u => isInfUnit(u)).length,
            vehicles: units.filter(u => !isInfUnit(u)).length,
        };
    }

    isBlockedForVehicle(x, y, unit) {
        // Infantry can pass through buildings
        if (isInfUnit(unit)) return false;
        
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
        // Радиусы авто-атаки увеличены x2 (раньше оборона стреляла фактически в упор)
        const stats = [
            { damage: 0, range: 0, hp: 0 },      // Уровень 0 - нет обороны
            { damage: 15, range: 240, hp: 300 },  // Уровень 1 (было 120)
            { damage: 25, range: 300, hp: 600 },  // Уровень 2 (было 150)
            { damage: 40, range: 360, hp: 1000 }, // Уровень 3 (было 180) + защита от артиллерии + урон по технике x1.3
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
            // Радиусы авто-атаки увеличены x2 (построенная оборона)
            bunker_light: { s: 30, c: 20, m: 25, hp: 300, defense: 10, range: 240, buildTime: 10 },
            bunker_medium: { s: 60, c: 40, m: 50, hp: 600, defense: 20, range: 300, buildTime: 15 },
            bunker_heavy: { s: 100, c: 70, m: 80, hp: 1000, defense: 35, range: 360, buildTime: 20 },
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
        // Живые юниты собираем ОДИН раз. Раньше поиск врагов шёл внутри
        // forEach по зданиям, а «return» на кулдауне первого бункера
        // пропускал обработку ВСЕХ остальных зданий — из-за этого оборона
        // ИИ почти никогда не стреляла («не атакует юнитов игрока»).
        const livingUnits = this.units.filter(u => u.hp > 0);

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
                // ===== ФИКС «ОБОРОНА (ИГРОКА И ИИ) НЕ СТРЕЛЯЕТ ПО ЮНИТАМ» =====
                // Раньше бункер стрелял ТОЛЬКО по юнитам-врагам. Как только
                // у юнита срабатывало «ответное решение» — он получал флаг
                // holdPosition (держать позицию до конца, см. ai.js /
                // updateUnit) или приказ отхода retreatToBase — оборона его
                // игнорировала. В реальном бою почти вся техника очень быстро
                // переходила в holdPosition, поэтому оборона фактически
                // «молчала» и работала только контрбатарейный огонь по
                // артиллерии. Теперь укрепления ведут огонь по ЛЮБЫМ
                // вражеским юнитам в радиусе (включая стоящих на месте),
                // исключение — лишь техника, полностью уехавшая на базу
                // (hp <= 0 мёртвые фильтруются списком livingUnits).
                // Плюс защита от «залипшего кулдауна»: если lastAtk оказался
                // в будущем (битые данные после санации/сохранения), бункер
                // больше не ждёт перезапуска игры — таймер сбрасывается.
                if (!Number.isFinite(b.lastAtk) || b.lastAtk > this.time) b.lastAtk = 0;

                // Кулдаун (2 секунды между выстрелами). return здесь теперь
                // безопасен: список врагов уже собран выше и другие здания
                // обрабатываются независимо.
                if (this.time - b.lastAtk < 120) return;

                // Ищем ближайшего врага в радиусе действия.
                // Приоритет цели: бронетехника > остальное (ПТО-логика).
                let nearestEnemy = null;
                let nearestDist = Infinity;
                let bestVehicle = null;
                let bestVehicleDist = Infinity;

                for (const u of livingUnits) {
                    if (u.faction === b.faction) continue;
                    if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) continue;
                    const d = dist(b.x, b.y, u.x, u.y);
                    if (d > b.range) continue;
                    if (isTechVehicle(u)) {
                        if (d < bestVehicleDist) { bestVehicleDist = d; bestVehicle = u; }
                    } else if (d < nearestDist) {
                        nearestDist = d; nearestEnemy = u;
                    }
                }
                if (bestVehicle) nearestEnemy = bestVehicle;

                // Атакуем если нашли врага
                if (nearestEnemy) {
                    b.lastAtk = this.time;
                    let damage = b.defense || 10;
                    // Урон обороны по технике — коэффициент x1.3 (см.
                    // DEFENSE_VS_TECH_MULT в vehicles.js). Действует для всех
                    // достроенных укреплений и целей из вкладки «🚗 Техника».
                    damage = getDefenseDamageVsTech(damage, nearestEnemy);
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
                
                // Ищем ближайшего врага в радиусе действия.
                // Приоритет цели: бронетехника игрока > остальные юниты —
                // оборона должна «держать» технику, а не только пехоту.
                let nearestEnemy = null;
                let nearestDist = Infinity;
                let bestVehicle = null;
                let bestVehicleDist = Infinity;

                for (const u of livingUnits) {
                    if (u.faction === cp.owner) continue;
                    if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) continue;
                    const d = dist(cp.x, cp.y, u.x, u.y);
                    if (d > stats.range) continue;
                    if (isTechVehicle(u)) {
                        if (d < bestVehicleDist) { bestVehicleDist = d; bestVehicle = u; }
                    } else if (d < nearestDist) {
                        nearestDist = d; nearestEnemy = u;
                    }
                }
                if (bestVehicle) nearestEnemy = bestVehicle;
                
                // Атакуем если нашли врага
                if (nearestEnemy) {
                    cp.lastAtk = this.time;
                    
                    // Add defense tracer
                    this.addTracer(cp.x, cp.y, nearestEnemy.x, nearestEnemy.y, 'defense');
                    
                    // Урон обороны по технике — коэффициент x1.3 (см.
                    // DEFENSE_VS_TECH_MULT в vehicles.js). По пехоте,
                    // логистике и артиллерии урон без бонуса.
                    let defDamage = stats.damage;
                    defDamage = getDefenseDamageVsTech(defDamage, nearestEnemy);
                    nearestEnemy.takeDamage(defDamage);
                    
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
                            // ФИКС: раньше проверялись только старые алиасы
                            // типов артиллерии — новые типы с суффиксами
                            // (warden_artillery120/150, colonial_artillery120/150)
                            // не распознавались и контибатри не работал.
                            if (u.faction !== cp.owner && u.hp > 0 &&
                                typeof u.type === 'string' && u.type.includes('artillery')) {
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
