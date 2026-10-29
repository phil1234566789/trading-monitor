import time
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock, patch

from broker import Broker
from test_core import intent


def api():
    m = Mock()
    m.ACCOUNT_TRADE_MODE_DEMO = 0
    m.ORDER_TYPE_BUY, m.ORDER_TYPE_SELL = 0, 1
    m.TRADE_ACTION_DEAL, m.ORDER_TIME_GTC, m.ORDER_FILLING_FOK = 1, 0, 0
    m.SYMBOL_FILLING_FOK, m.SYMBOL_FILLING_IOC, m.ORDER_FILLING_IOC = 1, 2, 1
    m.account_info.return_value = NS(login=42, server='Demo', trade_mode=0, trade_allowed=True,
                                      trade_expert=True, balance=50000, equity=50000, currency='USD')
    m.terminal_info.return_value = NS(connected=True, tradeapi_disabled=False, trade_allowed=True)
    m.positions_get.return_value, m.orders_get.return_value = (), ()
    m.symbol_info.return_value = NS(visible=True, digits=5, point=.00001, trade_stops_level=10,
                                     volume_min=.01, volume_max=100, volume_step=.01, filling_mode=3)
    m.symbol_info_tick.return_value = NS(bid=1.30000, ask=1.30010, time=time.time())
    m.order_calc_profit.return_value = -1000
    m.order_check.return_value = NS(retcode=0)
    return m


class BrokerTests(unittest.TestCase):
    def test_prepares_capped_short_with_protective_stop(self):
        m = api()
        order = intent(risk_amount=5)
        m.order_calc_profit.return_value = -100
        request = Broker(m, 42, 'Demo').prepare(order)
        self.assertEqual(request['volume'], .01)
        self.assertEqual(request['price'], 1.3)
        self.assertEqual(request['sl'], 1.31)
        m.order_send.assert_not_called()

    def test_confirmed_market_uses_minimum_and_rejects_changed_quote(self):
        m=api()
        m.order_calc_profit.return_value=-100
        order=intent(trigger='market_confirmed', reference_price=1.3, volume=.01, created_sec=240, expires_sec=270, risk_amount=5)
        self.assertEqual(Broker(m,42,'Demo').prepare(order)['volume'],.01)
        order['reference_price']=1.29
        with self.assertRaises(ValueError):
            Broker(m,42,'Demo').prepare(order)
        m.order_send.assert_not_called()

    def test_explicit_feed_offset_does_not_allow_old_or_future_ticks(self):
        m=api();m.symbol_info_tick.return_value.time=10900
        broker=Broker(m,42,'Demo',server_time_offset_seconds=10800)
        with patch('broker.time.time',return_value=100):
            self.assertEqual(broker.fresh_tick('GBPUSD')[1],100)
            with self.assertRaises(ValueError):Broker(m,42,'Demo').fresh_tick('GBPUSD')
        for host,tick in [(100,10870),(102,10872),(100,10902)]:
            m.symbol_info_tick.return_value.time=tick
            with patch('broker.time.time',return_value=host),self.assertRaises(ValueError):
                broker.fresh_tick('GBPUSD')

    def test_quote_list_includes_broker_gold_but_not_unrelated_instruments(self):
        m=api()
        m.symbols_get.return_value=[NS(name='XAUUSD.gbe'),NS(name='BTCUSD.gbe')]
        m.symbol_info.return_value.point=.01
        m.symbol_info.return_value.digits=2
        quotes=Broker(m,42,'Demo').quotes()
        self.assertEqual([q['symbol'] for q in quotes],['XAUUSD.gbe'])
        self.assertEqual(quotes[0]['minimum_volume'],.01)
        m.order_send.assert_not_called()

    def test_refuses_account_switch_live_account_and_disabled_trading(self):
        for changes in [dict(login=43), dict(server='Other'), dict(trade_mode=2),
                        dict(trade_allowed=False), dict(trade_expert=False)]:
            m = api()
            for key, val in changes.items():
                setattr(m.account_info.return_value, key, val)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                Broker(m, 42, 'Demo').prepare(intent())
            m.order_send.assert_not_called()

    def test_stale_prices_wrong_stop_existing_exposure_and_unknown_reads_block(self):
        for kind in ['stale', 'stop', 'position', 'positions_unknown', 'orders_unknown']:
            m = api()
            order = intent(risk_amount=5)
            if kind == 'stale':
                m.symbol_info_tick.return_value.time -= 30
            if kind == 'stop':
                order['stop_loss'] = 1.29
            if kind == 'position':
                m.positions_get.return_value = (NS(ticket=1),)
            if kind == 'positions_unknown':
                m.positions_get.return_value = None
            if kind == 'orders_unknown':
                m.orders_get.return_value = None
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                Broker(m, 42, 'Demo').prepare(order)


if __name__ == '__main__':
    unittest.main()
