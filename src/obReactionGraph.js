import {measureOrderBlockPenetration,orderBlockPenetration} from './orderBlockPenetration.js';
import {candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {internalFvgOpenAt,firstIndex,TOUCH_TOLERANCE_FRACTION,reactionBreaksOrderBlock} from './orderBlockReaction.js';
import {formatBerlinTime} from './berlinTime.js';
import {fmtPrice} from './format.js';
const TOUCH_PCT=`${TOUCH_TOLERANCE_FRACTION*100} %`;

// Knotenplan der OB-Reaktion im Chart-Debugger: Knoten = v7-Entscheidungsbaum (Default W1), Zustände nur aus dem
// Produktergebnis (evaluateCase → evaluateOrderBlockReaction/detectDoubleOrderBlocks) zum Slider-Stand.
export const REASON_TEXT={
 noContact:'noch kein Retest',awaitingFvg:'Retest da, noch keine neue FVG',marketClosed:'Markt geschlossen, OB verfallen',
 missingHistory:'M1-Historie lückenhaft',m5OrderBlockBroken:'M5-Gegenkante gebrochen',invalidOrderBlock:'OB ungültig',
 reactionFalse:'Reaktion false',entryUnavailable:'kein Entry aus der FVG',entryBPending:'wartet auf Entry-b-Bestätigung',
 entryBUnknown:'Entry b unbekannt',entryBOrderBlockBroken:'M1-OB der FVG gebrochen',entryBOrderBlockTooDeep:'M1-OB über 50 % eingestochen',
 entryAlreadyFound:'Entry a bereits gefunden',
 entryPending:'wartet auf vollständigen Entry',entryRoutesRejected:'beide Entry-Routen abgelehnt',
 opposingFvgHistoryMissing:'Füllhistorie der Gegen-FVG fehlt',
 opposingFvgOpen:'Gegen-FVG bei Reaktion offen → Entry a abgelehnt',
 partialOverlapOpen:'interne FVG nur teilweise in der OB',
 internalFvgHistoryMissing:'Füllhistorie interner FVG fehlt',stopNotBeyondEntry:'SL liegt nicht hinter dem Entry',
};
export const SKIPPED_ENTRY_TEXT='nicht geprüft · Entry a bereits gefunden';
export const reasonText=reason=>REASON_TEXT[reason]??reason;

export const structuralState=r=>r?.structuralState??r?.state??'unknown';
const adjective=dir=>dir===1?'bullische':'bärische';
const price=p=>fmtPrice(p,2),time=t=>formatBerlinTime(t);
const range=z=>`${price(z.bottom)}–${price(z.top)}`;
const pct=n=>Number(n.toFixed(2))+' %';
const ROUTE_STATUS={entry:'visited',rejected:'rejected',unknown:'unknown',pending:'unknown'};
// SL-Gründe bzw. -Anker der Produktrouten; ein unknown aus diesen Gründen hat das 50-%-Gate von Route b bereits passiert.
const STOP_BRANCH={'m5-edge':'interne FVG offen → ferne M5-Kante',retestExtreme:'keine offen → Retest-Extrem',
 partialOverlapOpen:'nur teilweise überlappend → unknown',
 internalFvgHistoryMissing:'Füllhistorie fehlt → unknown',stopNotBeyondEntry:'SL nicht hinter dem Entry → unknown'};
const UNKNOWN_METER=label=>({value:null,label,segments:[]});
const meterOf=(value,words,label,positive=true)=>({value,label,
 segments:[{value,word:words[0],positive},{value:100-value,word:words[1],positive:false}].filter(s=>s.value>0)});
const rowsFrom=(context,from)=>context.rows.slice(firstIndex(context.rows,c=>c.time>=from));

// Offen/gefüllt/unbekannt kommt aus der Produkt-Füllhistorie (fvgFill); die Prozentzahl nur als Messung dazu.
// Replay kann dieselbe Quelle in mehreren Kontexten auswerten; Fülltexte dürfen keinen Sliderstand überleben.
const fillMeters=new WeakMap();
export function fvgFillMeter(context,fvg){
 let cache=fillMeters.get(context);
 if(!cache){cache=new WeakMap();fillMeters.set(context,cache);}
 if(cache.has(fvg))return cache.get(fvg);
 const open=internalFvgOpenAt(context,fvg,context.evaluatedAt);
 let meter;
 if(open===null)meter=UNKNOWN_METER('Füllstand unbekannt');
 else if(!open)meter=meterOf(100,['gefüllt','offen'],'gefüllt');
 else{
  const m=measureOrderBlockPenetration(fvg,fvg.direction,rowsFrom(context,fvg.recognizedAt));
  const depth=m.status==='ready'?Math.max(0,Math.min(100,m.maxPenetrationFraction*100)):0;
  meter=meterOf(depth,['gefüllt','offen'],`${depth>0?'berührt':'unberührt'} · ${pct(100-depth)} offen`);
 }
 cache.set(fvg,meter);
 return meter;
}

function orderBlockMeter(context,ob,dir){
 const rows=rowsFrom(context,ob.recognizedAt),m=measureOrderBlockPenetration(ob,dir===1?'long':'short',rows);
 // Ohne Kerze seit Bekanntwerden ist der OB schlicht unberührt, nicht unbekannt.
 if(m.status!=='ready')return {...UNKNOWN_METER('Messung unbekannt'),state:rows.length?'Messung unbekannt':'noch nicht berührt'};
 if(m.maxPenetrationFraction<0)return {...UNKNOWN_METER('Messung unbekannt'),state:'noch nicht berührt'};
 // Gleiche Bruchregel wie die Reaktion, sonst zeigt Pin 501 „gehalten“ neben „Gegenkante gebrochen“.
 const depth=Math.min(100,m.maxPenetrationFraction*100),broken=rows.some(c=>reactionBreaksOrderBlock(c,ob));
 return {...meterOf(100-depth,['intakt','eingestochen'],`OB intakt ${pct(100-depth)} · Einstich ${pct(depth)}${broken?' · gebrochen':''}`,!broken),
  state:broken?'gebrochen':'gehalten'};
}

// Seitenspur zeigt den aktuellen Quellenzustand; die SL-Entscheidung bleibt am Entry eingefroren.
export const internalFvgSources=entry=>(entry.internalFvgs??[]).filter(f=>f!==entry.reaction?.fvg);
export const internalFvgPlacement=(fvg,ob)=>fvg.bottom>=ob.bottom&&fvg.top<=ob.top?'intern':'teilweise überlappend';
function sideTrack(dir,entry,context){
 const fvgs=internalFvgSources(entry),ob=fvgs.at(-1)?.orderBlock;
 const meters=fvgs.map(f=>({...fvgFillMeter(context,f),range:range(f)}));
 const inside=fvgs.filter(f=>internalFvgPlacement(f,entry.orderBlock)==='intern').length,partial=fvgs.length-inside;
 const fvgList={label:`Interne ${adjective(dir)} M1-FVGs`,description:'SL-Quelle · aktueller Füllstand',info:true,status:fvgs.length?'visited':'info',
  sub:fvgs.length?`${inside} intern${partial?' · '+partial+' teilweise überlappend':''}`:'keine bekannt',meters,
  detail:fvgs.length?[...fvgs.map((f,i)=>`${range(f)} · ${internalFvgPlacement(f,entry.orderBlock)} · M1-FVG ${time(f.candleTime)} (Formation ${time(f.candleTime-60)}–${time(f.candleTime+60)}) · bekannt ${time(f.recognizedAt)} · ${meters[i].label}`),
   'Die Füllbalken zeigen den aktuellen Sliderstand, nicht den Füllstand beim Entry. Für den SL zählt der Zustand beim Entry: offen und komplett in der OB → ferne M5-Kante; keine offen → Retest-Extrem. Spätere Füllung ändert den SL nicht.',
   ...(fvgs.length>1?['Mehrere interne FVGs: Auswahl-/Prioritätsregel noch nicht fachlich festgelegt.']:[])]
   :['Keine interne gleichgerichtete M1-FVG in der M5-OB bekannt.']};
 const meter=ob&&orderBlockMeter(context,ob,dir);
 const internalOb={label:`Interner ${dir===1?'bullischer':'bärischer'} M1-OB`,info:true,status:ob?'visited':'info',
  sub:ob?`${range(ob)}\n${meter.state}`:'kein Beleg',meters:ob?[meter]:[],
  detail:ob?[`M1-OB der jüngsten internen FVG, ${range(ob)}.`,meter.label,'Zusatzbeleg, kein Gate in v7.']
   :['Kein interner M1-OB zugeordnet. Der M1-OB der Reaktions-FVG gehört zu Route b.']};
 return {fvgList,internalOb};
}

// Ausgabe = nur der Rückgabewert von evaluateOrderBlockReaction, rollenunabhängig; Begründungen stehen im Baum.
const STOP_ANCHOR_TEXT={'m5-edge':'OB-Kante',retestExtreme:'Retest'};
// true trägt den frühesten Entry, wie verdict.knownAt; false/pending/unknown tragen nichts.
export function reactionOutput(r){
 const state=r?.verdict?.state??'unknown';
 const entry=state==='true'?Object.values(r.routes??{}).filter(x=>x.status==='entry').sort((a,b)=>a.entryTime-b.entryTime)[0]:null;
 return {state,entry:entry?`Entry ${time(entry.entryTime)} @ ${price(entry.entryPrice)} · SL ${price(entry.stopLoss)} (${STOP_ANCHOR_TEXT[entry.stopAnchor]??entry.stopAnchor})`:''};
}
function resultNode(r){
 const {state,entry}=reactionOutput(r);
 return {label:'Ausgabe',headline:`Reaktion: ${state}`,status:state==='true'?'visited':state==='false'?'rejected':'unknown',
  sub:entry,detail:[entry?`${state} · ${entry}`:state]};
}

const fillState=open=>open===true?'offen':open===false?'gefüllt':'Füllstand unbekannt';
function opponentNode(r,dir,live){
 const sources=live?r.opponentFvgs??[]:[],blocked=r?.routes?.a?.status==='rejected'&&r.routes.a.reason==='opposingFvgOpen',unknownNow=sources.some(x=>x.openNow==null),unknownThen=sources.some(x=>x.openAtReaction==null);
 const now=unknownNow?'Füllstand unbekannt':sources.some(x=>x.openNow)?'offen':'gefüllt';
 return {label:`💀 Gegen-FVG: ${adjective(-dir)} M1-FVG im Weg?`,status:!live?'not-visited':unknownNow||unknownThen?'unknown':'visited',
  sub:!live?'○ nicht besucht':sources.length?`${sources.length} Gegen-FVG · jetzt ${now}${unknownThen?' · damaliger Füllstand unbekannt':''}${blocked?' · a historisch abgelehnt':''}`:'keine Gegen-FVG seit M5-OB im Retest-Weg',
  detail:!live?['Erst nach Bekanntwerden der Reaktions-FVG.']:[
   ...sources.map(({fvg,openAtReaction,openNow,blocksEntryA,nearest})=>`Quelle: ${range(fvg)} · M1-FVG ${time(fvg.candleTime)} · erste Kerze ${time(fvg.candleTime-60)} · bekannt ${time(fvg.recognizedAt)} · bei Reaktion ${fillState(openAtReaction)} · jetzt ${fillState(openNow)} · ${blocksEntryA?'als Entry-a-Blocker markiert':nearest?'nächste in Trade-Richtung, kein belegter Entry-a-Blocker':'nicht die nächste in Trade-Richtung, blockiert nicht'}.`),
   sources.length?'Spätere Füllung beschreibt die Quelle; sie schreibt die historische Entry-a-Entscheidung nicht um.':'Keine gegnerische FVG im vom Produkt geprüften Reaktionsweg.',
   'Zählt nur FVGs, die seit der M5-OB entstanden sind (M1-FVG-Zeit ≥ OB-Start), bis zur Reaktion.',
   r?.routes?.b?.status==='skipped'?`Entry b: ${SKIPPED_ENTRY_TEXT}.`:'Entry b wird geprüft, wenn a keinen Entry liefert. Quellen und Blocker stammen aus dem Produkt; nur die preislich nächste Gegen-FVG in Trade-Richtung ab dem Bestätigungspreis lehnt a ab, wenn sie offen ist.']};
}

const hasEntryCandidate=x=>x?.status==='entry'||Boolean(x?.status==='unknown'&&x.entryCandidate);
function routeEntry(x,unvisited){
 if(x?.status==='skipped')return {status:'not-visited',sub:SKIPPED_ENTRY_TEXT,detail:[SKIPPED_ENTRY_TEXT]};
 if(!x)return {status:'not-visited',sub:'○ nicht besucht',detail:[unvisited]};
 return {status:ROUTE_STATUS[x.status],sub:x.status==='entry'?`${price(x.entryPrice)} · ${time(x.entryTime)}`:`${x.status} · ${reasonText(x.reason)}`,
  detail:[x.status==='entry'?`Entry-Kandidat ${price(x.entryPrice)} um ${time(x.entryTime)}; SL wird danach geprüft.`:`${x.status}: ${reasonText(x.reason)}.`,
   x.entryFvg?`Quelle: Entry-b-FVG ${range(x.entryFvg)} · bekannt ${time(x.entryFvg.recognizedAt)}.`:null,
   x.entryCandidate?`Kandidat ${price(x.entryCandidate.entryPrice)} um ${time(x.entryCandidate.entryTime)}; ohne belegten SL kein Entry.`:null].filter(Boolean)};
}

// Route b: rejected aus dem 50-%-Gate oder M1-OB-Bruch = „ja“; entry oder ein SL-unknown = „nein“; sonst Grund zeigen.
function bCheckNode(b){
 const node=(status,sub)=>({label:'Route b: M1-OB der FVG nach voller Füllung >50 % durchstochen?',status,sub,
  detail:[b?`Route b: ${b.status}${b.reason?' · '+reasonText(b.reason):''}${b.knownAt!=null?' · ab '+time(b.knownAt):''}.`:'Erst mit Reaktion true.',
   b?.entryFvg?`Aktuelle Entry-b-FVG: ${range(b.entryFvg)} · bekannt ${time(b.entryFvg.recognizedAt)}.`:'Quelle: erste Reaktions-FVG.',
   ...attemptHistory(b).map(h=>`${time(h.at)} · ${h.text}`),
   'Die 50 % betreffen den M1-OB der jeweiligen Entry-FVG nach ihrer vollen Füllung, nicht den M5-Retest.']});
 if(b?.status==='skipped')return {...node('not-visited',SKIPPED_ENTRY_TEXT),detail:[SKIPPED_ENTRY_TEXT]};
 if(!b)return node('not-visited','○ nicht besucht');
 if(b.status==='rejected')return node('rejected',['entryBOrderBlockTooDeep','entryBOrderBlockBroken'].includes(b.reason)?`ja · ${reasonText(b.reason)}`:reasonText(b.reason));
 if(b.status==='entry'||b.status==='unknown'&&STOP_BRANCH[b.reason])return node('visited','nein');
 return node('unknown',b.status==='pending'?'◇ offen':`unknown · ${reasonText(b.reason)}`);
}

// Rollen-Weiche für Graph und Sprungziele: OB1 eines DOB endet im Hold-Gate (nur dort zählen Paar und Partner),
// OB2 bzw. Einzel-OB in SL und Entry-Routen (Routen-Knoten erst mit Reaktion true, Ausgabe zeigt alle Produktrouten).
function roleView({entry,pair=null,partner=null}){
 const r=entry.reaction,first=(entry.role??'second')==='first',live=structuralState(r)==='true';
 return {first,live,routes:live&&!first?r.routes:{},resultRoutes:first?{}:r?.routes??{},pair:first?pair:null,partner:first?partner:null};
}

export function obReactionGraph({dir,entry,context,evaluatedAt,nearTouch=false,bridgeClosures=false,...links}){
 const {orderBlock:ob,reaction:r}=entry,adj=adjective(dir),{first,live,routes,pair,partner}=roleView({entry,...links});
 const contact=r?.contact,fvg=r?.fvg,rejected=structuralState(r)==='false',closed=r?.reason==='marketClosed',open=s=>s?'unknown':'not-visited';
 const n={};
 n.detect={label:`${dir===1?'Bullische':'Bärische'} M5-OB erkannt`,status:ob?'visited':'unknown',sub:ob?`${range(ob)} · ${time(ob.recognizedAt)}`:'noch nicht bekannt',
  detail:[ob?`M5-OB ${range(ob)}, bekannt ${time(ob.recognizedAt)}.`:'Die M5-OB ist zu diesem Stand noch nicht bekannt.']};
 n.touch={label:nearTouch?'Exakt oder Near ≤10 % vor dem nächsten Marktschluss?':`Touch (≤ ${TOUCH_PCT} der OB-Höhe) vor dem nächsten Marktschluss?`,
  status:contact?'visited':open(ob&&!rejected),
  sub:contact?`${contact.status==='nearTouch'?'Near-Touch':'Touch'} ${time(contact.candleTime)}`:closed?'nein · Markt geschlossen':ob&&!rejected?'◇ offen':'○ nicht besucht',
  detail:[contact?`${contact.status} mit der M1-Kerze ${time(contact.candleTime)}, bekannt ${time(contact.knownAt)}.`:'Noch kein Touch einer geschlossenen M1-Kerze.',
   nearTouch?'Near-Touch-Schalter an: ≤10 % der OB-Höhe vor der Kante zählt.':`Produkt-Default: Touch, auch bis ${TOUCH_PCT} der OB-Höhe vor der Kante.`]};
 n.closed={label:'Markt geschlossen, OB verfallen',status:closed?'rejected':'not-visited',sub:closed?'Reaktion false':'○ nicht besucht',
  detail:[bridgeClosures?'Schalter „Marktschluss überbrücken“ an: die Reaktion läuft über die XAU-Pause weiter, dieser Ausgang tritt nicht ein.'
   :'Ohne Überbrückung verfällt eine OB, die bis zum ersten XAU-Marktschluss nach ihrer Erkennung nicht reagiert hat (Entry-Machbarkeit false).']};
 n.broken={label:`Gegenkante auf M1 gebrochen (≤ ${TOUCH_PCT} der OB-Höhe), bevor eine neue ${adj} M1-FVG bekannt ist?`,
  status:rejected?'rejected':fvg?'visited':open(contact&&!closed),
  sub:rejected?`ja · ${time(r.knownAt)}`:fvg?'nein':contact&&!closed?'◇ offen':'○ nicht besucht',
  detail:[`Erreicht eine M1-Kerze die ferne M5-Kante bis auf ${TOUCH_PCT} der OB-Höhe, bevor eine neue gleichgerichtete M1-FVG bekannt ist, ist die Reaktion false.`,
   'Ein Bruch in derselben Kerze wie der erste Touch zählt ebenfalls als false.']};
 n.false={label:'Reaktion false',status:rejected?'rejected':'not-visited',sub:rejected?reasonText(r.reason):'○ nicht besucht',
  detail:[rejected?`M5-Gegenkante gebrochen, bekannt ${time(r.knownAt)}.`:'Kein Bruch vor der Reaktions-FVG.']};
 n.reaction={label:`Reaktion true (neue ${adj} M1-FVG)`,status:live?'visited':'not-visited',sub:live?`${range(fvg)} · ${time(fvg.recognizedAt)}`:'○ nicht besucht',
  detail:live?[`Reaktions-FVG ${range(fvg)}, bekannt ${time(fvg.recognizedAt)}.`,
   r.penetration?.status==='ready'?`Retest bis ${pct(r.penetration.maxPenetrationFraction*100)} in die M5-OB.`:null].filter(Boolean):['Noch keine Reaktions-FVG.']};
 // Das Produkt zählt ein gescheitertes Hold-Gate nur in stats, nicht je Paar: ohne Paar bleibt der Grund offen.
 const holdLive=first&&live,partnerLive=structuralState(partner?.reaction)==='true',noDob=holdLive&&!pair&&partnerLive;
 n.hold={label:'OB1: Retest-Extrem hält bis OB2-Reaktion?',status:!holdLive?'not-visited':pair?'visited':'unknown',
  sub:!holdLive?'○ nicht besucht':pair?`ja · ${pair.firstRetestHold.status}`:noDob?'kein DOB · Grund offen':'wartet auf OB2-Reaktion',
  detail:[pair?`DOB erkannt um ${time(pair.recognizedAt)}; Hold ${pair.firstRetestHold.status}.`
   :noDob?'OB2 hat reagiert, aber kein DOB: Hold gescheitert oder anderes Gate (Retest-Tag, Preislücke, kein Entry). Das Produkt nennt den Grund nicht je Paar.'
   :'Hold wird bis zur OB2-Reaktion gemessen.']};
 n.noDob={label:'kein DOB',status:open(noDob),sub:noDob?'◇ Grund offen':'○ nicht besucht',detail:n.hold.detail};
 const list=Object.values(routes),entries=list.filter(x=>x.status==='entry');
 const stopKey=list.map(x=>x.status==='entry'?x.stopAnchor:x.reason).find(k=>STOP_BRANCH[k]),slLive=live&&!first&&list.some(hasEntryCandidate);
 const chosen=entries[0],anchor=chosen?.stopAnchor;
 const branches=[`${anchor==='m5-edge'?'●':'○'} ja → ferne M5-Kante${anchor==='m5-edge'?' · '+price(chosen.stopLoss):''}`,
  `${anchor==='retestExtreme'?'●':'○'} nein → Retest-Extrem${anchor==='retestExtreme'?' · '+price(chosen.stopLoss):''}`];
 const decision=!slLive?'○ nicht besucht':chosen?`beim Entry eingefroren · ${time(chosen.entryTime)}`
  :stopKey?`SL unknown · ${STOP_BRANCH[stopKey]}`:'noch kein Entry-Zeitpunkt';
 n.stop={label:'Interne M1-FVG beim Entry noch offen?',status:!slLive?'not-visited':chosen?'visited':'unknown',
  sub:!slLive?decision:[...branches,decision].join('\n'),
  detail:['Entscheidung zum Entry-Zeitpunkt, nicht zum aktuellen Sliderstand: ja (offen und vollständig intern) → ferne M5-Kante; nein (keine offen) → Retest-Extrem. Nur teilweise überlappend oder Füllhistorie fehlt → unknown.',
   'Retest-Extrem: Short höchstes High, Long tiefstes Low von der Kontakt- bis einschließlich Entry-Kerze, ohne Puffer. Ast und Preis bleiben beim Entry eingefroren.',
   ...Object.entries(routes).map(([k,x])=>`Route ${k}: ${x.status==='entry'?'SL '+price(x.stopLoss)+' · '+(STOP_BRANCH[x.stopAnchor]??x.stopAnchor):x.status==='skipped'?SKIPPED_ENTRY_TEXT:reasonText(x.reason)}`)]};
 n.counter=opponentNode(r,dir,live&&!first);
 const a=routes.a,b=routes.b;
 n.routeA={label:'Entry-Kandidat a',...routeEntry(a,'Erst mit Reaktion true.')};
 n.bCheck=bCheckNode(b);
 n.entryB={label:'Entry-Kandidat b',...(b?.status==='skipped'||hasEntryCandidate(b)||n.bCheck.status==='visited'?routeEntry(b):routeEntry(null,b?'Route b hat das Entry-Gate nicht erreicht.':'Erst mit Reaktion true.'))};
 n.result=resultNode(r);
 Object.assign(n,sideTrack(dir,entry,context));

 const v=s=>s==='visited'||s==='rejected'?s:'not-visited';
 const candidateEdge=x=>!hasEntryCandidate(x)?'not-visited':x.status==='entry'?'visited':'unknown';
 const edges={detectTouch:ob?'visited':'unknown',touchClosed:closed?'unknown':'not-visited',touchBroken:contact?'visited':'not-visited',
  brokenFalse:v(n.false.status),brokenReaction:v(n.reaction.status),reactionOb1:holdLive?'visited':'not-visited',
  reactionCounter:live&&!first?'visited':'not-visited',counterA:live&&!first?'visited':'not-visited',holdNoDob:n.noDob.status,
  aB:b&&b.status!=='skipped'?n.bCheck.status:'not-visited',bCandidate:n.entryB.status,
  aStop:candidateEdge(a),bStop:candidateEdge(b),stopResult:!slLive?'not-visited':chosen?'visited':'unknown',
  bEndResult:b?.status==='rejected'?'rejected':b?.status==='unknown'&&!hasEntryCandidate(b)?'unknown':'not-visited',
  closedResult:closed?'rejected':'not-visited',falseResult:v(n.false.status),side:'info'};
 const head=`Intern: ${structuralState(r)}${r?.reason?` (${reasonText(r.reason)})`:''} · Routen: ${
  first?'– (OB1)':r?.routes?Object.entries(r.routes).map(([k,x])=>`${k} ${x.status==='skipped'?SKIPPED_ENTRY_TEXT:x.status}`).join(', '):'–'}`;
 const text=!ob?'M5-OB noch nicht bekannt.':!r||r.reason==='noContact'?'M5-OB bekannt; noch kein Retest.'
  :live?`Reaktion bestätigt um ${time(r.knownAt)}; ${first?'OB1 geht in das Hold-Gate.':'Entry a beendet die Auswertung; andernfalls wird b geprüft.'}`
  :rejected?`Reaktion false um ${time(r.knownAt)}: ${reasonText(r.reason)}.`:`Reaktion unknown: ${reasonText(r.reason)}.`;
 // Kopfzeile: welcher Aufruf mit welchem OB; Uhrzeit = OB-Kerze, Preise erst, wenn die OB bekannt ist.
 const start=entry.startTime??ob?.startTime;
 const title=['evaluateOrderBlockReaction()',dir===1?'Long':'Short',`M5-OB${start!=null?' '+time(start):''}`,ob&&range(ob)].filter(Boolean).join(' · ');
 return {title,head,text,nodes:n,edges,history:history(ob,r,routes,evaluatedAt)};
}

// Versuche bleiben getrennte Ereignisse; ein späterer Entry überschreibt die frühere Ablehnung nicht.
function attemptHistory(route){
 if(route?.status==='skipped')return [];
 return (route?.attempts??[]).flatMap((attempt,i)=>{
  const result=[{at:attempt.fvg.recognizedAt,text:`Route b Versuch ${i+1} FVG bekannt · ${range(attempt.fvg)}`}];
  const at=attempt.entryTime??attempt.knownAt;
  if(at!=null)result.push({at,text:`Route b Versuch ${i+1} ${attempt.status}${attempt.reason?' · '+reasonText(attempt.reason):''}`});
  return result;
 });
}

// Damalige Beurteilungen aus den knownAt-Zeitpunkten des aktuellen Ergebnisses; das Produkt ist zeitpunkttreu.
function history(ob,r,routes,evaluatedAt){
 if(!ob)return [];
 const list=[{at:ob.recognizedAt,text:'M5-OB bekannt · Reaktion unknown'}];
 if(r?.contact)list.push({at:r.contact.knownAt,text:`${r.contact.status} · Reaktion unknown`});
 if(r?.verdict?.knownAt!=null)list.push({at:r.verdict.knownAt,text:`Urteil ${r.verdict.state}${r.verdict.reason?' · '+reasonText(r.verdict.reason):''}`});
 if(r?.knownAt!=null)list.push({at:r.knownAt,text:`Struktur ${structuralState(r)}${r.reason?' · '+reasonText(r.reason):''}`});
 for(const [name,x] of Object.entries(routes)){
  if(x.status==='skipped')continue;
  if(name==='b'&&x.attempts?.length){list.push(...attemptHistory(x));continue;}
  const at=x.status==='entry'?x.entryTime:x.knownAt;
  if(at!=null)list.push({at,text:`Route ${name} ${x.status}${x.reason?' · '+reasonText(x.reason):''}`});
 }
 return list.filter(h=>h.at<=evaluatedAt).sort((a,b)=>a.at-b.at).map(h=>({...h,time:time(h.at)}));
}

// Sprungziele für „vorige/nächste Änderung“: alle Zeitpunkte, an denen sich der Plan ändert, aus den knownAt-Zeiten
// des Endergebnisses. Das Produkt ist zeitpunkttreu, darum gelten sie auch für frühere Slider-Stände.
export function graphChangeTimes({entry,context,...links}){
 const {orderBlock:ob,reaction:r}=entry,{resultRoutes,pair,partner}=roleView({entry,...links});
 if(!ob)return [];
 // Hold-Knoten zeigt Paar/Partner erst ab der eigenen Reaktion true; vorher wäre der Sprung leer.
 const holdFrom=structuralState(r)==='true'?r.knownAt:Infinity,fromHold=t=>t>=holdFrom?t:null;
 const times=[ob.recognizedAt,r?.contact?.knownAt,r?.knownAt,r?.verdict?.knownAt,fromHold(pair?.recognizedAt),fromHold(partner?.reaction?.knownAt)];
 for(const x of Object.values(resultRoutes).filter(x=>x.status!=='skipped'))times.push(x.status==='entry'?x.entryTime:x.knownAt);
 times.push(...attemptHistory(resultRoutes.b).map(h=>h.at));
 // Ohne Entry a fällt das sichtbare Paar bei einer b-Ablehnung weg und kehrt mit einem neuen Versuch zurück.
 if(partner?.reaction?.routes?.a?.status!=='entry'){
  const attempts=partner?.reaction?.routes?.b?.attempts??[];
  attempts.forEach((attempt,i)=>{if(attempt.status==='rejected')times.push(fromHold(attempt.knownAt),fromHold(attempts[i+1]?.fvg.recognizedAt));});
 }

 for(const {fvg} of entry.role==='first'?[]:r?.opponentFvgs??[])
  times.push(...fillChangeTimes(context,fvg).filter(t=>t>r.knownAt&&internalFvgOpenAt(context,fvg,t)!==internalFvgOpenAt(context,fvg,t-60)));
 const fvgs=(entry.internalFvgs??[]).filter(f=>f!==r?.fvg);
 fvgs.forEach((f,i)=>{
  // Die Seitenspur zeigt nur den M1-OB der jeweils jüngsten internen FVG, also nur in deren Zeitfenster.
  const until=fvgs[i+1]?.recognizedAt??Infinity;
  times.push(f.recognizedAt,...fillChangeTimes(context,f),...orderBlockChangeTimes(context,f.orderBlock).filter(t=>t<until));
 });
 // Vor dem Bekanntwerden der OB zeigt der Plan nur „noch nicht bekannt“; frühere Zeiten wären leere Sprünge.
 return [...new Set(times.filter(t=>Number.isFinite(t)&&t>=ob.recognizedAt))].sort((a,b)=>a-b);
}

// Seitenspur wechselt bei erster Berührung (Label „berührt“) und beim Ende von „offen“ (gefüllt oder unbekannt).
function fillChangeTimes(context,fvg){
 const touch=rowsFrom(context,fvg.recognizedAt).find(c=>orderBlockPenetration(fvg,fvg.direction,c)>0);
 const times=[touch&&touch.time+60];
 // offen → nicht offen ist monoton: Binärsuche über Minuten auf der einmal berechneten Produkt-Füllhistorie.
 return [...times,fvgFillChangeAt(context,fvg)];
}

// Derselbe belegte Zustandswechsel begrenzt die Chartbox; ein erster Touch ist kein Füllende.
export function fvgFillChangeAt(context,fvg){
 let lo=fvg.recognizedAt,hi=Math.floor(context.evaluatedAt/60)*60;
 if(internalFvgOpenAt(context,fvg,hi)===true)return null;
 while(hi-lo>60){const mid=lo+Math.floor((hi-lo)/120)*60;if(internalFvgOpenAt(context,fvg,mid)===true)lo=mid;else hi=mid;}
 return hi;
}

// Interner M1-OB: Label wechselt bei erster Berührung und beim Bruch (gehalten → gebrochen).
function orderBlockChangeTimes(context,ob){
 if(!ob)return [];
 const rows=rowsFrom(context,ob.recognizedAt),dir=ob.dir===1?'long':'short';
 const touch=rows.find(c=>orderBlockPenetration(ob,dir,c)>=0),broken=rows.find(c=>candleInvalidatesOrderBlock(c,ob));
 return [touch&&touch.time+60,broken&&broken.time+60];
}
