import {createChartStructureWorker} from './chartStructureWorkerClient.js';
export function createTradeSetup11Worker(options={}) {
  return createChartStructureWorker({createWorker:()=>new Worker(new URL('./tradeSetup11ChartWorker.js',import.meta.url),{type:'module'}),...options});
}
