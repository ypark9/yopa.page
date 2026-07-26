import json
import shutil
import subprocess
import sys
import tempfile
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

    def test_disabled_client_opens_no_socket_or_recurring_timer(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node.js is required for the browser-client contract test")

        client_path = Path(__file__).parents[1] / "static/js/atlas-presence-client.js"
        harness = """
globalThis.window = globalThis;
globalThis.location = { protocol: "https:", hostname: "www.yopa.page", host: "www.yopa.page" };
globalThis.document = { currentScript: { dataset: { enabled: "false" } } };
let sockets = 0;
let intervals = 0;
let timeouts = 0;
globalThis.WebSocket = class { constructor() { sockets += 1; } };
globalThis.setInterval = () => { intervals += 1; return intervals; };
globalThis.clearInterval = () => {};
globalThis.setTimeout = () => { timeouts += 1; return timeouts; };
globalThis.clearTimeout = () => {};
require(process.argv[2]);
let mode = "";
window.ArticleAtlasPresence.subscribe((event) => { mode = event.mode; });
window.ArticleAtlasPresence.connect();
if (mode !== "disabled" || sockets !== 0 || intervals !== 0 || timeouts !== 0) {
  throw new Error(JSON.stringify({ mode, sockets, intervals, timeouts }));
}
"""
        with tempfile.NamedTemporaryFile("w", suffix=".cjs") as script:
            script.write(harness)
            script.flush()
            subprocess.run(
                [node, script.name, str(client_path)],
                check=True,
                capture_output=True,
                text=True,
            )


if __name__ == "__main__":
    unittest.main()
