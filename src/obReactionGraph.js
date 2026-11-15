import {measureOrderBlockPenetration} from './orderBlockPenetration.js';
import {candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {internalFvgOpenAt,firstIndex} from './orderBlockReaction.js';
import {formatBerlinTime} from './berlinTime.js';
import {fmtPrice} from './format.js';

// Knotenplan der OB-Reaktion im Chart-Debugger: Knoten = v7-Entscheidungsbaum (Default W1), Zustände nur aus dem
// Produktergebnis (evaluateCase → evaluateOrderBlockReaction/detectDoubleOrderBlocks) zum Slider-Stand.
export const REASON_TEXT={
 noContact:'noch kein Retest',awaitingFvg:'Retest da, noch keine neue FVG',marketClosed:'Markt geschlossen, OB verfallen',
 missingHistory:'M1-Historie lückenhaft',m5OrderBlockBroken:'M5-Gegenkante gebrochen',invalidOrderBlock:'OB ungültig',
 reactionFalse:'Reaktion false',entryUnavailable:'kein Entry aus der FVG',entryBPending:'wartet auf Entry-b-Bestätigung',
 entryBUnknown:'Entry b unbekannt',entryBOrderBlockBroken:'M1-OB der FVG gebrochen',entryBOrderBlockTooDeep:'M1-OB über 50 % eingestochen',
 partialOverlapOpen:'interne FVG nur teilweise in der OB',
 internalFvgHistoryMissing:'Füllhistorie interner FVG fehlt',stopNotBeyondEntry:'SL liegt nicht hinter dem Entry',
};
export const reasonText=reason=>REASON_TEXT[reason]??reason;

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
// fvg-Objekte entstehen je evaluateCase neu, darum ist der Cache je FVG zeitpunkttreu.
const fillMeters=new WeakMap();
export function fvgFillMeter(context,fvg){
 if(fillMeters.has(fvg))return fillMeters.get(fvg);
 const open=internalFvgOpenAt(context,fvg,context.evaluatedAt);
 let meter;
 if(open===null)meter=UNKNOWN_METER('Füllstand unbekannt');
 else if(!open)meter=meterOf(100,['gefüllt','offen'],'gefüllt');
 else{
  const m=measureOrderBlockPenetration(fvg,fvg.direction,rowsFrom(context,fvg.recognizedAt));
  const depth=m.status==='ready'?Math.max(0,Math.min(100,m.maxPenetrationFraction*100)):0;
  meter=meterOf(depth,['gefüllt','offen'],`${depth>0?'berührt':'unberührt'} · ${pct(100-depth)} offen`);
 }
 fillMeters.set(fvg,meter);
 return meter;
}

function orderBlockMeter(context,ob,dir){
 const rows=rowsFrom(context,ob.recognizedAt),m=measureOrderBlockPenetration(ob,dir===1?'long':'short',rows);
 if(m.status!=='ready')return {...UNKNOWN_METER('Messung unbekannt'),state:'Messung unbekannt'};
 if(m.maxPenetrationFraction<0)return {...UNKNOWN_METER('Messung unbekannt'),state:'noch nicht berührt'};
 const depth=Math.min(100,m.maxPenetrationFraction*100),broken=rows.some(c=>candleInvalidatesOrderBlock(c,ob));
 return {...meterOf(100-depth,['intakt','eingestochen'],`OB intakt ${pct(100-depth)} · Einstich ${pct(depth)}${broken?' · gebrochen':''}`,!broken),
  state:broken?'gebrochen':'gehalten'};
}

// Seitenspur: Zusatzinfos ohne Gate-Wirkung (interne FVGs mit Füllgrad, M1-OB der jüngsten internen FVG).
function sideTrack(dir,entry,context){
 const r=entry.reaction,fvgs=(entry.internalFvgs??[]).filter(f=>f!==r?.fvg),ob=fvgs.at(-1)?.orderBlock;
 const meters=fvgs.map(f=>({...fvgFillMeter(context,f),range:range(f)}));
 const fvgList={label:`Interne ${adjective(dir)} M1-FVGs`,info:true,status:fvgs.length?'visited':'info',
  sub:fvgs.length?`${fvgs.length} in der M5-OB`:'keine bekannt',meters,
  detail:fvgs.length?[...fvgs.map((f,i)=>`${range(f)} · bekannt ${time(f.recognizedAt)} · ${meters[i].label}`),
   'Für den SL zählen nur vor dem Retest bekannte; offen und komplett in der OB → ferne M5-Kante.']
   :['Keine interne gleichgerichtete M1-FVG in der M5-OB bekannt.']};
 const meter=ob&&orderBlockMeter(context,ob,dir);
 const internalOb={label:`Interner ${dir===1?'bullischer':'bärischer'} M1-OB`,info:true,status:ob?'visited':'info',
  sub:ob?`${range(ob)}\n${meter.state}`:'kein Beleg',meters:ob?[meter]:[],
  detail:ob?[`M1-OB der jüngsten internen FVG, ${range(ob)}.`,meter.label,'Zusatzbeleg, kein Gate in v7.']
   :['Kein interner M1-OB zugeordnet. Der M1-OB der Reaktions-FVG gehört zu Route b.']};
 return {fvgList,internalOb};
}

// Kein eigenes Gesamturteil: Kopf und Ausgabe zeigen nur Reaktionsstatus und Routenstatus des Produkts.
const routeText=(name,x)=>`${name}: ${x.status}${x.status==='entry'?` ${price(x.entryPrice)} · ${time(x.entryTime)} · SL ${price(x.stopLoss)}`:x.reason?' · '+reasonText(x.reason):''}`;
function resultNode(r,first){
 const routes=Object.entries(r?.routes??{});
 if(first)return {label:'Ausgabe',status:'not-visited',sub:'OB1 trägt keinen Entry',detail:['Entry-Routen gehören zu OB2.']};
 if(!routes.length)return {label:'Ausgabe',status:'unknown',sub:`Reaktion ${r?.state??'unknown'}${r?.reason?'\n'+reasonText(r.reason):''}`,
  detail:['Noch keine Entry-Routen: das Produkt bewertet sie erst mit dem Reaktionsergebnis.']};
 const status=routes.some(([,x])=>x.status==='entry')?'visited':routes.every(([,x])=>x.status==='rejected')?'rejected':'unknown';
 return {label:'Ausgabe',status,sub:routes.map(([k,x])=>routeText(k,x)).join('\n'),detail:routes.map(([k,x])=>'Route '+routeText(k,x))};
}

function routeEntry(x,unvisited){
 if(!x)return {status:'not-visited',sub:'○ nicht besucht',detail:[unvisited]};
 return {status:ROUTE_STATUS[x.status],sub:x.status==='entry'?`${price(x.entryPrice)} · ${time(x.entryTime)}`:`${x.status} · ${reasonText(x.reason)}`,
  detail:[x.status==='entry'?`Entry ${price(x.entryPrice)} um ${time(x.entryTime)}, SL ${price(x.stopLoss)}.`:`${x.status}: ${reasonText(x.reason)}.`,
   x.entryCandidate?`Kandidat ${price(x.entryCandidate.entryPrice)} um ${time(x.entryCandidate.entryTime)}; ohne belegten SL kein Entry.`:null].filter(Boolean)};
}

// Route b: rejected aus dem 50-%-Gate oder M1-OB-Bruch = „ja“; entry oder ein SL-unknown = „nein“; sonst Grund zeigen.
function bCheckNode(b){
 const node=(status,sub)=>({label:'Route b: M1-OB der FVG nach voller Füllung >50 % durchstochen?',status,sub,
  detail:[b?`Route b: ${b.status}${b.reason?' · '+reasonText(b.reason):''}${b.knownAt!=null?' · ab '+time(b.knownAt):''}.`:'Erst mit Reaktion true.',
   'Die 50 % betreffen den M1-OB der Reaktions-FVG nach ihrer vollen Füllung, nicht den M5-Retest.']});
 if(!b)return node('not-visited','○ nicht besucht');
 if(b.status==='rejected')return node('rejected',['entryBOrderBlockTooDeep','entryBOrderBlockBroken'].includes(b.reason)?`ja · ${reasonText(b.reason)}`:reasonText(b.reason));
 if(b.status==='entry'||b.status==='unknown'&&STOP_BRANCH[b.reason])return node('visited','nein');
 return node('unknown',b.status==='pending'?'◇ offen':`unknown · ${reasonText(b.reason)}`);
}

// role/pair/partner: OB1 eines DOB endet im Hold-Gate, OB2 bzw. Einzel-OB in SL und Entry-Routen.
export function obReactionGraph({dir,entry,context,evaluatedAt,nearTouch=false,bridgeClosures=false,pair=null,partner=null}){
 const {orderBlock:ob,reaction:r,role='second'}=entry,adj=adjective(dir);
 const contact=r?.contact,fvg=r?.fvg,rejected=r?.state==='false',closed=r?.reason==='marketClosed',live=r?.state==='true';
 const first=role==='first',routes=live&&!first?r.routes:{},open=s=>s?'unknown':'not-visited';
 const n={};
 n.detect={label:`${dir===1?'Bullische':'Bärische'} M5-OB erkannt`,status:ob?'visited':'unknown',sub:ob?`${range(ob)} · ${time(ob.recognizedAt)}`:'noch nicht bekannt',
  detail:[ob?`M5-OB ${range(ob)}, bekannt ${time(ob.recognizedAt)}.`:'Die M5-OB ist zu diesem Stand noch nicht bekannt.']};
 // marketClosed ist im Produkt unknown, kein false: der Pfad bleibt ◇ statt ×.
 n.touch={label:nearTouch?'Exakt oder Near ≤10 % vor dem nächsten Marktschluss?':'Exakter Touch vor dem nächsten Marktschluss?',
  status:contact?'visited':open(ob&&!rejected),
  sub:contact?`${contact.status==='nearTouch'?'Near-Touch':'Touch'} ${time(contact.candleTime)}`:closed?'nein · Markt geschlossen':ob&&!rejected?'◇ offen':'○ nicht besucht',
  detail:[contact?`${contact.status} mit der M1-Kerze ${time(contact.candleTime)}, bekannt ${time(contact.knownAt)}.`:'Noch kein Touch einer geschlossenen M1-Kerze.',
   nearTouch?'Near-Touch-Schalter an: ≤10 % der OB-Höhe vor der Kante zählt.':'Produkt-Default W1: nur exakter Touch.']};
 n.closed={label:'Markt geschlossen, OB verfallen',status:open(closed),sub:closed?'Reaktion unknown':'○ nicht besucht',
  detail:[bridgeClosures?'Schalter „Marktschluss überbrücken“ an: die Reaktion läuft über die XAU-Pause weiter, dieser Ausgang tritt nicht ein.'
   :'Ohne Überbrückung verfällt eine OB, die bis zum ersten XAU-Marktschluss nach ihrer Erkennung nicht reagiert hat (Reaktion unknown).']};
 n.broken={label:`Gegenkante auf M1 gebrochen, bevor eine neue ${adj} M1-FVG bekannt ist?`,
  status:rejected?'rejected':fvg?'visited':open(contact&&!closed),
  sub:rejected?`ja · ${time(r.knownAt)}`:fvg?'nein':contact&&!closed?'◇ offen':'○ nicht besucht',
  detail:['Bricht eine M1-Kerze die ferne M5-Kante, bevor eine neue gleichgerichtete M1-FVG bekannt ist, ist die Reaktion false.',
   'Ein Bruch in derselben Kerze wie der erste Touch zählt ebenfalls als false.']};
 n.false={label:'Reaktion false',status:rejected?'rejected':'not-visited',sub:rejected?reasonText(r.reason):'○ nicht besucht',
  detail:[rejected?`M5-Gegenkante gebrochen, bekannt ${time(r.knownAt)}.`:'Kein Bruch vor der Reaktions-FVG.']};
 n.reaction={label:`Reaktion true (neue ${adj} M1-FVG)`,status:live?'visited':'not-visited',sub:live?`${range(fvg)} · ${time(fvg.recognizedAt)}`:'○ nicht besucht',
  detail:live?[`Reaktions-FVG ${range(fvg)}, bekannt ${time(fvg.recognizedAt)}.`,
   r.penetration?.status==='ready'?`Retest bis ${pct(r.penetration.maxPenetrationFraction*100)} in die M5-OB.`:null].filter(Boolean):['Noch keine Reaktions-FVG.']};
 // Das Produkt zählt ein gescheitertes Hold-Gate nur in stats, nicht je Paar: ohne Paar bleibt der Grund offen.
 const holdLive=first&&live,partnerLive=partner?.reaction?.state==='true',noDob=holdLive&&!pair&&partnerLive;
 n.hold={label:'OB1: Retest-Extrem hält bis OB2-Reaktion?',status:!holdLive?'not-visited':pair?'visited':'unknown',
  sub:!holdLive?'○ nicht besucht':pair?`ja · ${pair.firstRetestHold.status}`:noDob?'kein DOB · Grund offen':'wartet auf OB2-Reaktion',
  detail:[pair?`DOB erkannt um ${time(pair.recognizedAt)}; Hold ${pair.firstRetestHold.status}.`
   :noDob?'OB2 hat reagiert, aber kein DOB: Hold gescheitert oder anderes Gate (Retest-Tag, Preislücke, kein Entry). Das Produkt nennt den Grund nicht je Paar.'
   :'Hold wird bis zur OB2-Reaktion gemessen.']};
 n.noDob={label:'kein DOB',status:open(noDob),sub:noDob?'◇ Grund offen':'○ nicht besucht',detail:n.hold.detail};
 const list=Object.values(routes),entries=list.filter(x=>x.status==='entry');
 const stopKey=list.map(x=>x.status==='entry'?x.stopAnchor:x.reason).find(k=>STOP_BRANCH[k]),slLive=live&&!first;
 n.stop={label:'OB2: SL beim Entry',status:!slLive?'not-visited':entries.length?'visited':'unknown',
  sub:!slLive?'○ nicht besucht':entries.length?`${price(entries[0].stopLoss)}\n${STOP_BRANCH[entries[0].stopAnchor]??entries[0].stopAnchor}`
   :stopKey?`SL unknown\n${STOP_BRANCH[stopKey]}`:'noch kein Entry-Zeitpunkt',
  detail:['Interne FVG offen und komplett in der OB → ferne M5-Kante; nur teilweise überlappend → unknown; keine offen → Retest-Extrem: Short höchstes High, Long tiefstes Low von der Kontakt- bis einschließlich Entry-Kerze, ohne Puffer.',
   ...Object.entries(routes).map(([k,x])=>`Route ${k}: ${x.status==='entry'?'SL '+price(x.stopLoss)+' · '+(STOP_BRANCH[x.stopAnchor]??x.stopAnchor):reasonText(x.reason)}`)]};
 const a=routes.a,b=routes.b;
 n.routeA={label:'Route a: Entry bei FVG-Bestätigung',...routeEntry(a,'Erst mit Reaktion true.')};
 n.bCheck=bCheckNode(b);
 n.entryB={label:'Entry b',...(n.bCheck.status==='visited'?routeEntry(b):routeEntry(null,b?'Route b hat das Entry-Gate nicht erreicht.':'Erst mit Reaktion true.'))};
 n.result=resultNode(r,first);
 Object.assign(n,sideTrack(dir,entry,context));

 const v=s=>s==='visited'||s==='rejected'?s:'not-visited';
 const edges={detectTouch:ob?'visited':'unknown',touchClosed:closed?'unknown':'not-visited',touchBroken:contact?'visited':'not-visited',
  brokenFalse:v(n.false.status),brokenReaction:v(n.reaction.status),reactionOb1:holdLive?'visited':'not-visited',
  reactionOb2:slLive?'visited':'not-visited',holdNoDob:n.noDob.status,stopA:n.routeA.status,stopB:n.bCheck.status,
  bEntry:n.entryB.status,aResult:v(n.routeA.status),bResult:v(n.entryB.status),closedResult:closed?'unknown':'not-visited',
  falseResult:v(n.false.status),side:'info'};
 const head=`Intern: ${r?.state??'unknown'}${r?.reason?` (${reasonText(r.reason)})`:''} · Routen: ${
  first?'– (OB1)':r?.routes?Object.entries(r.routes).map(([k,x])=>`${k} ${x.status}`).join(', '):'–'}`;
 const text=!ob?'M5-OB noch nicht bekannt.':!r||r.reason==='noContact'?'M5-OB bekannt; noch kein Retest.'
  :live?`Reaktion bestätigt um ${time(r.knownAt)}; ${first?'OB1 geht in das Hold-Gate.':'Entry-Routen separat.'}`
  :rejected?`Reaktion false um ${time(r.knownAt)}: ${reasonText(r.reason)}.`:`Reaktion unknown: ${reasonText(r.reason)}.`;
 return {head,text,nodes:n,edges,history:history(ob,r,routes,evaluatedAt)};
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
