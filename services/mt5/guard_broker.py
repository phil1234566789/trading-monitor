"""Notfallaufträge betreffen auch manuelle Positionen; kein Magic-Filter darf Risiko verstecken."""
from core import positive
from broker_close import market_close_request


class GuardBroker:
    def __init__(self,broker):
        self.broker,self.api=broker,broker.api

    def exposure(self):
        self.broker.account()
        positions,orders=self.api.positions_get(),self.api.orders_get()
        if positions is None or orders is None:raise ValueError('guard_exposure_unavailable')
        return dict(positions=[dict(ticket=p.ticket,symbol=p.symbol,type=p.type,magic=p.magic,volume=p.volume,sl=p.sl,tp=p.tp) for p in positions],
                    orders=[dict(ticket=o.ticket,symbol=o.symbol,type=o.type,magic=o.magic,volume=o.volume_current) for o in orders])

    def current(self,row):
        c=row['checkpoint']
        self.broker.account(c['mode'])
        if (c['account_login'],c['account_server'])!=(self.broker.login,self.broker.server):raise ValueError('guard_account_changed')
        rows=self.api.positions_get(ticket=row['ticket']) if row['kind']=='close' else self.api.orders_get(ticket=row['ticket'])
        if rows is None:raise ValueError('guard_exposure_unavailable')
        if not rows:return None
        if len(rows)!=1:raise ValueError('guard_exposure_ambiguous')
        p=rows[0]
        if p.ticket!=row['ticket'] or p.symbol!=row['symbol'] or p.type!=c['type'] or p.magic!=c['magic']:
            raise ValueError('guard_exposure_changed')
        return p

    def prepare(self,row):
        a,t=self.broker.account(row['checkpoint']['mode'])
        if getattr(a,'margin_mode',None)!=getattr(self.api,'ACCOUNT_MARGIN_MODE_RETAIL_HEDGING',-1):raise ValueError('guard_hedging_required')
        if not a.trade_allowed or not a.trade_expert or not t.trade_allowed or t.tradeapi_disabled:raise ValueError('guard_trading_disabled')
        p=self.current(row)
        if p is None:return None
        if row['kind']=='close':
            if abs(p.volume-row['expected_volume'])>1e-8:raise ValueError('guard_volume_changed')
            request=market_close_request(self.broker,p,p.volume,'mmt-day:'+row['id'][:15])
        else:
            request=dict(action=self.api.TRADE_ACTION_REMOVE,order=p.ticket,symbol=p.symbol,comment='mmt-day:'+row['id'][:15])
        check=self.api.order_check(request)
        if check is None or check.retcode!=0:raise ValueError('guard_precheck_failed')
        return request

    def send(self,row,request):
        self.broker.account(row['checkpoint']['mode'])
        if request is None:return dict(status='executed',reason='broker_exposure_absent')
        request=self.prepare(row)
        if request is None:return dict(status='executed',reason='broker_exposure_absent')
        result=self.api.order_send(request)
        if result is None:return dict(status='unknown',reason='guard_no_broker_reply')
        fields={k:getattr(result,k,0) for k in ('retcode','deal','order','volume')}
        if result.retcode!=self.api.TRADE_RETCODE_DONE:
            rejected={10004,10006,10013,10014,10015,10016,10017,10018,10019,10020,10021,10022,10024,10026,10027,10030,10033,10034,10035}
            return dict(status='rejected' if result.retcode in rejected else 'unknown',reason='guard_broker_rejected' if result.retcode in rejected else 'guard_outcome_unknown',**fields)
        p=self.current(row)
        if p is not None:return dict(status='unknown',reason='guard_exposure_not_yet_absent',**fields)
        if row['kind']=='close' and not positive(result.deal):return dict(status='unknown',reason='guard_close_deal_missing',**fields)
        return dict(status='executed',reason='broker_exposure_absent',**fields)
