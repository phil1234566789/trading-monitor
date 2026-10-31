"""Cloud-Claim plus dauerhaftes lokales Journal: ein unbekannter Close wird niemals wiederholt."""
import json
from guard_broker import GuardBroker


class DailyStopEngine:
    def __init__(self,broker,cloud,db,execute=True):
        self.broker,self.cloud,self.db,self.execute=GuardBroker(broker),cloud,db,execute
        self.login,self.server=broker.login,broker.server
        db.execute('CREATE TABLE IF NOT EXISTS guard_sends(id TEXT PRIMARY KEY,row TEXT NOT NULL,result TEXT,delivered INTEGER NOT NULL DEFAULT 0)')
        db.commit()
        self.latched=True

    def call(self,action,fields):
        return self.cloud.call(action,dict(account_login=self.login,account_server=self.server,**fields))

    def record(self,row,result):
        with self.db:self.db.execute('UPDATE guard_sends SET result=?,delivered=0 WHERE id=?',(json.dumps(result,allow_nan=False),row['id']))
        if self.call('guard_result',dict(id=row['id'],result=result)).get('recorded') is True:
            with self.db:self.db.execute('UPDATE guard_sends SET delivered=1 WHERE id=?',(row['id'],))

    def flush(self):
        for command,raw in self.db.execute('SELECT row,result FROM guard_sends WHERE delivered=0').fetchall():
            row=json.loads(command)
            result=json.loads(raw) if raw else dict(status='unknown',reason='guard_restart_after_reservation')
            if result['status']=='unknown':
                try:
                    if self.broker.current(row) is None:result=dict(status='executed',reason='broker_exposure_absent')
                except Exception:result=dict(status='unknown',reason='guard_reconcile_unavailable')
            self.record(row,result)

    def cycle(self,snapshot):
        response=self.call('guard_sync',dict(snapshot=snapshot,exposure=self.broker.exposure()))
        if type(response.get('latched')) is not bool or not isinstance(response.get('commands'),list):raise ValueError('invalid_guard_response')
        self.latched=response['latched']
        if not self.execute:return not self.latched
        self.flush()
        rows=sorted(response['commands'],key=lambda r:(r['kind']!='cancel',r['id']))
        for row in rows:
            if row['status'] in ('sending','unknown'):
                try:current=self.broker.current(row)
                except Exception:
                    self.call('guard_result',dict(id=row['id'],result=dict(status='unknown',reason='guard_reconcile_unavailable')))
                    continue
                if current is None:self.call('guard_result',dict(id=row['id'],result=dict(status='executed',reason='broker_exposure_absent')))
                elif row['status']=='sending':self.call('guard_result',dict(id=row['id'],result=dict(status='unknown',reason='guard_prior_send_unresolved')))
                continue
            if row['status']!='pending':continue
            # Ein Server-Claim ohne lokales Ergebnis bleibt nach einem Crash gesperrt.
            if self.db.execute('SELECT 1 FROM guard_sends WHERE id=?',(row['id'],)).fetchone():continue
            if self.call('guard_claim',dict(id=row['id'])).get('authorized') is not True:continue
            with self.db:self.db.execute('INSERT INTO guard_sends(id,row) VALUES (?,?)',(row['id'],json.dumps(row,allow_nan=False)))
            try:
                request=self.broker.prepare(row)
            except ValueError as error:
                result=dict(status='rejected',reason=str(error)[:100])
            else:
                try:result=self.broker.send(row,request)
                except Exception:result=dict(status='unknown',reason='guard_outcome_unknown')
            self.record(row,result)
            # Nach jeder Brokeraktion erst frische Exposition lesen, bevor die nächste Aktion beginnt.
            break
        return not self.latched
