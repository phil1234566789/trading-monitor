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

// Teilprofit mit SL auf Entry ab atR (Konfig partialAtR/partialBe): Rest-Verlauf aus dobMaxR(..., {breakevenAtR}) je gespeicherter
// Stufe, Schlüssel be_<atR>_*. Gelesen über dobBreakevenRest, gerechnet in src/dobPartialProfit.js.
export const DOB_BREAKEVEN_AT_R_LEVELS=[3];
const beKey=(atR,field)=>`be_${String(atR).replace('.','_')}_${field}`;
export const dobBreakevenFeatures=(atR,{maxR,slHit,ambiguousR})=>({[beKey(atR,'max_r')]:maxR,[beKey(atR,'stopped')]:slHit,[beKey(atR,'ambiguous_r')]:ambiguousR});
export function dobBreakevenRest(features,atR){
 const maxR=features?.[beKey(atR,'max_r')];
 return Number.isFinite(maxR)?{maxR,stopped:features[beKey(atR,'stopped')]===true,ambiguousR:features[beKey(atR,'ambiguous_r')]??null}:null;
}

// POI-Art LQ-Sweep (src/dobLqSweepPoi.js): welches LS-Reaktion-Setup trägt und wie es am DOB hängt. Die Stufe (edge/overlap/adjacent)
// entscheidet die Konfig (poiMatchMode); HTF-OB-Trades schreiben keine dieser Schlüssel.
// Keine Detektorversion: trade_setups.detector_version hält nach Backfills das alte Etikett (Trigger preserve_trade_setup_provenance).
export const DOB_POI_FEATURE_KEYS=Object.freeze({match:'poi_match',gapUsd:'poi_gap_usd',tradeSetupId:'poi_trade_setup_id',matchedOb:'poi_matched_ob',
 matchedEdge:'poi_matched_edge',lsPrice:'poi_ls_price',lsPivotTime:'poi_ls_pivot_time',lsTouchedTime:'poi_ls_touched_time',
 // Kausale LS-Auswahl (Lauf v2): Herkunft ('causal'/'none'), Zahl und Liste der gültigen LS der Sweep-Kerze, Start des Umkehr-OB.
 lsSource:'poi_ls_source',lsCount:'poi_ls_count',lsLevels:'poi_ls_levels',reactionObStart:'poi_reaction_ob_start'});
export const dobPoiFeatures=poi=>poi?.kind!=='ts11'?{}:Object.fromEntries(Object.entries(DOB_POI_FEATURE_KEYS).map(([field,key])=>[key,poi[field]??null]));
export const dobPoiFeature=(features,field)=>features?.[DOB_POI_FEATURE_KEYS[field]]??null;

// Lesen: Zeile aus dob_trade_setups bzw. Setup des Watchers; ältere Läufe ohne features liefern {} (kein Urteil, keine Sperre).
export const dobFeaturesOf=rowOrSetup=>rowOrSetup?.features??{};
export const dobFeature=(features,key)=>Number.isFinite(features?.[DOB_FEATURE_KEYS[key]])?features[DOB_FEATURE_KEYS[key]]:null;
