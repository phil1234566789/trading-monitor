"""Offizielle MT5-Schnittstelle; keine Zugangsdaten in Aufträgen oder Logs."""
import time

from core import positive, validate_intent, volume_for_risk
from reconciliation import reconcile_fill, position_lifecycle

# Symbol-Bitflags aus MQL5 fehlen im Python-SDK; ORDER_FILLING_* sind andere Werte.
SYMBOL_FILLING_FOK = 1
SYMBOL_FILLING_IOC = 2


class Broker:
    def __init__(self, api, login, server, allow_live=False, server_time_offset_seconds=0):
        self.api, self.login, self.server, self.allow_live = api, login, server, allow_live
        if type(server_time_offset_seconds) is not int or abs(server_time_offset_seconds)>14*3600 or server_time_offset_seconds%900:
            raise ValueError('invalid_server_time_offset')
        self.server_time_offset_seconds=server_time_offset_seconds

    def account(self, mode=None):
        a, t = self.api.account_info(), self.api.terminal_info()
        if a is None or t is None or not t.connected:
            raise ValueError('terminal_not_connected')
        if (a.login, a.server) != (self.login, self.server):
            raise ValueError('account_changed')
        demo = a.trade_mode == self.api.ACCOUNT_TRADE_MODE_DEMO
        if (not demo and not self.allow_live) or (mode and (mode == 'demo') != demo):
            raise ValueError('account_mode_mismatch')
        return a, t

    def fresh_tick(self,symbol):
        tick=self.api.symbol_info_tick(symbol)
        if tick is None or not positive(tick.bid) or not positive(tick.ask) or tick.ask<tick.bid:
            raise ValueError('quote_unavailable')
        # Feed-Zeitkorrektur ist explizite Brokerkonfiguration, niemals aus einem alten Tick ableiten.
        received=tick.time-self.server_time_offset_seconds
        if not -1<=time.time()-received<=5:
            raise ValueError('quote_stale')
        return tick,received

    def quotes(self):
        result=[]
        for symbol in self.api.symbols_get() or ():
            if not any(symbol.name == pair or symbol.name.startswith(pair+'.') for pair in ('EURUSD','GBPUSD','XAUUSD')):
                continue
            if len(result)>=10:
                break
            if not self.api.symbol_select(symbol.name,True):
                continue
            info=self.api.symbol_info(symbol.name)
            try:
                tick,received=self.fresh_tick(symbol.name)
            except ValueError:
                continue
            if not info or not tick or not positive(info.point) or not positive(info.volume_min):
                continue
            long_loss=self.api.order_calc_profit(self.api.ORDER_TYPE_BUY,symbol.name,info.volume_min,tick.ask,tick.ask-info.point)
            short_loss=self.api.order_calc_profit(self.api.ORDER_TYPE_SELL,symbol.name,info.volume_min,tick.bid,tick.bid+info.point)
            if long_loss is None or short_loss is None or not positive(-long_loss) or not positive(-short_loss):
                continue
            result.append(dict(symbol=symbol.name,bid=tick.bid,ask=tick.ask,time=received,
                               point=info.point,digits=info.digits,minimum_volume=info.volume_min,
                               loss_per_unit_long=-long_loss/info.point,loss_per_unit_short=-short_loss/info.point))
        return result

    def snapshot(self):
        a, t = self.account()
        positions, orders = self.api.positions_get(), self.api.orders_get()
        if positions is None or orders is None:
            raise ValueError('exposure_unknown')
        return dict(account_login=a.login, account_server=a.server,
                    mode='demo' if a.trade_mode == self.api.ACCOUNT_TRADE_MODE_DEMO else 'live',
                    balance=a.balance, equity=a.equity, currency=a.currency,
                    trade_allowed=bool(a.trade_allowed and a.trade_expert and t.trade_allowed and not t.tradeapi_disabled),
                    positions=[dict(ticket=p.ticket, symbol=p.symbol, volume=p.volume, type=p.type,
                                    sl=p.sl, tp=p.tp, profit=p.profit, magic=p.magic,
                                    price_open=p.price_open, price_current=p.price_current) for p in positions],
                    pending_orders=len(orders))

    def closed_m1(self, symbol):
        if not self.api.symbol_select(symbol, True):
            return None
        rates = self.api.copy_rates_from_pos(symbol, self.api.TIMEFRAME_M1, 1, 1)
        if rates is None or len(rates) != 1:
            return None
        return dict(time=int(rates[0]['time'])-self.server_time_offset_seconds, open=float(rates[0]['open']),close=float(rates[0]['close']))

    def prepare(self, intent):
        validate_intent(intent, self.allow_live)
        a, t = self.account(intent['mode'])
        if (intent['account_login'], intent['account_server']) != (a.login, a.server):
            raise ValueError('intent_account_mismatch')
        if not a.trade_allowed or not a.trade_expert or not t.trade_allowed or t.tradeapi_disabled:
            raise ValueError('trading_disabled')
        # Netting-Konten dürfen einen Test nicht unbemerkt mit einer bestehenden Position verrechnen.
        positions, orders = self.api.positions_get(), self.api.orders_get()
        if positions is None or orders is None:
            raise ValueError('exposure_unknown')
        if positions or orders:
            raise ValueError('existing_exposure')
        symbol = intent['symbol']
        info = self.api.symbol_info(symbol)
        if info is None:
            raise ValueError('unknown_symbol')
        if not info.visible and not self.api.symbol_select(symbol, True):
            raise ValueError('symbol_unavailable')
        tick,received = self.fresh_tick(symbol)
        if tick.ask - tick.bid > 30 * info.point:
            raise ValueError('spread_exceeds_test_limit')
        long = intent['direction'] == 'long'
        side = self.api.ORDER_TYPE_BUY if long else self.api.ORDER_TYPE_SELL
        price = tick.ask if long else tick.bid
        sl = round(intent['stop_loss'], info.digits)
        tp = round(intent.get('take_profit') or 0, info.digits)
        distance = max(info.trade_stops_level, 1) * info.point
        reference = tick.bid if long else tick.ask
        if (long and sl >= reference - distance) or (not long and sl <= reference + distance):
            raise ValueError('invalid_stop_side_or_distance')
        if tp and ((long and tp <= reference + distance) or (not long and tp >= reference - distance)):
            raise ValueError('invalid_target_side_or_distance')
        profit = self.api.order_calc_profit(side, symbol, 1.0, price, sl)
        if profit is None or not positive(-profit):
            raise ValueError('risk_unavailable')
        if intent['trigger']=='market_confirmed':
            if abs(price-intent['reference_price'])>5*info.point:
                raise ValueError('preview_price_changed')
        if intent['trigger'] in ('market_confirmed','m1_directional_close'):
            # Mindestlot-Test: Der Verlust ist eine Schätzung, kein vom Nutzer beauftragtes Geldlimit.
            if intent['volume']!=info.volume_min or intent['volume']>.01:
                raise ValueError('invalid_minimum_volume')
            lots=intent['volume']
        else:
            lots = volume_for_risk(intent['risk_amount'], -profit,
                                   info.volume_min, info.volume_max, info.volume_step, .01)
        if info.filling_mode & SYMBOL_FILLING_FOK:
            filling = self.api.ORDER_FILLING_FOK
        elif info.filling_mode & SYMBOL_FILLING_IOC:
            filling = self.api.ORDER_FILLING_IOC
        else:
            raise ValueError('unsupported_filling_mode')
        request = dict(action=self.api.TRADE_ACTION_DEAL, symbol=symbol, volume=lots,
                       type=side, price=price, sl=sl, tp=tp, deviation=5,
                       magic=int(intent['id'].replace('-', '')[:13], 16),
                       comment='mmt:' + intent['id'][:18],
                       type_time=self.api.ORDER_TIME_GTC, type_filling=filling)
        check = self.api.order_check(request)
        if check is None or check.retcode != 0:
            raise ValueError('broker_precheck_failed')
        return request

    def position_lifecycle(self,intent,result):
        account,_=self.account(intent['mode'])
        position=result.get('position') or result.get('order')
        positions=self.api.positions_get(ticket=position)
        deals=self.api.history_deals_get(position=position)
        return position_lifecycle(result,intent,positions,deals,self.server_time_offset_seconds,account.currency)

    def reconcile_result(self,result):
        self.account()
        if not positive(result.get('order')):
            return None
        deals=self.api.history_deals_get(ticket=result['order'])
        positions=self.api.positions_get(ticket=result['order'])
        return reconcile_fill(result,deals,positions)

    def send(self, intent, request):
        # Nach der Cloud-Freigabe nicht auf Basis einer inzwischen gewechselten Kontositzung senden.
        self.account(intent['mode'])
        if time.time() >= intent['expires_sec']:
            return dict(status='rejected', reason='expired_before_send')
        result = self.api.order_send(request)
        if result is None:
            return dict(status='unknown', reason='no_broker_result')
        fields = dict(retcode=result.retcode, order=result.order, deal=result.deal,
                      volume=result.volume, price=result.price, magic=request['magic'])
        if result.retcode in (self.api.TRADE_RETCODE_DONE, self.api.TRADE_RETCODE_DONE_PARTIAL):
            return dict(status='executed', partial=result.retcode == self.api.TRADE_RETCODE_DONE_PARTIAL, **fields)
        # Timeout/Verbindungsabbruch/PLACED sind keine sichere Ablehnung und dürfen nie einen Retry auslösen.
        rejected = {10004, 10006, 10013, 10014, 10015, 10016, 10017, 10018, 10019,
                    10020, 10021, 10022, 10024, 10026, 10027, 10030, 10033, 10034, 10035}
        return dict(status='rejected' if result.retcode in rejected else 'unknown', **fields)
