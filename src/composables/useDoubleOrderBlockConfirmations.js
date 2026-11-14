import {ref} from 'vue';
import {addRangeConfirmation,addConfirmationToTrade,createDealingRange} from '../tradeIntake.js';
import {assertDoubleOrderBlockPair} from '../../supabase/functions/_shared/doubleOrderBlockPin.js';

const evidenceKey=e=>JSON.stringify([e.timeframe,e.sourceTime,e.rangeLow,e.rangeHigh]);
export function useDoubleOrderBlockConfirmations({currentSymbol,confirmationAddTrade,rangeConfirmationAddTrade,
  tscBootstrapArmed,tscRangeId,refreshTscRange,refreshTrades,getEvidence}) {
  const saving=ref(false),error=ref('');
  const completed=new Map();
  async function save(pair) {
    try {assertDoubleOrderBlockPair(pair);}catch(cause){error.value=cause.message;return;}
    const trade=confirmationAddTrade.value??rangeConfirmationAddTrade.value;
    if(saving.value||(!trade&&!tscBootstrapArmed.value)||pair.instrument!==currentSymbol.value)return;
    const instrument=currentSymbol.value,bootstrap=!trade&&tscBootstrapArmed.value;
    const rangeLevel=bootstrap||rangeConfirmationAddTrade.value!=null;
    const refresh=bootstrap||trade?.isTsc?refreshTscRange:refreshTrades;
    let rangeId=trade?.dealingRangeId,destination;
    saving.value=true;error.value='';
    confirmationAddTrade.value=null;rangeConfirmationAddTrade.value=null;tscBootstrapArmed.value=false;
    try {
      if(bootstrap) {
        const range=await createDealingRange({instrument,direction:pair.direction});
        if(!range)throw new Error('Dealing Range konnte nicht angelegt werden.');
        rangeId=range.id;
        if(currentSymbol.value===instrument)tscRangeId.value=range.id;
      }
      destination=(rangeLevel?'range:':'position:')+(rangeLevel?rangeId:trade.id);
      const done=completed.get(destination)??new Set();completed.set(destination,done);
      for(const e of getEvidence(trade,rangeId,rangeLevel)??[]) {
        if(e.kind==='ob'&&e.category==='confirmation'&&e.level===(rangeLevel?'range':'position'))done.add(evidenceKey(e));
      }
      // Der bestehende Insert setzt die Default-Invalidierung beim ersten OB, deshalb OB2 zuerst.
      for(const ob of [pair.secondOrderBlock,pair.firstOrderBlock]) {
        const evidence={kind:'ob',instrument,direction:pair.direction,timeframe:'5M',sourceTime:ob.startTime,
          touchedTime:null,rangeLow:ob.bottom,rangeHigh:ob.top,price:pair.direction==='long'?ob.bottom:ob.top};
        const key=evidenceKey(evidence);
        if(done.has(key))continue;
        const ok=await (rangeLevel?addRangeConfirmation(rangeId,evidence,'confirmation'):addConfirmationToTrade(trade.id,evidence,'confirmation'));
        if(!ok)throw new Error('DOB-Bestätigungen konnten nicht vollständig gespeichert werden. Bitte die sichtbaren Einträge prüfen.');
        done.add(key);
      }
    } catch(cause) {error.value=cause.message||'DOB konnte nicht übernommen werden.';}
    finally {
      try {if(rangeId!=null&&await refresh()===false)throw new Error();}
      catch {error.value=[error.value,'Anzeige konnte nicht aktualisiert werden. Bitte Daten neu laden.'].filter(Boolean).join(' ');}
      finally {if(!error.value)completed.delete(destination);saving.value=false;}
    }
  }
  return {saving,error,save};
}
