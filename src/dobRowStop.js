import {slAlgoApplies} from './slAlgo.js';

// Eigenes Modul wie dobTargetOutcome.js: der DOB-Watcher (Deno) braucht diese Zeilen-Helfer für die TP-WR (dobPartialProfit) ohne die
// Pin-Abgleich-Kette von dobTradeStatistics.js; dort weiter re-exportiert.
export const dobRunPoiType=runId=>runId.includes('lq-sweep')?'lq_sweep':'htf_ob';
// SL-Algo Struktur-P2 (Konfig slAlgo): Trades mit Anti-Confluence und M15-P2 rechnen mit dessen Werten, alle anderen unverändert.
// Die swing_*-Spalten rechnet der Fill mit SL_ALGO_V1. stop_price bleibt (Pin-Schlüssel), der neue SL steht in swing_stop_price.
export const dobHasSwingStopVariant=row=>row.swing_max_r!=null;
// Wie der Alarm (checkDobTradeSetup): Methode UND POI-Familie der Zeile (aus ihrem Lauf) müssen passen.
export const dobSlAlgoActive=(config,row)=>slAlgoApplies(config?.slAlgo,dobRunPoiType(row?.run_id??''));
export const dobRowStopPrice=(config,row)=>dobSlAlgoActive(config,row)&&dobHasSwingStopVariant(row)?row.swing_stop_price:row.stop_price;
export const dobAsSwingStop=row=>dobHasSwingStopVariant(row)?{...row,max_r:row.swing_max_r,sl_hit:row.swing_sl_hit,ambiguous_r:row.swing_ambiguous_r}:row;
