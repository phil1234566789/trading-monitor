"""Serverreservierung plus SQLite-Ergebnisjournal: unbekannte Teilcloses werden nie erneut gesendet."""
import json
import uuid
from target_broker import TargetBroker,same


class TargetEngine:
    def __init__(self,broker,cloud,db,execute):
        self.broker=TargetBroker(broker);self.cloud,self.db,self.execute=cloud,db,execute
        self.db.execute('CREATE TABLE IF NOT EXISTS target_sends (id TEXT PRIMARY KEY,body TEXT NOT NULL,result TEXT,delivered INTEGER NOT NULL DEFAULT 0)')
        self.db.commit()

    def flush(self):
        for id,body,result in self.db.execute('SELECT id,body,result FROM target_sends WHERE delivered=0').fetchall():
            value=json.loads(result) if result else dict(status='unknown',reason='target_restart_after_reservation')
            if self.cloud.call('target_result',dict(**json.loads(body),operation_id=id,result=value)).get('recorded') is True:
                with self.db:self.db.execute('UPDATE target_sends SET delivered=1 WHERE id=?',(id,))

    def observed(self,row,state,reason):
        self.cloud.call('target_observed',dict(order_id=row['order_id'],revision=row['revision'],state=state,reason=reason))

    def consider(self,row):
        if not self.execute or row['state'] not in ('pending','active'):return
        p=self.broker.position(row)
        if p is None:self.observed(row,'completed','broker_position_closed');return
        c=row['checkpoint']
        if not all(same(getattr(p,k),c[k]) for k in ('volume','sl','tp')):
            self.observed(row,'paused','broker_position_changed');return
        plan=row['plan'];index=row['next_index'];kind='install' if row['state']=='pending' else 'close'
        if kind=='close':
            if plan['native_tp']>0:return
            if index>=len(plan['targets']):self.observed(row,'completed','targets_finished_with_remainder');return
        else:index=-1
        try:self.broker.prepare(row,kind,index)
        except ValueError as error:
            if str(error)=='target_not_reached':return
            self.observed(row,'paused','broker_precheck_failed');return
        id=str(uuid.uuid4());body=dict(order_id=row['order_id'],revision=row['revision'])
        # Das Cloud-Recht wird vor dem lokalen Journal vergeben; verlorene Bestätigung führt zu keinem Versand.
        if self.cloud.call('target_claim',dict(**body,operation_id=id,kind=kind,target_index=index)).get('authorized') is not True:return
        with self.db:self.db.execute('INSERT INTO target_sends(id,body) VALUES (?,?)',(id,json.dumps(body)))
        result=dict(status='unknown',reason='target_send_outcome_unknown')
        try:
            try:request=self.broker.prepare(row,kind,index)
            except ValueError:result=dict(status='rejected',reason='target_position_or_price_changed')
            else:result=self.broker.send(row,kind,index,request)
        finally:
            with self.db:self.db.execute('UPDATE target_sends SET result=? WHERE id=?',(json.dumps(result,allow_nan=False),id))

    def cycle(self,risk_allowed=True):
        if not self.execute:return
        self.flush()
        if not risk_allowed:return
        response=self.cloud.call('target_poll',{})
        plans=response.get('plans')
        if not isinstance(plans,list) or len(plans)>100:raise ValueError('invalid_target_plan_list')
        for row in plans:self.consider(row)
        self.flush()
