import {measureOrderBlockPenetration} from './orderBlockPenetration.js';
import {candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {formatBerlinTime} from './berlinTime.js';
import {fmtPrice} from './format.js';

// Knotenplan des OB-Reaktions-Debuggers: leitet jeden Knotenzustand nur aus dem v7-Produktergebnis
// (evaluateCase → evaluateOrderBlockReaction) zum Slider-Stand ab; die Komponente rendert nur.
export const REASON_TEXT={
 noContact:'noch kein Retest',awaitingFvg:'Retest da, noch keine neue FVG',marketClosed:'Markt geschlossen, OB verfallen',
 missingHistory:'M1-Historie lückenhaft',m5OrderBlockBroken:'M5-Gegenkante gebrochen',invalidOrderBlock:'OB ungültig',
 entryUnavailable:'kein Entry aus der FVG',entryBPending:'wartet auf Entry-b-Bestätigung',entryBUnknown:'Entry b unbekannt',
 entryBOrderBlockBroken:'M1-OB der FVG gebrochen',entryBOrderBlockTooDeep:'M1-OB über 50 % eingestochen',
 retestEpisodeUnresolved:'Retest-Extrem-SL nicht spezifiziert',partialOverlapOpen:'interne FVG nur teilweise im OB',
 internalFvgHistoryMissing:'Füllhistorie interner FVG fehlt',stopNotBeyondEntry:'SL liegt nicht hinter dem Entry',
};
const STOP_REASONS=new Set(['retestEpisodeUnresolved','partialOverlapOpen','internalFvgHistoryMissing','stopNotBeyondEntry']);
export const reasonText=reason=>REASON_TEXT[reason]??reason;

const adjective=dir=>dir===1?'bullische':'bärische';
const price=p=>fmtPrice(p,2),time=t=>formatBerlinTime(t);
const range=z=>`${price(z.bottom)}–${price(z.top)}`;
const ROUTE_STATUS={entry:'visited',rejected:'rejected',unknown:'unknown',pending:'unknown'};

// Füllgrad bzw. Einstich über denselben Messhelfer wie die Reaktion; ohne Kerze seit Bekanntwerden ehrlich unbekannt.
function zoneMeter(zone,dir,m1,kind){
 const rows=m1.filter(c=>c.time>=zone.recognizedAt),m=measureOrderBlockPenetration(zone,dir===1?'long':'short',rows);
 if(m.status!=='ready')return {value:null,label:'Messung unbekannt',segments:[]};
 const depth=Math.max(0,Math.min(100,m.maxPenetrationFraction*100)),p=n=>Number(n.toFixed(2))+' %';
 const broken=kind==='ob'&&rows.some(c=>!c.ignored&&candleInvalidatesOrderBlock(c,zone));
 const [value,words,label]=kind==='fvg'?[depth,['gefüllt','offen'],`${p(100-depth)} offen · ${p(depth)} gefüllt`]
  :[100-depth,['intakt','eingestochen'],`OB intakt ${p(100-depth)} · Einstich ${p(depth)}${broken?' · gebrochen':''}`];
 return {value,label,broken,touched:m.maxPenetrationFraction>=0,depth,
  segments:[{value,word:words[0],positive:!broken},{value:100-value,word:words[1],positive:false}].filter(s=>s.value>0)};
}

function sideTrack(dir,entry,m1){
 const {reaction:r}=entry,cut=r?.contact?.candleTime;
 // Nur vor dem Retest bekannte interne FVGs zählen für den SL (evaluateReactionStop); die Reaktions-FVG ist keine davon.
 const fvgs=(entry.internalFvgs??[]).filter(f=>f!==r?.fvg&&(cut==null||f.recognizedAt<=cut)),fvg=fvgs.at(-1),ob=fvg?.orderBlock;
 const oldFvg={label:`Interne ${adjective(dir)} M1-FVG?`,info:true,status:fvg?'visited':'info',
  sub:fvg?range(fvg):'kein Beleg',meter:fvg?zoneMeter(fvg,dir,m1,'fvg'):null,
  detail:fvg?[`${fvgs.length} interne FVG bis zum Retest bekannt; gezeigt die jüngste, bekannt ${time(fvg.recognizedAt)}.`,
   'Offen und komplett im OB → SL an der M5-Kante; nur teilweise drin → SL unknown.']
   :['Keine interne gleichgerichtete M1-FVG im OB bekannt. Das ist kein false.']};
 const meter=ob?zoneMeter(ob,dir,m1,'ob'):null;
 const internalOb={label:`Interner ${dir===1?'bullischer':'bärischer'} M1-OB?`,info:true,status:ob?'visited':'info',
  sub:ob?`${range(ob)}\n${meter.value===null?'Messung unbekannt':!meter.touched?'noch nicht berührt':meter.broken?'gebrochen':'gehalten'}`:'kein Beleg',
  meter:ob?(meter.touched?meter:{value:null,label:'Messung unbekannt',segments:[]}):null,
  detail:ob?[`M1-OB der jüngsten internen FVG, ${range(ob)}.`,meter.label,'Zusatzbeleg, kein Gate in v7.']
   :['Kein interner M1-OB zugeordnet. Der M1-OB der Reaktions-FVG gehört zu Entry b.']};
 return {oldFvg,internalOb};
}

// Ausgabe = früheste Entry-Route; sonst der offene bzw. abgelehnte Zustand.
function output(r,routeMap){
 if(!r)return {status:'pending',route:null};
 if(r.state==='false')return {status:'rejected',route:null};
 if(r.reason==='marketClosed')return {status:'unknown',route:null};
 const routes=Object.entries(routeMap);
 const entry=routes.filter(([,x])=>x.status==='entry').sort(([,x],[,y])=>x.entryTime-y.entryTime)[0];
 if(entry)return {status:'entry',route:entry[0],...entry[1]};
 if(routes.length&&routes.every(([,x])=>x.status==='rejected'))return {status:'rejected',route:null};
 const open=routes.find(([,x])=>x.status==='unknown')??routes.find(([,x])=>x.status==='pending');
 return open?{status:open[1].status,route:open[0]}:{status:'pending',route:null};
}

function routeNode(name,route,live){
 const status=live?ROUTE_STATUS[route.status]:'not-visited';
 const sub=!live?'○ nicht besucht':route.status==='entry'?`${price(route.entryPrice)} · ${time(route.entryTime)}`
  :`${route.status} · ${reasonText(route.reason)}`;
 const detail=!live?['Route wird erst mit einer Reaktion true geprüft.']:[
  route.status==='entry'?`Entry ${price(route.entryPrice)} um ${time(route.entryTime)}, SL ${price(route.stopLoss)}.`
   :`${route.status}: ${reasonText(route.reason)}${route.knownAt!=null?' · ab '+time(route.knownAt):''}.`,
  route.entryCandidate?`Kandidat ${price(route.entryCandidate.entryPrice)} um ${time(route.entryCandidate.entryTime)}; ohne belegten SL kein Entry.`:null,
  name==='a'?'Route a: Entry am Schluss der Reaktions-FVG.':'Route b: Retest der FVG; nach Vollfüllung darf ihr M1-OB höchstens 50 % eingestochen werden.',
 ].filter(Boolean);
 return {label:`Entry ${name}`,status,sub,detail};
}

export function obReactionGraph({dir,entry,m1,evaluatedAt}){
 const {orderBlock:ob,reaction:r}=entry,adj=adjective(dir),enemy=adjective(-dir);
 const contact=r?.contact,fvg=r?.fvg,rejected=r?.state==='false',closed=r?.reason==='marketClosed',live=r?.state==='true';
 // OB1 eines DOB trägt keinen Entry (pairEntries nimmt nur OB2), also auch keine Routen im Plan.
 const routes=live&&entry.role!=='first'?r.routes:{},out=output(r,routes);
 const nodes={
  start:{label:`${dir===1?'Long':'Short'} prüfen`,status:'visited',sub:'● durchlaufen',
   detail:[ob?`M5-OB ${range(ob)}, bekannt ${time(ob.recognizedAt)}.`:'M5-OB noch nicht bekannt.']},
  touch:{label:`${dir===1?'Bullischer':'Bärischer'} M5-OB-${contact?.status==='nearTouch'?'Near-Touch':'Touch'}`,
   status:contact?'visited':rejected?'rejected':closed?'not-visited':'unknown',
   sub:contact?`Kerze ${time(contact.candleTime)}`:!ob?'OB noch nicht bekannt':rejected?'gebrochen ohne Touch':'◇ offen / unbekannt',
   detail:[contact?`${contact.status} mit der M1-Kerze ${time(contact.candleTime)}, bekannt ${time(contact.knownAt)}.`:'Noch kein (Near-)Touch einer geschlossenen M1-Kerze.',
    'Near-Touch zählt nur mit eingeschaltetem Schalter (Produkt-Default W1: nur exakter Touch).']},
  fvg:{label:`Neue ${adj} M1-FVG?`,status:fvg?'visited':rejected&&contact?'rejected':contact&&!closed&&!rejected?'unknown':'not-visited',
   sub:fvg?`bekannt ${time(fvg.recognizedAt)}`:contact&&!closed&&!rejected?'◇ offen / unbekannt':'○ nicht besucht',
   detail:['Erste gleichgerichtete M1-FVG nach dem Touch macht die Reaktion true; bricht vorher die M5-Gegenkante, false.']},
  wait:{label:`Noch keine neue ${adj} M1-FVG`,status:fvg?'alternative':contact&&r.state==='unknown'&&!closed?'unknown':'not-visited',
   sub:fvg?'überholt':r?.state==='unknown'&&contact&&!closed?'Reaktion unknown':'○ nicht besucht',
   detail:['Reaktion unknown: spätere Bestätigung nicht ausgeschlossen.']},
  reaction:{label:`${adj[0].toUpperCase()+adj.slice(1)} M1-FVG bekannt`,status:fvg?'visited':'not-visited',
   sub:fvg?range(fvg):'○ nicht besucht',
   detail:fvg?[`Reaktions-FVG ${range(fvg)}, bekannt ${time(fvg.recognizedAt)} → Reaktion true.`,
    r.penetration?.status==='ready'?`Retest bis ${Number((r.penetration.maxPenetrationFraction*100).toFixed(2))} % in den M5-OB.`:null].filter(Boolean):['Noch keine Reaktions-FVG.']},
  counter:{label:`☠️ ${enemy} M1-FVG im Weg?`,info:true,status:'info',sub:'nicht in v7 · kein Gate',
   detail:['v7 prüft keine gegnerische FVG zwischen Reaktion und Entry. Info-Knoten aus dem alten Prototyp, ohne Messung.']},
  entryA:routeNode('a',routes.a,live&&!!routes.a),
  entryB:routeNode('b',routes.b,live&&!!routes.b),
  closed:{label:'Markt geschlossen',status:closed?'rejected':'not-visited',sub:closed?'OB verfallen · unknown':'○ nicht besucht',
   detail:['Ohne bridgeClosures verfällt ein OB, der bis zum ersten XAU-Marktschluss nach seiner Erkennung nicht reagiert hat.']},
 };
 const entries=Object.values(routes).filter(x=>x.status==='entry'),stopUnknown=Object.values(routes).find(x=>x.status==='unknown'&&STOP_REASONS.has(x.reason));
 const noEntry=rejected||closed||out.status==='rejected';
 nodes.stop={label:'SL-Wahl',status:entries.length?'visited':noEntry?'not-visited':'unknown',
  sub:entries.length?`${price(entries[0].stopLoss)}\nM5-Kante`:stopUnknown?`SL unknown\n${reasonText(stopUnknown.reason)}`
   :noEntry?'kein Entry / kein SL':'SL pending / unknown',
  detail:['SL an der M5-Kante nur mit offener interner FVG komplett im OB; das Retest-Extrem ist in v7 nicht spezifiziert → unknown.',
   ...Object.entries(routes).map(([n,x])=>`Route ${n}: ${x.status==='entry'?'SL '+price(x.stopLoss)+' ('+x.stopAnchor+')':reasonText(x.reason)}`)]};
 nodes.result={label:out.status==='entry'?'Entry':out.status,
  status:out.status==='entry'?'visited':out.status==='rejected'?'rejected':'unknown',
  sub:out.status==='entry'?`Preis ${price(out.entryPrice)}\nZeit ${time(out.entryTime)}\nSL ${price(out.stopLoss)}`
   :closed?'OB verfallen':rejected?'Reaktion false':out.route?`Route ${out.route} · ${out.status}`:'warte · noch kein Tupel',
  detail:[`Reaktion ${r?.state??'–'}${r?.reason?' · '+reasonText(r.reason):''}.`,'Kein Trade-Outcome, kein Target: nur Reaktion und Entry-Routen.']};
 Object.assign(nodes,sideTrack(dir,entry,m1));

 const e=s=>s==='visited'||s==='rejected'?s:'not-visited';
 const edges={
  startTouch:contact?'visited':'unknown',touchFvg:contact?'visited':'not-visited',fvgWait:nodes.wait.status,
  fvgReaction:e(nodes.reaction.status),reactionCounter:'info',touchOld:'info',oldInner:'info',
  reactionA:nodes.entryA.status,reactionB:nodes.entryB.status,
  aStop:e(nodes.entryA.status==='visited'?'visited':''),bStop:e(nodes.entryB.status==='visited'?'visited':''),
  stopResult:e(nodes.stop.status),bReject:nodes.entryB.status==='rejected'?'rejected':'not-visited',
  touchReject:rejected?'rejected':'not-visited',waitClosed:closed?'rejected':'not-visited',closedResult:closed?'rejected':'not-visited',
 };
 const head=`Intern: ${r?.state??'unknown'} · Ausgabe: ${out.status}${out.route?` (Route ${out.route})`:''}`;
 const text=!ob?'M5-OB noch nicht bekannt.':!r||r.reason==='noContact'?'M5-OB bekannt; noch kein Retest.'
  :live?`Reaktion bestätigt um ${time(r.knownAt)}; Entry-Routen separat.`:rejected?`Reaktion false um ${time(r.knownAt)}: ${reasonText(r.reason)}.`
  :`Reaktion unknown: ${reasonText(r.reason)}.`;
 return {head,text,nodes,edges,history:history(ob,r,routes,evaluatedAt)};
}

// Damalige Beurteilungen aus den knownAt-Zeitpunkten des aktuellen Ergebnisses; das Produkt ist zeitpunkttreu.
function history(ob,r,routes,evaluatedAt){
 if(!ob)return [];
 const list=[{at:ob.recognizedAt,text:'M5-OB bekannt · Reaktion unknown'}];
 if(r?.contact)list.push({at:r.contact.knownAt,text:`${r.contact.status} · Reaktion unknown`});
 if(r?.knownAt!=null)list.push({at:r.knownAt,text:`Reaktion ${r.state}${r.reason?' · '+reasonText(r.reason):''}`});
 for(const [name,x] of Object.entries(routes)){
  const at=x.status==='entry'?x.entryTime:x.knownAt;
  if(at!=null)list.push({at,text:`Route ${name} ${x.status}${x.reason?' · '+reasonText(x.reason):''}`});
 }
 return list.filter(h=>h.at<=evaluatedAt).sort((a,b)=>a.at-b.at).map(h=>({...h,time:time(h.at)}));
}
