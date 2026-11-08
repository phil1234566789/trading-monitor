export const SOURCE_FAMILY_VERSION='causal-natural-source-family-v1';
export function naturalSourceFamilyKey(source){
 const ls=source?.ls;
 if(typeof source?.instrument!=='string'||!source.instrument||![1,-1].includes(source.dir)||![1,-1].includes(ls?.dir)
  ||![ls?.price,ls?.pivotTime,ls?.touchedTime,source.obStartTime,source.obTop,source.obBottom].every(Number.isFinite)
  ||source.obTop<=source.obBottom||ls.price<=0||ls.pivotTime>=ls.touchedTime)return null;
 return JSON.stringify([source.instrument,source.dir,ls.dir,ls.price,ls.pivotTime,ls.touchedTime,source.obStartTime,source.obTop,source.obBottom]);
}
