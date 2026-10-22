import {formatDatedTime} from './berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';

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
  return {
    liquiditySweep:[`${tf} ${type} · Level ${price(level?.price)}`,
      `Pivot-/Levelzeit: ${date(level?.pivotTime)}`,
      ...(known(exactSweep)?[`Tatsächlicher Sweep (M1): ${date(exactSweep)}`] : [`Sweepkerze (${Number.isFinite(level?.fineTouchedTime)?'M5':tf}): ${date(level?.fineTouchedTime ?? level?.touchedTime)}`, 'Genauere Sweepzeit: nicht gespeichert'])],
    reaction:[`Ursprünglicher M5-Orderblock aus Setup 1.0 · ${ob?.dir===1?'bullisch':ob?.dir===-1?'bärisch':'Richtung nicht gespeichert'}`,
      `Preiszone unten–oben: ${price(ob?.bottom)}–${price(ob?.top)}`,
      `Entstehung: ${date(ob?.startTime)}`,`Bekannt / zugeordnet: ${date(primary?.reactionRecognizedAt)}`],
  };
}

export function setup1ChecklistRows(rows,state,m1Check) {
  const details=setup1ChecklistDetails(state,m1Check);
  return rows.map(row=>details[row.key]?{...row,details:details[row.key]}:row);
}
