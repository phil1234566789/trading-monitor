import {dobTargetOutcome} from './dobTargetOutcome.js';
import {dobHasSwingStopVariant,dobAsSwingStop,dobSlAlgoActive} from './dobRowStop.js';
import {dobRowConfigTpR,dobPartialPlan} from './dobGuardrails.js';
import {dobFeaturesOf,dobBreakevenRest} from './dobTradeFeatures.js';

// Ausgang eines Lauf-Trades nach Konfig inkl. Teilprofit (Labor DOB-LAB-TEILPROFIT, Abnahme Philips Konfig +111,5R): eine Rechnung
// für Statistikseite, Panel-Vorschau und Chart-Positionen. {target, outcome, r, rest, label}; outcome success/loss nach Vorzeichen
// von r (Winrate = Anteil Trades mit ΣR > 0), sonst ambiguous/open/unknown mit r null.
const restOutcome=(row,tp,plan)=>{
 if(!plan.be)return dobTargetOutcome(row,tp);
 const be=dobBreakevenRest(dobFeaturesOf(row),plan.atR);
 if(!be)return 'unknown';
 if(be.maxR>=tp)return 'success';
 if(tp<=(be.ambiguousR??-1))return 'ambiguous';
 return be.stopped?'breakeven':row.outcome==='unknown'?'unknown':'open';
};
const pctText=pct=>pct===50?'½':`${pct} %`;

export function dobPartialScore(row,tp,plan){
 const single=k=>{const outcome=dobTargetOutcome(row,k);return {target:tp,outcome,r:outcome==='success'?k:outcome==='loss'?-1:null,rest:null,label:null};};
 if(!plan||tp<=plan.atR)return single(tp);
 const first=single(plan.atR);
 if(first.outcome!=='success')return first;
 const rest=restOutcome(row,tp,plan),restR={success:tp,loss:-1,breakeven:0}[rest];
 if(restR==null)return {target:tp,outcome:rest==='ambiguous'||rest==='unknown'?rest:'open',r:null,rest,label:null};
 const share=plan.pct/100,r=Math.round((share*plan.atR+(1-share)*restR)*1000)/1000;
 return {target:tp,outcome:r>0?'success':'loss',r,rest,label:`${String(plan.atR).replace('.',',')}R ${pctText(plan.pct)}${rest==='breakeven'?' · BE':''}`};
}
// SL-Algo Struktur-P2: festes Ziel gegen den M15-P2-SL; ein Win bringt tp·DOB-Risiko / neues Risiko. Teilprofit-Verläufe gibt es nur
// zum DOB-SL, deshalb rechnen (c)-Trades ohne Teilprofit.
export const dobRowConfigScore=(config,row)=>{const tp=dobRowConfigTpR(config,row);
 if(!dobSlAlgoActive(config,row)||!dobHasSwingStopVariant(row))return dobPartialScore(row,tp,dobPartialPlan(config,tp));
 const s=dobPartialScore(dobAsSwingStop(row),tp,null);
 return s.outcome==='success'?{...s,r:Math.round(tp*Math.abs(row.entry_price-row.stop_price)/row.swing_risk_usd*1000)/1000}:s;};
// Hat der Lauf den Rest-Verlauf für diese Teilprofit-Stufe gespeichert (sonst blendet das Panel den Schalter aus)?
export const dobHasPartialData=(rows,atR)=>rows.some(r=>dobBreakevenRest(dobFeaturesOf(r),atR)!=null);
