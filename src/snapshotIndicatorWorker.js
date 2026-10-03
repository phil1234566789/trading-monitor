import { calculateSnapshotIndicators } from './snapshotIndicatorCalculation.js';

self.onmessage = ({ data }) => {
  try { self.postMessage({ result: calculateSnapshotIndicators(data) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
