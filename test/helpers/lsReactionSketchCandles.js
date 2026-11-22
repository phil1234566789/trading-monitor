// Künstliche XAU-Kerzen für Philips LS-Reaktion-Wurzel-Skizze: ein D1-Hoch als Anker, danach eine LL/LH-Wurzel abwärts,
// am Ende die Szene der Skizze. Wegpunkte [Bar, Preis]; Dochte {wick} sind Sweeps, die per Schluss zurückkommen.
import {detectLiquidityLevels} from '../../src/liquidityDetection.js';

const START=Date.UTC(2026,10,2)/1000,BAR=300;
// Anstieg bis zum D1-Hoch (Tag 9 Mittag, die D1-Erkennung braucht 8 Tage davor), danach Wurzel mit Beinen -12/+6 bis Tag 15.
export function rootWaypoints(){
 const pts=[[0,3900],[9*288+144,4100]];
 let bar=9*288+144,price=4100;
 while(bar<15*288){bar+=30;price-=12;pts.push([bar,price]);bar+=15;price+=6;pts.push([bar,price]);}
 return pts;
}
// Skizzen-Punkte (x, y wie im SVG) an die Wurzel hängen: 0,2 Bar je x-Einheit, 0,2 USD je y-Einheit.
export function appendSketch(pts,sketch){
 const [x0,y0]=sketch[0],[bar0,price0]=pts.at(-1);
 for(const [x,y,wick] of sketch.slice(1))pts.push([bar0+Math.round((x-x0)*0.2),+(price0-(y-y0)*0.2).toFixed(2),wick]);
 return pts;
}
export function sketchCandles(pts){
 const path=pts.filter(p=>!p[2]),last=path.at(-1)[0];
 const at=t=>{const i=path.findIndex(p=>p[0]>=t);if(i<=0)return path[Math.max(0,i)][1];
  const [a,pa]=path[i-1],[b,pb]=path[i];return pa+(pb-pa)*(t-a)/(b-a);};
 const m5=[];
 for(let i=0;i<=last;i++){
  const open=+at(i-0.5).toFixed(2),close=+at(i+0.5).toFixed(2),mid=+at(i).toFixed(2);
  m5.push({time:START+i*BAR,open,close,high:Math.max(open,close,mid),low:Math.min(open,close,mid),volume:1});
 }
 for(const [bar,price,wick] of pts)if(wick){const c=m5[bar];c.high=Math.max(c.high,price);c.low=Math.min(c.low,price);}
 const agg=sec=>[...m5.reduce((m,c)=>{const t=c.time-(c.time-START)%sec,g=m.get(t);
  m.set(t,g?{...g,high:Math.max(g.high,c.high),low:Math.min(g.low,c.low),close:c.close}:{...c,time:t});return m;},new Map()).values()];
 return {m5,h1:agg(3600),d1:agg(86400)};
}
export const barTime=bar=>START+bar*BAR;
// LS wie die Erkennung ihn sieht (Periode 5), damit der Test keine Zeiten von Hand rät.
export function lsAt(m5,dir,bar){
 const {highs,lows}=detectLiquidityLevels(m5,5),level=(dir===1?highs:lows).find(p=>p.pivotTime===barTime(bar));
 if(!level)throw new Error(`kein Fraktal an Bar ${bar}`);
 return level;
}
export function sketchSetup(dir,level){
 const ob=level.touchedTime,box=dir===1?{obTop:level.price+4,obBottom:level.price-2}:{obTop:level.price+2,obBottom:level.price-4};
 const ls={price:level.price,pivotTime:level.pivotTime,touchedTime:level.touchedTime,dir};
 return {instrument:'XAUUSD',dir,obStartTime:ob,...box,ls,sweeps:[{timeframe:'5M',level:ls}]};
}
