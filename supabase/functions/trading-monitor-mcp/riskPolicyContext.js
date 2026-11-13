import {tradingDay} from './dailyStopContract.js';
export function riskPolicyDay(now){
 const {day,day_end_sec}=tradingDay(now);
 return {day,valid_until_sec:day_end_sec};
}
export function riskPolicyContext(policy,now){
 // Feste Regeln laufen nicht ab; die bestehenden Worker verlangen weiterhin einen aktuellen Tageskontext.
 return policy?{...policy,...riskPolicyDay(now)}:null;
}
