import {expect,it} from 'vitest';
import {simulationVolumeLabel,simulationContractWarning} from '../src/simulationVolumePresentation.js';
import {entryLotsLabel} from '../src/entryPresentation.js';
import {XAU_SIMULATION_EXECUTION_CONTRACT} from '../src/xauSimulationExecutionContract.js';
const old={instrument:'XAUUSD',lots:36,t1Lots:18,executionContract:{version:'simulation-contract-v1',instrument:'XAUUSD',unitsPerLot:1,commissionUsdPerLot:5}};
it('labels proven old ounce quantities without mutating historical numbers or fees',()=>{
 expect(simulationVolumeLabel(old)).toBe('36 oz (0,36 Standardlots)');
 expect(simulationVolumeLabel(old,'t1Lots')).toBe('18 oz (0,18 Standardlots)');
 expect(entryLotsLabel(old)).toContain('36 oz (0,36 Standardlots)');
 expect(simulationContractWarning(old)).toContain('5 USD je Unze');
 expect(old.lots).toBe(36);
});
it('preserves fractional abstract partials and leaves Forex/unknown provenance alone',()=>{
 const modern={lots:.37,t1Lots:.185,executionContract:XAU_SIMULATION_EXECUTION_CONTRACT};
 expect(simulationVolumeLabel(modern,'t1Lots')).toBe('0,185 Lots');
 expect(simulationContractWarning(modern)).toContain('abstrakte Hälfte');
 expect(simulationVolumeLabel({instrument:'XAUUSD',lots:36})).toBe('36 Lots');
 expect(simulationVolumeLabel({instrument:'GBPUSD',lots:8})).toBe('8 Lots');
});
