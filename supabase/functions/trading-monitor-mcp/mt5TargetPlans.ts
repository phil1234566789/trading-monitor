import {z} from 'npm:zod@3.24.1';
import {checked,mt5Database} from './mt5Credentials.ts';
import {executionConfig} from './mt5Execution.ts';
import {validateWorkerSnapshot,validateDispatchAccount} from './executionContract.js';
import {validateTargetAllocation} from './targetPlanContract.js';
const uuid=z.string().uuid(),number=z.number().finite(),positive=number.positive();
const request=z.object({order_id:uuid,revision:uuid,expected_revision:uuid.nullable(),targets:z.array(z.object({price:positive,volume:positive}).strict()).min(1).max(5),observed:z.object({volume:positive,sl:positive,tp:number.nonnegative()}).strict()}).strict();
const resultSchema=z.object({status:z.enum(['executed','rejected','unknown']),reason:z.string().max(100).optional(),remaining_volume:number.nonnegative().optional(),sl:positive.optional(),tp:number.nonnegative().optional(),deal:z.number().int().positive().optional()}).strict();
export async function targetPlanAction(body:Record<string,unknown>,worker=false){
 const db=mt5Database(),action=body.action;
 if(!worker&&action==='target_state'){
  const order=uuid.parse(body.order_id);
  return {plan:checked(await db.from('mt5_target_plans').select('*').eq('order_id',order).maybeSingle())};
 }
 const config=await executionConfig();
 if(!worker&&action==='target_save'){
  const {action:_,...fields}=body,input=request.parse(fields);
  const order:any=checked(await db.from('mt5_execution_orders').select('*').eq('id',input.order_id).single());
  if(order.status!=='executed'||!order.result?.price||!order.result?.volume||order.result?.position_lifecycle?.state==='closed')throw new Error('target_fill_required');
  validateDispatchAccount(order.intent,config);
  const bridge:any=checked(await db.from('mt5_bridge_state').select('*').eq('id','primary').single());
  if(Date.now()-Date.parse(bridge.heartbeat_at)>5000)throw new Error('bridge_offline');
  const s=validateWorkerSnapshot(bridge.snapshot,config);
  if(!s.target_plans_ready||!s.execution_ready||!s.trade_allowed||s.worker_error)throw new Error('target_worker_not_ready');
  const ticket=order.result.position??order.result.order;
  const p=s.positions.find((p:any)=>p.ticket===ticket&&p.symbol===order.intent.symbol&&p.type===(order.intent.direction==='long'?0:1)&&p.magic===order.result.magic);
  const q=s.quotes?.find((q:any)=>q.symbol===order.intent.symbol);
  if(!p||!q||Date.now()/1000-q.time>5)throw new Error('target_position_unavailable');
  if(['volume','sl','tp'].some(key=>Math.abs(p[key]-input.observed[key as keyof typeof input.observed])>1e-9))throw new Error('target_position_changed');
  const allocation=validateTargetAllocation(input.targets,p,q,order.result.price,order.intent.stop_loss);
  const plan={...allocation,order_id:order.id,account_login:config.login,account_server:config.server,mode:config.mode,
   position:ticket,symbol:order.intent.symbol,direction:order.intent.direction,magic:order.result.magic,
   entry_price:order.result.price,initial_sl:order.intent.stop_loss,filled_volume:order.result.volume};
  return {plan:checked(await db.rpc('mt5_save_target_plan',{p_order:order.id,p_revision:input.revision,p_expected:input.expected_revision,p_plan:plan,p_checkpoint:input.observed}))};
 }
 if(!worker)throw new Error('invalid_target_action');
 if(action==='target_poll'){
  // Ein Absturz nach Reservierung ist unklar, kein abgelaufenes Versandrecht für einen Retry.
  const stuck:any[]=checked(await db.from('mt5_target_commands').select('id,order_id,revision').eq('status','sending').lt('created_at',new Date(Date.now()-30000).toISOString()).limit(100))??[];
  for(const command of stuck){
   checked(await db.from('mt5_target_commands').update({status:'unknown'}).eq('id',command.id).eq('status','sending'));
   checked(await db.from('mt5_target_plans').update({state:'unknown',reason:'worker_result_unresolved'}).eq('order_id',command.order_id).eq('revision',command.revision).eq('state','sending'));
  }
  const rows=[];let after='00000000-0000-0000-0000-000000000000';
  while(true){
   const page:any[]=checked(await db.from('mt5_target_plans').select('*').in('state',['pending','active','sending','unknown'])
    .eq('plan->>account_login',String(config.login)).eq('plan->>account_server',config.server).gt('order_id',after).order('order_id').limit(100))??[];
   if(!page.length)break;
   rows.push(...page);after=page[page.length-1].order_id;
   if(rows.length>100)throw new Error('invalid_target_plan_count');
  }
  return {plans:rows};
 }
 const orderId=uuid.parse(body.order_id),revision=uuid.parse(body.revision);
 const row:any=checked(await db.from('mt5_target_plans').select('*').eq('order_id',orderId).single());
 validateDispatchAccount(row.plan,config);
 if(action==='target_result'){
  const id=uuid.parse(body.operation_id),result=resultSchema.parse(body.result);
  const cmd:any=checked(await db.from('mt5_target_commands').select('*').eq('id',id).eq('order_id',orderId).eq('revision',revision).single());
  if(cmd.result&&Object.keys(cmd.result).length===Object.keys(result).length&&Object.keys(result).every(k=>cmd.result[k]===result[k as keyof typeof result]))return {recorded:true};
  if(row.revision!==revision)throw new Error('target_revision_changed');
  if(result.status==='executed'&&(result.remaining_volume==null||result.sl==null||result.tp==null||(cmd.kind==='close'&&!result.deal)))throw new Error('invalid_target_result');
  return {recorded:checked(await db.rpc('mt5_finish_target',{p_id:id,p_result:result}))===true};
 }
 if(row.revision!==revision)throw new Error('target_revision_changed');
 if(action==='target_claim'){
  const id=uuid.parse(body.operation_id),kind=z.enum(['install','close']).parse(body.kind),index=z.number().int().min(-1).max(4).parse(body.target_index);
  return {authorized:checked(await db.rpc('mt5_claim_target',{p_order:orderId,p_revision:revision,p_id:id,p_kind:kind,p_index:index}))===true};
 }
 if(action==='target_observed'){
  const state=z.enum(['paused','completed']).parse(body.state),reason=z.enum(['broker_position_changed','broker_position_closed','targets_finished_with_remainder','broker_precheck_failed']).parse(body.reason);
  const updated=checked(await db.from('mt5_target_plans').update({state,reason,updated_at:new Date().toISOString()}).eq('order_id',orderId).eq('revision',revision).in('state',['pending','active']).select('order_id'));
  return {recorded:!!updated?.length};
 }
 throw new Error('invalid_target_action');
}
