import {riskBudget,RISK_BASE} from './mt5RiskContract.js';
import {validateStopAllocation} from './stopPlanContract.js';
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const finite=n=>typeof n==='number'&&Number.isFinite(n);

export function stopRiskBudget(mode,position,snapshot,policy,now){
 if(snapshot.hedging!==true||!snapshot.positions.some(p=>p.ticket===position.ticket&&p.symbol===position.symbol)||!finite(position.profit)||!finite(position.swap))throw new Error('risk_exposure_unavailable');
 const rest={...snapshot,positions:snapshot.positions.filter(p=>p.ticket!==position.ticket)};
 const limits=riskBudget(mode,position.symbol,rest,policy,now);
 // Der eigene offene Verlust steckt schon im Tagesstand; beim Ersetzen seines SL nicht doppelt zählen.
 const daily=limits.daily_left-Math.min(0,position.profit)-Math.min(0,position.swap);
 const drawdown=limits.drawdown_left-position.profit;
 const values={preset:limits.requested,market:limits.market_left,daily,drawdown};
 const allocation=Math.max(0,Math.min(...Object.values(values))),available=allocation-policy.cost_buffer;
 if(!positive(available))throw new Error('risk_budget_exhausted');
 const limiting_reason=Object.keys(values).find(key=>Math.abs(values[key]-allocation)<1e-7);
 return {...limits,allocation,available,effective_percent:allocation/RISK_BASE*100,limiting_reason};
}

export function stopRiskPreview(mode,position,snapshot,policy,quote,now){
 const budget=stopRiskBudget(mode,position,snapshot,policy,now),long=position.type===0;
 const unit=(long?quote.loss_per_unit_long:quote.loss_per_unit_short)/quote.minimum_volume;
 if(!positive(unit)||!positive(position.price_open)||!positive(position.volume)||!positive(quote.point))throw new Error('risk_sizing_unavailable');
 const raw=position.price_open+(long?-1:1)*budget.available/(unit*position.volume);
 const price=Number(((long?Math.ceil(raw/quote.point-1e-8):Math.floor(raw/quote.point+1e-8))*quote.point).toFixed(quote.digits));
 validateStopAllocation([{price,volume:position.volume}],position,quote,position.price_open,price);
 return {price,budget};
}

export function validateStopRisk(mode,stops,position,snapshot,policy,quote,now){
 const budget=stopRiskBudget(mode,position,snapshot,policy,now);
 const allocation=validateStopAllocation(stops,position,quote,position.price_open,null);
 const long=position.type===0,unit=(long?quote.loss_per_unit_long:quote.loss_per_unit_short)/quote.minimum_volume;
 if(!positive(unit))throw new Error('risk_sizing_unavailable');
 const gross=Math.max(0,(long?position.price_open-allocation.native_sl:allocation.native_sl-position.price_open)*unit*position.volume);
 if(gross>budget.available+1e-7)throw new Error('stop_risk_budget_exceeded');
 return {...allocation,budget,gross_risk:gross};
}
