import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {lsReactionCaseFromPin,locateLsReactionCase,diagnoseLsReactionCase} from '../src/lsReactionDebugger.js';

// Mit dem Trend nur bei bestätigter Range (HH+HL bzw. LL+LH); eine Range nur aus Close-CHoCH reicht nicht.
// Philip: „ja doch das brauchen wir. auch wenns weniger trades werden.“ Beide Fälle dürfen zu keinem Zeitpunkt ✓ werden.
const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const cases=[
 ['P556 GBP Long 15:40 (#55185)','./fixtures/ls-reaction-currenttrend/gbp-2026-11-18.json','GBPUSD',{top:1.31616,bottom:1.31565,startTime:'2026-11-18T14:40:00+00:00'}],
 ['#54967 XAU Long 09:20 (ex P544)','./fixtures/ls-reaction-ls-ob/xau-2026-11-18.json','XAUUSD',{top:3763.63,bottom:3757.31,startTime:'2026-11-18T08:20:00+00:00'}],
];

it.each(cases)('%s: Long gegen die Close-CHoCH-Range wird über den ganzen Zeitbalken nie ✓',(_,path,instrument,ob)=>{
 const f=load(path),{m5,h1,d1}=f.candles,sessions=f.sessionConfigs.filter(s=>s.instrument===instrument);
 const kase=lsReactionCaseFromPin({id:0,kind:'ob_zone',note:'',obZone:{instrument,direction:'long',timeframe:'5M',...ob}});
 const located=locateLsReactionCase(kase,m5,sessions);
 expect(located.ob).not.toBeNull();
 const verdicts=[];
 for(let at=located.obKnownAt;at<=m5.at(-1).time+300;at+=300)
  verdicts.push(diagnoseLsReactionCase(kase,m5,sessions,{...located,evaluatedAt:at},{m5,h1,d1},{explain:false}).verdict);
 expect(verdicts.length).toBeGreaterThan(5);
 expect(verdicts).not.toContain('LS-Reaktion ✓');
});
