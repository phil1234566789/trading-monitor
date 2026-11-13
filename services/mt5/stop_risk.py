"""Ein geteilter SL muss auch ohne Worker die volle Restposition im Kontobudget absichern."""
import time
from core import positive
from risk import risk_budget, finite


def validate_stop_risk(broker,position,plan):
    snapshot=broker.guard_snapshot()
    current=next((p for p in snapshot['positions'] if p['ticket']==position.ticket and p['symbol']==position.symbol),None)
    if current is None or not finite(current.get('swap')):raise ValueError('risk_exposure_unavailable')
    rest=dict(snapshot,positions=[p for p in snapshot['positions'] if p['ticket']!=position.ticket])
    policy=broker.risk_context['policy']
    limits=risk_budget(plan['risk_mode'],position.symbol,rest,policy,time.time())
    daily=limits['daily_left']-min(0,current['profit'])-min(0,current['swap'])
    drawdown=limits['drawdown_left']-current['profit']
    available=min(limits['requested'],limits['market_left'],daily,drawdown)-policy['cost_buffer']
    side=broker.api.ORDER_TYPE_BUY if position.type==0 else broker.api.ORDER_TYPE_SELL
    gross=broker.api.order_calc_profit(side,position.symbol,position.volume,position.price_open,plan['native_sl'])
    if not finite(gross) or not positive(available) or max(0,-gross)>available+1e-7:
        raise ValueError('stop_risk_budget_exceeded')
