const finite=n=>typeof n==='number'&&Number.isFinite(n);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const keys=['ticket','position_id','time_msc','type','entry','symbol','volume','price','profit','commission','swap','fee'];
export function validateHistoryBatch(body,account,now) {
 if(body.account_login!==Number(account.login)||body.account_server!==account.server)throw new Error('account_mismatch');
 if(typeof body.currency!=='string'||!/^[A-Z]{3,8}$/.test(body.currency)||!Array.isArray(body.deals)||body.deals.length>100)throw new Error('invalid_history_batch');
 for(const d of body.deals){
  if(!d||Object.keys(d).some(k=>!keys.includes(k))||!['ticket','position_id','time_msc','type','entry'].every(k=>integer(d[k]))
   ||d.ticket<=0||d.time_msc<=0||d.time_msc>(now+60)*1000||d.type>50||d.entry>3
   ||typeof d.symbol!=='string'||!/^[A-Za-z0-9._-]{0,64}$/.test(d.symbol)
   ||!['volume','price','profit','commission','swap','fee'].every(k=>finite(d[k]))||d.volume<0||d.price<0
   ||([0,1].includes(d.type)&&(!d.symbol||!d.position_id||d.volume<=0||d.price<=0)))throw new Error('invalid_history_deal');
 }
 return body.deals.map(d=>({...d,account_id:account.id,currency:body.currency}));
}
