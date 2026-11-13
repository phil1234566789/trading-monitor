export async function readHistoryJournalLinks(db){
 const rows=[];let after=0;
 while(true){
  const {data,error}=await db.from('mt5_journal_links').select('account_id,broker_position_id,trade_position_id,trade_positions(dealing_range_id,dealing_ranges(instrument))').gt('trade_position_id',after).order('trade_position_id').limit(500);
  if(error)throw error;
  if(!data?.length)return rows;
  rows.push(...data);after=data[data.length-1].trade_position_id;
 }
}
