export const XAU_SIMULATION_EXECUTION_CONTRACT=Object.freeze({
 version:'xau-standard-lot-backtest-v2',instrument:'XAUUSD',quoteCurrency:'USD',scope:'backtest-only',
 unitsPerLot:100,commissionUsdPerLot:5,commissionBasis:'roundturn',
 entryGranularityUnits:1,minimumEntryUnits:1,brokerVolumeStep:null,brokerMinimumVolume:null,
 partialExitPolicy:'exact-half-abstract-backtest',riskBudgetBasis:'price-risk-excluding-commission',
 source:'Native closed XAUUSD.gbe deals verified 2026-11-08: contract units from gross PnL / price movement / lots; roundturn commission per opened standard lot.',
});
const money=value=>Math.round(value*1e8)/1e8;

// Die bisherige Abrundung auf ganze Unzen bleibt erhalten; Lots sind jetzt echte 100-oz-Lots.
export function sizeXauSimulationVolume({riskDistance,riskBudget,positionSizeFactor=1}){
 if(!Number.isFinite(riskDistance)||riskDistance<=0||!Number.isFinite(riskBudget)||riskBudget<=0
  ||![.5,1].includes(positionSizeFactor))return {status:'notExecutable',reason:'invalidSizing'};
 const contract=XAU_SIMULATION_EXECUTION_CONTRACT;
 const fullUnits=Math.floor(riskBudget/money(riskDistance)+1e-10);
 const units=Math.floor(fullUnits*positionSizeFactor+1e-10);
 if(!Number.isFinite(units)||units<contract.minimumEntryUnits)return {status:'notExecutable',reason:'belowOneOunce'};
 const lots=money(units/contract.unitsPerLot);
 return {status:'ready',reason:null,executionContract:{...contract},unitsPerLot:contract.unitsPerLot,
  commissionUsdPerLot:contract.commissionUsdPerLot,units,fullLots:money(fullUnits/contract.unitsPerLot),
  lots,t1Lots:money(lots/2),remainingLots:money(lots/2),actualRisk:money(units*money(riskDistance)),
  commissionUsd:money(lots*contract.commissionUsdPerLot)};
}
