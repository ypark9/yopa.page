import csv
import json
import shutil
import subprocess
import tempfile
import unittest
from io import StringIO
from pathlib import Path


ROOT = Path(__file__).parents[1]


class ArticleAtlasTrailsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output_dir = Path(tempfile.mkdtemp(prefix="yopa-atlas-test-"))
        subprocess.run(
            ["hugo", "--gc", "--minify", "--destination", str(cls.output_dir)],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        html = (cls.output_dir / "explore" / "index.html").read_text()
        marker = '<script id=explore-posts type=application/json>'
        if marker not in html:
            marker = '<script id="explore-posts" type="application/json">'
        payload = html.split(marker, 1)[1].split("</script>", 1)[0]
        cls.posts = json.loads(payload)
        cls.explore_html = html

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.output_dir)

    def hugo_paths(self, state):
        result = subprocess.run(
            ["hugo", "list", state],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return {row["path"] for row in csv.DictReader(StringIO(result.stdout)) if row["section"] == "blog"}

    def test_payload_contains_every_published_article(self):
        source_paths = {str(path.relative_to(ROOT)) for path in (ROOT / "content" / "blog").glob("*.md")}
        unpublished = self.hugo_paths("future") | self.hugo_paths("drafts") | self.hugo_paths("expired")
        expected_count = len(source_paths - unpublished)
        urls = [post["url"] for post in self.posts]

        self.assertEqual(len(self.posts), expected_count)
        self.assertEqual(len(urls), len(set(urls)))
        self.assertEqual({post["language"] for post in self.posts}, {"en", "ko"})

    def test_related_urls_are_valid_and_never_self_links(self):
        known_urls = {post["url"] for post in self.posts}
        for post in self.posts:
            self.assertLessEqual(len(post["related"]), 3)
            self.assertNotIn(post["url"], post["related"])
            self.assertTrue(set(post["related"]).issubset(known_urls))
            for field in ("categories", "tags", "series", "language"):
                self.assertIn(field, post)

    def test_series_relations_take_priority(self):
        by_url = {post["url"]: post for post in self.posts}
        series_posts = [post for post in self.posts if post["series"] == "AWS re:Invent 2025"]
        self.assertEqual(len(series_posts), 10)
        for post in series_posts:
            self.assertTrue(post["related"])
            self.assertTrue(all(by_url[url]["series"] == post["series"] for url in post["related"]))

    def test_sparse_articles_receive_region_backbone_trails(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        self.assertIn("for (let index = 1; index < local.length; index += 1)", source)
        self.assertIn("add(local[index - 1], local[index], false)", source)

    def test_relations_are_waypoints_not_visible_paths(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        self.assertNotIn("function drawTrail", source)
        self.assertNotIn("edges.forEach(drawTrail)", source)
        self.assertIn("setWaypoint(articleByPath.get", source)
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()
        self.assertIn('id="explore-waypoint"', template)

    def test_explore_never_renders_adsense_or_unconfigured_support(self):
        self.assertNotIn("pagead2.googlesyndication.com", self.explore_html)
        self.assertNotIn("adsbygoogle", self.explore_html)
        self.assertNotIn("explore-pit-support", self.explore_html)

    def test_server_cost_pit_is_bounded_and_dismissible(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        self.assertIn("PIT_DELAY_SECONDS = 60", source)
        self.assertIn("state.visitedRegions.size < 2", source)
        self.assertIn('sessionStorage.setItem(PIT_SESSION_KEY, "seen")', source)
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()
        self.assertIn('id="explore-pit-dismiss"', template)
        self.assertIn('aria-modal="true"', template)

    def test_presence_is_fail_closed_without_simulated_people(self):
        config = (ROOT / "config.yaml").read_text()
        explore = (ROOT / "static" / "js" / "explore.js").read_text()
        home = (ROOT / "static" / "js" / "home-atlas.js").read_text()

        self.assertIn("articleAtlasPresenceEnabled: false", config)
        self.assertIn("data-enabled=false", self.explore_html)
        self.assertNotIn("simulatedVisitors", explore)
        self.assertNotIn("simulatedVisitors", home)
        self.assertIn("Solo exploration · live presence off", self.explore_html)

    def test_rendering_is_viewport_culled_and_stops_behind_modals(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        self.assertIn("function regionIsVisible", source)
        self.assertIn("const visibleRegions = regions.filter", source)
        self.assertIn("if (p.x < -60 || p.y < -60", source)
        self.assertIn("function stopAnimation", source)
        self.assertIn("document.hidden || state.paused || state.pitOpen", source)
        self.assertGreaterEqual(source.count("stopAnimation();"), 3)

    def test_keyboard_and_reduced_motion_contracts_are_present(self):
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        styles = (ROOT / "static" / "css" / "explore.css").read_text()

        self.assertIn('id="explore-world" tabindex="0"', template)
        self.assertIn('id="explore-pause" role="dialog" aria-modal="true"', template)
        self.assertIn("ArrowUp", source)
        self.assertIn('event.key === "Escape" && state.paused', source)
        self.assertIn("@media (prefers-reduced-motion: reduce)", styles)
        self.assertIn("max-height: calc(100dvh - 28px)", styles)

    def test_preview_is_fixed_to_the_lower_left(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        styles = (ROOT / "static" / "css" / "explore.css").read_text()
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()

        self.assertIn("left: clamp(16px, 4vw, 54px);", styles)
        self.assertIn("bottom: clamp(18px, 5vh, 48px);", styles)
        self.assertIn('canvas.addEventListener("pointermove"', source)
        self.assertNotIn('shell.addEventListener("pointermove"', source)
        self.assertIn('window.addEventListener("blur"', source)
        self.assertNotIn("previewEngaged", source)
        self.assertNotIn("positionPreviewCard", source)
        self.assertNotIn("explore-card-bridge", template)
        self.assertNotIn("atlas-preview-docking.js", template)
        self.assertFalse((ROOT / "static" / "js" / "atlas-preview-docking.js").exists())

    def test_mobile_destination_does_not_lock_map_movement(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        styles = (ROOT / "static" / "css" / "explore.css").read_text()

        self.assertIn("setWaypoint(articleByPath.get", source)
        self.assertIn("if (!state.waypoint || !state.pointer.active) return;", source)
        self.assertNotIn("previewEngaged", source)
        self.assertIn("@media (max-width: 640px)", styles)
        self.assertIn("width: calc(100vw - 20px);", styles)
        self.assertIn("max-height: min(52dvh, 430px);", styles)


if __name__ == "__main__":
    unittest.main()
