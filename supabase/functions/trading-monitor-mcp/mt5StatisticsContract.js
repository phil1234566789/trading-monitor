const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=value=>value==null||value===''?null:typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value?value:invalid();
function invalid(){throw new Error('invalid_statistics_filter');}
export function statisticsParameters(body){
 if(!Array.isArray(body.account_ids)||body.account_ids.length>100||body.account_ids.some(id=>typeof id!=='string'||!uuid.test(id)))invalid();
 if(body.asset!=null&&(typeof body.asset!=='string'||body.asset.length>80))invalid();
 if(body.currency!=null&&(typeof body.currency!=='string'||!/^[A-Z]{3,8}$/.test(body.currency)))invalid();
 const outcomes=body.outcomes??['win','loss','breakeven'];
 if(!Array.isArray(outcomes)||outcomes.some(value=>!['win','loss','breakeven'].includes(value)))invalid();
 const params={p_account_ids:[...new Set(body.account_ids)],p_asset:body.asset??'',p_currency:body.currency??'USD',p_from:date(body.from),p_to:date(body.to),p_outcomes:[...new Set(outcomes)]};
 if(body.action==='statistics_summary'){
  const count=body.extreme_limit??5;if(!Number.isSafeInteger(count)||count<1||count>100)invalid();
  const positions=body.commission_positions??[];
  if(!Array.isArray(positions)||positions.length>100||positions.some(p=>!p||typeof p.account_id!=='string'||!uuid.test(p.account_id)||!Number.isSafeInteger(p.position_id)||p.position_id<1))invalid();
  return {...params,p_extreme_limit:count,p_commission_positions:positions};
 }
 const offset=body.offset??0,limit=body.limit??(body.action==='statistics_page'?100:500);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>(body.action==='statistics_page'?100:500))invalid();
 return {...params,p_offset:offset,p_limit:limit,...(body.action==='statistics_page'?{p_week:date(body.week)}:{})};
}
