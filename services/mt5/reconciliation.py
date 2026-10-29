"""Nur Brokerdaten abgleichen; niemals einen Handelsauftrag erneut senden."""
from core import positive

def reconcile_fill(result,deals,positions):
    order,magic,expected=result.get('order'),result.get('magic'),result.get('volume')
    if not positive(order) or not positive(magic) or not positive(expected) or expected>.01:
        return None
    fills=[d for d in deals or () if d.order==order and d.magic==magic and d.entry==0
           and d.type in (0,1) and positive(d.ticket) and positive(d.volume) and positive(d.price)]
    volume=sum(d.volume for d in fills)
    if fills and abs(volume-expected)<1e-8:
        return dict(result,deal=fills[0].ticket,volume=volume,price=sum(d.price*d.volume for d in fills)/volume,
                    confirmation_source='deal_history')
    matches=[p for p in positions or () if p.ticket==order and p.magic==magic
             and positive(p.price_open) and abs(p.volume-expected)<1e-8]
    if len(matches)==1:
        p=matches[0]
        return dict(result,position=p.ticket,volume=p.volume,price=p.price_open,confirmation_source='position_snapshot')
    return None

def position_lifecycle(result,intent,positions,deals,time_offset,currency):
    position=result.get('position') or result.get('order')
    if positions is None:raise ValueError('position_history_unavailable')
    matches=[p for p in positions if p.ticket==position and p.magic==result.get('magic') and p.symbol==intent['symbol']]
    if len(matches)==1:
        return dict(state='open',position=position,remaining_volume=matches[0].volume)
    if deals is None:raise ValueError('position_history_unavailable')
    pending=dict(state='unverified',position=position)
    rows=[d for d in deals if d.position_id==position and d.symbol==intent['symbol']]
    entries=[d for d in rows if d.entry==0 and d.type in (0,1)]
    exits=[d for d in rows if d.entry in (1,3) and d.type in (0,1)]
    expected=result.get('volume',0)
    if (not entries or not exits or any(d.entry==2 for d in rows)
        or any(d.order!=result.get('order') or d.magic!=result.get('magic') for d in entries)
        or abs(sum(d.volume for d in entries)-expected)>1e-8
        or abs(sum(d.volume for d in exits)-expected)>1e-8
        or not all(positive(d.price) and positive(d.volume) for d in exits)):
        return pending
    reasons={d.reason for d in exits}
    reason='tp' if reasons=={5} else 'sl' if reasons=={4} else 'mixed' if len(reasons)>1 else 'other'
    gross=sum(d.profit for d in rows)
    net=sum(d.profit+d.commission+d.swap+getattr(d,'fee',0) for d in rows)
    return dict(state='closed',position=position,source='deal_history',close_reason=reason,
                exit_price=sum(d.price*d.volume for d in exits)/expected,closed_volume=expected,
                closed_at_sec=max(d.time for d in exits)-time_offset,gross_profit=round(gross,8),
                net_profit=round(net,8),currency=currency)
