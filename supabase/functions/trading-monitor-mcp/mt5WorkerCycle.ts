import {workerAction} from './mt5Execution.ts';
import {dailyStopAction} from './mt5DailyStop.ts';
import {targetPlanAction} from './mt5TargetPlans.ts';
import {activeMt5Account,activeMt5AccountId,checked,mt5Database} from './mt5Credentials.ts';

export const UI_PRESENCE_MS=90_000;

// Ein HTTP-Call statt poll/guard_sync/target_poll/risk_context; Reihenfolge und Gates wie im alten Worker-Zyklus.
export async function workerCycle(body:Record<string,any>){
  const poll:any=await workerAction({...body,action:'poll'});
  const guard:any=await dailyStopAction({...body,action:'guard_sync'});
  const plans:any[]=guard.latched?[]:(await targetPlanAction({...body,action:'target_poll'},true) as any).plans;
  const risk_context=await dailyStopAction({...body,action:'risk_context'});
  const db=mt5Database();
  const wake=checked(await db.from('mt5_worker_wake').select('ui_seen_at').eq('id',true).single());
  const ui_active=!!wake?.ui_seen_at&&Date.now()-Date.parse(wake.ui_seen_at)<=UI_PRESENCE_MS;
  const s=body.snapshot;
  // Leerlauf nur, wenn weder Broker noch Server noch lokales Journal etwas Offenes kennen.
  // watch_orders ist per Cursor seitenweise: nur eine Abfrage ab Anfang darf "nichts beobachtet" bedeuten.
  const idle=body.local_busy===false&&body.watch_cursor==null&&!ui_active&&!s.worker_error&&s.positions.length===0&&s.pending_orders===0
    &&!poll.orders.length&&!poll.watch_orders.length&&!guard.commands.length&&!plans.length;
  if(idle){
    const account=await activeMt5Account(body.account_id);
    const ids=[account.id,...(await activeMt5AccountId(db)===account.id?['primary']:[])];
    checked(await db.from('mt5_bridge_state').update({poll_mode:'idle'}).in('id',ids));
  }
  return {...poll,guard,plans,risk_context,ui_active,idle};
}
