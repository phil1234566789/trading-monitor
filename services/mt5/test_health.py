import json
import unittest
from health import fault_details

class HealthTests(unittest.TestCase):
    def test_fault_reports_safe_location_without_secret_error_text(self):
        try:
            raise AttributeError('password=never-share-this')
        except AttributeError as error:
            fault=fault_details(error)
            self.assertEqual(fault['code'],'AttributeError')
            self.assertIn('test_fault_reports',fault['stage'])
            self.assertNotIn('never-share-this',json.dumps(fault))
            self.assertEqual(fault_details(error,fault)['since_sec'],fault['since_sec'])
