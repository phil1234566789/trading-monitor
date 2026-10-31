"""Native offene Risiken und Tagesnetto; fehlende Historie ist keine Null."""
import time
from core import positive
from risk import finite

COST_TYPES={4,7,8,9,10,11,12,15,16,17}

def native_position(api,p,offset):
    result=dict(ticket=p.ticket,symbol=p.symbol,volume=p.volume,type=p.type,sl=p.sl,tp=p.tp,profit=p.profit,
                magic=p.magic,price_open=p.price_open,price_current=p.price_current,risk_to_sl=None,remaining_risk_to_sl=None)
    stamp=getattr(p,'time',None)
    if positive(stamp):result['opened_at_sec']=int(stamp)-offset
    if not positive(p.sl) or p.type not in (0,1):return result
    side=api.ORDER_TYPE_BUY if p.type==0 else api.ORDER_TYPE_SELL
    entry=api.order_calc_profit(side,p.symbol,p.volume,p.price_open,p.sl)
    remaining=api.order_calc_profit(side,p.symbol,p.volume,p.price_current,p.sl)
    if finite(entry) and finite(remaining):
        result.update(risk_to_sl=max(0,-entry),remaining_risk_to_sl=max(0,-remaining))
    return result

def native_daily_risk(api,positions,context,offset,now=None):
    now=time.time() if now is None else now
    if (not context or not positive(context.get('day_start_sec')) or not positive(context.get('day_end_sec'))
        or not context['day_start_sec']<=now<context['day_end_sec'] or type(context.get('latched')) is not bool):
        raise ValueError('risk_context_unavailable')
    deals=api.history_deals_get(context['day_start_sec']+offset,int(now)+offset+1)
    if not isinstance(deals,(tuple,list)):raise ValueError('risk_history_unavailable')
    net=0
    for d in deals:
        stamp=d.time_msc/1000-offset
        if not context['day_start_sec']<=stamp<=now+1:continue
        amounts=[d.profit,d.commission,d.swap,getattr(d,'fee',0)]
        if not all(finite(n) for n in amounts):raise ValueError('risk_history_unavailable')
        if d.type in (0,1) or d.type in COST_TYPES:net+=sum(amounts)
    open_loss=0
    for p in positions:
        swap=getattr(p,'swap',0)
        if not finite(p.profit) or not finite(swap):raise ValueError('risk_exposure_unavailable')
        open_loss+=min(0,p.profit+swap)
    return dict(time=int(now),day=context['day'],realized_net_day=net,open_loss=open_loss,latched=context['latched'])
