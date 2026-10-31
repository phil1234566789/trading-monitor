import {watch} from 'vue';
import {ALL_ACCOUNTS_ID} from '../tradingAccounts.js';

export function useJournalRoute(query,{trades,currentSymbol,selectedTradingAccountId,showTrades,open,select}){
 let opened=null;
 watch(query,value=>{
  const id=Number(value.journalTrade);
  if(!Number.isSafeInteger(id)||id<=0)return;
  if(['GBPUSD','EURUSD','XAUUSD'].includes(value.instrument))currentSymbol.value=value.instrument;
  selectedTradingAccountId.value=ALL_ACCOUNTS_ID;
  showTrades.value=true;
 },{immediate:true});
 watch([trades,query],()=>{
  const id=Number(query().journalTrade);
  if(opened===id)return;
  const trade=trades.value.find(t=>t.id===id&&t.instrument===currentSymbol.value);
  if(!trade)return;
  opened=id;open(trade);void select(trade);
 });
}
