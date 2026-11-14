import {fmtPrice,pricePrecisionForInstrument} from './format.js';
import {formatDatedTime} from './berlinTime.js';

function sourceDescription({level,timeframe},instrument){
 const ob=level.sourceKind==='orderBlock',born=level.sourceStartTime??level.pivotTime;
 const price=fmtPrice(level.price,pricePrecisionForInstrument(instrument));
 return `${ob?'OB-Kante':'LS'} ${price} (${timeframe}) · ${formatDatedTime(born)}`+
  (ob?` · bekannt ${formatDatedTime(level.sourceKnownAt)}`:'')+
  ` · Sweep ${formatDatedTime(level.touchedTime)}`;
}

export function tradeSetupSourceDetails(setup,instrument){
 if(!setup)return '';
 const display=(setup.sweeps??[]).map(s=>sourceDescription(s,instrument)).join(' | ');
 const witness=setup.trendEvidence?.goWitness;
 return display+(witness?`${display?' · ':''}GO-Beleg: ${sourceDescription(witness,instrument)}`:'');
}

export function tradeSetupInteractionRows(live,frozen){
 return frozen?[...live.filter(s=>s.dir!==frozen.dir||s.obStartTime!==frozen.obStartTime),frozen]:live;
}
