import {expect,it,vi} from 'vitest';
import {createSSRApp,effectScope,reactive,ref,nextTick} from 'vue';
import {renderToString} from 'vue/server-renderer';
import ChecklistReplayHistory from '../src/components/ChecklistReplayHistory.vue';
import {snapshotChecklistAt,checklistHistoryChanges} from '../src/checklistReplayView.js';
import {CHECKLIST_HISTORY_VERSION} from '../src/tradeSetup2ChecklistHistory.js';
const state=knownAt=>({knownAt,source:'M5',rows:[{key:'reaction',label:'B · Reaktion',status:'passed',details:['OB']}],changes:[{key:'reaction',label:'B',new:'passed',text:'OB'}],checklist:{evaluatedAt:knownAt,checks:{reaction:{status:'passed'}},setup:{primary:{recognizedAt:100}}},dealingRange:{status:'validated'},m1Check:null});
const history={version:CHECKLIST_HISTORY_VERSION,entries:[state(100),state(300)]};
it('selects a causal checklist before the entry and never reveals a future entry',()=>{
  const snapshot={knownAt:400,entry:{recognizedAt:400},checklistHistory:history};
  expect(snapshotChecklistAt(snapshot,99)).toBeNull();
  expect(snapshotChecklistAt(snapshot,299)).toMatchObject({knownAt:100,entry:null});
  expect(snapshotChecklistAt(snapshot,300).knownAt).toBe(300);
  expect(snapshotChecklistAt(snapshot,500).entry).toEqual(snapshot.entry);
  expect(snapshotChecklistAt({knownAt:400},399)).toBeNull();
  expect(checklistHistoryChanges(history.entries[0],'A')).toHaveLength(0);
  expect(checklistHistoryChanges(history.entries[0],'B')).toHaveLength(1);
});
it('renders Stand von, the not-yet-known state, checkpoint filters and the legacy fallback',async()=>{
  const render=props=>renderToString(createSSRApp(ChecklistReplayHistory,props));
  expect(await render({history,asOf:200})).toContain('Stand von');
  expect(await render({history,asOf:99})).toContain('noch nicht erkannt');
  expect(await render({asOf:200})).toContain('kein Verlauf gespeichert');
  const html=await render({history,asOf:200});
  expect(html).toContain('Checkpoint');expect(html).toContain('aria-current="true"');expect(html).toContain('→');
});
