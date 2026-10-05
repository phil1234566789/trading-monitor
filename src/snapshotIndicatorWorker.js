import { calculateSnapshotIndicators } from './snapshotIndicatorCalculation.js';
import { calculateSnapshotM1 } from './snapshotM1Calculation.js';

self.onmessage = ({ data }) => {
  try { self.postMessage({ result: data.operation==='m1'?calculateSnapshotM1(data):calculateSnapshotIndicators(data, progress => self.postMessage({ progress })) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
