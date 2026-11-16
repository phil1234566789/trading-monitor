import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/chartDebuggerCases.js';
import {obReactionGraph,graphChangeTimes} from '../src/obReactionGraph.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,internalFvgOpenAt} from '../src/orderBlockReaction.js';
import {reactionOptionsFor} from '../src/doubleOrderBlocks.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

// Gleicher Aufruf wie ChartDebugger.vue: Rolle wählen, Partner und Paar mitgeben.
const OB_CASES=CHART_DEBUGGER_CASES;
const caseOf=id=>CHART_DEBUGGER_CASES.find(x=>x.id===id);
const graphOf=(c,r,at,role='second')=>{const entry=r.orderBlocks.find(o=>o.role===role);
 return obReactionGraph({dir:c.dir,entry,context:r.context,evaluatedAt:at,pair:r.pair,partner:r.orderBlocks.find(o=>o!==entry)??null});};
const graphAt=async(id,evaluatedAt,role='second')=>{
 const c=caseOf(id),fixture=await loadCaseFixture(c),at=evaluatedAt??caseSteps(c,fixture).through;
 return graphOf(c,evaluateCase(c,fixture,at),at,role);
};
const status=g=>Object.fromEntries(Object.entries(g.nodes).map(([k,n])=>[k,n.status]));

describe('Knotenplan = v7-Entscheidungsbaum aus dem Produktergebnis',()=>{
 it('P16 OB2: zeigt Produktrouten und den belegten Entry mit fernem M5-Kanten-SL',async()=>{
  const c=caseOf('P16'),fixture=await loadCaseFixture(c),at=caseSteps(c,fixture).through,result=evaluateCase(c,fixture,at);
  const g=graphOf(c,result,at),a=result.orderBlocks[1].reaction.routes.a;
  expect(g.head).toBe(`Intern: true · Routen: a ${a.status}, b entry`);
  expect(status(g)).toMatchObject({detect:'visited',touch:'visited',broken:'visited',reaction:'visited',stop:'visited',routeA:({entry:'visited',rejected:'rejected',unknown:'unknown',pending:'unknown'})[a.status],
   result:'visited',closed:'not-visited',false:'not-visited',hold:'not-visited'});
  expect(g.nodes.stop.sub).toContain('ferne M5-Kante');
  // Ausgabe-Box: nur der Rückgabewert; die Routenbegründungen stehen im Baum (head, routeA oben).
  expect(g.nodes.result.headline).toBe('Reaktion: true');
  expect(g.nodes.result.sub).toMatch(/^Entry \d\d:\d\d @ \S+ · SL \S+ \(OB-Kante\)$/);
  expect(g.nodes.result.sub).not.toMatch(/a: |b: |Struktur/);
  expect(g.edges).toMatchObject({counterA:'visited',bStop:'visited',stopResult:'visited',falseResult:'not-visited'});
 });
 it('P16 OB1: Hold-Gate hält, weil der DOB erkannt ist',async()=>{
  const g=await graphAt('P16',undefined,'first');
  expect(status(g)).toMatchObject({reaction:'visited',hold:'visited',noDob:'not-visited',stop:'not-visited',counter:'not-visited'});
  expect(g.edges.reactionCounter).toBe('not-visited');
  expect(g.head).toBe('Intern: true · Routen: – (OB1)');
 });
 it('503: Gegenkante vor der FVG gebrochen → Reaktion false',async()=>{
  const g=await graphAt('503');
  expect(g.head).toBe('Intern: false (M5-Gegenkante gebrochen) · Routen: a rejected, b rejected');
  expect(status(g)).toMatchObject({broken:'rejected',false:'rejected',reaction:'not-visited',routeA:'not-visited',stop:'not-visited',result:'rejected'});
  expect(g.edges.falseResult).toBe('rejected');
  expect(g.history.some(h=>h.text==='Struktur false · M5-Gegenkante gebrochen')).toBe(true);
 });
 it('P14: Reaktion true, SL ohne offene interne FVG → Retest-Extrem; 504 lehnt Entry b ab',async()=>{
  const g=await graphAt('P14');
  expect(g.head).toBe('Intern: true · Routen: a entry, b nicht geprüft · Entry a bereits gefunden');
  expect(status(g)).toMatchObject({reaction:'visited',stop:'visited',routeA:'visited',bCheck:'not-visited',entryB:'not-visited',result:'visited'});
  expect(g.nodes.stop.sub).toContain('● nein → Retest-Extrem · 4.181,45');
  const g504=await graphAt('504');
  expect(g504.head).toBe('Intern: true · Routen: a rejected, b rejected');
  expect(g504.nodes.result.headline).toBe('Reaktion: false');
  expect(g504.nodes.counter.sub).toContain('a historisch abgelehnt');
 });
 it('nennt die 2-%-Berührungstoleranz an Touch- und Bruch-Knoten',async()=>{
  const g=await graphAt('P14');
  expect(g.nodes.touch.label).toBe('Touch (≤ 2 % der OB-Höhe) vor dem nächsten Marktschluss?');
  expect(g.nodes.broken.label).toContain('gebrochen (≤ 2 % der OB-Höhe)');
 });
 it('folgt dem Slider: vor der OB unbekannt, vor der FVG offen',async()=>{
  const c=CHART_DEBUGGER_CASES.find(x=>x.id==='503');
  expect((await graphAt('503',c.orderBlocks[0]+60)).text).toBe('M5-OB noch nicht bekannt.');
  const knownAt=(await graphAt('P16')).history.find(h=>h.text.startsWith('Struktur true')).at,before=await graphAt('P16',knownAt-60);
  expect(status(before)).toMatchObject({reaction:'not-visited',broken:'unknown'});
  expect(before.head).toBe('Intern: unknown (Retest da, noch keine neue FVG) · Routen: –');
 });
 it('marketClosed: OB1 vom 05.11. verfällt über die Tagespause',()=>{
  const load=n=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${n}.json`,import.meta.url),'utf8'));
  const [d1,d2]=['2026-11-05','2026-11-06'].map(load),m5=[...d1.candles.m5,...d2.candles.m5],at=1793916060+1800;
  const m1=[...d1.candles.m1,...d2.candles.m1].filter(c=>c.time+60<=at);
  const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1793838000);
  const orderBlock={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(1793838000),timeframe:'5M'};
  const reaction=evaluateOrderBlockReaction(createOrderBlockReactionContext(m1,at,'XAUUSD'),orderBlock,reactionOptionsFor('first'));
  const g=obReactionGraph({dir:1,entry:{role:'second',orderBlock,reaction,internalFvgs:[]},context:{rows:m1,evaluatedAt:at},evaluatedAt:at});
  // Struktur bleibt unknown; das öffentliche Produkturteil ist ein endgültiges false.
  expect(g.head).toBe('Intern: unknown (Markt geschlossen, OB verfallen) · Routen: –');
  expect(status(g)).toMatchObject({touch:'unknown',closed:'rejected',broken:'not-visited',result:'rejected'});
  expect(g.nodes.result).toMatchObject({headline:'Reaktion: false',status:'rejected'});
  expect(g.nodes.result.sub).toBe('');
  expect(g.nodes.closed.label).toBe('Markt geschlossen, OB verfallen');
 });

 it('Seitenspur übernimmt unknown aus der Produkt-Füllhistorie bei verdeckter Kerze und Lücke (Drift-Wächter)',async()=>{
  const c=caseOf('P16'),fixture=await loadCaseFixture(c),at=caseSteps(c,fixture).through;
  const base=evaluateCase(c,fixture,at),fvg=base.orderBlocks[1].internalFvgs[0];
  // Vorbedingung: ohne Eingriff ist der Füllstand bekannt, sonst prüft der Test nichts.
  expect(fvg).not.toBe(base.orderBlocks[1].reaction.fvg);
  expect(internalFvgOpenAt(base.context,fvg,at)).not.toBeNull();
  for(const edit of [m1=>m1.map(x=>x.time===fvg.recognizedAt?{...x,ignored:true}:x),m1=>m1.filter(x=>x.time!==fvg.recognizedAt)]){
   const r=evaluateCase(c,{...fixture,candles:{...fixture.candles,m1:edit(fixture.candles.m1)}},at),same=r.orderBlocks[1].internalFvgs.find(f=>f.candleTime===fvg.candleTime);
   expect(internalFvgOpenAt(r.context,same,at)).toBeNull();
   const g=graphOf(c,r,at),index=r.orderBlocks[1].internalFvgs.filter(f=>f!==r.orderBlocks[1].reaction.fvg).indexOf(same);
   expect(g.nodes.fvgList.meters[index]).toMatchObject({value:null,label:'Füllstand unbekannt'});
  }
 });
 it('Route b: missingHistory und entryBUnknown bleiben unknown statt „nein“',()=>{
  const orderBlock={dir:1,top:2,bottom:1,startTime:0,recognizedAt:300},fvg={top:2.5,bottom:2.2,recognizedAt:900,candleTime:780};
  for(const reason of ['missingHistory','entryBUnknown']){
   const reaction={state:'true',reason:null,contact:{status:'touch',candleTime:600,knownAt:660},fvg,knownAt:900,penetration:null,
    routes:{a:{status:'unknown',reason:'partialOverlapOpen',knownAt:900},b:{status:'unknown',reason,knownAt:1200}}};
   const g=obReactionGraph({dir:1,entry:{role:'second',orderBlock,reaction,internalFvgs:[]},context:{rows:[],evaluatedAt:1800},evaluatedAt:1800});
   expect(g.nodes.bCheck.status,reason).toBe('unknown');
   expect(g.nodes.bCheck.sub,reason).toContain(reason==='missingHistory'?'M1-Historie lückenhaft':'Entry b unbekannt');
   expect(g.nodes.entryB.status,reason).toBe('not-visited');
  }
 });
 it('P16: „nächste Änderung“ springt nacheinander zu Kontakt, Reaktion, Entry a, Entry b und verpasst keine Änderung',async()=>{
  const c=caseOf('P16'),fixture=await loadCaseFixture(c),{from,through}=caseSteps(c,fixture),end=evaluateCase(c,fixture,through);
  const entry=end.orderBlocks[1],times=graphChangeTimes({entry,context:end.context,pair:end.pair,partner:end.orderBlocks[0]});
  const r=entry.reaction,key=[r.contact.knownAt,r.knownAt,r.routes.a.knownAt,r.routes.b.entryTime];
  const jumps=[];for(let at=from,next;(next=times.find(t=>t>at))!=null&&next<=through;at=next)jumps.push(next);
  expect(jumps.filter(t=>key.includes(t))).toEqual([...new Set(key)]);
 },60000);
 // Wächter in beide Richtungen: jede sichtbare Änderung ist ein Sprungziel und jedes Sprungziel eine Änderung.
 it.each(OB_CASES.flatMap(c=>(c.orderBlocks.length===2?['first','second']:['second']).map(role=>[c.id,role])))('Sprungziele %s %s = sichtbare Änderungen',async(id,role)=>{
  const c=caseOf(id),fixture=await loadCaseFixture(c),{from,through}=caseSteps(c,fixture),end=evaluateCase(c,fixture,through);
  const entry=end.orderBlocks.find(o=>o.role===role);
  const times=graphChangeTimes({entry,context:end.context,pair:end.pair,partner:end.orderBlocks.find(o=>o!==entry)??null});
  const sign=at=>{const g=graphOf(c,evaluateCase(c,fixture,at),at,role);
   return JSON.stringify([g.head,g.text,g.history,Object.values(g.nodes).map(n=>[n.status,n.sub,n.headline,(n.meters??[]).map(m=>m.label.replace(/[\d,.]+ %/g,'')),n===g.nodes.counter||n===g.nodes.bCheck?n.detail:null])]);};
  const changes=[];let previous=sign(from);
  for(let at=from+60;at<=through;at+=60){const now=sign(at);if(now!==previous)changes.push(at);previous=now;}
  expect(times.filter(t=>t>from&&t<=through)).toEqual(changes);
 },120000);
});


describe('öffentlicher Verdict und Gegen-FVG-Quellen',()=>{
 const ob={dir:1,top:110,bottom:100,startTime:0,recognizedAt:300};
 const fvg={direction:'long',top:113,bottom:111,candleTime:780,recognizedAt:900};
 const enemy={direction:'short',top:109,bottom:108,candleTime:540,recognizedAt:660};
 const graph=(reaction,internalFvgs=[],rows=[])=>obReactionGraph({dir:1,entry:{role:'second',orderBlock:ob,reaction,internalFvgs},
  context:createOrderBlockReactionContext(rows,1800,'XAUUSD'),evaluatedAt:1800});
 const reaction={state:'unknown',structuralState:'true',fvg,knownAt:900,contact:{candleTime:720,knownAt:780,status:'touch'},
  verdict:{state:'pending',reason:'entryBPending',knownAt:900},routes:{a:{status:'rejected',reason:'opposingFvgOpen',knownAt:900},b:{status:'pending',reason:'entryBPending'}},
  opponentFvgs:[{fvg:enemy,openAtReaction:true,openNow:false,blocksEntryA:true}]};
 it('strukturelles true ohne Entry bleibt öffentlich pending; spätere Füllung hebt A-Ablehnung nicht auf',()=>{
  const g=graph(reaction);
  expect(g.nodes.result.headline).toBe('Reaktion: pending');
  expect(g.nodes.counter).toMatchObject({status:'visited',sub:'1 Gegen-FVG · jetzt gefüllt · a historisch abgelehnt'});
  expect(g.nodes.counter.detail.join(' ')).toContain('bei Reaktion offen');
  expect(g.nodes.counter.detail.join(' ')).toContain('jetzt gefüllt');
  expect(g.nodes.counter.detail.join(' ')).toContain('bekannt');
  expect(g.nodes.routeA.sub).toContain('Gegen-FVG');
  expect(g.edges).toMatchObject({reactionCounter:'visited',counterA:'visited',aStop:'not-visited',stopResult:'not-visited'});
 });
 it.each(['true','false','pending','unknown'])('verwendet Verdict %s ohne Routen neu zu aggregieren',state=>{
  expect(graph({...reaction,verdict:{state,reason:null,knownAt:900}}).nodes.result.headline).toBe('Reaktion: '+state);
 });
 it('Verfall ist false; fehlende Historie bleibt unknown und Gegenprüfung unbesucht',()=>{
  for(const [reason,state] of [['marketClosed','false'],['missingHistory','unknown']]){
   const g=graph({state:'unknown',reason,verdict:{state,reason,knownAt:1200}});
   expect(g.nodes.result.headline).toBe('Reaktion: '+state);
   expect(g.nodes.counter.status).toBe('not-visited');
  }
 });
 it('zeigt jede interne FVG und jede Gegnerquelle, auch bei unbekanntem Füllstand',()=>{
  const internal=[{...fvg,recognizedAt:600},{...fvg,recognizedAt:660}];
  const g=graph({...reaction,opponentFvgs:[...reaction.opponentFvgs,{fvg:{...enemy,candleTime:600},openAtReaction:null,openNow:null,blocksEntryA:false}]},internal);
  expect(g.nodes.fvgList.meters).toHaveLength(2);
  expect(g.nodes.fvgList.detail).toContain('Mehrere interne FVGs: Auswahl-/Prioritätsregel noch nicht fachlich festgelegt.');
  expect(g.nodes.counter.detail.join(' ')).toContain('Füllstand unbekannt');
  expect(g.nodes.counter.detail.filter(x=>x.includes('Quelle:'))).toHaveLength(2);
 });
 it('zeigt beobachtete Gegnerquellen und übernimmt nur die gelieferte Routenentscheidung',()=>{
  const g=graph({...reaction,routes:{...reaction.routes,a:{status:'unknown',reason:'entryUnavailable',knownAt:900}}});
  expect(g.nodes.counter.sub).not.toContain('historisch abgelehnt');
  expect(g.nodes.counter.detail.join(' ')).toContain('Quellen und Blocker stammen aus dem Produkt');
  expect(g.nodes.routeA.status).toBe('unknown');
 });
 it('spätere bekannte Füllung verdeckt keinen unbekannten historischen Zustand',()=>{
  const g=graph({...reaction,opponentFvgs:[{fvg:enemy,openAtReaction:null,openNow:false,blocksEntryA:false}],
   routes:{...reaction.routes,a:{status:'unknown',reason:'opposingFvgHistoryMissing',knownAt:900}}});
  expect(g.nodes.counter.status).toBe('unknown');
  expect(g.nodes.counter.sub).toContain('jetzt gefüllt');
  expect(g.nodes.counter.sub).toContain('damaliger Füllstand unbekannt');
 });
 it('behält frühere b-Ablehnung und neue FVG als getrennte historische Ereignisse und Sprungziele',()=>{
  const next={...fvg,candleTime:1080,recognizedAt:1200};
  const attempts=[{fvg,status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:1020},
   {fvg:next,status:'entry',knownAt:1380,entryTime:1380}];
  const r={...reaction,verdict:{state:'true',reason:null,knownAt:1380},routes:{...reaction.routes,b:{status:'entry',entryTime:1380,entryPrice:114,stopLoss:99,stopAnchor:'retestExtreme',entryFvg:next,attempts}}};
  const g=graph(r);
  expect(g.history).toContainEqual(expect.objectContaining({at:1020,text:expect.stringContaining('Versuch 1 rejected')}));
  expect(g.history).toContainEqual(expect.objectContaining({at:1200,text:expect.stringContaining('Versuch 2 FVG bekannt')}));
  expect(g.history).toContainEqual(expect.objectContaining({at:1380,text:expect.stringContaining('Versuch 2 entry')}));
  expect(g.nodes.bCheck.detail.join(' ')).toContain('Versuch 2');
  const times=graphChangeTimes({entry:{role:'second',orderBlock:ob,reaction:r,internalFvgs:[]},context:createOrderBlockReactionContext([],1800,'XAUUSD')});
  expect(times).toEqual(expect.arrayContaining([1020,1200,1380]));
 });
 it('Entry a beendet die Suche: b skipped bleibt unbesucht, ohne eigene Historie oder Sprung',()=>{
  const r={...reaction,verdict:{state:'true',knownAt:900},routes:{a:{status:'entry',entryTime:900,entryPrice:114,stopLoss:99,stopAnchor:'retestExtreme'},
   b:{status:'skipped',reason:'entryAlreadyFound',knownAt:1200}}};
  const g=graph(r);
  for(const node of [g.nodes.bCheck,g.nodes.entryB])expect(node).toMatchObject({status:'not-visited',sub:'nicht geprüft · Entry a bereits gefunden'});
  expect(g.nodes.result.sub).toMatch(/^Entry \d\d:\d\d @ 114 · SL 99 \(Retest\)$/);
  expect(g.edges).toMatchObject({aStop:'visited',aB:'not-visited',bCandidate:'not-visited',bStop:'not-visited',stopResult:'visited'});
  expect(g.history.some(h=>h.text.startsWith('Route b'))).toBe(false);
  const times=graphChangeTimes({entry:{role:'second',orderBlock:ob,reaction:r,internalFvgs:[]},context:createOrderBlockReactionContext([],1800,'XAUUSD')});
  expect(times).not.toContain(1200);
 });
 it.each([['m5-edge','ja → ferne M5-Kante'],['retestExtreme','nein → Retest-Extrem']])('SL-Ast %s bleibt am Entry eingefroren trotz heute gefüllter Quelle',(anchor,branch)=>{
  const internal={direction:'long',bottom:102,top:103,candleTime:480,recognizedAt:600};
  const rows=Array.from({length:20},(_,i)=>({time:600+i*60,open:104,close:104,high:105,low:101}));
  const r={...reaction,routes:{a:{status:'entry',entryTime:900,entryPrice:114,stopLoss:100,stopAnchor:anchor},b:{status:'skipped',reason:'entryAlreadyFound',knownAt:900}}};
  const g=graph(r,[internal],rows);
  expect(g.nodes.fvgList.meters[0].label).toBe('gefüllt');
  expect(g.nodes.fvgList.description).toBe('SL-Quelle · aktueller Füllstand');
  expect(g.nodes.stop.label).toBe('Interne M1-FVG beim Entry noch offen?');
  expect(g.nodes.stop.sub).toContain('● '+branch+' · 100');
  expect(g.nodes.stop.sub).toContain('beim Entry eingefroren');
  expect(g.nodes.stop.sub).toContain('ja → ferne M5-Kante');
  expect(g.nodes.stop.sub).toContain('nein → Retest-Extrem');
 });
 it('SL bleibt bei fehlender Füllhistorie unbekannt, statt einen Ja-/Nein-Ast zu erfinden',()=>{
  const g=graph({...reaction,routes:{a:{status:'unknown',reason:'internalFvgHistoryMissing',knownAt:900,entryCandidate:{entryTime:900,entryPrice:114}},b:{status:'pending',reason:'entryBPending'}}});
  expect(g.nodes.stop.status).toBe('unknown');
  expect(g.nodes.stop.sub).toContain('SL unknown');
  expect(g.nodes.stop.sub).not.toContain('● ja');
  expect(g.nodes.stop.sub).not.toContain('● nein');
 });
 it('wartendes b besucht den SL erst mit einem Entry-Kandidaten',()=>{
  const waiting=graph(reaction);
  expect(waiting.nodes.stop.status).toBe('not-visited');
  expect(waiting.edges).toMatchObject({aStop:'not-visited',bStop:'not-visited',stopResult:'not-visited'});
  const candidate=graph({...reaction,routes:{...reaction.routes,b:{status:'unknown',reason:'partialOverlapOpen',knownAt:1200,entryCandidate:{entryTime:1200,entryPrice:114}}}});
  expect(candidate.nodes.entryB.label).toBe('Entry-Kandidat b');
  expect(candidate.nodes.stop.status).toBe('unknown');
  expect(candidate.edges).toMatchObject({bStop:'unknown',stopResult:'unknown'});
 });
 it('nimmt Gegnerfüllung nach Reaktion in die Änderungssprünge auf',()=>{
  const rows=Array.from({length:20},(_,i)=>({time:660+i*60,open:107,close:107,high:i>=7?110:107,low:106}));
  const context=createOrderBlockReactionContext(rows,1860,'XAUUSD');
  const times=graphChangeTimes({entry:{role:'second',orderBlock:ob,reaction,internalFvgs:[]},context});
  expect(times).toContain(1140);
  expect(times).not.toContain(660);
 });
});
