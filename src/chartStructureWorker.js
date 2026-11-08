import { createChartStructureCalculator } from './chartStructureCalculation.js';

const calculate = createChartStructureCalculator();
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: calculate(data) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
