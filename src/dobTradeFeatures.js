import {candleDirection} from './candlePatterns.js';

// Konfig-Merkmale je DOB-Trade (Philip): eine jsonb-Spalte features in dob_trade_setups statt einer Spalte je Merkmal. Schreiben
// (Fill, Setup im Watcher) und Lesen (dobGuardrails, Statistikseite) laufen nur über diese Datei, die Schlüsselnamen stehen hier.
// Deno-tauglich (Watcher-Bundle): nur relative Importe mit Dateiendung.
export const DOB_FEATURE_KEYS=Object.freeze({counterCandles3:'counter_candles_3',counterCandles5:'counter_candles_5'});
const M5=300;

// Gegenkerzen (DOB-PA, Labor lab-reeval): Kerzen mit Farbe gegen die Trade-Richtung unter den letzten n M5, die vor dem Entry
// geschlossen sind. Session-ignorierte Kerzen zählen mit (echte Preise). m5Candles aufsteigend.
export function dobCounterCandles(m5Candles,entryTime,direction,n){
 let hi=m5Candles.length,lo=0;
 while(lo<hi){const m=(lo+hi)>>1;if(m5Candles[m].time+M5<=entryTime)lo=m+1;else hi=m;}
 const against=direction==='short'?'bull':'bear';
 return m5Candles.slice(Math.max(0,lo-n),lo).filter(c=>candleDirection(c)===against).length;
}

export function dobTradeFeatures({m5Candles,entryTime,direction}){
 return {[DOB_FEATURE_KEYS.counterCandles3]:dobCounterCandles(m5Candles,entryTime,direction,3),
  [DOB_FEATURE_KEYS.counterCandles5]:dobCounterCandles(m5Candles,entryTime,direction,5)};
}

// Lesen: Zeile aus dob_trade_setups bzw. Setup des Watchers; ältere Läufe ohne features liefern {} (kein Urteil, keine Sperre).
export const dobFeaturesOf=rowOrSetup=>rowOrSetup?.features??{};
export const dobFeature=(features,key)=>Number.isFinite(features?.[DOB_FEATURE_KEYS[key]])?features[DOB_FEATURE_KEYS[key]]:null;
