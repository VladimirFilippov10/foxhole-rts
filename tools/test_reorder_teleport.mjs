// Регрессия бага «телепорт с восстановлением координат»:
// юнит едет, посреди пути выдаём НОВЫЙ приказ; в этот момент приходит NaN
// (симулируем внешний источник повреждения). Юнита НЕ должно телепортировать
// на старую точку приказа/базу — восстановление обязано быть рядом с ним.
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';

global.window = { innerWidth: 1200, innerHeight: 800, AI_LOG: false };
let fails = 0;
const check = (n, c, i='') => { console.log((c?'PASS':'FAIL')+' | '+n+(i?' | '+i:'')); if(!c) fails++; };

{
  const g = new Game('wardens');
  g.res={s:0,c:0,m:0};
  // база игрока далеко слева — если санация возьмёт её как якорь, будет телепорт
  g.cps=[{id:'B1',name:'B1',x:100,y:100,radius:80,owner:'wardens',defenseLevel:0},
         {id:'E1',name:'E1',x:2500,y:1500,radius:120,owner:'colonials',defenseLevel:0}];
  g.mines=[]; g.buildings=[];
  const v = createVehicle('devitt','wardens',300,300);
  g.units=[v];
  // ПЕРВЫЙ приказ — длинный маршрут
  v.tx=2000; v.ty=300;
  for(let i=0;i<200;i++) g.updateUnits();          // юнит в пути (~pos x≈600)
  check('юнит едет по первому приказу', v.x>500 && v.tx===2000, `pos=(${Math.round(v.x)},${Math.round(v.y)})`);
  const posBefore = {x:v.x, y:v.y};
  // ВТОРОЙ приказ посреди пути
  v.tx=1200; v.ty=900;
  g.updateUnits();                                 // один шаг нового маршрута
  // Внешний источник повреждает координаты ровно после смены приказа
  v.x=NaN; v.y=NaN;
  g.updateUnits();                                 // санация должна восстановить РЯДОМ
  const dRestore = Math.hypot(v.x-posBefore.x, v.y-posBefore.y);
  check('нет телепорта на старую точку/базу при восстановлении', Number.isFinite(v.x)&&Number.isFinite(v.y)&&dRestore<100, `restored=(${Math.round(v.x)},${Math.round(v.y)}), drift=${dRestore.toFixed(1)}`);
  // и дальше юнит продолжает движение к новой цели
  let arrived=false;
  for(let i=0;i<4000;i++){ g.updateUnits(); if(v.tx===undefined){arrived=true;break;} }
  check('после восстановления доехал до ВТОРОЙ точки приказа', arrived && Math.hypot(v.x-1200,v.y-900)<25, `pos=(${Math.round(v.x)},${Math.round(v.y)})`);
}

// Сценарий из консоли пользователя: devitt с id va0l9tx5ge — арта? нет, танк.
// Проверяем также вариант, когда NaN приходит от соседа через сепарацию.
{
  const g = new Game('wardens');
  g.res={s:0,c:0,m:0};
  g.cps=[{id:'B1',name:'B1',x:100,y:100,radius:80,owner:'wardens',defenseLevel:0}];
  g.mines=[]; g.buildings=[];
  const v = createVehicle('devitt','wardens',400,400);
  const w = createVehicle('gallagher','wardens',405,405);
  g.units=[v,w];
  v.tx=1800; v.ty=400; w.tx=1800; w.ty=400;
  for(let i=0;i<150;i++) g.updateUnits();
  const pv={x:v.x,y:v.y};
  v.tx=1000; v.ty=1000;                 // новый приказ на ходу
  w.x=NaN; w.y=NaN;                    // сосед повредился (внешне)
  g.sanitizeAllPositions();            // глобальная санация начала тика
  g.updateUnits();
  const dd=Math.hypot(v.x-pv.x, v.y-pv.y);
  check('соседняя NaN-сепарация не телепортирует юнита', Number.isFinite(v.x)&&dd<50, `drift=${dd.toFixed(1)}`);
}

process.exit(fails?1:0);
