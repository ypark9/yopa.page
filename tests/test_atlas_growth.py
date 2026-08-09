import importlib.util
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class AtlasGrowthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.expeditions = load("validate_expeditions", ROOT / "scripts/validate_expeditions.py")
        cls.analytics = load("ga4_baseline", ROOT / "scripts/ga4_baseline.py")

    def test_bilingual_expedition_schema_and_urls(self):
        self.assertEqual(self.expeditions.validate(), [])

    def test_analytics_periods_are_fixed_non_overlapping_years(self):
        self.assertEqual(
            self.analytics.periods(date(2026, 8, 9)),
            {
                "current": ("2025-08-09", "2026-08-08"),
                "prior": ("2024-08-09", "2025-08-08"),
            },
        )

    def test_analytics_contract_excludes_individual_identifiers(self):
        dimensions = {dimension for report in self.analytics.REPORTS for dimension in report.dimensions}
        self.assertFalse({"userPseudoId", "userId", "city", "sessionId"} & dimensions)
        self.assertEqual(
            {report.name for report in self.analytics.REPORTS},
            {"totals", "acquisition", "content_language", "atlas_discovery", "growth_funnel"},
        )
        self.assertTrue(all(report.allowed_hosts == ("www.yopa.page", "yopa.page") for report in self.analytics.REPORTS))

    def test_totals_report_matches_ga_ui_overview_metrics(self):
        totals = next(report for report in self.analytics.REPORTS if report.name == "totals")
        self.assertEqual(totals.dimensions, ())
        self.assertEqual(totals.metrics, ("sessions", "activeUsers", "screenPageViews"))
        self.assertEqual(totals.limit, 1)

    def test_growth_funnel_includes_only_anonymous_confirmation_pages(self):
        funnel = next(report for report in self.analytics.REPORTS if report.name == "growth_funnel")
        self.assertEqual(
            funnel.page_paths,
            ("/dispatch/confirmed.html", "/ko/dispatch/confirmed.html"),
        )
        self.assertNotIn("dispatch_confirmed", funnel.event_names)

    def test_analytics_uses_filter_nested_types_supported_by_pinned_client(self):
        script = (ROOT / "scripts/ga4_baseline.py").read_text()
        self.assertIn("Filter.InListFilter", script)
        self.assertIn("Filter.StringFilter", script)
        self.assertNotIn("FilterExpression, InListFilter", script)

    def test_empty_report_removes_a_stale_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            stale = output_dir / "growth_funnel-current.csv"
            stale.write_text("stale\n")
            payload = {
                "generated_on": "2026-08-09",
                "reports": {
                    "growth_funnel": {
                        "current": {"sampled": False, "rows": []},
                    }
                },
            }
            self.analytics.write_outputs(payload, output_dir)
            self.assertFalse(stale.exists())

    def test_dispatch_urls_are_enabled_after_owner_acceptance(self):
        config = (ROOT / "config.yaml").read_text()
        dispatch = config.split("fieldDispatch:", 1)[1].split("socialOptions:", 1)[0]
        self.assertEqual(dispatch.count("enabled: true"), 2)
        self.assertIn('subscribeUrl: "https://yopapage.beehiiv.com/"', dispatch)
        self.assertIn(
            'subscribeUrl: "https://yopa-field-dispatch-ko.beehiiv.com/"', dispatch
        )

    def test_presence_remains_disabled(self):
        self.assertIn("articleAtlasPresenceEnabled: false", (ROOT / "config.yaml").read_text())

    def test_expedition_client_sanitizes_saved_ids_and_tracks_implicit_start(self):
        script = (ROOT / "static/js/expedition.js").read_text()
        self.assertIn('.expedition-stop[data-stop-id]', script)
        self.assertIn("validStopIds.has(id)", script)
        self.assertIn("function start()", script)
        self.assertGreaterEqual(script.count("start();"), 2)

    def test_expedition_completion_is_only_recorded_once(self):
        script = (ROOT / "static/js/expedition.js").read_text()
        self.assertIn("completedOnce", script)
        self.assertIn("if (firstCompletion)", script)

    def test_google_analytics_loads_only_in_production(self):
        head = (ROOT / "layouts/partials/head/head.html").read_text()
        analytics = '{{ template "_internal/google_analytics.html" . }}'
        self.assertIn("{{ if hugo.IsProduction }}\n    " + analytics, head)


if __name__ == "__main__":
    unittest.main()
