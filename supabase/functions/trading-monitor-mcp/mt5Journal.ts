import {z} from 'npm:zod@3.24.1';
import {checked,mt5Database} from './mt5Credentials.ts';
import {brokerJournalPosition,validateJournalComment} from './mt5JournalContract.js';
import {JOURNAL_POSITION_SELECT} from '../_shared/journalSelect.js';

const id=z.number().int().positive().safe();
export const journalInput={
 journal_positions:z.object({instrument:z.string().min(1).max(64),after_id:z.number().int().nonnegative().safe().default(0),account_id:id.nullable().optional()}),
 journal_position_update:z.object({position_id:id,fields:z.object({entry_price:z.number().positive().nullable().optional(),stop_loss:z.number().positive().nullable().optional(),
  triggered_at:z.string().datetime().optional(),exit_price:z.number().positive().nullable().optional(),exit_time:z.string().datetime().nullable().optional(),
  outcome:z.enum(['win','loss','open']).nullable().optional(),reasoning:z.string().max(6000).nullable().optional(),trading_account_id:id.nullable().optional(),
  size:z.number().positive().nullable().optional(),net_pl:z.number().finite().nullable().optional(),commission:z.number().finite().nullable().optional()}).strict()}),
 journal_context:z.object({account_id:z.string().uuid(),broker_position_id:id}),
 journal_import:z.object({account_id:z.string().uuid(),account_server:z.string().min(1).max(100),broker_position_id:id,dealing_range_id:id,
  instrument:z.string().min(1).max(64),broker_symbol:z.string().min(1).max(64),existing_position_id:id.optional(),trading_account_id:id.optional()}),
 journal_comments:z.object({position_id:id,after_id:z.string().uuid().optional()}),
 journal_comment_save:z.object({id:z.string().uuid(),position_id:id,kind:z.enum(['statement','observation','hypothesis']),body:z.string().min(1).max(6000),source:z.string().min(1).max(300),occurred_at:z.string().datetime({offset:true})}),
};
async function positionDeals(db:any,account:string,position:number){
 const rows=[];let after=0;
 while(true){
  const page=checked(await db.from('mt5_broker_deals').select('*').eq('account_id',account).eq('position_id',position).gt('id',after).order('id').limit(500)) as any[];
  if(!page.length)return rows;
  rows.push(...page);after=page[page.length-1].id;
 }
}
export async function mt5JournalAction(body:Record<string,any>){
 const schema=journalInput[body.action as keyof typeof journalInput];
 if(!schema)throw new Error('invalid_journal_action');
 const input:any=schema.parse(body),db=mt5Database();
 if(body.action==='journal_positions'){
  let query=db.from('trade_positions').select(JOURNAL_POSITION_SELECT)
   .eq('broker_private',true).eq('dealing_ranges.instrument',input.instrument).gt('id',input.after_id).order('id').limit(500);
  if(input.account_id!=null)query=query.eq('trading_account_id',input.account_id);
  const rows:any[]=checked(await query)??[];
  return {rows,next_cursor:rows.length?rows[rows.length-1].id:null};
 }
 if(body.action==='journal_context'){
  const link:any=checked(await db.from('mt5_journal_links').select('*,trade_positions(*,dealing_ranges(instrument))').eq('account_id',input.account_id).eq('broker_position_id',input.broker_position_id).maybeSingle());
  return {link};
 }
 if(body.action==='journal_position_update')return {position:checked(await db.from('trade_positions').update(input.fields).eq('id',input.position_id).eq('broker_private',true).select('*').single())};
 if(body.action==='journal_import'){
  const sync:any=checked(await db.from('mt5_history_sync').select('*').eq('account_id',input.account_id).single());
  if(!sync.last_full_at||!sync.synced_at||!Number.isFinite(sync.complete_until_sec)||sync.in_progress||sync.last_error)throw new Error('broker_history_incomplete');
  const rows=await positionDeals(db,input.account_id,input.broker_position_id);
  const position=brokerJournalPosition(rows,input.account_id,input.broker_position_id,input.broker_symbol);
  if(Date.parse(position.exit_time)>sync.complete_until_sec*1000)throw new Error('broker_history_incomplete');
  const {data:result,error}=await db.rpc('import_mt5_journal',{p_account:input.account_id,p_server:input.account_server,p_broker:input.broker_position_id,
   p_range:input.dealing_range_id,p_symbol:input.instrument,p_position:position,p_synced_at:sync.synced_at,p_existing:input.existing_position_id??null,p_trading_account:input.trading_account_id??null});
  if(error){
   const reasons=['account_mismatch','range_mismatch','position_mismatch','position_already_linked','existing_position_required','broker_history_changed'];
   throw new Error(reasons.find(reason=>error.message===reason)??'mt5_storage_unavailable');
  }
  return {trade_position_id:result,dealing_range_id:input.dealing_range_id,broker_stop_loss:null,broker_take_profit:null,
   note:'Historischer Import ohne Live-State-Machine-Ereignis. SL/TP sind aus Deals nicht belegt; keine R-Schätzung.'};
 }
 if(body.action==='journal_comments'){
  const rows:any[]=checked(await db.from('trade_journal_comments').select('*').eq('trade_position_id',input.position_id)
   .gt('id',input.after_id??'00000000-0000-0000-0000-000000000000').order('id').limit(500))??[];
  return {rows,next_cursor:rows.length?rows[rows.length-1].id:null};
 }
 const value=validateJournalComment(input);
 // Gleiche UUID ist ein Retry; der Eltern-Trade darf dabei niemals umgehängt werden.
 const inserted:any[]=checked(await db.from('trade_journal_comments').upsert(value,{onConflict:'id',ignoreDuplicates:true}).select('*'))??[];
 if(inserted.length)return {comment:inserted[0]};
 const previous:any=checked(await db.from('trade_journal_comments').select('*').eq('id',input.id).eq('trade_position_id',input.position_id).single());
 if((['kind','body','source'] as const).every(key=>previous[key]===value[key])&&Date.parse(previous.occurred_at)===Date.parse(value.occurred_at))return {comment:previous};
 const saved=checked(await db.from('trade_journal_comments').update({...value,updated_at:new Date().toISOString()})
  .eq('id',input.id).eq('trade_position_id',input.position_id).select('*').single());
 return {comment:saved};
}
