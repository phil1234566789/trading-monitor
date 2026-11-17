// Chart-Debugger-Sektion TS1.1: Philips Pins als Fälle und je Fall, woran der Detektor scheitert.
// Nur Anzeige: fragt die Bausteine von detectTradeSetups/TS1.1 einzeln ab, ändert keine Regel.
import {detectTradeSetups,detectSetupObs,hasUninterruptedSweepReaction,findFirstSetupObAfter,sweepBrokenByClose,
 widenObForSweep,TRADE_SETUP_OB_SWEEP_PROFILE,TRADE_SETUP_DETECTOR_VERSION} from './tradeSetup.js';
import {detectLiquidityLevels} from './liquidityDetection.js';
import {tradeSetupParameters} from './tradeSetupParameters.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {obMinimum,instrumentConfig} from './instrumentConfig.js';
import {isForbiddenAt} from './sessions.js';
import {evaluateSweepConfirmation} from './tradeSetupSweepSources.js';
import {orderBlockRecognitionTimes} from './orderBlockRecognitionTime.js';
import {filterTradeSetup11Candidates} from './tradeSetup11.js';
import {mergeCandles} from './candleCache.js';
import {TRADE_SETUP_M5_CANDLE_COUNT,TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';
import {tradeSetupFromRow} from './tradeSetupRow.js';

// Ältere trade_setup-Pins stammen aus der TS1.0-Zeit; ab hier pinnt Philip für TS1.1.
export const TS11_PINS_SINCE=Date.parse('2026-11-14T00:00:00Z')/1000;
const TS11_NOTE=/\bts\s*1[.,]\s*1\b/i;
// Nach dem Sweep sucht der Detektor höchstens so lange; die Lupe braucht Kerzen bis dahin plus Puffer.
export const TS11_LOOKAHEAD_SEC=6*3600;
const sec=iso=>iso==null?null:Math.floor(Date.parse(iso)/1000);

export function isTs11Pin(pin){
 return TS11_NOTE.test(pin.note??'')||(pin.kind==='trade_setup'&&sec(pin.createdAt)>=TS11_PINS_SINCE);
}

// „LS 4.445,98“ (deutsch) oder „LS 4179.25“ aus Philips Notiz.
export function noteLsPrice(note){
 const m=/\bLS\s*(\d[\d.,]*\d)/i.exec(note??'');
 if(!m)return null;
 const raw=m[1].includes(',')?m[1].replace(/\./g,'').replace(',','.'):m[1];
 const price=Number(raw);
 return Number.isFinite(price)?price:null;
}

const sideDir=direction=>({short:1,high:1,long:-1,low:-1})[direction]??null;

export function ts11CaseFromPin(pin,setupRows=new Map()){
 const row=pin.tradeSetupId!=null?setupRows.get(pin.tradeSetupId):null;
 const setup=row?tradeSetupFromRow(row):null;
 const level=pin.m5Liquidity??pin.liquidityLevel;
 const zone=pin.obZone?.timeframe==='5M'?pin.obZone:null;
 const instrument=setup?.instrument??pin.obZone?.instrument??level?.instrument??null;
 const dir=setup?.dir??sideDir(pin.obZone?.direction)??sideDir(level?.direction);
 const ob=setup?{top:setup.obTop,bottom:setup.obBottom,startTime:setup.obStartTime}
  :zone?{top:zone.top,bottom:zone.bottom,startTime:sec(zone.startTime)}:null;
 const lsPrice=noteLsPrice(pin.note)??setup?.ls?.price??level?.price??null;
 const lsPivotTime=setup?.ls?.pivotTime??sec(level?.pivotTime);
 const anchorTime=ob?.startTime??lsPivotTime;
 const base={id:pin.id,code:`P${pin.id}`,pin,instrument,dir,ob,lsPrice,lsPivotTime,anchorTime,setup,
  setupId:pin.tradeSetupId??null,detectorVersion:row?.detector_version??null};
 const error=!instrument||!dir?'Pin ohne Instrument oder Richtung'
  :!anchorTime?'Pin ohne M5-OB oder M5-Level (H1/H4-OB kann TS1 nicht tragen)':null;
 return {...base,error};
}

function prepare(kase,m5,sessions,at){
 const window=closedChecklistCandles(m5,'5m',at).slice(-TRADE_SETUP_M5_CANDLE_COUNT);
 const rows=markIgnoredCandles(window,sessions,s=>berlinOffsetMinutes(s*1000));
 const clean=rows.filter(c=>!c.ignored),levels=detectLiquidityLevels(rows,TRADE_SETUP_M5_FRACTAL_PERIOD);
 const obs=detectSetupObs(rows,obMinimum(kase.instrument,'5m'));
 const params={...tradeSetupParameters(kase.instrument,rows.at(-1)?.time),sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE};
 return {window,rows,clean,own:kase.dir===1?levels.highs:levels.lows,obs,params};
}

// Bestätigender OB und Auswertungszeitpunkt: der Moment, ab dem TS1.1 das Setup frühestens kennt (OB + 10 min).
export function locateTs11Case(kase,m5,sessions){
 const late=prepare(kase,m5,sessions,kase.anchorTime+TS11_LOOKAHEAD_SEC),obDir=-kase.dir,{obMaxDelaySec}=late.params;
 let ob=null,obNote=null,level=null;
 if(kase.ob){
  ob=late.obs.find(o=>o.dir===obDir&&o.startTime===kase.ob.startTime)??null;
  if(!ob)obNote=`Gepinnter OB ist kein Setup-OB: FVG unter Mindestgröße ${obMinimum(kase.instrument,'5m')} oder Richtung passt nicht`;
 }else{
  level=late.own.find(l=>l.pivotTime===kase.lsPivotTime&&Math.abs(l.price-kase.lsPrice)<1e-6)
   ??late.own.find(l=>Math.abs(l.price-kase.lsPrice)<1e-6)??null;
  if(!level?.touched)obNote=level?'Level wurde im Ladefenster nicht gesweept':'Kein M5-Fraktal (Periode 5) zu diesem Level';
  else{
   ob=findFirstSetupObAfter(late.obs,obDir,level.touchedTime,obMaxDelaySec);
   if(!ob)obNote=`Kein Setup-OB innerhalb ${obMaxDelaySec/60} min nach dem Sweep`;
  }
 }
 const fallback=level?.touchedTime!=null?level.touchedTime+obMaxDelaySec:kase.anchorTime;
 return {ob,obNote,level,evaluatedAt:(ob?.startTime??fallback)+600};
}

const check=(label,ok,detail='')=>({label,ok,detail});
const minutes=s=>`${Math.round(s/60)} min`;

function candidateChecks(level,ob,ctx,kase,recognizedAt){
 const {clean,obs,own,params}=ctx,dir=kase.dir,touch=level.touchedTime;
 if(!level.touched||touch==null)return [check('gesweept',false,'Level bis zum OB nicht berührt')];
 const extreme=widenObForSweep(ob,touch,dir,clean)[dir===1?'top':'bottom'];
 const first=findFirstSetupObAfter(obs,-dir,touch,params.obMaxDelaySec);
 const confirmation=evaluateSweepConfirmation(level,clean,recognizedAt,'5M',own);
 return [
  check('Sweep vor dem OB',touch<=ob.startTime,`Sweep ${minutes(ob.startTime-touch)} vor OB`),
  check(`OB höchstens ${minutes(params.obMaxDelaySec)} nach Sweep`,ob.startTime-touch<=params.obMaxDelaySec),
  check(`im Radius ${params.maxSweepDistance} vom Extrem`,Math.abs(level.price-extreme)<=params.maxSweepDistance,
   `Abstand ${Math.abs(level.price-extreme).toFixed(2)} zu ${extreme}`),
  check('erster Setup-OB nach Sweep',first?.startTime===ob.startTime,first?`erster OB ${first.startTime===ob.startTime?'ist dieser':'liegt früher/anders'}`:'kein OB im Fenster'),
  check('keine Gegen-FVG zwischen Sweep und OB',hasUninterruptedSweepReaction({dir,ls:level,sweeps:[{level,timeframe:'5M'}],obStartTime:ob.startTime},obs,clean)),
  check('Sweep nicht per Close gebrochen (Pfad B)',!sweepBrokenByClose(level,clean,dir,params)),
  check('Sweep-Bestätigung',confirmation.status==='valid',[confirmation.status,confirmation.reason].filter(Boolean).join(' · ')),
 ];
}

// policy: {h1,d1,m5} aus loadTradeSetup11Context; m5 ist die längere Ankerhistorie wie im Chart.
export function diagnoseTs11Case(kase,m5,sessions,located,policy){
 const {ob,evaluatedAt}=located,ctx=prepare(kase,m5,sessions,evaluatedAt),steps=[];
 if(!ob)return {evaluatedAt,steps:[check('Setup-OB vorhanden',false,located.obNote)],candidates:[],setup:null,verdict:'kein TS1-Setup'};
 steps.push(check('Setup-OB vorhanden',true,`${ob.bottom}–${ob.top}`));
 const setup=detectTradeSetups(kase.dir,ctx.own,[],ctx.own,ctx.obs,ctx.params,ctx.clean,ctx.rows)
  .find(s=>s.obStartTime===ob.startTime);
 const recognizedAt=orderBlockRecognitionTimes(ctx.rows,'5m').get(ob.startTime);
 // Philips Preis ist abgeschrieben, nicht gerundet: wenige Pips Toleranz statt Sweep-Radius.
 const near=l=>kase.lsPrice!=null&&Math.abs(l.price-kase.lsPrice)<=5*instrumentConfig(kase.instrument).pip;
 const candidates=ctx.own.filter(l=>near(l)||(l.touched&&l.touchedTime<=ob.startTime&&ob.startTime-l.touchedTime<=2*ctx.params.obMaxDelaySec))
  .map(level=>({level,philip:near(level),inSetup:!!setup?.sweeps.some(s=>s.level===level),checks:candidateChecks(level,ob,ctx,kase,recognizedAt)}));
 if(kase.lsPrice!=null&&!candidates.some(c=>c.philip))steps.push(check(`M5-Fraktal bei LS ${kase.lsPrice}`,false,'Detektor kennt dort kein Fraktal (Periode 5, z. B. M1-Pivot)'));
 steps.push(check(`TS1 (${TRADE_SETUP_DETECTOR_VERSION}) findet Setup`,!!setup,setup?`LS ${setup.ls.price}`:'kein gültiger Sweep zu diesem OB, siehe Kandidaten'));
 if(!setup)return {evaluatedAt,steps,candidates,setup:null,verdict:'kein TS1-Setup'};
 const forbidden=isForbiddenAt(sessions,ob.startTime,u=>berlinOffsetMinutes(u*1000));
 steps.push(check('OB nicht in verbotener Session',!forbidden,forbidden?'Chart blendet das Setup aus':''));
 const input={instrument:kase.instrument,m5Candles:mergeCandles(policy.m5??[],ctx.window),h1Candles:policy.h1,d1Candles:policy.d1,
  settings:{},sessionConfigs:sessions,evaluatedAt,sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE};
 const assessment=filterTradeSetup11Candidates({...input,setups:[{...setup,instrument:kase.instrument}]}).assessments[0];
 steps.push(check('TS1.1-Trendregel',assessment.status==='passed',`${assessment.status} · ${assessment.reason}`));
 for(const s of assessment.trendEvidence.sourceAssessments??[])steps.push(check(`  Quelle ${s.sourceKey?.split(':').slice(0,2).join(' ')} ${s.sourceKey?.split(':')[4]??''}`,s.status==='passed',`${s.status} · ${s.reason}`));
 const verdict=forbidden?'ausgeblendet (verbotene Session)':assessment.status==='passed'?'TS1.1 ✓':`TS1.1 ${assessment.status}`;
 return {evaluatedAt,steps,candidates,setup:{...setup,instrument:kase.instrument},assessment,verdict};
}

const HOUR=3600;
// Philip braucht mindestens einen Tag M5-Vorlauf, um den Trend am Fall selbst zu lesen.
export const TS11_LEADS=[['24h','24 h',24*HOUR],['48h','48 h',48*HOUR],['72h','72 h',72*HOUR],['7d','7 Tage',7*24*HOUR]];
export const TS11_TAILS=[['1h','+ 1 h',HOUR],['3h','+ 3 h',3*HOUR],['6h','+ 6 h',6*HOUR],['12h','+ 12 h',12*HOUR]];
const pick=(list,key,fallback)=>(list.find(([k])=>k===key)??list.find(([k])=>k===fallback));
export const ts11LeadOf=v=>pick(TS11_LEADS,v,'24h')[0];
export const ts11TailOf=v=>pick(TS11_TAILS,v,'3h')[0];
// Sicht um den Fall; geladen wird zusätzlich das volle Chart-M5-Fenster vor dem Auswertungszeitpunkt.
export function ts11CaseWindow(kase,lead,tail){
 const from=Math.min(kase.anchorTime-pick(TS11_LEADS,lead,'24h')[2],(kase.lsPivotTime??kase.anchorTime)-HOUR);
 const to=kase.anchorTime+pick(TS11_TAILS,tail,'3h')[2],loadTo=Math.max(to,kase.anchorTime+TS11_LOOKAHEAD_SEC);
 return {view:{from,to},loadTo,count:{'5m':TRADE_SETUP_M5_CANDLE_COUNT+Math.ceil((loadTo-from)/300)+300,'1m':Math.ceil((to-from)/60)+30}};
}
