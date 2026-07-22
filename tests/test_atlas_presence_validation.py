import json
import sys
import unittest
from pathlib import Path


LAMBDA_DIR = Path(__file__).parents[1] / "terraform/modules/article_atlas_presence/lambda"
sys.path.insert(0, str(LAMBDA_DIR))

from validation import coordinate, country_code, parse_body  # noqa: E402


class PresenceValidationTests(unittest.TestCase):
    def test_country_code_accepts_only_two_ascii_letters(self):
        self.assertEqual(country_code("kr"), "KR")
        self.assertEqual(country_code("USA"), "XX")
        self.assertEqual(country_code(""), "XX")

    def test_coordinate_accepts_normalized_finite_numbers(self):
        self.assertEqual(str(coordinate(0)), "0")
        self.assertEqual(str(coordinate(0.123456)), "0.1235")
        self.assertEqual(str(coordinate(1)), "1")

    def test_coordinate_rejects_invalid_values(self):
        for value in (-0.01, 1.01, True, "0.5", float("inf"), float("nan")):
            with self.subTest(value=value), self.assertRaises(ValueError):
                coordinate(value)

    def test_parse_body_requires_small_json_object(self):
        self.assertEqual(parse_body('{"action":"hello"}'), {"action": "hello"})
        with self.assertRaises(ValueError):
            parse_body("[]")
        with self.assertRaises(ValueError):
            parse_body(json.dumps({"value": "x" * 513}))

    def test_cost_safety_contract_is_kept_in_source(self):
        backend = (LAMBDA_DIR / "index.py").read_text()
        client = (Path(__file__).parents[1] / "static/js/atlas-presence-client.js").read_text()
        terraform = (LAMBDA_DIR.parent / "main.tf").read_text()

        self.assertIn('MOVE_INTERVAL_MS = int(os.environ.get("MOVE_INTERVAL_MS", "5000"))', backend)
        self.assertNotIn("broadcast_snapshot", backend)
        self.assertIn('if action == "snapshot":', backend)
        self.assertIn('setInterval(() => send({ action: "snapshot" }), 5000)', client)
        self.assertIn("current - state.lastMoveAt < 5000", client)
        self.assertIn('const configured = document.currentScript?.dataset.enabled === "true"', client)
        self.assertIn("throttling_rate_limit  = 12", terraform)
        self.assertIn("throttling_burst_limit = 24", terraform)
        self.assertIn("reserved_concurrent_executions = 5", terraform)


if __name__ == "__main__":
    unittest.main()
