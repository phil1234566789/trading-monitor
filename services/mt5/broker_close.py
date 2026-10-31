"""Ein gemeinsamer Close-Request für Teilziele und Tagesstopp, immer per Positionsticket."""
from core import positive
from broker import SYMBOL_FILLING_FOK, SYMBOL_FILLING_IOC


def market_close_request(broker,position,volume,comment):
    api=broker.api
    info=api.symbol_info(position.symbol)
    if info is None or not all(positive(getattr(info,k,None)) for k in ('volume_min','volume_max','volume_step')):
        raise ValueError('close_specs_unavailable')
    def valid(v):
        return positive(v) and info.volume_min-1e-10<=v<=info.volume_max and abs(v/info.volume_step-round(v/info.volume_step))<1e-7
    remaining=position.volume-volume
    if not valid(volume) or remaining< -1e-10 or (remaining>1e-10 and not valid(remaining)):
        raise ValueError('close_volume_changed')
    if info.filling_mode & SYMBOL_FILLING_FOK:filling=api.ORDER_FILLING_FOK
    elif info.filling_mode & SYMBOL_FILLING_IOC:filling=api.ORDER_FILLING_IOC
    else:raise ValueError('close_filling_unsupported')
    tick,_=broker.fresh_tick(position.symbol)
    return dict(action=api.TRADE_ACTION_DEAL,position=position.ticket,symbol=position.symbol,volume=volume,
        type=api.ORDER_TYPE_SELL if position.type==0 else api.ORDER_TYPE_BUY,
        price=tick.bid if position.type==0 else tick.ask,deviation=5,magic=position.magic,
        comment=comment,type_time=api.ORDER_TIME_GTC,type_filling=filling)
