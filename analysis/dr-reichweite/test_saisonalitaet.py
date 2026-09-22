"""Regression: ältere zweite Halbjahre dürfen nicht im ersten Halbjahr landen."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class SaisonalitaetTest(unittest.TestCase):
    def test_halbjahre_ueber_mehrere_jahre(self):
        rows = [
            {"day": day, "reach": reach, "risk": 2, "t_inval": 30}
            for day, reach in [("2025-01-10", 20), ("2025-07-10", 5),
                               ("2026-01-10", 20), ("2026-07-10", 5)]
        ]
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "punkt1_result.json").write_text(json.dumps(rows), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("saisonalitaet.py"))],
                cwd=directory, capture_output=True, check=True,
                env=dict(os.environ, PYTHONIOENCODING="utf-8"),
            ).stdout.decode("utf-8")
        self.assertRegex(result, r"Januar-Juni\s+2\s+100%")
        self.assertRegex(result, r"Juli-Dezember\s+2\s+0%")


if __name__ == "__main__":
    unittest.main()
