import {fmtMoney,fmtPrice,fmtR} from './format.js';
import {mmtRiskReason} from './mmtRiskReasons.js';

export const exitKindLabel=kind=>kind==='stop'?'SL':kind==='entry'?'Entry':'TP';
export function exitForecastLabel(forecast){
 return `Netto ${forecast?.estimatedNet==null?'—':'≈ '+fmtMoney(forecast.estimatedNet,forecast.currency)} · ${fmtR(forecast?.rr)}`;
}
export function stopChoiceLabel(mode,preview){
 const requested=mode==='risky'?.5:.9,effective=preview?.budget?.effective_percent;
 return `SL ${fmtPrice(requested,2)}${Number.isFinite(effective)&&effective<requested-1e-7?' → '+fmtPrice(effective,2):''} %`;
}
export function stopPreviewReason(preview,fallback=''){
 if(fallback)return fallback;
 if(preview?.error)return mmtRiskReason(preview.error);
 const b=preview?.budget;
 return b?`${fmtMoney(b.allocation)} Risikobudget einschließlich ${fmtMoney(b.cost_buffer)} Kosten-/Slippagepuffer${b.limiting_reason&&b.limiting_reason!=='preset'?' · Restbudget begrenzt':''}`:'SL-Berechnung wird geladen.';
}
