import {XAU_SIMULATION_EXECUTION_CONTRACT} from './xauSimulationExecutionContract.js';
const legacyOunces=value=>value?.executionContract?.version==='simulation-contract-v1'
 && value.executionContract.instrument==='XAUUSD'&&value.executionContract.unitsPerLot===1;

export function simulationVolumeLabel(value,field='lots'){
 const amount=value?.[field];if(!Number.isFinite(amount))return '–';
 const fmt=n=>n.toLocaleString('de-DE',{maximumFractionDigits:4});
 return legacyOunces(value)?`${fmt(amount)} oz (${fmt(amount/100)} Standardlots)`:`${fmt(amount)} Lots`;
}
export function simulationContractWarning(value){
 if(legacyOunces(value))return 'Historisches Fehlmodell: 5 USD je Unze. Gespeicherte Gebühren und Nettozahlen sind unverändert; Korrektur benötigt einen neuen Lauf.';
 if(value?.executionContract?.version===XAU_SIMULATION_EXECUTION_CONTRACT.version)
  return 'Backtest: Entry auf ganze Unzen abgerundet, T1 abstrakte Hälfte. Gebühren separat vom Preisrisiko; keine Broker-Minimum-/Schrittzusage.';
 return '';
}
