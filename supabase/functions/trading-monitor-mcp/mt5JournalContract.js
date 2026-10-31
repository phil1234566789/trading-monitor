import {closedBrokerTrades} from '../../../src/milkyMetaTraderStatistics.js';

export function brokerJournalPosition(rows,accountId,positionId,symbol){
 const trade=closedBrokerTrades(rows).trades.find(t=>t.account_id===accountId&&t.position_id===positionId&&t.symbol===symbol);
 if(!trade)throw new Error('broker_position_incomplete');
 return {entry_price:trade.entry,stop_loss:null,exit_price:trade.exit,triggered_at:new Date(trade.opened_at).toISOString(),
  exit_time:new Date(trade.closed_at).toISOString(),size:trade.volume,net_pl:trade.net,commission:trade.commission,
  outcome:trade.net>0?'win':trade.net<0?'loss':null,r_multiple:null,direction:trade.direction,account_currency:trade.currency};
}
export function validateJournalComment(input){
 if(!Number.isSafeInteger(input.position_id)||input.position_id<=0||!['statement','observation','hypothesis'].includes(input.kind)
  ||typeof input.body!=='string'||!input.body.trim()||input.body.length>6000
  ||typeof input.source!=='string'||!input.source.trim()||input.source.length>300
  ||typeof input.occurred_at!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(input.occurred_at)||!Number.isFinite(Date.parse(input.occurred_at)))throw new Error('invalid_journal_comment');
 return {id:input.id,trade_position_id:input.position_id,kind:input.kind,body:input.body.trim(),source:input.source.trim(),occurred_at:input.occurred_at};
}
