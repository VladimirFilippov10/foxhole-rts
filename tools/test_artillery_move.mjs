// Тест: артиллерия при приказе движения ЕДЕТ К ЦЕЛИ (не крутится на месте,
// не «исчезает», приказ не подменяется авто-смещением).
import { Game } from '../js/game.js';
import { createVehicle } from '../js/vehicles.js';

global.window = { innerWidth: 1200, innerHeight: 800, AI_LOG: false };
let fails=0; const check=(n,c,i='')=>{console.log((c?'PASS':'FAIL')+' | '+n+(i?' | '+i:''));if(!c)fails++;};

const g = new Game('wardens');
g.res={s:0,c:0,m:0};
g.cps=[{id:'A1',name:'A1',x:375,y:225,radius:100,owner:'wardens',defenseLevel:0},
       {id:'F1',name:'F1',x:2250,y:225,radius:100,owner:'colonials',defenseLevel:0}];
g.mines=[]; g.buildings=[];
const art = createVehicle('warden_artillery','wardens',400,400);
g.units=[art];
art.tx=1200; art.ty=1200;
const target={x:1200,y:1200};
let arrived=false, minD=Infinity;
for(let i=0;i<4000;i++){
  g.updateUnits();
  if(art.hp<=0) break;
  const d=Math.hypot(art.x-target.x,art.y-target.y);
  minD=Math.min(minD,d);
  if(d<=20){arrived=true;break;}
}
check('арта жива (не исчезла)', art.hp>0, `hp=${art.hp}`);
check('арта ДОЕХАЛА к цели приказа', arrived||minD<60, `minDist=${Math.round(minD)} pos=(${Math.round(art.x)},${Math.round(art.y)})`);

// Приказ движения не должен подменяться авто-отъездом от ближней цели:
const art2 = createVehicle('warden_artillery','wardens',900,900);
const enemy = createVehicle('hoplite','colonials',950,950); // в упор (<minRange)
g.units=[art2,enemy];
art2.tx=1500; art2.ty=900;
const order={x:art2.tx,y:art2.ty};
for(let i=0;i<50;i++) g.updateUnits();
const sameOrder = art2.tx===order.x && art2.ty===order.y;
const movingTowardGoal = art2.x>900; // поехала в сторону цели приказа, а не от врага
check('при движении приказ НЕ подменяется авто-смещением', sameOrder || movingTowardGoal, `tx=${art2.tx},ty=${art2.ty},x=${Math.round(art2.x)}`);
process.exit(fails?1:0);
