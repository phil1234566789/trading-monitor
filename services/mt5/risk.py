"""Gemeinsames Konto-/Marktrisiko; Brokerberechnung statt Forex-Konstanten."""
import math
from decimal import Decimal, ROUND_FLOOR
from core import positive

RISK_BASE=50000
RISK_MODES={'risky':.005,'full':.009}

def finite(n):return type(n) in (int,float) and math.isfinite(n)
def nonnegative(n):return finite(n) and n>=0
def market(symbol):return symbol.split('.')[0].upper()

def risk_budget(mode,symbol,snapshot,policy,now):
    if mode not in RISK_MODES:raise ValueError('invalid_risk_mode')
    if (not policy or not all(positive(policy.get(k)) for k in ('risk_base','drawdown_floor','valid_until_sec','cost_buffer','confirmed_balance','confirmed_equity'))
        or policy.get('risk_base')!=RISK_BASE or policy['valid_until_sec']<=now or policy.get('currency')!='USD' or policy.get('currency')!=snapshot.get('currency')):
        raise ValueError('risk_limits_unconfirmed')
    if snapshot['balance']>policy['confirmed_balance']+1e-7 or snapshot['equity']>policy['confirmed_equity']+1e-7:
        raise ValueError('risk_floor_reconfirmation_required')
    r=snapshot.get('risk')
    if (snapshot.get('risk_guards_ready') is not True or not r or not positive(r.get('time'))
        or not -1<=now-r['time']<=5 or r.get('day')!=policy.get('day') or r.get('latched') is not False
        or not finite(r.get('realized_net_day')) or not finite(r.get('open_loss')) or r['open_loss']>0):
        raise ValueError('risk_guard_unavailable')
    positions=snapshot.get('positions',[])
    if (snapshot.get('pending_orders') or not positive(snapshot.get('equity')) or not positive(snapshot.get('balance'))
        or (positions and snapshot.get('hedging') is not True)):
        raise ValueError('risk_exposure_unavailable')
    used,remaining=0,0
    for p in positions:
        if not all(nonnegative(p.get(k)) for k in ('risk_to_sl','remaining_risk_to_sl')):raise ValueError('risk_exposure_unavailable')
        remaining+=p['remaining_risk_to_sl']+policy['cost_buffer']
        if market(p['symbol'])==market(symbol):used+=p['risk_to_sl']+policy['cost_buffer']
    requested=RISK_BASE*RISK_MODES[mode]
    market_left=max(0,RISK_BASE*.009-used)
    daily_left=max(0,1000+r['realized_net_day']+r['open_loss']-remaining)
    drawdown_left=max(0,snapshot['equity']-policy['drawdown_floor']-remaining)
    allocation=min(requested,market_left,daily_left,drawdown_left)
    available=allocation-policy['cost_buffer']
    if not positive(available):raise ValueError('risk_budget_exhausted')
    return dict(requested=requested,allocation=allocation,cost_buffer=policy['cost_buffer'],available=available,market_used=used,market_left=market_left,daily_left=daily_left,drawdown_left=drawdown_left)

def risk_volume(risk,loss_per_lot,minimum,maximum,step):
    if not all(positive(v) for v in (risk,loss_per_lot,minimum,maximum,step)):raise ValueError('risk_sizing_unavailable')
    raw=min(Decimal(str(risk))/Decimal(str(loss_per_lot)),Decimal(str(maximum)))
    increment=Decimal(str(step))
    lots=(raw/increment+Decimal('0.000000001')).to_integral_value(rounding=ROUND_FLOOR)*increment
    if lots<Decimal(str(minimum)):raise ValueError('broker_minimum_exceeds_budget')
    return float(lots)
