// POI-Texte für Statistikseite und Alarm (Deno-Watcher importiert diese Datei: nur relative Importe mit Dateiendung).
import {instrumentConfig} from './instrumentConfig.js';
export const dobAge=sec=>sec<3600?`${Math.round(sec/60)} min`:sec<86400?`${(sec/3600).toLocaleString('de-DE',{maximumFractionDigits:1})} h`:`${Math.round(sec/86400)} Tg`;

// Letzter Touch der Zone vor OB1: „erster Touch vor 2,2 h“; ohne Zählung (Statistik speichert nur die Art) „Folge-Touch vor 40 min“.
export function dobRetestLabel({kind,count,ageSeconds}){
 if(!kind||!Number.isFinite(ageSeconds))return '';
 return `${kind==='first'?'erster':count>1?`${count}.`:'Folge-'}${kind==='first'||count>1?' ':''}Touch vor ${dobAge(ageSeconds)}`;
}

// POI aus den v1-Feldern, z.B. „H1-OB · 0,8 ATR · Folge-Touch vor 40 min“; v0 hat keine und zeigt „–“.
// LQ-Sweep: „LS-Reaktion #50160 · Kante“ bzw. „· Überlappung“ / „· 0,8 USD daneben“ (Forex in Pips); Schlüssel wie src/dobTradeFeatures.js.
const MATCH_TEXT={edge:'Kante',overlap:'Überlappung'};
const fmtLevel=(v,instrument)=>{const d=instrumentConfig(instrument??'XAUUSD').precision;return v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});};
const gapText=(gap,instrument)=>instrument&&instrument!=='XAUUSD'?`${(gap/instrumentConfig(instrument).pip).toLocaleString('de-DE',{maximumFractionDigits:1})} Pips`
 :`${Number(gap).toLocaleString('de-DE',{maximumFractionDigits:2})} USD`;
// lsPrice (gesweeptes LS-Level) steht vorn, damit Philip das Level im Chart findet: „1,32068 · LS-Reaktion #50740 · Kante“.
// Kausale LS-Auswahl (Lauf v2): mehrere gesweepte LS hängen „· 2 LS“ an.
export function dobLsReactionLabel({tradeSetupId,match,gapUsd,instrument,lsPrice,lsCount}){
 return `${Number.isFinite(lsPrice)?`${fmtLevel(lsPrice,instrument)} · `:''}LS-Reaktion #${tradeSetupId}${match?` · ${MATCH_TEXT[match]??`${gapText(gapUsd,instrument)} daneben`}`:''}${lsCount>1?` · ${lsCount} LS`:''}`;
}
export function dobPoiLabel(row){
 if(!row.poi_kind)return '–';
 if(row.poi_kind==='ts11'){const f=row.features??{};return dobLsReactionLabel({tradeSetupId:f.poi_trade_setup_id,match:f.poi_match,gapUsd:f.poi_gap_usd,instrument:row.instrument,lsCount:f.poi_ls_count});}
 const num=v=>v.toLocaleString('de-DE',{maximumFractionDigits:1});
 const distance=Number.isFinite(row.poi_distance_atr)?` · ${num(row.poi_distance_atr)} ATR`
  :Number.isFinite(row.poi_distance_usd)?` · ${num(row.poi_distance_usd)} USD`:'';
 const kind=/^ob_(h\d)$/.exec(row.poi_kind);
 const retest=dobRetestLabel({kind:row.poi_retest_kind,ageSeconds:row.poi_retest_age_seconds});
 return (kind?`${kind[1].toUpperCase()}-OB`:row.poi_kind)+distance+(retest?` · ${retest}`:'');
}
