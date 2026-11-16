import {checked,mt5Database} from './mt5Credentials.ts';
import {statisticsParameters} from './mt5StatisticsContract.js';
import {fetchAllRows} from '../_shared/fetchAllRows.ts';

export async function statisticsAction(body:Record<string,any>){
 const db=mt5Database(),params=statisticsParameters(body);
 const result=checked(await db.rpc(`mt5_${body.action}`,params));
 if(body.action!=='statistics_page')return result;
 const native=(result.rows??[]).filter((row:any)=>row.position_id!=null);
 // Nur Verknüpfungen der sichtbaren Seite laden; Archivlinks wachsen nicht mit jeder Wochenabfrage mit.
 // Paginiert wegen des PostgREST-Zeilendeckels; Fehlerbild bleibt das von checked().
 const links=native.length?await fetchAllRows((from,to)=>db.from('mt5_journal_links')
  .select('account_id,broker_position_id,trade_position_id,trade_positions(dealing_range_id,dealing_ranges(instrument))')
  .or(native.map((row:any)=>`and(account_id.eq.${row.account_id},broker_position_id.eq.${row.position_id})`).join(','))
  .order('account_id').order('broker_position_id').range(from,to))
  .catch(()=>{throw new Error('mt5_storage_unavailable');}):[];
 return {...result,journal_links:links};
}
