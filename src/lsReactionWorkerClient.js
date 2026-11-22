import {createChartStructureWorker} from './chartStructureWorkerClient.js';
export function createLsReactionWorker(options={}) {
  return createChartStructureWorker({createWorker:()=>new Worker(new URL('./lsReactionChartWorker.js',import.meta.url),{type:'module'}),...options});
}
