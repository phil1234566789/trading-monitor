// Quellzeilen und numerische CSV-IDs bleiben von nativen Brokerpositions-IDs getrennt.
export function importedClosedTrades(rows){
 return rows.map(row=>({...row,id:`csv:${row.account_id}:${row.source_trade_id}`,source:'csv',position_id:null}));
}
