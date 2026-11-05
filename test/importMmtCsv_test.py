import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('importer', Path(__file__).parents[1] / 'scripts/importMmtCsv.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)
HEADER = 'Account;Provider Account;Start Balance;Trade Id;Contract;Quantity;Entry Date/Time;Entry Price;Exit Date/Time;Exit Price;Net PnL;Commissions;Divider\n'
ROW = 'Test;42;50000;1;GBPUSD;50000;2026-10-01 10:00:00;1,2;2026-10-01 11:00:00;1,3;99,5;-0,5;10000\n'


class ImportTest(unittest.TestCase):
    def test_preserves_net_commission_and_unknown_direction(self):
        start, rows = importer.parse_export((HEADER + ROW).encode(), 42)
        self.assertEqual(start, 50000)
        self.assertEqual(rows[0]['net'], 99.5)
        self.assertEqual(rows[0]['commission'], -.5)
        self.assertEqual(rows[0]['volume'], 5)
        self.assertIsNone(rows[0]['direction'])
        self.assertEqual(rows[0]['opened_at'], 1790841600000)

    def test_dst_is_aware_and_ambiguity_is_rejected(self):
        self.assertEqual(importer.timestamp('2026-10-26 10:00:00'), 1793005200000)
        with self.assertRaises(ValueError):
            importer.timestamp('2026-10-25 02:30:00')

    def test_rejects_mixed_accounts_and_duplicate_rows(self):
        for data in [HEADER + ROW + ROW, HEADER + ROW.replace(';42;', ';43;')]:
            with self.assertRaises(ValueError):
                importer.parse_export(data.encode(), 42)

    def test_sql_is_archived_only_and_escapes_source_names(self):
        sql, summary = importer.prepare_sql((HEADER + ROW).encode(), "test'file.csv", 42, 50100, 50099.5, 'test')
        self.assertIn("test''file.csv", sql)
        self.assertIn('and archived', sql)
        self.assertIn('on conflict(account_id,source_trade_id) do nothing', sql)
        self.assertEqual(summary['csv_end'], '50099.5')

    def test_reset_does_not_inherit_breach_or_another_accounts_history(self):
        sql, _ = importer.prepare_sql((HEADER + ROW).encode(), 'test.csv', 42, 50100, 50099.5,
                                     'Reset, Fristablauf vermutet', status='closed', note='Reset laut Nutzer.')
        self.assertIn('"status": "closed"', sql)
        self.assertIn('Reset laut Nutzer.', sql)
        self.assertNotIn('frühere Kontonummer', sql)
        with self.assertRaises(ValueError):
            importer.prepare_sql((HEADER + ROW).encode(), 'test.csv', 42, 50100, 50099.5, 'test', status='invalid')

    def test_prefixed_provider_account_requires_an_explicit_exact_match(self):
        data = (HEADER + ROW.replace(';42;', ';IQEV10K-42;')).encode()
        with self.assertRaises(ValueError):
            importer.parse_export(data, 42)
        _, rows = importer.parse_export(data, 42, provider_account='IQEV10K-42')
        self.assertEqual(len(rows), 1)
        with self.assertRaises(ValueError):
            importer.parse_export(data, 42, provider_account='IQEV50K-42')

    def test_signed_volumetrica_quantities_preserve_direction_and_positive_lots(self):
        header = HEADER.replace('Account;', 'Account;Provider;', 1)
        for quantity, direction in [('50000', 'long'), ('-50000', 'short')]:
            row = ROW.replace('Test;', 'Test;VolumetricaFX;', 1).replace(';50000;2026-', ';'+quantity+';2026-')
            _, trades = importer.parse_export((header + row).encode(), 42)
            self.assertEqual(trades[0]['direction'], direction)
            self.assertEqual(trades[0]['volume'], 5)
        with self.assertRaises(ValueError):
            importer.parse_export((HEADER + ROW.replace(';50000;2026-', ';-50000;2026-')).encode(), 42)


if __name__ == '__main__':
    unittest.main()
