import {checked,mt5Database} from './mt5Credentials.ts';
import {statisticsParameters} from './mt5StatisticsContract.js';

export async function statisticsAction(body:Record<string,any>){
 const db=mt5Database(),params=statisticsParameters(body);
 const result=checked(await db.rpc(`mt5_${body.action}`,params));
 if(body.action!=='statistics_page')return result;
 const native=(result.rows??[]).filter((row:any)=>row.position_id!=null);
 // Nur Verknüpfungen der sichtbaren Seite laden; Archivlinks wachsen nicht mit jeder Wochenabfrage mit.
 const links=native.length?checked(await db.from('mt5_journal_links')
  .select('account_id,broker_position_id,trade_position_id,trade_positions(dealing_range_id,dealing_ranges(instrument))')
  .or(native.map((row:any)=>`and(account_id.eq.${row.account_id},broker_position_id.eq.${row.position_id})`).join(','))):[];
 return {...result,journal_links:links};
}
