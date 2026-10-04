import { expect, it } from 'vitest';
import { computed,effectScope, nextTick, ref } from 'vue';
import { useTradeSetup2Route } from '../src/composables/useTradeSetup2Route.js';
import { useSnapshotVisitToggle } from '../src/composables/useSnapshotVisitToggle.js';

function harness(initial) {
  const query = ref(initial), scope = effectScope();
  const state = Object.fromEntries(Object.entries({ showTradeSetup2: false, showTradeSetupChecklist: false,
    tradeSetup2Variant: 'wide', currentSymbol: 'EURUSD', currentBar: '1h', replayTime: 123, replayActive: false,
  }).map(([key, value]) => [key, ref(value)]));
  const saved={setup:state.showTradeSetup2,checklist:state.showTradeSetupChecklist};
  scope.run(() => {
    const view=computed(()=>!!(query.value.setup2&&query.value.run));
    state.showTradeSetup2=useSnapshotVisitToggle(saved.setup,view);
    state.showTradeSetupChecklist=useSnapshotVisitToggle(saved.checklist,view);
    useTradeSetup2Route(() => query.value, state, ['GBPUSD', 'EURUSD']);
  });
  return { query, state, scope,saved };
}
const link = { setup2: 'entry', run: 'research', instrument: 'GBPUSD', replay: '1772809740', variant: 'narrow', bar: '1m' };
it('keeps visit switches editable without persisting them and restores saved settings on close',async()=>{
  const {state,saved,query,scope}=harness(link);
  state.showTradeSetup2.value=false;state.showTradeSetupChecklist.value=false;
  await nextTick();expect(saved.setup.value).toBe(false);expect(saved.checklist.value).toBe(false);
  state.showTradeSetup2.value=true;
  query.value={};await nextTick();
  expect(state.showTradeSetup2.value).toBe(false);
  state.showTradeSetup2.value=true;await nextTick();expect(saved.setup.value).toBe(true);
  scope.stop();
});

it('defaults snapshot links to M5', () => {
  const { state, scope } = harness({ ...link, bar: undefined });
  expect(state.currentBar.value).toBe('5m');
  scope.stop();
});

it('restores a direct link over stale settings on mount and reload', () => {
  for (let i = 0; i < 2; i++) {
    const { state, scope } = harness(link);
    expect(Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.value]))).toEqual({
      showTradeSetup2: true, showTradeSetupChecklist: true, tradeSetup2Variant: 'narrow', currentSymbol: 'GBPUSD',
      currentBar: '1m', replayTime: 1772809740, replayActive: true,
    });
    scope.stop();
  }
});
it('accepts a second entry in the same mounted dashboard without overriding later replay steps', async () => {
  const { state, query, scope } = harness(link);
  query.value = { ...link, setup2: 'next', replay: '1775028300', variant: 'wide' };
  await nextTick();
  expect(state.replayTime.value).toBe(1775028300);
  expect(state.tradeSetup2Variant.value).toBe('wide');
  state.replayTime.value += 60;
  await nextTick();
  expect(state.replayTime.value).toBe(1775028360);
  scope.stop();
});
it.each([{}, { setup2: 'entry' }])('leaves ordinary dashboard navigation unchanged', query => {
  const { state, scope } = harness(query);
  expect(state.showTradeSetup2.value).toBe(false);
  expect(state.replayActive.value).toBe(false);
  expect(state.currentBar.value).toBe('1h');
  scope.stop();
});
it.each(['', 'NaN', '-1', '1.5', ['1772809740']])('rejects invalid replay values', replay => {
  const { state, scope } = harness({ ...link, replay });
  expect(state.replayTime.value).toBe(123);
  expect(state.replayActive.value).toBe(false);
  scope.stop();
});
