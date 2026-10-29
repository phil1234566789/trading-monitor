"""Brokerunabhängige Prüfung und dauerhaftes Versandjournal."""
import json
import math
import sqlite3
import uuid
from decimal import Decimal, ROUND_FLOOR


def positive(value):
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def validate_intent(value, allow_live=False):
    if not isinstance(value, dict):
        raise ValueError('invalid_intent')
    try:
        uuid.UUID(value['id'])
    except (KeyError, ValueError, TypeError, AttributeError):
        raise ValueError('invalid_id') from None
    if type(value.get('account_login')) is not int or value['account_login'] <= 0:
        raise ValueError('invalid_account')
    for key in ('account_server', 'symbol'):
        if not isinstance(value.get(key), str) or not 1 <= len(value[key]) <= 100:
            raise ValueError('invalid_' + key)
    if value.get('direction') not in ('long', 'short'):
        raise ValueError('invalid_direction')
    if value.get('mode') not in ('demo', 'live') or (value['mode'] == 'live' and not allow_live):
        raise ValueError('live_not_enabled')
    for key in ('stop_loss', 'risk_amount', 'created_sec', 'expires_sec'):
        if not positive(value.get(key)):
            raise ValueError('invalid_' + key)
    if value['risk_amount'] > 5 or not 0 < value['expires_sec'] - value['created_sec'] <= 3600:
        raise ValueError('test_limit_exceeded')
    if value.get('take_profit') is not None and not positive(value['take_profit']):
        raise ValueError('invalid_take_profit')
    trigger = value.get('trigger')
    if trigger not in ('m1_directional_close', 'market_confirmed', 'm1_close_above', 'm1_close_below', 'test_next_m1_close'):
        raise ValueError('unknown_trigger')
    if trigger == 'm1_directional_close' and (not positive(value.get('volume')) or value['volume']>.01):
        raise ValueError('invalid_search_volume')
    if trigger == 'market_confirmed':
        if (not positive(value.get('reference_price')) or not positive(value.get('volume'))
                or value['volume'] > .01 or value['expires_sec'] - value['created_sec'] > 30):
            raise ValueError('invalid_market_preview')
    elif trigger == 'test_next_m1_close':
        if value['mode'] != 'demo':
            raise ValueError('test_trigger_demo_only')
    elif trigger != 'm1_directional_close' and not positive(value.get('trigger_price')):
        raise ValueError('invalid_trigger_price')
    return value


def trigger_matches(intent, candle, now):
    if intent['trigger'] == 'market_confirmed':
        return intent['created_sec'] <= now < intent['expires_sec']
    opened, close = candle.get('time'), candle.get('close')
    if not positive(opened) or not positive(close) or not positive(now):
        return False
    # Nach einer Netzpause keine alten Signale nachträglich handeln.
    closed = opened + 60
    if closed <= intent['created_sec'] or not 0 <= now - closed <= 10 or now >= intent['expires_sec']:
        return False
    if intent['trigger'] == 'm1_directional_close':
        opened_price=candle.get('open')
        return positive(opened_price) and (close<opened_price if intent['direction']=='short' else close>opened_price)
    if intent['trigger'] == 'test_next_m1_close':
        return True
    if intent['trigger'] == 'm1_close_above':
        return close > intent['trigger_price']
    if intent['trigger'] == 'm1_close_below':
        return close < intent['trigger_price']
    return False


def volume_for_risk(risk, loss_per_lot, minimum, maximum, step, cap):
    if not all(positive(v) for v in (risk, loss_per_lot, minimum, maximum, step, cap)):
        raise ValueError('invalid_sizing_data')
    lots = min(Decimal(str(risk)) / Decimal(str(loss_per_lot)), Decimal(str(maximum)), Decimal(str(cap)))
    increment = Decimal(str(step))
    lots = (lots / increment).to_integral_value(rounding=ROUND_FLOOR) * increment
    if lots < Decimal(str(minimum)):
        raise ValueError('broker_minimum_exceeds_budget')
    return float(lots)


class Journal:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('CREATE TABLE IF NOT EXISTS sends (id TEXT PRIMARY KEY, result TEXT, delivered INTEGER NOT NULL DEFAULT 0)')
        self.db.commit()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.db.close()

    def reserve(self, order_id):
        with self.db:
            return self.db.execute('INSERT OR IGNORE INTO sends(id) VALUES (?)', (order_id,)).rowcount == 1

    def finish(self, order_id, result):
        with self.db:
            self.db.execute('UPDATE sends SET result=? WHERE id=?', (json.dumps(result, allow_nan=False), order_id))

    def pending(self):
        return [dict(id=row[0], result=json.loads(row[1]) if row[1] else None)
                for row in self.db.execute('SELECT id,result FROM sends WHERE delivered=0')]

    def acknowledge(self, order_id):
        with self.db:
            self.db.execute('UPDATE sends SET delivered=1 WHERE id=?', (order_id,))
