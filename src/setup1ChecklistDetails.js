import {formatDatedTime} from './berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';
import {isSweepRetestSource} from './setupSources.js';

// Die Identität kommt nur aus dem ursprünglichen Setup, niemals aus einem späteren Entry-Retest.
export function setup1ChecklistDetails(state,m1Check) {
  if(state?.model!=='countertrend')return {};
  const primary=state.setup?.primary;
  const at=state.evaluatedAt;
  if(Number.isFinite(primary?.recognizedAt)&&Number.isFinite(at)&&primary.recognizedAt>at)return {};
  const known=value=>Number.isFinite(value)&&(!Number.isFinite(at)||value<=at);
  const date=value=>known(value)?`${formatDatedTime(value)} Uhr (Europe/Berlin)`:'nicht gespeichert';
  const price=value=>Number.isFinite(value)?fmtPrice(value,pricePrecisionForInstrument(state.instrument)):'nicht gespeichert';
  const sweep=primary?.sweep,level=sweep?.level,ob=primary?.reactionOB;
  const anchor=m1Check?.structureStart;
  const exactSweep=known(anchor?.recognizedAt)&&Number.isFinite(level?.touchedTime)&&Number.isFinite(level?.price)
    &&anchor.sourceTime===level.touchedTime&&anchor.price===level.price
    ? anchor.structureFrom : null;
  const tf={'5M':'M5','1H':'H1','4H':'H4','1D':'D1'}[sweep?.timeframe?.toUpperCase()] ?? sweep?.timeframe ?? 'Zeitrahmen nicht gespeichert';
  const type=level?.dir===-1?'Liquidity Low':level?.dir===1?'Liquidity High':'Leveltyp nicht gespeichert';
  const association=primary?.rangeAssociation,relativeDetails={};
  const idea=primary?.ideaBinding;
  const aliasDetails=idea?.status==='ambiguous'?['Zuordnung zur bereits bekannten Idee ist mehrdeutig; keine erneute Entry-Freigabe.']
    :idea?.status==='known'&&idea.canonicalSourceKey!==primary.id&&known(idea.knownAt)
      ?[`Gleiche bereits bekannte POI→Target-Idee seit ${date(idea.knownAt)}.`,
        `Diese Quelle ist erst seit ${date(primary.recognizedAt)} bekannt und startet den bisherigen Verlauf nicht neu.`]:[];
  if(association?.status==='ready'){
    for(const [key,name,range] of [['outerM5Trend','Umschließende M5-Range',association.outer],['m5Trend','Zum Sweep führende M5-Range',association.inner]]){
      relativeDetails[key]=[`${name} · ${range.trend==='uptrend'?'bullisch':'bärisch'}`,
        `Spanne ${price(range.range.low.price)}–${price(range.range.high.price)}`,
        `Low: ${date(range.range.low.pivotTime)} · High: ${date(range.range.high.pivotTime)}`,
        `Kausal bekannt: ${date(range.knownAt)}`,
        ...(range.basis==='existingCloseReactionChoch'?['Vorhandener CHoCH am Sweep bestätigt die Hinbewegung; die Raw-Nested-Pivotbestätigung wird nicht vorgezogen.']:[])];
    }
  }
  return {
    ...relativeDetails,
    liquiditySweep:[`${tf} ${type} · Level ${price(level?.price)}`,
      `Pivot-/Levelzeit: ${date(level?.pivotTime)}`,
      ...(known(exactSweep)?[`Tatsächlicher Sweep (M1): ${date(exactSweep)}`] : [`Sweepkerze (${Number.isFinite(level?.fineTouchedTime)?'M5':tf}): ${date(level?.fineTouchedTime ?? level?.touchedTime)}`, 'Genauere Sweepzeit: nicht gespeichert'])],
    reaction:[`${isSweepRetestSource(primary)?'Bestehender M5-Orderblock · Startweg LS + Retest':'Ursprünglicher M5-Orderblock aus Setup 1.0'} · ${ob?.dir===1?'bullisch':ob?.dir===-1?'bärisch':'Richtung nicht gespeichert'}`,
      `Preiszone unten–oben: ${price(ob?.bottom)}–${price(ob?.top)}`,
      `Entstehung: ${date(ob?.startTime)}`,`Bekannt / zugeordnet: ${date(primary?.reactionRecognizedAt)}`,
      ...(isSweepRetestSource(primary)&&known(primary?.sourceRetest?.recognizedAt)
        ?[`Retestkerze: ${date(primary.sourceRetest.candleTime)}`,`Retest bekannt: ${date(primary.sourceRetest.recognizedAt)}`]:[]),...aliasDetails],
  };
}

export function setup1ChecklistRows(rows,state,m1Check) {
  const details=setup1ChecklistDetails(state,m1Check);
  return rows.map(row=>details[row.key]?{...row,details:details[row.key]}:row);
}
