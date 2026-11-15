import {measureOrderBlockPenetration} from './orderBlockPenetration.js';
import {candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {m1FvgFullyFilled} from './m1FvgEntrySequence.js';
import {formatBerlinTime} from './berlinTime.js';
import {fmtPrice} from './format.js';

// Knotenplan des OB-Reaktions-Debuggers: Knoten = v7-Entscheidungsbaum (Default W1), Zustände nur aus dem
// Produktergebnis (evaluateCase → evaluateOrderBlockReaction/detectDoubleOrderBlocks) zum Slider-Stand.
export const REASON_TEXT={
 noContact:'noch kein Retest',awaitingFvg:'Retest da, noch keine neue FVG',marketClosed:'Markt geschlossen, OB verfallen',
 missingHistory:'M1-Historie lückenhaft',m5OrderBlockBroken:'M5-Gegenkante gebrochen',invalidOrderBlock:'OB ungültig',
 entryUnavailable:'kein Entry aus der FVG',entryBPending:'wartet auf Entry-b-Bestätigung',entryBUnknown:'Entry b unbekannt',
 entryBOrderBlockBroken:'M1-OB der FVG gebrochen',entryBOrderBlockTooDeep:'M1-OB über 50 % eingestochen',
 retestEpisodeUnresolved:'Retest-Extrem-SL nicht spezifiziert',partialOverlapOpen:'interne FVG nur teilweise in der OB',
 internalFvgHistoryMissing:'Füllhistorie interner FVG fehlt',stopNotBeyondEntry:'SL liegt nicht hinter dem Entry',
};
export const reasonText=reason=>REASON_TEXT[reason]??reason;

const adjective=dir=>dir===1?'bullische':'bärische';
const price=p=>fmtPrice(p,2),time=t=>formatBerlinTime(t);
const range=z=>`${price(z.bottom)}–${price(z.top)}`;
const ROUTE_STATUS={entry:'visited',rejected:'rejected',unknown:'unknown',pending:'unknown'};
const STOP_BRANCH={'m5-edge':'interne FVG offen → ferne M5-Kante',retestExtreme:'keine offen → Retest-Extrem',
 partialOverlapOpen:'nur teilweise überlappend → unknown',retestEpisodeUnresolved:'keine offen → Retest-Extrem (T6) → unknown',
 internalFvgHistoryMissing:'Füllhistorie fehlt → unknown',stopNotBeyondEntry:'SL nicht hinter dem Entry → unknown'};

// Füllgrad bzw. Einstich über denselben Messhelfer wie die Reaktion; ohne Kerze seit Bekanntwerden ehrlich unbekannt.
export const fvgFillMeter=(fvg,m1)=>zoneMeter(fvg,fvg.direction==='long'?1:-1,m1,'fvg');
function zoneMeter(zone,dir,m1,kind){
 const rows=m1.filter(c=>c.time>=zone.recognizedAt),m=measureOrderBlockPenetration(zone,dir===1?'long':'short',rows);
 if(m.status!=='ready')return {value:null,label:'Messung unbekannt',segments:[]};
 // Vollfüllung wie fvgFill im Produkt über m1FvgFullyFilled (mit Rundungstoleranz), nicht erst bei 100 % Einstich.
 const full=kind==='fvg'&&rows.some(c=>!c.ignored&&m1FvgFullyFilled(c,zone));
 const depth=full?100:Math.max(0,Math.min(100,m.maxPenetrationFraction*100)),p=n=>Number(n.toFixed(2))+' %';
 const broken=kind==='ob'&&rows.some(c=>!c.ignored&&candleInvalidatesOrderBlock(c,zone));
 const [value,words,label]=kind==='fvg'?[depth,['gefüllt','offen'],full?'gefüllt':`${m.maxPenetrationFraction>=0?'berührt':'unberührt'} · ${p(100-depth)} offen`]
  :[100-depth,['intakt','eingestochen'],`OB intakt ${p(100-depth)} · Einstich ${p(depth)}${broken?' · gebrochen':''}`];
 return {value,label,broken,touched:m.maxPenetrationFraction>=0,depth,
  segments:[{value,word:words[0],positive:!broken},{value:100-value,word:words[1],positive:false}].filter(s=>s.value>0)};
}

// Seitenspur: Zusatzinfos ohne Gate-Wirkung (interne FVGs mit Füllgrad, M1-OB der jüngsten internen FVG).
function sideTrack(dir,entry,m1){
 const r=entry.reaction,fvgs=(entry.internalFvgs??[]).filter(f=>f!==r?.fvg),ob=fvgs.at(-1)?.orderBlock;
 const fvgList={label:`Interne ${adjective(dir)} M1-FVGs`,info:true,status:fvgs.length?'visited':'info',
  sub:fvgs.length?`${fvgs.length} in der M5-OB`:'keine bekannt',meters:fvgs.map(f=>({...zoneMeter(f,dir,m1,'fvg'),range:range(f)})),
  detail:fvgs.length?[...fvgs.map(f=>`${range(f)} · bekannt ${time(f.recognizedAt)} · ${zoneMeter(f,dir,m1,'fvg').label}`),
   'Für den SL zählen nur vor dem Retest bekannte; offen und komplett in der OB → ferne M5-Kante.']
   :['Keine interne gleichgerichtete M1-FVG in der M5-OB bekannt.']};
 const meter=ob?zoneMeter(ob,dir,m1,'ob'):null;
 const internalOb={label:`Interner ${dir===1?'bullischer':'bärischer'} M1-OB`,info:true,status:ob?'visited':'info',
  sub:ob?`${range(ob)}\n${meter.value===null?'Messung unbekannt':!meter.touched?'noch nicht berührt':meter.broken?'gebrochen':'gehalten'}`:'kein Beleg',
  meters:ob?[meter.touched?meter:{value:null,label:'Messung unbekannt',segments:[]}]:[],
  detail:ob?[`M1-OB der jüngsten internen FVG, ${range(ob)}.`,meter.label,'Zusatzbeleg, kein Gate in v7.']
   :['Kein interner M1-OB zugeordnet. Der M1-OB der Reaktions-FVG gehört zu Route b.']};
 return {fvgList,internalOb};
}

// Ausgabe = früheste Entry-Route; sonst offen bzw. abgelehnt. unknown bleibt sichtbar, solange das Produkt es meldet.
function output(r,routeMap,first){
 if(first)return {status:'kein Entry',route:null};
 if(!r||r.state==='unknown'&&r.reason!=='marketClosed')return {status:'pending',route:null};
 if(r.state==='false'||r.reason==='marketClosed')return {status:'rejected',route:null};
 const routes=Object.entries(routeMap);
 const entry=routes.filter(([,x])=>x.status==='entry').sort(([,x],[,y])=>x.entryTime-y.entryTime)[0];
 if(entry)return {status:'entry',route:entry[0],...entry[1]};
 if(routes.every(([,x])=>x.status==='rejected'))return {status:'rejected',route:null};
 const open=routes.find(([,x])=>x.status==='pending')??routes.find(([,x])=>x.status==='unknown');
 return {status:open[1].status,route:open[0]};
}

function routeEntry(x,unvisited){
 if(!x)return {status:'not-visited',sub:'○ nicht besucht',detail:[unvisited]};
 return {status:ROUTE_STATUS[x.status],sub:x.status==='entry'?`${price(x.entryPrice)} · ${time(x.entryTime)}`:`${x.status} · ${reasonText(x.reason)}`,
  detail:[x.status==='entry'?`Entry ${price(x.entryPrice)} um ${time(x.entryTime)}, SL ${price(x.stopLoss)}.`:`${x.status}: ${reasonText(x.reason)}.`,
   x.entryCandidate?`Kandidat ${price(x.entryCandidate.entryPrice)} um ${time(x.entryCandidate.entryTime)}; ohne belegten SL kein Entry.`:null].filter(Boolean)};
}

// role/pair/partner: OB1 eines DOB endet im Hold-Gate, OB2 bzw. Einzel-OB in SL und Entry-Routen.
export function obReactionGraph({dir,entry,m1,evaluatedAt,nearTouch=false,pair=null,partner=null}){
 const {orderBlock:ob,reaction:r,role='second'}=entry,adj=adjective(dir);
 const contact=r?.contact,fvg=r?.fvg,rejected=r?.state==='false',closed=r?.reason==='marketClosed',live=r?.state==='true';
 const first=role==='first',routes=live&&!first?r.routes:{},out=output(r,routes,first),open=s=>s?'unknown':'not-visited';
 const n={};
 n.detect={label:`${dir===1?'Bullische':'Bärische'} M5-OB erkannt`,status:ob?'visited':'unknown',sub:ob?`${range(ob)} · ${time(ob.recognizedAt)}`:'noch nicht bekannt',
  detail:[ob?`M5-OB ${range(ob)}, bekannt ${time(ob.recognizedAt)}.`:'Die M5-OB ist zu diesem Stand noch nicht bekannt.']};
 n.touch={label:nearTouch?'Exakt oder Near ≤10 % vor dem nächsten Marktschluss?':'Exakter Touch vor dem nächsten Marktschluss?',
  status:contact?'visited':closed?'rejected':open(ob&&!rejected),
  sub:contact?`${contact.status==='nearTouch'?'Near-Touch':'Touch'} ${time(contact.candleTime)}`:closed?'nein':ob&&!rejected?'◇ offen':'○ nicht besucht',
  detail:[contact?`${contact.status} mit der M1-Kerze ${time(contact.candleTime)}, bekannt ${time(contact.knownAt)}.`:'Noch kein Touch einer geschlossenen M1-Kerze.',
   nearTouch?'Near-Touch-Schalter an: ≤10 % der OB-Höhe vor der Kante zählt.':'Produkt-Default W1: nur exakter Touch.']};
 n.closed={label:'Markt geschlossen, OB verfallen',status:closed?'rejected':'not-visited',sub:closed?'Reaktion unknown':'○ nicht besucht',
  detail:['Ohne bridgeClosures verfällt eine OB, die bis zum ersten XAU-Marktschluss nach ihrer Erkennung nicht reagiert hat.']};
 n.broken={label:`Gegenkante auf M1 gebrochen, bevor eine neue ${adj} M1-FVG bekannt ist?`,
  status:rejected?'rejected':fvg?'visited':open(contact&&!closed),
  sub:rejected?`ja · ${time(r.knownAt)}`:fvg?'nein':contact&&!closed?'◇ offen':'○ nicht besucht',
  detail:['Bricht eine M1-Kerze die ferne M5-Kante, bevor eine neue gleichgerichtete M1-FVG bekannt ist, ist die Reaktion false.',
   'Ein Bruch in derselben Kerze wie der erste Touch zählt ebenfalls als false.']};
 n.false={label:'Reaktion false',status:rejected?'rejected':'not-visited',sub:rejected?reasonText(r.reason):'○ nicht besucht',
  detail:[rejected?`M5-Gegenkante gebrochen, bekannt ${time(r.knownAt)}.`:'Kein Bruch vor der Reaktions-FVG.']};
 n.reaction={label:`Reaktion true (neue ${adj} M1-FVG)`,status:live?'visited':'not-visited',sub:live?`${range(fvg)} · ${time(fvg.recognizedAt)}`:'○ nicht besucht',
  detail:live?[`Reaktions-FVG ${range(fvg)}, bekannt ${time(fvg.recognizedAt)}.`,
   r.penetration?.status==='ready'?`Retest bis ${Number((r.penetration.maxPenetrationFraction*100).toFixed(2))} % in die M5-OB.`:null].filter(Boolean):['Noch keine Reaktions-FVG.']};
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
  detail:['Interne FVG offen und komplett in der OB → ferne M5-Kante; nur teilweise überlappend → unknown; keine offen → Retest-Extrem vom Kontakt bis zum Entry (kommt mit T6, bis dahin unknown).',
   ...Object.entries(routes).map(([k,x])=>`Route ${k}: ${x.status==='entry'?'SL '+price(x.stopLoss)+' · '+(STOP_BRANCH[x.stopAnchor]??x.stopAnchor):reasonText(x.reason)}`)]};
 const a=routes.a,b=routes.b,bRejected=b?.status==='rejected';
 n.routeA={label:'Route a: Entry bei FVG-Bestätigung',...routeEntry(a,'Erst mit Reaktion true.')};
 // b rejected kommt aus dem 50-%-Gate oder einem M1-OB-Bruch; sonst ist das Gate (noch) nicht ausgelöst.
 n.bCheck={label:'Route b: M1-OB der FVG nach voller Füllung >50 % durchstochen?',status:!b?'not-visited':bRejected?'rejected':b.status==='pending'?'unknown':'visited',
  sub:!b?'○ nicht besucht':bRejected?`ja · ${reasonText(b.reason)}`:b.status==='pending'?'◇ offen':'nein',
  detail:[b?`Route b: ${b.status}${b.reason?' · '+reasonText(b.reason):''}${b.knownAt!=null?' · ab '+time(b.knownAt):''}.`:'Erst mit Reaktion true.',
   'Die 50 % betreffen den M1-OB der Reaktions-FVG nach ihrer vollen Füllung, nicht den M5-Retest.']};
 n.entryB={label:'Entry b',...(bRejected?routeEntry(null,'Route b abgelehnt.'):routeEntry(b,'Erst mit Reaktion true.'))};
 n.result={label:out.status==='entry'?'Entry':out.status,status:out.status==='entry'?'visited':out.status==='rejected'?'rejected':first?'not-visited':'unknown',
  sub:out.status==='entry'?`Route ${out.route} · ${price(out.entryPrice)}\n${time(out.entryTime)} · SL ${price(out.stopLoss)}`
   :first?'OB1 trägt keinen Entry':closed?'OB verfallen':rejected?'Reaktion false':out.route?`Route ${out.route} · ${out.status}`:'warte · noch kein Tupel',
  detail:[`Reaktion ${r?.state??'–'}${r?.reason?' · '+reasonText(r.reason):''}.`,'Ausgabe pending / entry / rejected; unknown, solange der SL nicht belegt ist.']};
 Object.assign(n,sideTrack(dir,entry,m1));

 const v=s=>s==='visited'||s==='rejected'?s:'not-visited';
 const edges={detectTouch:ob?'visited':'unknown',touchClosed:v(n.closed.status),touchBroken:contact?'visited':'not-visited',
  brokenFalse:v(n.false.status),brokenReaction:v(n.reaction.status),reactionOb1:holdLive?'visited':'not-visited',
  reactionOb2:slLive?'visited':'not-visited',holdNoDob:n.noDob.status,stopA:n.routeA.status,stopB:n.bCheck.status==='rejected'?'visited':n.bCheck.status,
  bEntry:n.entryB.status,aResult:v(n.routeA.status),bResult:v(n.entryB.status),closedResult:v(n.closed.status),falseResult:v(n.false.status),side:'info'};
 const head=`Intern: ${r?.state??'unknown'} · Ausgabe: ${out.status}${out.route?` (Route ${out.route})`:''}`;
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
