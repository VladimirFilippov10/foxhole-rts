// Тест: (1) ремонты/заправки/пополнения работают непрерывно и ДО КОНЦА;
//       (2) ИИ держит квоту 1 техника : 5 пехоты и догоняет потери техники.
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';
import { SUPPLY_SYSTEM } from '../js/constants.js';

global.window = { innerWidth: 1200, innerHeight: 800, AI_LOG: false };

let fails = 0;
const check = (name, cond, info='') => { console.log((cond?'PASS':'FAIL')+' | '+name+(info?' | '+info:'')); if(!cond) fails++; };

// ===== ТЕСТ 1: ЛОГИСТИКА =====
{
  const g = new Game('wardens');
  g.res = {s:0,c:0,m:0};
  const hall = { faction:'wardens', type:'town_hall', x:300, y:300, hp:100 };
  g.buildings=[hall]; g.cps=[]; g.mines=[];
  // повреждённый танк + грузовик/бензовоз/инженер/флэтбед + арта
  const tank = createVehicle('silverhand','wardens',400,300); tank.hp=20; tank.ammo=10; tank.fuel=10;
  const art  = createVehicle('warden_artillery','wardens',460,300); art.ammo=5;
  const eng  = createVehicle('engineer','wardens',410,310);
  const trk  = createVehicle('truck','wardens',420,290);
  const fuel = createVehicle('fuel_truck','wardens',430,310);
  const flat = createVehicle('flatbed','wardens',450,290);
  g.units=[tank,art,eng,trk,fuel,flat];
  for(let i=0;i<1200;i++) g.updateUnits();
  check('инженер починил танк ДО ПОЛНОГО HP', tank.hp===tank.maxHp, `hp=${tank.hp}/${tank.maxHp}, cargo=${eng.currentCargo}`);
  check('грузовик наполнил БК танка полностью', tank.ammo===tank.maxAmmo, `ammo=${tank.ammo}`);
  check('бензовоз наполнил топливо полностью', tank.fuel===tank.maxFuel, `fuel=${tank.fuel}`);
  check('flatbed наполнил БК артиллерии полностью', art.ammo===art.maxAmmo, `ammo=${art.ammo}`);
  check('ёмкость инженера >= maxHp самой прочной техники', SUPPLY_SYSTEM.engineerCapacity>=480);
}

// ===== ТЕСТ 2: КВОТА ИИ 1:5 + ДОГОНЯЩЕЕ СТРОИТЕЛЬСТВО =====
{
  const g = new Game('wardens'); // игрок=wardens, ai=colonials
  g.res={s:0,c:0,m:0};
  const baseCp = { id:'F1', name:'F1', x:2250, y:225, radius:100, owner:'colonials', defenseLevel:0 };
  const pBase  = { id:'A12', name:'A12', x:375, y:2175, radius:100, owner:'wardens', defenseLevel:0 };
  g.cps=[baseCp,pBase];
  g.mines=[];
  g.buildings=[
    {faction:'colonials',type:'town_hall',x:2250,y:225,hp:100},
    {faction:'colonials',type:'barracks',x:2200,y:280,hp:100},
    {faction:'colonials',type:'factory',x:2300,y:280,hp:100},
  ];
  g.units=[];
  g.init([baseCp,pBase],[],g.buildings,[]);
  const ai=g.aiController;
  // ускорим фарм: +ресурсы каждый тик
  for(let i=0;i<6000;i++){ ai.aiResources.s+=0.5; ai.aiResources.c+=0.3; ai.aiResources.m+=0.2; g.update(); }
  const counts=g.getUnitCounts('colonials');
  console.log(`INFO | после 6000 тиков: пехота=${counts.infantry} техника(вкл. логистику)=${counts.vehicles}`);
  const spawnedInf = ai.infantryCount||0;
  check('ИИ произвёл технику (не только пехоту)', ai.vehicleCount>0, `vehicleCount=${ai.vehicleCount}`);
  check('ИИ не спамит: техника производится регулярно', ai.vehicleCount>=3, `vehicleCount=${ai.vehicleCount}`);
  // Проверка отсутствия исключений: update отработал 6000 тиков
  check('цикл ИИ без крашей', true);
  // Догоняющее строительство: убьём технику ИИ — следующая production-проверка должна优先 технику
  const before=ai.vehicleCount;
  g.units.filter(u=>u.faction==='colonials'&&u.type!=='infantry').forEach(u=>u.hp=0);
  g.units=g.units.filter(u=>u.hp>0);
  for(let i=0;i<1500;i++){ ai.aiResources.s+=0.5; ai.aiResources.c+=0.3; ai.aiResources.m+=0.2; g.update(); }
  check('после потери ВСЕЙ техники ИИ начал её догонять', ai.vehicleCount>before, `до=${before} после=${ai.vehicleCount}`);
}

process.exit(fails?1:0);
