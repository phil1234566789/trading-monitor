(()=>{
 let d=window.P14_DEBUG_DATA;const api=window.OBReactionDebugger,$=id=>document.getElementById(id);
 if(!d){$('observation').textContent='Datenbundle fehlt. Keine Auswertung möglich.';return;}
 const at=hm=>Date.parse(d.date+'T'+hm+':00+02:00')/1000;
 const fmt=t=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(t*1000);
 const entrySource=window.OBReactionEntrySource,projectEntries=entrySource.createM1FvgEntryProjection();
 const cases=window.OB_REACTION_CASES,runners=new Map();let selected=cases[0],main,old,inner,newFvg,evidence,steps,from,through,index=0,publicResult=null,routeInput=null;
 function choose(value){selected=cases.find(c=>c.id===value)??cases[0];({d,main,old,inner,newFvg,evidence,steps,from,through}=selected);index=0;if($('entry-marking'))$('entry-marking').value=evidence.entryContext?.b?'retestReaction':'immediate';}
 choose(window.location?.hash.replace('#','')||cases[0].id);$('example').innerHTML=cases.map(c=>`<option value="${c.id}">${c.title}</option>`).join('');$('example').value=selected.id;
 let lo,hi;
 const x=t=>65+(t-from)/(through-from)*850,y=p=>450-(p-lo)/(hi-lo)*400;
 const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
 function render(){
  const asOf=at(steps[index][0]),tf=$('timeframe').value,sec=tf==='m1'?60:300;
  const contactState=window.OBReactionContact?.scanReactionContacts(main,d.candles.m1,asOf,.10);
  const marking=projectEntries({candles:d.candles.m1,evaluatedAt:asOf,direction:main.dir===1?'long':'short',variant:$('entry-marking').value});
  const baseRows=api.closedCandles(d.candles[tf],asOf,sec).filter(c=>c.time>=from&&c.time<through);
  const rows=entrySource.tintManualFvgConfirmations(entrySource.tintM1FvgCandidates(baseRows,marking.candidates,tf==='m1'?'1m':'5m','#ffd54f'),marking.confirmations,tf==='m1'?'1m':'5m','#fd80ff');
  const scaleRows=api.closedCandles(d.candles.m1,asOf,60).filter(c=>c.time>=from&&c.time<through);
  lo=Math.min(main.bottom,...scaleRows.map(c=>c.low))-1;hi=Math.max(main.top,...scaleRows.map(c=>c.high))+1;
  let svg='<rect width="1000" height="520" fill="#121619"/>';
  for(let i=0;i<=5;i++){const p=lo+(hi-lo)*i/5;svg+=`<path d="M65 ${y(p)}H915" stroke="#364147"/><text x="925" y="${y(p)+4}" fill="#b3bec4" font-size="12">${p.toFixed(2)}</text>`;}
  const box=(z,known,label,color,dash=false,barSeconds=60)=>{if(known>asOf)return;const start=Math.max(from,z.startTime??z.candleTime),end=window.OBReactionRendering.zoneEndAt(z,asOf,barSeconds);if(start>=end)return;svg+=`<rect data-zone-end="${end}" x="${x(start)}" y="${y(z.top)}" width="${x(end)-x(start)}" height="${y(z.bottom)-y(z.top)}" fill="${color}" fill-opacity=".10" stroke="${color}" ${dash?'stroke-dasharray="5 4"':''}><title>${escape(label)} ${z.bottom.toFixed(2)}–${z.top.toFixed(2)} · bekannt ${fmt(known)}${end<asOf?' · Touch '+fmt(end):''}</title></rect>`;};
  if($('m5obs').checked)box(main,main.recognizedAt,'M5-OB '+fmt(main.startTime),main.dir===1?'#26a69a':'#ef5350',false,300);
  if($('m1obs').checked)for(const z of d.orderBlocks.m1.filter(z=>z.startTime>=from&&z.startTime<=asOf&&z.bottom<=hi&&z.top>=lo))box(z,z.recognizedAt,'M1-OB '+fmt(z.startTime),z.dir===1?'#26a69a':'#ef5350',true);
  if($('fvgs').checked)for(const z of [old,newFvg].filter(Boolean))box(z,z.recognizedAt,'M1-FVG '+fmt(z.candleTime),'#ffd54f',true);
  if($('fvgs').checked)for(const z of (selected.counterSources??[]).filter(z=>z.candleTime>=from&&z.candleTime<(newFvg?.recognizedAt??asOf)))box(z,z.recognizedAt,'Gegen-FVG '+fmt(z.candleTime),z.direction==='short'?'#ef5350':'#26a69a',true);
  const width=tf==='m1'?6:23;for(const c of rows){const normal=c.close>=c.open?'#26a69a':'#ef5350',color=c.color??normal,wick=c.wickColor??normal,reason=c.borderColor?' · technische Entry-Bestätigung '+($('entry-marking').value==='immediate'?'a':'b')+(c.color==='#ffd54f'?' + FVG-Impuls':''):c.color?' · bekannte FVG-Impulskerze':'';svg+=`<g data-candle-time="${c.time}" data-tint="${c.borderColor?(c.color==='#ffd54f'?'gold-pink':'pink'):c.color?'gold':'normal'}"><title>${fmt(c.time)} · O ${c.open} H ${c.high} L ${c.low} C ${c.close} · Schluss ${fmt(c.time+sec)}${reason}</title><path d="M${x(c.time)} ${y(c.high)}V${y(c.low)}" stroke="${wick}"/><rect x="${x(c.time)-width/2}" y="${y(Math.max(c.open,c.close))}" width="${width}" height="${Math.max(1,Math.abs(y(c.open)-y(c.close)))}" fill="${color}" stroke="${c.borderColor??color}" stroke-width="${c.borderColor?2:1}"/></g>`;}
  for(let t=from;t<=through;t+=600)svg+=`<text x="${x(t)}" y="480" text-anchor="middle" fill="#b3bec4" font-size="12">${fmt(t)}</text>`;
  svg+=`<path d="M${x(asOf)} 30V460" stroke="#9cd5ef" stroke-dasharray="4 4"/><text x="65" y="20" fill="#eff3f4">${tf.toUpperCase()} · geschlossen bis ${fmt(asOf)}</text>`;
  $('chart').innerHTML=svg;const result=api.evaluateOrderBlockReaction(evidence,asOf);
  if(window.OBReactionAPI){const route=evidence.entryContext?.b?'b':'a',source=window.OB_REACTION_SL_EVIDENCE.cases.find(c=>c.caseID===selected.id);routeInput=window.OBReactionRouteInput.buildReactionRouteInput(selected,source,route);const key=routeInput.episodeId+':'+route;if(!runners.has(key))runners.set(key,window.OBReactionAPI.createReactionRunner(routeInput));publicResult=runners.get(key)(asOf);}
  $('clock').textContent=fmt(asOf)+' · bekannt';$('step-count').textContent=`${index+1} / ${steps.length}`;
  $('example').title=selected.title;
  $('previous').disabled=index===0;$('next').disabled=index===steps.length-1;
  const knownFvg=result.trace.find(t=>t.key==='newFvgKnownAt').available;
  $('observation').textContent=steps[index][1];$('state').textContent='Intern: '+result.state+(publicResult?' · Ausgabe: '+publicResult.status+' (Route '+publicResult.route+')':'');$('reason').textContent=result.state==='unknown'?(knownFvg?'Neue FVG bereits bekannt; die Gesamtreaktion bleibt ohne belegten M5-Touch unbekannt. Entry-Routen werden separat geprüft.':'Noch keine neue FVG bekannt; kein späterer Ausgang ist ausgeschlossen.'):'Beurteilung zu diesem Wissensstand; bekannte FVG und frühere Reaktion bleiben in der Historie.';
  if($('history'))$('history').innerHTML=steps.slice(0,index+1).map(([hm])=>`<li>${hm} · damals ${api.evaluateOrderBlockReaction(evidence,at(hm)).state}</li>`).join('');
  const proof=(key,absent)=>{const t=result.trace.find(t=>t.key===key);return t.available?'✓ '+t.label+' · bekannt '+fmt(evidence[key]):'○ '+absent;};
  $('proof-touch').textContent=contactState?.status==='nearTouch'?'✓ Fast berührt · Abstand '+(contactState.lastNear??contactState.first).distance.toFixed(2)+' ('+((contactState.lastNear??contactState.first).ratio*100).toFixed(2)+' % der OB-Höhe; erlaubt ≤10 %) · bekannt '+fmt((contactState.lastNear??contactState.first).knownAt)+' · erster Near-Touch bekannt '+fmt(contactState.first.knownAt)+' · exakter Touch noch nicht bekannt':proof('touchAt','Noch kein exakter M5-OB-Touch bekannt.');
  $('proof-fvg').textContent=proof('newFvgKnownAt','Neue gleichgerichtete M1-FVG noch nicht bekannt.');
  $('proof-old').textContent=proof('oldFvgFilledAt','Alte FVG-Füllung nicht als Beleg vorhanden; keine Pflicht.');
  $('proof-inner').textContent=proof('internalObReactionAt','Frühere interne M1-OB-Reaktion nicht als Beleg vorhanden; keine Pflicht.');
  $('entry-a').textContent=result.entryA+(result.entryA.startsWith('ungeeignet')?' · '+evidence.entryContext.aReason:' · noch keine zusätzliche Eignung festgelegt.');
  $('entry-b').textContent=result.entryB;
  const b=evidence.entryContext?.b,knownTests=b?.tests.filter(t=>t.knownAt<=asOf)??[];
  $('entry-b-evidence').textContent=b&&b.fullFillAt<=asOf?'Volle FVG-Füllung bekannt '+fmt(b.fullFillAt)+' · '+knownTests.map(t=>fmt(t.knownAt)+' bekannt: '+(t.depth*100).toFixed(2)+' % M1-OB-Tiefe').join(' · '):'Volle FVG-Füllung noch nicht bekannt; keine M1-OB-50-%-Prüfung vorgezogen.';
  $('rejection-proof').textContent=result.state==='false'?result.reason:'Keine Ablehnung zu diesem Wissensstand festgestellt.';
  document.querySelectorAll('[data-reaction-branch]').forEach(n=>{const chosen=knownFvg?'confirmed':null;const inactive=chosen&&n.dataset.reactionBranch!==chosen;n.dataset.branchState=inactive?'inactive':chosen?'selected':'pending';const status=n.querySelector('.branch-status');if(status)status.textContent=inactive?'Durch bekannte neue FVG überholt':chosen?'Neue FVG bereits bekannt · bleibt historisch belegt':'Noch offen · nicht ausgeschlossen';n.setAttribute('aria-description',status?.textContent??'');});
  document.querySelectorAll('[data-entry-branch]').forEach(n=>{const inactive=n.dataset.entryBranch==='a'?result.entryA.startsWith('ungeeignet'):result.entryB==='abgelehnt';n.dataset.branchState=inactive?'inactive':'pending';n.setAttribute('aria-description',inactive?'Diese Entry-Route ist am aktuellen Stand ungeeignet oder verworfen.':'Entry-Route noch nicht ausgeschlossen.');});
  document.querySelectorAll('[data-node]').forEach(n=>n.classList.toggle('active',n.dataset.node===result.node));
  $('chart-info').textContent=`${rows.length} geschlossene ${tf.toUpperCase()}-Kerzen · M5-OB ${main.bottom}–${main.top} · ${selected.id==='504'?'Annäherung bis10 % für lokale Reaction akzeptiert; exakter Touch bleibt separat.':''}`+[old,newFvg].filter(z=>z&&z.recognizedAt<=asOf).map(z=>` · FVG ${fmt(z.candleTime)}: ${z.bottom}–${z.top}`).join('')+(inner?.recognizedAt<=asOf?` · M1-OB ${inner.bottom}–${inner.top}`:'');
  if(selected.referencePins)$('chart-info').textContent+=' · Nutzerreferenz DOB505/506 positiv.'+(asOf>=d.keyProofs.m5Depth.candleTime+60?' OB1-M5-Tiefe55.23 % / internerM1OB43.88 % (bekannt09:03).':' Tiefenmaximum noch nicht bekannt.')+' AktuelleProdukt-DOBv6 weichtab; nochkeinpositiverProdukt-DOB-UnitTest. TechnischeKerzenmarkierungistkeinPublicEntry.';
  $('source').textContent=`${d.instrument} · ${d.candles.m1.length} native M1 / ${d.candles.m5.length} M5 im Bundle. SHA256: ${d.source.sha256}`;
  if(window.renderOBReactionGraph)window.renderOBReactionGraph({evidence,asOf,result,caseId:selected.id,direction:main.dir,caseSpec:selected,publicResult,routeInput,contactState});
 }
 $('previous').onclick=()=>{index=Math.max(0,index-1);render();};$('next').onclick=()=>{index=Math.min(steps.length-1,index+1);render();};
 for(const id of ['entry-marking','timeframe','m1obs','m5obs','fvgs'])$(id).onchange=render;
 $('example').onchange=()=>{choose($('example').value);render();};
 $('function-code').textContent=(window.OBReactionAPI?.reaction??api.evaluateOrderBlockReaction).toString();render();
 window.OB_REACTION_DEBUG_STATE=()=>({index,asOf:at(steps[index][0]),evidence,result:api.evaluateOrderBlockReaction(evidence,at(steps[index][0])),publicResult});
})();
