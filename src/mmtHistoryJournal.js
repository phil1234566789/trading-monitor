export const historyJournalKey=trade=>`${trade.account_id}:${trade.broker_position_id??trade.position_id}`;
export function historyJournalRoute(link){
 const instrument=link?.trade_positions?.dealing_ranges?.instrument;
 return link?.trade_position_id&&instrument?{path:'/',query:{journalTrade:link.trade_position_id,instrument}}:null;
}
