// Тест «ЮНИТЫ ЕДУТ ПЛАВНО, А НЕ ПРЫГАЮТ ВЛЕВО-ВПРАВО»:
// 1) ни за один тик смещение юнита не превышает скорость*2 (нет телепортов);
// 2) юнит с приказом движения доезжает до точки приказа;
// 3) на пути — препятствие (запретная зона): объезд плавной дугой, без прыжков.
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';

global.window = { innerWidth: 1200, innerHeight: 800, AI_LOG: false };
let fails = 0;
const check = (n, c, i='') => { console.log((c?'PASS':'FAIL')+' | '+n+(i?' | '+i:'')); if(!c) fails++; };

// --- 1+2: обычный танк едет по прямой, без скачков ---
{
  const g = new Game('wardens');
  g.res={s:0,c:0,m:0};
  g.cps=[]; g.mines=[]; g.buildings=[];
  const v = createVehicle('devitt','wardens',300,300);
  g.units=[v];
  v.tx=1500; v.ty=900;
  let maxStep=0, prev={x:v.x,y:v.y}, arrived=false;
  for(let i=0;i<6000;i++){
    g.updateUnits();
    const step=Math.hypot(v.x-prev.x, v.y-prev.y);
    maxStep=Math.max(maxStep, step);
    prev={x:v.x,y:v.y};
    if(v.tx===undefined){arrived=true;break;}
  }
  const limit=(v.spd*1.1)*2+0.5; // скорость*модификатор дороги + запас
  check('нет скачков/телепортов (шаг <= скорости)', maxStep<=limit, `maxStep=${maxStep.toFixed(2)} limit=${limit.toFixed(2)}`);
  check('танк ДОЕХАЛ к цели приказа', arrived && Math.hypot(v.x-1500,v.y-900)<20, `pos=(${Math.round(v.x)},${Math.round(v.y)})`);
}

// --- 3: объезд запретной зоны города — плавно, без бокового прыжка ---
{
  const g = new Game('wardens');
  g.res={s:0,c:0,m:0};
  // вражеская точка с целой обороной на прямом пути
  g.cps=[{id:'E1',name:'E1',x:1000,y:600,radius:200,owner:'colonials',defenseLevel:3}];
  g.mines=[]; g.buildings=[];
  const v = createVehicle('devitt','wardens',400,600);
  g.units=[v];
  v.tx=1700; v.ty=600;
  let maxStep=0, prev={x:v.x,y:v.y}, arrived=false;
  for(let i=0;i<12000;i++){
    g.updateUnits();
    const step=Math.hypot(v.x-prev.x, v.y-prev.y);
    maxStep=Math.max(maxStep, step);
    prev={x:v.x,y:v.y};
    if(v.tx===undefined){arrived=true;break;}
  }
  const limit=(v.spd*1.1)*2+0.5;
  check('объезд обороны: нет боковых прыжков', maxStep<=limit, `maxStep=${maxStep.toFixed(2)} limit=${limit.toFixed(2)}`);
  check('объезд обороны: доехал к цели приказа', arrived && Math.hypot(v.x-1700,v.y-600)<25, `pos=(${Math.round(v.x)},${Math.round(v.y)})`);
}

// --- 4: артиллерия тоже едет плавно ---
{
  const g = new Game('wardens');
  g.res={s:0,c:0,m:0};
  g.cps=[{id:'F1',name:'F1',x:2250,y:225,radius:100,owner:'colonials',defenseLevel:0}];
  g.mines=[]; g.buildings=[];
  const art = createVehicle('warden_artillery','wardens',400,400);
  g.units=[art];
  art.tx=1200; art.ty=1200;
  let maxStep=0, prev={x:art.x,y:art.y}, arrived=false;
  for(let i=0;i<8000;i++){
    g.updateUnits();
    const step=Math.hypot(art.x-prev.x, art.y-prev.y);
    maxStep=Math.max(maxStep, step);
    prev={x:art.x,y:art.y};
    if(Math.hypot(art.x-1200,art.y-1200)<=20){arrived=true;break;}
  }
  check('арта: нет скачков', maxStep<=4.5, `maxStep=${maxStep.toFixed(2)}`);
  check('арта: доехала', arrived, `pos=(${Math.round(art.x)},${Math.round(art.y)})`);
}

process.exit(fails?1:0);
