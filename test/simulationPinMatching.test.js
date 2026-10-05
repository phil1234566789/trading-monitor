import { describe,it,expect } from 'vitest';
import { matchSimulationPins,simulationDrIdentity } from '../src/simulationPinMatching.js';
import { simulationGroupHasPin } from '../src/simulationRunComparison.js';
const snapshot=(runId='new',setupKey='new-id')=>({id:`${runId}-snapshot`,runId,setupKey,instrument:'GBPUSD',direction:'long',knownAt:300,
  checklist:{setup:{primary:{sweep:{timeframe:'5M',level:{price:1.2,pivotTime:100,touchedTime:200,fineTouchedTime:220}},
    reactionOB:{startTime:240,top:1.3,bottom:1.25}}}}});
const entry={recognizedAt:300,price:1.3,stops:{wide:{price:1.2},narrow:{price:1.25}}};
const feature={key:'reaction',group:'checkpoint',label:'B',value:'met',details:['OB']};
const group=()=>({key:'new:dr',snapshot:snapshot(),entries:[{...snapshot(),id:'new-entry',entry}],features:[feature],outcome:{replayTime:500}});
const pin=(kind='simulation_dr')=>({id:1,kind,simulationRunId:'old',simulationSnapshotId:'old-snapshot',simulationEntrySnapshotId:'old-entry',simulationCheckpointKey:'reaction',
  note:'Meine Notiz',simulationContext:{setupKey:'old-id',entry:{...entry,time:{unix:300}},checkpoint:{...feature,details:[feature]},chartLink:{path:'/',query:{run:'old'}}}});
const match=(p,groups=[group()])=>matchSimulationPins([p],groups,'new',new Map([[p.id,snapshot('old','old-id')]]),
  [{id:'old',from:100,to:500,status:'complete',configuration:{label:'Alter Lauf'}}]);
describe('cross-run simulation pins',()=>{
  it('matches market evidence despite changed IDs, preserving the original pin and note',()=>{
    const p=pin(),before=JSON.stringify(p),result=match(p);
    expect(result.matched).toHaveLength(1);expect(result.unmatched).toHaveLength(0);
    expect(result.matched[0]).toMatchObject({id:1,note:'Meine Notiz',simulationRunId:'old',associatedRunId:'new'});
    expect(result.matched[0].originLabel).toContain('Alter Lauf');
    expect(result.matched[0].currentChartLink.query.run).toBe('new');
    expect(result.matched[0].simulationContext.chartLink.query.run).toBe('old');
    expect(simulationGroupHasPin(group(),result.matched)).toBe(true);
    expect(JSON.stringify(p)).toBe(before);expect(match(p)).toEqual(result);
  });
  it('refuses missing, ambiguous and incomplete DR evidence',()=>{
    expect(match(pin(),[]).unmatched[0].unmatchedReason).toContain('Keine DR');
    expect(match(pin(),[group(),{...group(),key:'other'}]).unmatched[0].unmatchedReason).toContain('Mehrere DRs');
    expect(matchSimulationPins([pin()],[group()],'new').unmatched[0].unmatchedReason).toContain('Merkmale');
    const changed=group();changed.snapshot.checklist.setup.primary.reactionOB.bottom=1.24;
    expect(match(pin(),[changed]).unmatched).toHaveLength(1);
    expect(simulationDrIdentity({})).toBeNull();
  });
  it('requires a unique unchanged entry including both stop variants',()=>{
    expect(match(pin('simulation_entry')).matched).toHaveLength(1);
    const changed=group();changed.entries[0].entry={...entry,price:1.31};
    expect(match(pin('simulation_entry'),[changed]).unmatched[0].unmatchedReason).toContain('Entry fehlt');
    changed.entries[0].entry={...entry,stops:{wide:{price:1.2},narrow:{price:1.26}}};
    expect(match(pin('simulation_entry'),[changed]).unmatched).toHaveLength(1);
    changed.entries=[{...snapshot(),entry},{...snapshot(),id:'duplicate',entry}];
    expect(match(pin('simulation_entry'),[changed]).unmatched[0].unmatchedReason).toContain('Mehrere Entries');
  });
  it('requires the saved checkpoint evidence, without transferring a changed finding',()=>{
    expect(match(pin('simulation_checkpoint')).matched).toHaveLength(1);
    const reordered=pin('simulation_checkpoint');reordered.simulationContext.checkpoint.details=[{details:['OB'],value:'met',label:'B',group:'checkpoint',key:'reaction'}];
    expect(match(reordered).matched).toHaveLength(1);
    const changed=group();changed.features=[{...feature,value:'unmet'}];
    expect(match(pin('simulation_checkpoint'),[changed]).unmatched[0].unmatchedReason).toContain('Befund');
  });
  it('keeps original-run pins usable without complete cross-run evidence',()=>{
    const p={...pin(),simulationRunId:'new',simulationContext:{setupKey:'new-id'}};
    expect(matchSimulationPins([p],[group()],'new').matched).toHaveLength(1);
    expect(matchSimulationPins([{id:1,simulationRunId:'new'}],[group()],'new').unmatched).toHaveLength(1);
  });
});
