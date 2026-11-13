"""TP-Änderungen und Teilcloses adressieren immer ein konkretes Broker-Positionsticket."""
from core import positive
from broker_close import market_close_request
from stop_risk import validate_stop_risk


def same(a,b):
    return abs(a-b)<1e-8


class TargetBroker:
    supports_without_sl = True
    supports_stops = True

    def __init__(self, broker):
        self.broker,self.api=broker,broker.api

    def position(self,row):
        plan=row['plan']
        self.broker.account(plan['mode'])
        if (plan['account_login'],plan['account_server'])!=(self.broker.login,self.broker.server):
            raise ValueError('target_account_changed')
        positions=self.api.positions_get(ticket=plan['position'])
        if positions is None:raise ValueError('target_position_unavailable')
        if not positions:return None
        if len(positions)!=1:raise ValueError('target_position_ambiguous')
        p=positions[0]
        if p.ticket!=plan['position'] or p.symbol!=plan['symbol'] or p.magic!=plan['magic'] or p.type!=(0 if plan['direction']=='long' else 1):
            raise ValueError('target_position_changed')
        return p

    def checked_position(self,row):
        p=self.position(row)
        if p is None:raise ValueError('target_position_closed')
        c=row['checkpoint']
        if not all(same(getattr(p,k),c[k]) for k in ('volume','sl','tp')) or not (p.sl == 0 or positive(p.sl)):
            raise ValueError('target_position_changed')
        return p

    def prepare(self,row,kind,index):
        plan=row['plan'];p=self.checked_position(row)
        a,t=self.broker.account(plan['mode'])
        if not a.trade_allowed or not a.trade_expert or not t.trade_allowed or t.tradeapi_disabled:
            raise ValueError('target_trading_disabled')
        if kind=='install':
            info=self.api.symbol_info(p.symbol)
            if info is None or not positive(info.point):raise ValueError('target_specs_unavailable')
            tick,_=self.broker.fresh_tick(p.symbol)
            tp=plan['native_tp']
            sl=plan.get('native_sl',p.sl)
            if 'stops' in plan:
                validate_stop_risk(self.broker,p,plan)
                distance=max(info.trade_stops_level,1)*info.point
                if (p.type==0 and sl>=tick.bid-distance) or (p.type==1 and sl<=tick.ask+distance):
                    raise ValueError('stop_price_changed')
            if tp:
                distance=max(info.trade_stops_level,1)*info.point
                if (p.type==0 and tp<=tick.bid+distance) or (p.type==1 and tp>=tick.ask-distance):
                    raise ValueError('target_price_changed')
            if same(p.tp,tp) and same(p.sl,sl):return None
            request=dict(action=self.api.TRADE_ACTION_SLTP,position=p.ticket,symbol=p.symbol,sl=sl,tp=tp)
        else:
            stop=kind=='stop_close';target=plan['stops' if stop else 'targets'][index]
            request=market_close_request(self.broker,p,target['volume'],('mmt-sl:' if stop else 'mmt-tp:')+row['revision'][:15])
            reached=(request['price']<=target['price'] if p.type==0 else request['price']>=target['price']) if stop else (request['price']>=target['price'] if p.type==0 else request['price']<=target['price'])
            if not reached:
                raise ValueError('target_not_reached')
        check=self.api.order_check(request)
        if check is None or check.retcode!=0:raise ValueError('target_broker_precheck_failed')
        return request

    def send(self,row,kind,index,request):
        plan=row['plan'];self.broker.account(plan['mode'])
        try:self.checked_position(row)
        except ValueError:return dict(status='rejected',reason='target_position_changed_before_send')
        if request is not None:
            result=self.api.order_send(request)
            if result is None:return dict(status='unknown',reason='target_broker_reply_missing')
            if result.retcode!=self.api.TRADE_RETCODE_DONE:
                rejected={10004,10006,10013,10014,10015,10016,10017,10018,10019,10020,10021,10022,10024,10026,10027,10030,10033,10034,10035}
                return dict(status='rejected' if result.retcode in rejected else 'unknown',reason='target_broker_rejected' if result.retcode in rejected else 'target_broker_outcome_unknown')
            if kind!='install' and (not positive(result.deal) or not same(result.volume,plan['stops' if kind=='stop_close' else 'targets'][index]['volume'])):
                return dict(status='unknown',reason='target_partial_close_unresolved')
        p=self.position(row)
        remaining=p.volume if p else 0
        expected=row['checkpoint']['volume']-(plan['stops' if kind=='stop_close' else 'targets'][index]['volume'] if kind!='install' else 0)
        expected_sl=plan.get('native_sl',row['checkpoint']['sl']) if kind=='install' else row['checkpoint']['sl']
        sl=p.sl if p else expected_sl;tp=p.tp if p else plan['native_tp']
        if not same(remaining,expected) or not same(sl,expected_sl) or not same(tp,plan['native_tp']):
            return dict(status='unknown',reason='target_broker_state_unresolved')
        value=dict(status='executed',remaining_volume=remaining,sl=sl,tp=tp)
        if kind!='install':value['deal']=result.deal
        return value
