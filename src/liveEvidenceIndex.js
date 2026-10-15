import {savedDealingRangeStatus} from './tradeSetup2DealingRange.js';

export const liveEvidenceOriginalOrder=(a,b)=>Number(a.evaluation_mode==='catchup')-Number(b.evaluation_mode==='catchup')||Date.parse(a.captured_at)-Date.parse(b.captured_at)||a.id.localeCompare(b.id);

// Die Liste braucht DR-Eckpunkte und Entries; jeder übrige Originalstand bleibt über seine ID abrufbar.
export function selectLiveEvidenceIndex(rows){
 const ordered=rows.toSorted(liveEvidenceOriginalOrder),originals=new Map(),selected=new Set(),groups=new Map(),observations=new Map(),histories=new Map();
 const latest=(map,key,row)=>{const old=map.get(key);if(!old||Date.parse(row.evaluated_through)>Date.parse(old.evaluated_through)||Date.parse(row.evaluated_through)===Date.parse(old.evaluated_through)&&Date.parse(row.captured_at)>Date.parse(old.captured_at))map.set(key,row);};
 for(const row of ordered){
  if(!originals.has(row.snapshot_id))originals.set(row.snapshot_id,row);
  if(row.entry_id)selected.add(row.snapshot_id);
  if(row.has_observation)latest(observations,row.setup_key,row);
  if(row.has_history)latest(histories,JSON.stringify([row.setup_key,row.configuration_id,row.evaluation_mode]),row);
 }
 for(const row of originals.values()){
  if(row.entry_id)continue;
  const group=groups.get(row.setup_key) ?? {};
  if(!group.first||Date.parse(row.known_at)<Date.parse(group.first.known_at))group.first=row;
  if(!group.last||Date.parse(row.known_at)>Date.parse(group.last.known_at))group.last=row;
  if(savedDealingRangeStatus({dealingRange:{version:row.dr_version,status:row.dr_status}})==='validated'&&(!group.validated||Date.parse(row.known_at)<Date.parse(group.validated.known_at)))group.validated=row;
  groups.set(row.setup_key,group);
 }
 for(const group of groups.values())for(const row of Object.values(group))selected.add(row.snapshot_id);
 for(const row of [...observations.values(),...histories.values()])selected.add(row.snapshot_id);
 return rows.filter(row=>selected.has(row.snapshot_id));
}
