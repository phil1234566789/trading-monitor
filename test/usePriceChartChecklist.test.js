import { describe, expect, it, vi } from 'vitest';
import { effectScope, reactive, nextTick } from 'vue';
import { usePriceChartChecklist } from '../src/composables/usePriceChartChecklist.js';
import candles from './fixtures/gbpusd-h1-2026-07-23-live-metadata-snapshot.json';
import * as timeBasis from '../src/tradeSetupChecklistTimeBasis.js';

it('shares the replay prefix across renderers and invalidates on replay, instrument, timeframe and candle changes',()=>{
  const scope=effectScope(),spy=vi.spyOn(timeBasis,'closedReplayEvaluationTime');
  const props=reactive({symbol:'GBPUSD',currentBar:'5m',replayUntil:300,tradeSetup2RunId:'r',selectedTradeSetup2Id:'s'});
  try {
    const api=scope.run(()=>usePriceChartChecklist(props,[],vi.fn(),()=>1200));
    api.setChartCandles([{time:0},{time:300},{time:600}],'GBPUSD:5m');
    spy.mockClear();
    for(let i=0;i<100;i++)expect(api.evaluationTime()).toBe(600);
    expect(spy).toHaveBeenCalledTimes(0);
    props.replayUntil=600;expect(api.evaluationTime()).toBe(900);
    props.currentBar='1m';expect(api.evaluationTime()).toBeNull();
    api.setChartCandles([{time:600}],'GBPUSD:1m');expect(api.evaluationTime()).toBe(660);
    props.symbol='EURUSD';expect(api.evaluationTime()).toBeNull();
  }finally{scope.stop();spy.mockRestore();}
});

it('uses the saved checklist without evaluating or saving a new checklist in a snapshot link', () => {
  const scope=effectScope(),emit=vi.fn(),statistics={save:vi.fn()};
  const props=reactive({symbol:'GBPUSD',currentBar:'5m',replayUntil:300,showTradeSetupChecklist:true,
    showM1Structure:true,showTradeSetup2:true,tradeSetup2RunId:'run',selectedTradeSetup2Id:'entry'});
  try {
    const api=scope.run(()=>usePriceChartChecklist(props,[],emit,()=>600,{},statistics));
    api.setChartCandles([{time:300}],'GBPUSD:5m');api.refresh();
    expect(api.evaluationTime()).toBe(600);
    expect(api.state.value).toBeNull();
    expect(api.m1PrerequisitesAt(600)).toBeNull();
    expect(emit).not.toHaveBeenCalled();expect(statistics.save).not.toHaveBeenCalled();
  } finally {scope.stop();}
});

function setup() {
  const evaluatedAt = candles.at(-1).time + 3600;
  const props = reactive({ symbol: 'GBPUSD', currentBar: '5m', replayUntil: null, showTradeSetupChecklist: true,
    rangesPeriod: 5, ranges2Period: 2, rangesFixedStartActive: true, rangesFixedStartTime: 1783918800 });
  const sessions = reactive([]);
  const events = [];
  const scope = effectScope();
  const api = scope.run(() => usePriceChartChecklist(props, sessions, (name, state) => events.push({ name, state }), () => evaluatedAt));
  const finish = (tf, rows) => api.finish(api.begin(tf), { ok: true, applied: true }, rows);
  const fill = () => {
    finish('h1', candles);
    finish('m5', [{ time: evaluatedAt - 300, open: 1, high: 2, low: 0, close: 1 }]);
  };
  return { props, sessions, events, scope, api, finish, fill };
}

describe('Chart-Checklist: asynchrone Integration', () => {
  it('publiziert Busy vor der Browser-Berechnung und verwirft überholte Frames', () => {
    const ctx = setup();
    ctx.fill();
    vi.useFakeTimers();
    const frames = [];
    vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    try {
      ctx.api.refresh();
      expect(ctx.api.state.value.updating).toBe(true);
      expect(ctx.api.m1PrerequisitesAt(123).updating).toBe(true);
      frames.at(-1)();
      expect(ctx.api.state.value.updating).toBe(true);
      vi.advanceTimersByTime(0);
      expect(ctx.api.state.value.status).toBe('ready');
      expect(ctx.api.state.value.updating).toBe(false);
      ctx.api.refresh();
      const obsolete = frames.at(-1);
      ctx.props.symbol = 'EURUSD';
      obsolete(); vi.advanceTimersByTime(0);
      expect(ctx.api.state.value.instrument).toBe('EURUSD');
      expect(ctx.api.state.value.updating).toBe(true);
    } finally { ctx.scope.stop(); vi.unstubAllGlobals(); vi.useRealTimers(); }
  });
  it('aktualisiert leere Kalender nach tatsächlichem Ladeerfolg und Ladefehler', async () => {
    const props = reactive({symbol:'GBPUSD',replayUntil:null,showTradeSetupChecklist:true});
    const timeData = reactive({newsEvents:[],newsCalendar:{status:'loading'}});
    const events = [];
    const scope = effectScope();
    try {
      scope.run(() => usePriceChartChecklist(props, reactive([]), (_,state) => events.push(state), undefined,timeData));
      expect(events.at(-1).checks.time).toBeUndefined();
      timeData.newsCalendar.status = 'ready';
      await nextTick();
      expect(events.at(-1).checks.time).toBeUndefined();
      timeData.newsCalendar.status = 'error';
      await nextTick();
      expect(events.at(-1).checks.time).toBeUndefined();
    } finally { scope.stop(); }
  });
  it('hält News-Grenzen aus A–G heraus und beendet Timer im Replay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T07:29:59Z'));
    const props = reactive({ symbol: 'GBPUSD', replayUntil: null, showTradeSetupChecklist: true });
    const timeData = reactive({ tradingSchedules: { GBPUSD: { tradingWindows: { weekday: [[0, 1440]] } } },
      newsEvents: [{ currency: 'USD', eventTime: Date.parse('2026-09-09T08:00:00Z') / 1000, title: 'Testtermin' }] });
    const events = [];
    const scope = effectScope();
    try {
      scope.run(() => usePriceChartChecklist(props, reactive([]), (name, state) => events.push(state), undefined, timeData));
      expect(events.at(-1).checks.time).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1000);
      expect(events.at(-1).checks.time).toBeUndefined();
      props.replayUntil = 123;
      const count = events.length;
      await vi.advanceTimersByTimeAsync(120000);
      expect(events).toHaveLength(count);
      expect(events.at(-1).checks.time).toBeUndefined();
    } finally { scope.stop(); vi.useRealTimers(); }
  });
  it('publiziert A unabhängig von Zeichen- und Chart-Timeframe-Toggles', async () => {
    const ctx = setup();
    ctx.fill();
    const before = ctx.events.at(-1);
    expect(before.name).toBe('checklist-state-change');
    expect(before.state.checks.liquiditySweep.status).toBe('pending');
    expect(before.state.checks.h1Trend).toBeUndefined();
    expect(before.state.status).toBe('ready');
    ctx.props.currentBar = '1m';
    ctx.props.showRanges = false;
    ctx.props.showLiquidity = false;
    await nextTick();
    ctx.api.refresh();
    expect(ctx.events.at(-1)).toEqual(before);
    ctx.scope.stop();
  });
  it('entfernt alte Ergebnisse sofort beim Symbolwechsel und ignoriert verspätete Antworten', () => {
    const ctx = setup();
    ctx.fill();
    const old = ctx.api.begin('h1');
    ctx.props.symbol = 'EURUSD';
    expect(ctx.events.at(-1).state.status).toBe('loading');
    expect(ctx.events.at(-1).state.checks.m5Trend.status).toBe('unknown');
    ctx.api.finish(old, { ok: true, applied: true }, candles);
    expect(ctx.events.at(-1).state.instrument).toBe('EURUSD');
    expect(ctx.events.at(-1).state.status).toBe('loading');
    ctx.scope.stop();
  });
  it('entfernt Live-Signale beim Replaywechsel und wertet nach dem Laden den sichtbaren M5-Schluss aus', () => {
    const ctx = setup();
    ctx.fill();
    ctx.props.replayUntil = candles.at(-1).time;
    expect(ctx.events.at(-1).state.evaluatedAt).toBeNull();
    expect(ctx.events.at(-1).state.checks.m5Trend.status).toBe('unknown');
    ctx.finish('h1', candles);
    ctx.finish('m5', [{ time: candles.at(-1).time, open: 1, high: 2, low: 0, close: 1 }]);
    ctx.api.setChartCandles([{ time: candles.at(-1).time, open: 1, high: 2, low: 0, close: 1 }], 'GBPUSD:5m');
    expect(ctx.events.at(-1).state.evaluatedAt).toBe(candles.at(-1).time + 300);
    expect(ctx.events.at(-1).state.status).toBe('ready');
    expect(ctx.events.at(-1).state.context.h1Candles.at(-1).time).toBeLessThan(candles.at(-1).time);
    ctx.scope.stop();
  });
  it('wertet Perioden-/Sessionänderungen neu aus und sendet nach Dispose nichts mehr', async () => {
    const ctx = setup();
    ctx.fill();
    ctx.sessions.push({ instrument: 'GBPUSD', ignoreLiquidity: true, fromMinutes: 0, toMinutes: 1440 });
    await nextTick();
    expect(ctx.events.at(-1).state.checks.m5Trend.status).toBe('unknown');
    ctx.sessions.length = 0;
    ctx.props.rangesPeriod = 9999;
    await nextTick();
    expect(ctx.events.at(-1).state.checks.m5Trend.status).toBe('unknown');
    const ticket = ctx.api.begin('h1');
    ctx.scope.stop();
    const count = ctx.events.length;
    ctx.api.finish(ticket, { ok: true, applied: true }, candles);
    expect(ctx.events).toHaveLength(count);
  });
});
