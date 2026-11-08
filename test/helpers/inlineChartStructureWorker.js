import { createChartStructureCalculator } from '../../src/chartStructureCalculation.js';

// Renderer-Tests prüfen dieselben Ergebnisse ohne Browser-Worker; der Transport hat eigene Tests.
export function createChartStructureWorker() {
  const calculate = createChartStructureCalculator();
  return { run: async input => calculate(input), dispose() {}, cancel() {} };
}
