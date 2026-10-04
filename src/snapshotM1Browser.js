import {runSnapshotWorker} from './snapshotWorkerBrowser.js';
export const calculateSnapshotM1InWorker=(input,options)=>runSnapshotWorker({...input,operation:'m1'},options);
