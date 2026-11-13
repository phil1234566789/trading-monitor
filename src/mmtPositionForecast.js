import {positionRiskMultiple} from '../supabase/functions/trading-monitor-mcp/targetPlanContract.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const positive=value=>finite(value)&&value>0;
const amount=value=>finite(value)?value:null;

export function calcPositionLineForecast(input){
 const {direction,entryPrice,price,volume,positionVolume,basisSl,minimumVolume,lossPerUnit,profitPerUnit,entryVolume}=input;
 const currency=typeof input.currency==='string'&&/^[A-Z]{3,8}$/.test(input.currency)?input.currency:null;
 const validVolume=positive(volume)&&positive(positionVolume)&&volume<=positionVolume+1e-9;
 const share=validVolume?volume/positionVolume:null;
 // Bereits verbuchte Entrykosten gehören anteilig zur ursprünglichen Füllmenge, auch nach Teilcloses.
 const entryCosts=validVolume&&positive(entryVolume)&&entryVolume+1e-9>=positionVolume&&finite(input.entryCosts)?amount(input.entryCosts*volume/entryVolume):null;
 const swap=share!==null&&finite(input.swap)?amount(input.swap*share):null;
 const estimatedExitCosts=validVolume&&finite(input.estimatedExitCostsPerLot)?amount(input.estimatedExitCostsPerLot*volume):null;
 const costsKnown=currency!==null&&[entryCosts,swap,estimatedExitCosts].every(finite);
 const move=['long','short'].includes(direction)&&positive(entryPrice)&&positive(price)?(price-entryPrice)*(direction==='long'?1:-1):null;
 const coefficient=move!==null&&move>=0?profitPerUnit:lossPerUnit;
 let gross=null;
 if(currency&&validVolume&&move!==null){
  if(move===0)gross=0;
  else if(positive(minimumVolume)&&positive(coefficient))gross=amount(move*volume/minimumVolume*coefficient);
 }
 const estimatedNet=finite(gross)&&costsKnown?amount(gross+entryCosts+swap+estimatedExitCosts):null;
 return {gross,estimatedNet,rr:positionRiskMultiple(direction,entryPrice,price,basisSl),entryCosts,swap,estimatedExitCosts,currency,costsKnown};
}
