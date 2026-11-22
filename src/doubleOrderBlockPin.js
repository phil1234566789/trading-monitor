import {DOB_PIN_CONTEXT_VERSION,assertDoubleOrderBlockPin,cloneDoubleOrderBlockContext} from '../supabase/functions/_shared/doubleOrderBlockPin.js';
import {DOUBLE_ORDER_BLOCK_VERSION,doubleOrderBlockDisplay} from './doubleOrderBlocks.js';
import {registerChartObjectType} from './chartObjectRegistry.js';
import {fmtPrice,pricePrecisionForInstrument} from './format.js';

export function doubleOrderBlockPinSnapshot(pair,{symbol,currentBar,replayUntil,evaluatedAt,coverage,visibleRange}) {
  return assertDoubleOrderBlockPin({contextVersion:DOB_PIN_CONTEXT_VERSION,engineVersion:DOUBLE_ORDER_BLOCK_VERSION,
    pair:cloneDoubleOrderBlockContext(pair),evaluatedAt,capturedAt:Math.floor(Date.now()/1000),
    view:{symbol,bar:currentBar,replayUntil:replayUntil??null,visibleRange:visibleRange??null},
    coverage:cloneDoubleOrderBlockContext(coverage),display:doubleOrderBlockDisplay(pair,evaluatedAt)});
}

export function doubleOrderBlockPinLabel(snapshot) {
  const p=snapshot.pair;
  return `DOB ${p.direction==='long'?'Long':'Short'} · ${p.instrument}`;
}

export function collectDoubleOrderBlockPins(items,x,y,context,radius=40) {
  const found=new Map();
  for(const item of items) {
    const distance=item.primitive.distanceTo(x,y);
    if(distance>radius)continue;
    for(const pair of item.pairs??[item.pair]) {
      if(found.has(pair.id)&&found.get(pair.id).distance<=distance)continue;
      const saved=context.pinnedSnapshots?.find(p=>p.pair.id===pair.id);
      found.set(pair.id,{kind:'double_order_block',dobContext:saved??doubleOrderBlockPinSnapshot(pair,context),distance});
    }
  }
  return [...found.values()];
}

// DOB in den TSC-Rollen (nicht im Pin-Menü, dort bleibt kind='double_order_block'): Snapshot = derselbe Pin-Kontext, den
// auch ein DOB-Pin speichert, damit Hover in der Rollenliste ihn über den bestehenden DOB-Pin-Renderer zeigt.
// Preis = nahe Kante von OB2 (der Retest-Bereich), Zeit = OB1-Start.
const dobNearEdge=p=>p.direction==='long'?p.secondOrderBlock.top:p.secondOrderBlock.bottom;
registerChartObjectType('double_order_block',{
  name:'Doppelter Orderblock (DOB)',
  algoVersion:DOUBLE_ORDER_BLOCK_VERSION,
  key:c=>String(c.pair.id),
  snapshot:c=>c,
  time:s=>s.pair.firstOrderBlock.startTime,
  line:s=>({price:dobNearEdge(s.pair),dir:s.pair.direction==='long'?-1:1,from:s.pair.firstOrderBlock.startTime,to:null,styleKey:'dobConfirmed'}),
  label:(s,instrument)=>`${doubleOrderBlockPinLabel(s).split(' · ')[0]} ${fmtPrice(dobNearEdge(s.pair),pricePrecisionForInstrument(instrument))}`,
});
