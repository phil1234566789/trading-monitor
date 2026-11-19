import {expect,it} from 'vitest';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {rootWaypoints,appendSketch,sketchCandles,lsAt,sketchSetup} from './helpers/ts11SketchCandles.js';

// Philips Wurzel-Skizze (Artifact „TS1.1 Wurzel-Skizze“): „du kannst entweder short weiter runter traden (also ab wurzel
// bis Low 09:20) oder Long traden vom Low 09:20 hoch, wenn es eine Struktur gibt“. Punkte = SVG-Koordinaten der Skizze.
const ROOT_END=[[488,522],[575,360],[703,630]];
const SHORT=[...ROOT_END,[780,475],[845,545],[907,405],[955,467],[1030,368],[1035,340,true],[1040,368],[1097,497],[1148,430],[1275,778]];
const LONG=(hh=315)=>[...ROOT_END,[780,470],[845,545],[935,hh],[1045,535],[1050,575,true],[1055,535],[1123,520],[1300,150]];
function run(sketch,dir,lsX){
 const pts=appendSketch(rootWaypoints(),sketch),{m5,h1,d1}=sketchCandles(pts);
 const bar=pts.at(-sketch.length+sketch.findIndex(p=>p[0]===lsX))[0],setup=sketchSetup(dir,lsAt(m5,dir,bar));
 return filterTradeSetup11Candidates({instrument:'XAUUSD',m5Candles:m5,h1Candles:h1,d1Candles:d1,sessionConfigs:[],
  setups:[setup],evaluatedAt:setup.obStartTime+600}).assessments[0];
}

it('Short: LH der Wurzel vor dem Low, die Gegenbewegung sweept ihn → ✓',()=>{
 expect(run(SHORT,1,575)).toMatchObject({status:'passed'});
});
it('Long: HL der Gegenbewegung vor dem HH, der Rücksetzer sweept ihn → ✓ (mit BOS)',()=>{
 expect(run(LONG(),-1,845)).toMatchObject({status:'passed'});
});
it('Long ohne BOS: HH bleibt unter dem letzten LH der Wurzel → trotzdem ✓',()=>{
 expect(run(LONG(400),-1,845)).toMatchObject({status:'passed'});
});
it('Negativ 1: Tief erst nach dem HH (gespiegelter P493) → ✗ sourcePivotInCounterMove',()=>{
 const late=[...ROOT_END,[780,470],[845,545],[935,315],[985,440],[1010,400],[1060,435],[1065,470,true],[1070,435],[1300,150]];
 expect(run(late,-1,985)).toMatchObject({status:'unmet',reason:'sourcePivotInCounterMove'});
});
it('Negativ 2: Long ohne HL in der Gegenbewegung → kein Long',()=>{
 const noHl=[...ROOT_END,[935,315],[1040,625],[1045,660,true],[1050,625],[1300,150]];
 expect(run(noHl,-1,703).status).not.toBe('passed');
});
it('Negativ 3: Short-LS, der erst nach dem Low entsteht → ✗',()=>{
 expect(run(SHORT,1,907)).toMatchObject({status:'unmet'});
});
