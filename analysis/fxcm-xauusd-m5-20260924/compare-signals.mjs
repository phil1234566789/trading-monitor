import { readFileSync, writeFileSync } from 'node:fs';
import { detectOrderBlocks } from '../../src/orderBlockDetection.js';
import { detectLiquidityLevels } from '../../src/liquidityDetection.js';
const root = new URL('./',import.meta.url);
const data = JSON.parse(readFileSync(new URL('candles.json',root),'utf8'));
const tv = JSON.parse(readFileSync(new URL('tradingview.json',root),'utf8')).bars;
const sdk = new Map(data.instruments['XAU/USD'].candles.map(c=>[Date.parse(c.time)/1000,{...c,time:Date.parse(c.time)/1000}]));
const common = tv.filter(c=>sdk.has(c.t));
const a = common.map(c=>sdk.get(c.t));
const b = common.map(c=>({time:c.t,open:c.o,high:c.h,low:c.l,close:c.c}));
function signals(candles) {
  const obs = detectOrderBlocks(candles,'5m',false,0.75);
  const {highs,lows} = detectLiquidityLevels(candles,5);
  return {obs,levels:[...highs,...lows]};
}
const left=signals(a),right=signals(b);
const obKey=z=>`${z.dir}:${z.startTime}`;
const levelKey=z=>`${z.dir}:${z.pivotTime}`;
function compare(x,y,key) {
  const mx=new Map(x.map(z=>[key(z),z])),my=new Map(y.map(z=>[key(z),z]));
  return {sdkCount:x.length,tvCount:y.length,sdkOnly:[...mx.keys()].filter(k=>!my.has(k)),tvOnly:[...my.keys()].filter(k=>!mx.has(k)),changed:[...mx.keys()].filter(k=>my.has(k)).filter(k=>JSON.stringify(mx.get(k))!==JSON.stringify(my.get(k))).map(k=>({key:k,sdk:mx.get(k),tv:my.get(k)}))};
}
const result={matchedBars:common.length,first:a[0].time,last:a.at(-1).time,minFvg:0.75,obs:compare(left.obs,right.obs,obKey),liquidity:compare(left.levels,right.levels,levelKey)};
writeFileSync(new URL('signal-comparison.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,obs:{...result.obs,changed:result.obs.changed.length},liquidity:{...result.liquidity,changed:result.liquidity.changed.length}}));
