import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {berlinOffsetMinutes} from '../src/berlinTime.js';
import {readFileSync} from 'node:fs';
import {sessions} from '../src/sessions.js';
import {doubleOrderBlockInput} from '../src/doubleOrderBlockInput.js';
import {loadCaseFixture,evaluateCase} from '../src/chartDebuggerCases.js';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';

// Spread Hour wie in Philips XAUUSD-Sessions: 23:00–00:00 Berlin, Mo–Fr, Kerzen ignorieren.
const SPREAD_HOUR={id:'spread',instrument:'XAUUSD',fromMinutes:1380,toMinutes:0,days:[1,2,3,4,5],ignoreLiquidity:true};
// Short-OB 09.11. 22:35 Berlin: ihre Reaktions-FVG entsteht in der Spread Hour (23:01).
const c={id:'ignored',day:'2026-11-09',dir:-1,orderBlocks:[1794260100]};
// markIgnored rechnet bewusst in Browser-Lokalzeit (wie das Session-Band); der Test stellt Philips Berliner Browser nach, sonst kippt er auf UTC-CI.
beforeEach(()=>{vi.spyOn(Date.prototype,'getTimezoneOffset').mockImplementation(function(){return -berlinOffsetMinutes(this.getTime());});});
afterEach(()=>{sessions.splice(0);vi.restoreAllMocks();});

it('Debugger und Dashboard-Worker bekommen dieselben ignorierten Kerzen',async()=>{
 sessions.splice(0,0,SPREAD_HOUR);
 const fixture=await loadCaseFixture(c),at=fixture.candles.m1.at(-1).time+60;
 const dashboard=doubleOrderBlockInput({m5:fixture.candles.m5,m1:fixture.candles.m1,symbol:'XAUUSD',evaluatedAt:at});
 const debug=evaluateCase(c,fixture,at);
 expect(debug.m1).toEqual(dashboard.m1Candles);
 expect(debug.m5).toEqual(dashboard.m5Candles);
 // 23:00 und 23:02; 23:01 fehlt in der Fixture (coverage.m1.gaps).
 expect(dashboard.m1Candles.filter(x=>x.ignored).map(x=>x.time)).toEqual([1794261600,1794261720]);
});

it('ignorierte Spread-Hour-Kerzen ändern das Debugger-Ergebnis wie im Dashboard',async()=>{
 const fixture=await loadCaseFixture(c),at=fixture.candles.m1.at(-1).time+60,reaction=()=>evaluateCase(c,fixture,at).orderBlocks[0].reaction;
 // Ohne Spread-Hour-Markierung gibt es die Reaktion, aber Q7: Entry a nach 22:00 ist verboten, der Marktschluss beendet Entry b.
 expect(reaction()).toMatchObject({structuralState:'true',verdict:{state:'false',reason:'marketClosed'},
  routes:{a:{status:'rejected',reason:'outsideEntryWindow'},b:{status:'rejected',reason:'marketClosed'}}});
 sessions.splice(0,0,SPREAD_HOUR);
 expect(reaction().verdict).toMatchObject({state:'false',reason:'marketClosed'});
});

it('der Vorfilter auf geschlossene Kerzen ändert die Paare nicht, auch mit laufender Kerze',async()=>{
 const fixture=await loadCaseFixture(c),{m5,m1}=fixture.candles;
 // 09.11. 17:32:30 Berlin: M5 17:30 und M1 17:32 laufen noch.
 const evaluatedAt=1794241950,raw=detectDoubleOrderBlocks({m5Candles:m5,m1Candles:m1,instrument:'XAUUSD',evaluatedAt});
 expect(raw.pairs.length).toBeGreaterThan(0);
 expect(detectDoubleOrderBlocks(doubleOrderBlockInput({m5,m1,symbol:'XAUUSD',evaluatedAt}))).toEqual(raw);
});

it('das Dashboard baut seine Worker-Eingabe über dieselbe Funktion',()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
 expect(read('../src/doubleOrderBlockData.js')).toContain('postMessage(doubleOrderBlockInput(');
 for(const user of ['../src/composables/useDoubleOrderBlockChart.js','../src/composables/useJournalDobEntryFinder.js'])
  expect(read(user)).toContain('runDoubleOrderBlockWorker(');
});
