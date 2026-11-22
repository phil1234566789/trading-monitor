import {setup1RecognitionTime} from './setup1RecognitionTime.js';

export function lsReactionSourceTimes(setup) {
 const ob=setup?.obStartTime;
 const nativeGeometryKnownAt=Number.isSafeInteger(ob)&&ob>0&&ob%300===0?ob+600:null;
 const storedFirstSeenAt=Number.isFinite(setup?.createdAt)?setup.createdAt:null;
 const unknown=reason=>({status:'unknown',reason,nativeGeometryKnownAt,storedFirstSeenAt,sourceKnownAt:null});
 if(nativeGeometryKnownAt===null)return unknown('invalidSetupTime');
 if(setup.fromDb&&storedFirstSeenAt===null)return unknown('storedFirstSeenUnknown');
 try {
  const sourceKnownAt=storedFirstSeenAt===null?nativeGeometryKnownAt:setup1RecognitionTime(setup);
  return {status:'ready',reason:null,nativeGeometryKnownAt,storedFirstSeenAt,sourceKnownAt};
 } catch {return unknown('invalidStoredFirstSeen');}
}
