import {describe,expect,it} from 'vitest';
import {dobAnchorTime,dobEntrySuggestions,dobEvaluationTime} from '../src/dobEntrySuggestion.js';

// 12.11.2026 14:11 Berlin (CET) = 13:11 UTC
const T=Date.UTC(2026,10,12,13,11)/1000,STATS={orderBlocks:9,reactions:{second:{true:2,false:3,unknown:0}},pairsWithoutEntry:1,firstHoldRejected:0,firstHoldUnknown:0,priceGapRejected:0,differentRetestDays:0};
const ob=startTime=>({startTime,top:1,bottom:0});
const ready=(variant,entryTime,entryPrice,stopPrice)=>({variant,status:'ready',entryTime,entryPrice,stopPrice});
const pair=(id,first,second,entries,direction='short')=>({id,direction,recognizedAt:T-600,firstOrderBlock:ob(first),secondOrderBlock:ob(second),entries});
const evidence=[{kind:'ob',timeframe:'5M',level:'range',sourceTime:T-7200},{kind:'ob',timeframe:'1H',level:'range',sourceTime:T-3600}];
const run=(pairs,extra={})=>dobEntrySuggestions({status:'ready',pairs,stats:STATS},{direction:'short',anchorTime:T,evidence,instrument:'XAUUSD',...extra});

describe('dobEntrySuggestions',()=>{
  it('wählt das Paar mit M5-OB-Evidence vor und belegt Entry, Zeit und SL', ()=>{
    const out=run([pair('x',T-9000,T-5000,{a:ready('a',T-120,3929,3940)}),
      pair('y',T-7200,T-5000,{a:ready('a',T,3930,3941.5),b:{variant:'b',status:'skipped',reason:'entryAlreadyFound'}})]);
    expect(out.preselectedKey).toBe('y:a');
    expect(out.choices[0]).toMatchObject({entryPrice:3930,entryTime:T,stopLoss:3941.5,rangeMatches:1,positionMatches:0});
    expect(out.choices).toHaveLength(2);
  });
  it('Positions-Evidence (Re-Entry) hat Vorrang vor Range-Evidence', ()=>{
    const ev=[{kind:'ob',timeframe:'5M',level:'range',sourceTime:T-9000},{kind:'ob',timeframe:'5M',level:'range',sourceTime:T-8000},
      {kind:'ob',timeframe:'5M',level:'position',sourceTime:T-3000},{kind:'ob',timeframe:'5M',level:'position',sourceTime:T-2000}];
    const pairs=[pair('first',T-9000,T-8000,{a:ready('a',T-4000,3934.94,3926.76)}),pair('reentry',T-3000,T-2000,{a:ready('a',T,3953.11,3937.72)})];
    const out=run(pairs,{evidence:ev});
    expect(out.preselectedKey).toBe('reentry:a');
    expect(out.choices[0]).toMatchObject({entryPrice:3953.11,stopLoss:3937.72});
    expect(run(pairs,{evidence:ev.filter(item=>item.level==='range')}).preselectedKey).toBe('first:a');
  });
  it('lässt bei gleich guter Übereinstimmung (beide Routen) wählen', ()=>{
    const out=run([pair('y',T-7200,T-5000,{a:ready('a',T,3930,3941),b:ready('b',T+300,3931,3941)})]);
    expect(out.preselectedKey).toBeNull();
    expect(out.reason).toContain('Bitte wählen');
  });
  it('filtert Richtung und Berliner Tag und nennt den Grund, statt still vorzubelegen', ()=>{
    const out=run([pair('long',T-7200,T-5000,{a:ready('a',T,1,0)},'long'),{...pair('old',T-7200,T-5000,{a:ready('a',T,1,0)}),recognizedAt:T-86400}]);
    expect(out.choices).toEqual([]);
    expect(out.reason).toContain('Kein DOB-Paar Short am 2026-11-12');
    expect(out.reason).toContain('true 2 / false 3');
  });
  it('nennt die Routengründe eines Paars ohne fertigen Entry', ()=>{
    const out=run([pair('y',T-7200,T-5000,{a:{variant:'a',status:'invalid',reason:'outsideEntryWindow'},b:{variant:'b',status:'pending',reason:'entryBPending'}})]);
    expect(out.reason).toMatch(/Route a: invalid \(outsideEntryWindow\).*Route b: pending/);
  });
  it('meldet unvollständige Daten', ()=>{
    expect(dobEntrySuggestions({status:'unknown',pairs:[]},{direction:'short',anchorTime:T}).reason).toContain('unvollständig');
  });
});

describe('dobAnchorTime/dobEvaluationTime',()=>{
  it('nimmt die Entry-Zeit, sonst die jüngste M5-OB-Evidence', ()=>{
    expect(dobAnchorTime({entryTime:T,confirmations:evidence})).toBe(T);
    expect(dobAnchorTime({entryTime:null,confirmations:[...evidence,{kind:'ob',timeframe:'5M',sourceTime:T-60}]})).toBe(T-60);
    expect(dobAnchorTime({entryTime:null,confirmations:[]})).toBeNull();
  });
  it('wertet bis Ende des Berliner Tags aus, höchstens bis jetzt', ()=>{
    expect(dobEvaluationTime(T,T+86400*5)).toBe(Date.UTC(2026,10,12,23)/1000);
    expect(dobEvaluationTime(T,T+60)).toBe(T+60);
  });
});
