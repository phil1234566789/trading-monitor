import { collectNestedChain } from './marketStructureAnalysis';
import { structureRangePath } from './structureRangePath.js';

// Belege übernehmen nur erkannte Fakten; offene Zuordnungen sind keine Zeichnungsfreigabe.
export function tradeSetup2Evidence({ checklist, m1Check, m1Structure, m1Candles = [] }) {
  m1Check ??= {};
  const at = m1Check.entry?.recognizedAt ?? checklist.evaluatedAt, primary = checklist.setup.primary, result = [];
  function add(role, checkKey, timeframe, knownAt, drawing) {
    if (!Number.isFinite(knownAt) || knownAt > at) return;
    const id = [timeframe, role, drawing.fromTime, drawing.toTime, drawing.price ?? drawing.fromPrice ?? drawing.top].join(':');
    if (result.some(e => e.id === id)) return;
    result.push({ id, sourceRef: `${primary.id}:${id}`, role, checkKey, timeframe, knownAt, ...drawing });
  }
  function line(role, key, tf, knownAt, price, fromTime, toTime, styleKey, label) {
    if (![price, fromTime, toTime].every(Number.isFinite)) return;
    add(role, key, tf, knownAt, { kind: 'line', price, fromTime, toTime, styleKey, label });
  }
  function structure(state, tf, key) {
    if (!state) return;
    for (const [depth, level] of collectNestedChain(state).entries()) {
      const paths=[...(level.trend!=='unknown'?[{...level.currRange,trend:level.trend,active:true}]:[]),
        ...(!depth?level.closedRanges ?? []:[])];
      for(const range of paths) {
       const points=structureRangePath(range);
       const styleBase=range.active ? (depth?'rangeChoch':range.trend==='downtrend'?'rangeLiveDowntrend':'rangeLiveUptrend')
         :range.trend==='downtrend'?'rangeClosedDowntrend':'rangeClosed';
       const styleKey=tf==='1h'?styleBase:`m5${styleBase[0].toUpperCase()}${styleBase.slice(1)}`;
       for (let i = 1; i < points.length; i++) {
        const a = points[i-1], b = points[i];
        if (![a.pivotTime, b.pivotTime, a.price, b.price].every(Number.isFinite)) continue;
        add('structure', key, tf, at, { kind:'segment', fromTime:a.pivotTime, toTime:b.pivotTime,
          fromPrice:a.price, toPrice:b.price, styleKey,
          label:depth ? `Nested ${tf}` : tf });
      }
      }
    }
  }
  structure(checklist.structure, '1h', 'h1Trend');
  structure(checklist.checks.m5Trend?.structureState, '5m', 'm5Trend');
  structure(m1Structure?.state, '1m', 'm1');
  const sweep = primary.sweep?.level;
  if (sweep) line('sweep','liquiditySweep','1h',sweep.recognizedAt ?? primary.knownAsOf,sweep.price,
    sweep.pivotTime,sweep.fineTouchedTime ?? sweep.touchedTime,'liquiditySweep','H1 Sweep');
  const ob = primary.reactionOB;
  if (ob) add('reactionOB','reaction','5m',primary.reactionRecognizedAt,{kind:'zone',fromTime:ob.startTime,
    toTime:m1Check.retest?.candleTime ?? at-60,top:ob.top,bottom:ob.bottom,styleKey:ob.dir===1?'obBull':'obBear',label:'C · M5 OB'});
  for (const name of ['target1','target2']) {
    const target=primary.targetSelection?.[name];
    if (target) line(name,'targets',target.timeframe,primary.targetSelection.selectedAt,target.price,
      target.pivotTime,at-60,target.dir===-1?'liquidityLow':'liquidityHigh',`${name==='target1'?'T1':'T2'} · ${target.sessionLabel ?? target.sessionName ?? ''}`);
  }
  for (const key of ['antiConfluences','confluences']) {
    const candidates=checklist.checks[key]?.divergences?.candidates ?? [];
    // E zeigt die jüngste H1-Gegendivergenz, G nur die tatsächlich am Sweep zugeordnete.
    for (const d of key==='antiConfluences'?candidates.slice(-1):candidates.filter(d=>d.association==='sweep-touch')) {
      add('divergence',key,d.timeframe,d.recognizedAt,{kind:'segment',fromTime:d.fromTime,toTime:d.toTime,
        fromPrice:d.fromPrice,toPrice:d.toPrice,fromRsi:d.fromRsi,toRsi:d.toRsi,
        styleKey:key==='antiConfluences'?'antiConfluence':'confluence',label:`${d.timeframe} RSI-Divergenz`});
    }
  }
  const signals=[...(checklist.checks.m5Trend?.structureReaction?.levels ?? []).map(s=>({...s,timeframe:'5m',key:'m5Trend'})),
    ...[m1Check.choch,m1Check.bos].filter(Boolean).map(s=>({...s,timeframe:'1m',key:'m1'}))];
  for (const s of signals) line(s.type,s.key,s.timeframe,s.recognizedAt,s.price,s.pivotTime,s.candleTime,
    s.type==='CHoCH'?'m5RangeChoch':'m5RangeBreakOfStructure',`${s.timeframe} ${s.type}`);
  for (const s of m1Check.internalSweeps ?? []) line('internalSweep','m1','1m',s.candleTime+60,s.price,
    s.pivotTime,s.candleTime,'m5RangeLqSweep','M1 LS');
  const retest=m1Check.retest, touch=m1Candles.find(c=>c.time===retest?.candleTime);
  if (touch) line('retest','m1','1m',retest.recognizedAt,primary.direction==='short'?touch.high:touch.low,
    touch.time,touch.time+60,'confirmation','Retest');
  const fvg=m1Check.fvg, confirmation=m1Candles.find(c=>c.time+60===fvg?.recognizedAt);
  if (confirmation) {
    const short=primary.direction==='short';
    const bottom=short?confirmation.high:confirmation.low-fvg.gap;
    add('fvg','m1','1m',fvg.recognizedAt,{kind:'zone',fromTime:fvg.candleTime,toTime:confirmation.time,
      top:bottom+fvg.gap,bottom,styleKey:'rScale',label:'M1 FVG'});
  }
  return result;
}
