const amount=d=>d.profit+d.commission+d.swap+d.fee;
const costTypes=new Set([4,7,8,9,10,11,12,15,16,17]);
const berlin=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'long'});
export function berlinTradeParts(ms){
 const p=Object.fromEntries(berlin.formatToParts(new Date(ms)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {...p,date:`${p.year}-${p.month}-${p.day}`};
}
export function closedBrokerTrades(raw){
 const deals=[...new Map(raw.map(d=>[`${d.account_id}:${d.ticket}`,d])).values()];
 const groups=new Map(),costGroups=new Map();
 for(const d of deals)if(costTypes.has(d.type)){const key=`${d.account_id}:${d.position_id}`;if(!costGroups.has(key))costGroups.set(key,[]);costGroups.get(key).push(d);}
 for(const d of deals)if([0,1].includes(d.type)&&d.position_id){
  const key=`${d.account_id}:${d.position_id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(d);
 }
 const trades=[];let excluded=0,open=0;
 for(const [key,items] of groups){
  items.sort((a,b)=>a.time_msc-b.time_msc||a.ticket-b.ticket);
  const ins=items.filter(d=>d.entry===0),outs=items.filter(d=>d.entry===1||d.entry===3);
  if(!ins.length||items[0].entry!==0||items.some(d=>d.entry===2)||ins.some(d=>d.type!==ins[0].type||d.symbol!==ins[0].symbol||d.currency!==ins[0].currency)
   ||outs.some(d=>d.type===ins[0].type||d.symbol!==ins[0].symbol||d.currency!==ins[0].currency)){excluded++;continue;}
  const volume=ins.reduce((s,d)=>s+d.volume,0),closed=outs.reduce((s,d)=>s+d.volume,0);
  if(closed<volume-1e-8){open++;continue;}
  if(Math.abs(volume-closed)>1e-8){excluded++;continue;}
  const costs=costGroups.get(key)??[];
  if(costs.some(d=>d.currency!==ins[0].currency)){excluded++;continue;}
  trades.push({id:key,account_id:ins[0].account_id,position_id:ins[0].position_id,symbol:ins[0].symbol,currency:ins[0].currency,
   direction:ins[0].type===0?'long':'short',volume,opened_at:ins[0].time_msc,closed_at:outs[outs.length-1].time_msc,
   entry:ins.reduce((s,d)=>s+d.price*d.volume,0)/volume,exit:outs.reduce((s,d)=>s+d.price*d.volume,0)/closed,
   net:[...items,...costs].reduce((s,d)=>s+amount(d),0)});
 }
 const unallocated=deals.filter(d=>costTypes.has(d.type)&&!groups.has(`${d.account_id}:${d.position_id}`));
 return {trades:trades.sort((a,b)=>a.closed_at-b.closed_at||a.id.localeCompare(b.id)),excluded,open,unallocated,
  cash:deals.filter(d=>![0,1].includes(d.type)&&!costTypes.has(d.type))};
}
export function filterBrokerTrades(trades,{account='',asset='',currency='',from='',to=''}={}){
 return trades.filter(t=>{
  const day=berlinTradeParts(t.closed_at).date;
  return (!account||t.account_id===account)&&(!asset||t.symbol===asset)&&(!currency||t.currency===currency)&&(!from||day>=from)&&(!to||day<=to);
 });
}
const weekdays={Monday:'Montag',Tuesday:'Dienstag',Wednesday:'Mittwoch',Thursday:'Donnerstag',Friday:'Freitag',Saturday:'Samstag',Sunday:'Sonntag'};
export function statisticsGroups(trades,dimension){
 const groups=new Map();
 for(const t of trades){
  const p=berlinTradeParts(t.opened_at),label=dimension==='asset'?t.symbol:dimension==='hour'?`${p.hour}:00–${p.hour}:59`:weekdays[p.weekday];
  if(!groups.has(label))groups.set(label,{label,count:0,net:0,wins:0});
  const g=groups.get(label);g.count++;g.net+=t.net;if(t.net>0)g.wins++;
 }
 return [...groups.values()].map(g=>({...g,average:g.net/g.count,winrate:g.wins/g.count*100})).sort((a,b)=>b.average-a.average||b.count-a.count);
}
