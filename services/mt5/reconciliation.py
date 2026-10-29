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
