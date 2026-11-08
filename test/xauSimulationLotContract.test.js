import {expect,it} from 'vitest';
import {XAU_SIMULATION_EXECUTION_CONTRACT,sizeXauSimulationVolume} from '../src/xauSimulationExecutionContract.js';
import {sizeSimulation} from '../src/tradeSetupSimulation.js';
import reference from './fixtures/xauusd-dr125-lot-unit-reference.json';

it('expresses the original DR125 exposure in standard lots with the proven roundturn fee',()=>{
 expect(XAU_SIMULATION_EXECUTION_CONTRACT).toMatchObject({unitsPerLot:100,commissionUsdPerLot:5,scope:'backtest-only'});
 expect(sizeXauSimulationVolume({riskDistance:13.63,riskBudget:500})).toMatchObject({lots:.36,t1Lots:.18,remainingLots:.18,units:36,actualRisk:490.68,commissionUsd:1.8});
 expect(sizeXauSimulationVolume({riskDistance:8.49,riskBudget:500})).toMatchObject({lots:.58,t1Lots:.29,remainingLots:.29,units:58,actualRisk:492.42,commissionUsd:2.9});
});
it('preserves both original exposures and gross results in the correction cohort',()=>{
 for(const row of reference.variants){
  const result=sizeXauSimulationVolume({riskDistance:row.riskDistance,riskBudget:reference.priceRiskBudgetUsd});
  expect(result).toMatchObject({lots:row.standardLots,t1Lots:row.t1Lots,units:row.legacyOunces,actualRisk:row.actualRisk,commissionUsd:row.commissionUsd});
  expect(Math.round((row.grossPnlUsd-result.commissionUsd)*100)/100).toBe(row.netPnlUsd);
 }
});
it('keeps the screenshot risk input distinct from the actual 500 USD run',()=>{
 expect(sizeXauSimulationVolume({riskDistance:14.685,riskBudget:400})).toMatchObject({lots:.27,units:27,actualRisk:396.495});
 expect(sizeXauSimulationVolume({riskDistance:14.685,riskBudget:500})).toMatchObject({lots:.34,units:34,actualRisk:499.29});
});
it('does not enable Gold execution sizing or accept unknown risk inputs',()=>{
 expect(sizeSimulation({instrument:'XAUUSD',price:4361.17,stops:{wide:{price:4374.8}}},'wide')).toMatchObject({status:'notExecutable',reason:'unsupportedInstrument'});
 for(const riskDistance of [0,-1,NaN,Infinity])expect(sizeXauSimulationVolume({riskDistance,riskBudget:500})).toMatchObject({status:'notExecutable'});
});
it('preserves abstract exact half exits and separate fees instead of inventing a broker step',()=>{
 expect(sizeXauSimulationVolume({riskDistance:13.5,riskBudget:500})).toMatchObject({lots:.37,t1Lots:.185,remainingLots:.185,actualRisk:499.5,commissionUsd:1.85});
 expect(sizeXauSimulationVolume({riskDistance:400,riskBudget:500})).toMatchObject({lots:.01,t1Lots:.005,actualRisk:400,commissionUsd:.05});
 expect(sizeXauSimulationVolume({riskDistance:501,riskBudget:500})).toMatchObject({status:'notExecutable',reason:'belowOneOunce'});
 expect(sizeXauSimulationVolume({riskDistance:13.63,riskBudget:500,positionSizeFactor:.5})).toMatchObject({fullLots:.36,lots:.18,actualRisk:245.34});
});
