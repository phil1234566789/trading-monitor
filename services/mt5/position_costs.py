"""Einmaliger begrenzter Kostenabgleich neuer offener Positionen; kein Historienpoll."""
import time
from concurrent.futures import ThreadPoolExecutor
from history_deals import normalise_deal

class PositionCosts:
    def __init__(self,broker,cloud):
        self.broker,self.cloud=broker,cloud
        self.done=set();self.retry_at={}
        self.uploads=ThreadPoolExecutor(max_workers=1,thread_name_prefix='mmt-position-costs');self.pending=None

    def sync(self):
        if self.pending:
            identifier,future,count=self.pending
            if not future.done():return
            self.pending=None
            if future.result().get('recorded')!=count:raise ValueError('position_cost_unconfirmed')
            self.done.add(identifier)
        broker=self.broker
        before,_=broker.account()
        positions=broker.api.positions_get()
        if positions is None:return
        active={int(getattr(p,'identifier',p.ticket)) for p in positions}
        self.done.intersection_update(active)
        self.retry_at={k:v for k,v in self.retry_at.items() if k in active}
        # Höchstens eine neue Position pro Durchlauf: Schutzprüfungen haben Vorrang.
        pending=next((p for p in positions if int(getattr(p,'identifier',p.ticket)) not in self.done and time.monotonic()>=self.retry_at.get(int(getattr(p,'identifier',p.ticket)),0)),None)
        if pending is None:return
        identifier=int(getattr(pending,'identifier',pending.ticket))
        self.retry_at[identifier]=time.monotonic()+60
        deals=broker.api.history_deals_get(position=identifier)
        if not isinstance(deals,(tuple,list)) or not deals or len(deals)>100:return
        rows=[normalise_deal(d,broker.server_time_offset_seconds) for d in deals]
        if any(r['position_id']!=identifier for r in rows):raise ValueError('position_cost_identity_changed')
        trades=[r for r in rows if r['type'] in (0,1)]
        if any(r['symbol']!=pending.symbol or r['entry'] not in (0,1,3) or r['type']!=(pending.type if r['entry']==0 else 1-pending.type) for r in trades):return
        remaining=sum(r['volume']*(1 if r['entry']==0 else -1) for r in trades)
        if abs(remaining-pending.volume)>1e-8:return
        after,_=broker.account()
        if (before.login,before.server)!=(after.login,after.server):raise ValueError('position_cost_account_changed')
        # Nur HTTPS läuft getrennt; das MT5-SDK bleibt ausschließlich im Schutzthread.
        future=self.uploads.submit(self.cloud.call,'history_batch',dict(account_login=broker.login,account_server=broker.server,currency=before.currency,deals=rows))
        self.pending=(identifier,future,len(rows))
