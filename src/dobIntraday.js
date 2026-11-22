import {berlinOffsetMinutes,berlinDateStrFor} from './berlinTime.js';
import {dobMaxR} from './dobMaxR.js';
import {candlesInWindow} from './atr.js';
import {dobSlAlgoActive,dobHasSwingStopVariant} from './dobTradeStatistics.js';

// Zusätzliche Messgröße „Ziel bis Tagesende erreicht“ (nur Intraday-Wins zählen). Kein Filter, max_r/sl_hit bleiben wie gemessen.
// Tagesende = NY-Close in Berlin-Zeit: 22:00 in der Berliner Sommerzeit, 23:00 im Winter (Default, von Philip noch nicht bestätigt).
// Konfig-Wert: der Fill rechnet mit diesem Tagesende; ein anderer Wert braucht einen neuen Fill.
export const DOB_INTRADAY_DAY_END=Object.freeze({summerMinutes:22*60,winterMinutes:23*60});

// Erstes Tagesende nach dem Entry (Unix-Sekunden). Sommer/Winter nach dem Berliner Offset dieses Kalendertags (Intl, kein fixer Offset).
export function dobIntradayEnd(entryTime,dayEnd=DOB_INTRADAY_DAY_END){
 const endOf=dateStr=>{const [y,m,d]=dateStr.split('-').map(Number),noon=Date.UTC(y,m-1,d,12),offset=berlinOffsetMinutes(noon);
  return Date.UTC(y,m-1,d)/1000+(offset===120?dayEnd.summerMinutes:dayEnd.winterMinutes)*60-offset*60;};
 const today=endOf(berlinDateStrFor(entryTime));
 return entryTime<today?today:endOf(berlinDateStrFor(entryTime+86400));
}

// Stufen wie dobMaxR bis zum Tagesende; danach offen = kein Win. closeR: R zum letzten M1-Schluss vor dem Tagesende, in R des
// verwendeten SL, nur zur Info. null, solange das Tagesende nach dem Datenende liegt.
export function dobIntradayOutcome(t,{candles,dataEnd,instrument='XAUUSD',rScale=1,dayEnd=DOB_INTRADAY_DAY_END}){
 const end=dobIntradayEnd(t.entryTime,dayEnd);
 if(end>dataEnd)return null;
 const {maxR}=dobMaxR(t,{candles,dataEnd:end,instrument,rScale});
 const close=candlesInWindow(candles,t.entryTime,end-59).at(-1)?.close??null;
 const side=t.direction==='long'?1:-1,risk=Math.abs(t.entryPrice-t.stopPrice);
 return {maxR,closeR:close==null||!risk?null:Math.round(side*(close-t.entryPrice)/risk*1000)/1000};
}

// Winrate nur mit Intraday-Wins (Statistik/Panel): Ziel k nach Konfig bis zum Tagesende erreicht = Win, sonst kein Win.
// Mit aktivem SL-Algo zählen die swing_intraday-Werte der Trades mit Variante. Zeilen ohne Messwert (Tagesende nach Datenende) fehlen.
export function dobIntradayWinrate(rows,config,kOf){
 let n=0,wins=0;
 for(const r of rows){
  const m=dobSlAlgoActive(config,r)&&dobHasSwingStopVariant(r)?r.swing_intraday_max_r:r.intraday_max_r;
  if(m==null)continue;
  n++;if(m>=kOf(r))wins++;
 }
 return {n,winrate:n?wins/n:null};
}
