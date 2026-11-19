import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {ts11CaseFromPin,locateTs11Case,diagnoseTs11Case} from '../src/tradeSetup11Debugger.js';

// Ein LS-Pivot muss älter sein als das Extrem, an dem die aktuelle Range beginnt, auch im Trend.
// Philip zu P493: „nach meiner Regel ist das kein richtiger LS. ich kann nicht analysieren, wenn meine Regeln nicht korrekt umgesetzt sind.“
const f=JSON.parse(readFileSync(new URL('./fixtures/ts11-pivot-age/xau-p493-2026-10-08.json',import.meta.url),'utf8'));
it('P493 Short: LS 08:50 nach dem Range-Low 08:35 wird über den ganzen Zeitbalken nie ✓',()=>{
 const {window,m5,h1,d1}=f.candles,kase=ts11CaseFromPin(f.pin,new Map([[f.row.id,f.row]]));
 const located=locateTs11Case(kase,window,f.sessionConfigs);
 expect(located.ob).not.toBeNull();
 const results=[];
 for(let at=located.obKnownAt;at<=located.obKnownAt+3*3600;at+=300)
  results.push(diagnoseTs11Case(kase,window,f.sessionConfigs,{...located,evaluatedAt:at},{m5,h1,d1},{explain:false}));
 expect(results.map(r=>r.verdict)).not.toContain('TS1.1 ✓');
 const first=results[0].assessment;
 expect(first.reason).toBe('sourcePivotInCounterMove');
 expect(first.setup.ls.pivotTime).toBe(Date.parse('2026-10-08T06:50:00Z')/1000);
 expect(first.trendEvidence.counterOrigin).toBe(Date.parse('2026-10-08T06:35:00Z')/1000);
});
