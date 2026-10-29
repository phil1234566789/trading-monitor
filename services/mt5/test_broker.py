import time
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock

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
