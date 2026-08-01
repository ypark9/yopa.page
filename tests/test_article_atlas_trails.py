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

    def test_explore_never_renders_adsense_and_links_to_kofi_once(self):
        self.assertNotIn("pagead2.googlesyndication.com", self.explore_html)
        self.assertNotIn("adsbygoogle", self.explore_html)
        self.assertEqual(self.explore_html.count("explore-pit-support"), 1)
        self.assertIn("https://ko-fi.com/yoonsoopark", self.explore_html)
        self.assertIn("Leave a coin on Ko-fi", self.explore_html)
        self.assertIn('target=_blank rel="noopener noreferrer"', self.explore_html)

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

    def test_atlas_uses_five_shared_canvas_layers(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()

        for canvas_id in ("atlas-backdrop", "atlas-base", "atlas-world", "atlas-top", "explore-world"):
            self.assertIn(f'id="{canvas_id}"', template)
        self.assertIn("const layerCanvases = {", source)
        self.assertIn("const pixelBudget = mobile ? 1280 * 720 : 2560 * 1440", source)
        self.assertIn("Object.entries(layerCanvases).forEach", source)
        self.assertIn("ctx = layerContexts.backdrop", source)
        self.assertIn("ctx = layerContexts.cursor", source)

    def test_manifest_drives_tiles_objects_and_culling(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()
        manifest_path = ROOT / "static" / "images" / "article-atlas" / "v1" / "atlas-manifest.json"
        manifest = json.loads(manifest_path.read_text())

        self.assertEqual(manifest["version"], 1)
        self.assertEqual(manifest["tileSize"], 512)
        self.assertEqual(manifest["revision"], "2026-07-31-chunk-navigation-1")
        self.assertEqual(manifest["world"], {"width": 7168, "height": 5120, "originX": -3584, "originY": -768})
        self.assertEqual(len(manifest["connections"]), 9)
        self.assertIn('data-atlas-manifest="{{ "images/article-atlas/v1/atlas-manifest.json" | relURL }}?v=atlas-v4"', template)
        self.assertIn("function rectIsVisible", source)
        self.assertIn("function drawAtlasTiles(layer)", source)
        self.assertIn("function drawAtlasObjects(layer)", source)
        self.assertIn("function drawDepthSortedWorld()", source)
        self.assertIn("atlasManifest.regions?.find", source)
        self.assertIn("traceRegionShape(region)", source)
        self.assertIn("ctx.clip();", source)
        self.assertIn("if (!rectIsVisible", source)
        self.assertIn("ensureAtlasImage(tile.src)", source)
        self.assertIn('url.searchParams.set("v", atlasManifest.revision)', source)
        self.assertTrue(any(item["id"] == "agent-house" for item in manifest["objects"]))
        self.assertTrue(any(item["layer"] == "top" for item in manifest["objects"]))

        ambient = manifest["ambient"]
        self.assertEqual({item["region"] for item in ambient}, {"cloud", "agents", "code", "salesforce", "python", "engineering", "archive"})
        self.assertEqual({item["behavior"] for item in ambient}, {"drift", "ripple", "track", "pulse", "haunt"})
        self.assertIn("function drawAmbientLayer(layer)", source)
        self.assertIn("state.motionTime += elapsed * 1000", source)
        for item in ambient:
            for sprite in item["sprites"]:
                self.assertTrue((manifest_path.parent / sprite).exists(), sprite)

        self.assertEqual(len(manifest["chunks"]), 12)
        self.assertTrue(all(chunk["width"] == 2048 and chunk["height"] == 2048 for chunk in manifest["chunks"]))
        self.assertEqual(len(manifest["signposts"]), len(manifest["connections"]) * 2 + 1)
        self.assertEqual(manifest["portals"][0]["id"], "app-garden-portal")
        self.assertIn("function drawAtlasChunks()", source)
        self.assertIn("function updateNearbyLandmark()", source)

    def test_world_objects_articles_and_visitors_share_depth_order(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()

        self.assertIn('item.layer === "world" && atlasObjectIsVisible(item)', source)
        self.assertIn("depth: item.y", source)
        self.assertIn("depth: article.y", source)
        self.assertIn("depth: visitor.y + verticalDrift", source)
        self.assertIn(".sort((a, b) => a.depth - b.depth || a.priority - b.priority)", source)
        self.assertIn("drawDepthSortedWorld();", source)

    def test_agent_grove_tiles_and_water_cover_the_full_region(self):
        manifest = json.loads(
            (ROOT / "static" / "images" / "article-atlas" / "v1" / "atlas-manifest.json").read_text()
        )
        tile_size = manifest["tileSize"]
        origin_x = manifest["world"]["originX"]
        agent_tiles = [tile for tile in manifest["tiles"]["base"] if tile["region"] == "agents"]
        tile_left = min(origin_x + tile["x"] * tile_size for tile in agent_tiles)
        tile_right = max(origin_x + (tile["x"] + 1) * tile_size for tile in agent_tiles)

        # Agent Grove is centered at x=470 with rx=790 in explore.js.
        self.assertLessEqual(tile_left, -320)
        self.assertGreaterEqual(tile_right, 1260)

        water = manifest["animations"]["ocean"]
        self.assertLessEqual(water["x"], -320)
        self.assertGreaterEqual(water["x"] + water["width"], 1260)

    def test_agent_grove_assets_are_separate_webp_resources(self):
        root = ROOT / "static" / "images" / "article-atlas" / "v1" / "agent-grove"
        expected = [
            root / "tiles" / "base_3_2.webp",
            root / "objects" / "agent-house.webp",
            root / "objects" / "bridge.webp",
            root / "objects" / "trail-sign.webp",
            root / "objects" / "rocks.webp",
            root / "objects" / "flowers.webp",
            root / "objects" / "canopy-1.webp",
            root / "animations" / "ocean-fallback.webp",
        ]
        for path in expected:
            self.assertTrue(path.exists(), path)
            self.assertLess(path.stat().st_size, 600_000, path)

    def test_asset_audit_is_read_only_and_part_of_the_documented_pipeline(self):
        script = (ROOT / "scripts" / "audit_article_atlas_assets.py").read_text()
        guide = (
            ROOT / "static" / "images" / "article-atlas" / "v1" / "STYLE-GUIDE.md"
        ).read_text()

        self.assertIn("def border_alpha_count", script)
        self.assertIn("def magenta_count", script)
        self.assertNotIn(".save(", script)
        self.assertIn("audit_article_atlas_assets.py", guide)

    def test_home_minimap_uses_the_shared_manifest(self):
        manifest = json.loads(
            (ROOT / "static" / "images" / "article-atlas" / "v1" / "atlas-manifest.json").read_text()
        )
        partial = (ROOT / "layouts" / "partials" / "home" / "article-atlas.html").read_text()
        source = (ROOT / "static" / "js" / "home-atlas.js").read_text()

        self.assertEqual(len(manifest["regions"]), 7)
        self.assertIn('data-atlas-manifest="{{ "images/article-atlas/v1/atlas-manifest.json" | relURL }}?v=atlas-v4"', partial)
        self.assertIn("async function loadManifest()", source)
        self.assertIn("manifest?.regions || fallbackRegions", source)
        self.assertIn("manifest.tiles.base", source)
        self.assertIn("groups.forEach((tiles, regionId)", source)
        self.assertIn("groups.forEach((items, regionId)", source)
        self.assertIn("manifest?.revision", source)
        self.assertIn('drawObjects("world")', source)
        self.assertIn('drawObjects("top")', source)
        self.assertIn("manifest?.connections || []", source)
        self.assertNotIn("drawRegionLabel", source)

    def test_manifest_regions_with_assets_use_unique_complete_tiles(self):
        root = ROOT / "static" / "images" / "article-atlas" / "v1"
        manifest = json.loads((root / "atlas-manifest.json").read_text())
        asset_regions = {tile["region"] for tile in manifest["tiles"]["base"]}

        self.assertEqual(
            asset_regions,
            {"cloud", "agents", "code", "salesforce", "python", "engineering", "archive"},
        )
        for region_id in asset_regions:
            tiles = [tile for tile in manifest["tiles"]["base"] if tile["region"] == region_id]
            coordinates = {(tile["x"], tile["y"]) for tile in tiles}
            self.assertEqual(len(coordinates), len(tiles), region_id)
            self.assertTrue(all((root / tile["src"]).exists() for tile in tiles), region_id)
            self.assertTrue(
                any(
                    item["region"] == region_id and item["layer"] == "world"
                    for item in manifest["objects"]
                ),
                region_id,
            )
            region = next(item for item in manifest["regions"] if item["id"] == region_id)
            size = manifest["tileSize"]
            origin_x = manifest["world"]["originX"]
            origin_y = manifest["world"]["originY"]
            self.assertLessEqual(
                min(origin_x + tile["x"] * size for tile in tiles),
                region["x"] - region["rx"],
                region_id,
            )
            self.assertGreaterEqual(
                max(origin_x + (tile["x"] + 1) * size for tile in tiles),
                region["x"] + region["rx"],
                region_id,
            )
            self.assertLessEqual(
                min(origin_y + tile["y"] * size for tile in tiles),
                region["y"] - region["ry"],
                region_id,
            )
            self.assertGreaterEqual(
                max(origin_y + (tile["y"] + 1) * size for tile in tiles),
                region["y"] + region["ry"],
                region_id,
            )

        top_regions = {tile["region"] for tile in manifest["tiles"]["top"]}
        self.assertEqual(top_regions, asset_regions)
        for tile in manifest["tiles"]["top"]:
            self.assertRegex(Path(tile["src"]).name, r"^top_\d+_\d+\.webp$")
            self.assertEqual(tile.get("motion"), "foliage")

    def test_rive_runtime_is_self_hosted_with_static_fallback(self):
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()
        vendor = ROOT / "static" / "vendor" / "rive-2.31.5"

        self.assertTrue((vendor / "rive.js").exists())
        self.assertTrue((vendor / "rive.wasm").exists())
        self.assertIn('"vendor/rive-2.31.5/rive.js"', template)
        self.assertIn('"vendor/rive-2.31.5/rive.wasm"', template)
        self.assertIn("window.rive.RuntimeLoader?.setWasmUrl", source)
        self.assertIn('stateMachines: animation.stateMachine', source)
        self.assertIn("enableRiveAssetCDN: false", source)
        self.assertIn("if (!atlasManifest || riveOceanStatus !== \"idle\" || reducedMotion) return;", source)
        self.assertFalse(json.loads(
            (ROOT / "static" / "images" / "article-atlas" / "v1" / "atlas-manifest.json").read_text()
        )["animations"]["ocean"]["enabled"])
        self.assertIn("const fallback = ensureAtlasImage(animation.fallback)", source)
        runtime = (vendor / "rive.js").read_text()
        self.assertNotIn("https://cdn.jsdelivr.net", runtime)
        self.assertIn("Do not retry a third-party CDN", runtime)

    def test_keyboard_and_reduced_motion_contracts_are_present(self):
        template = (ROOT / "layouts" / "explore" / "single.html").read_text()
        source = (ROOT / "static" / "js" / "explore.js").read_text()
        styles = (ROOT / "static" / "css" / "explore.css").read_text()

        self.assertIn('id="explore-world" class="atlas-layer atlas-cursor" tabindex="0"', template)
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
        self.assertIn('shell.addEventListener("pointermove"', source)
        self.assertIn('stage.addEventListener("pointermove"', source)
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


class MonetizationRenderingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output_dir = Path(tempfile.mkdtemp(prefix="yopa-monetization-test-"))
        subprocess.run(
            [
                "hugo",
                "--gc",
                "--minify",
                "--environment",
                "production",
                "--destination",
                str(cls.output_dir),
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.output_dir)

    def test_production_blog_articles_render_exactly_one_manual_ad(self):
        article_paths = sorted((self.output_dir / "blog").glob("*.html"))
        self.assertTrue(article_paths)

        article_html = article_paths[0].read_text()
        self.assertEqual(article_html.count("pagead2.googlesyndication.com"), 1)
        self.assertEqual(article_html.count("class=adsbygoogle"), 1)
        self.assertEqual(article_html.count("data-ad-slot=5207040273"), 1)
        self.assertLess(article_html.index("class=article-post"), article_html.index("class=article-ad"))
        self.assertLess(
            article_html.index("class=article-ad"),
            article_html.index("class=article-atlas-trails"),
        )

    def test_non_blog_pages_never_render_adsense(self):
        non_blog_html = [
            path
            for path in self.output_dir.rglob("*.html")
            if "blog" not in path.relative_to(self.output_dir).parts
        ]
        self.assertTrue(non_blog_html)

        for path in non_blog_html:
            html = path.read_text()
            self.assertNotIn("pagead2.googlesyndication.com", html, path)
            self.assertNotIn("adsbygoogle", html, path)

    def test_empty_settings_remain_fail_closed(self):
        fail_closed_dir = Path(tempfile.mkdtemp(prefix="yopa-monetization-off-test-"))
        override = fail_closed_dir / "config.yaml"
        override.write_text(
            'params:\n'
            '  articleAtlasSupportUrl: ""\n'
            '  articleAdSlot: ""\n'
        )
        try:
            subprocess.run(
                [
                    "hugo",
                    "--gc",
                    "--minify",
                    "--environment",
                    "production",
                    "--config",
                    f"config.yaml,{override}",
                    "--destination",
                    str(fail_closed_dir / "public"),
                ],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            output = fail_closed_dir / "public"
            explore_html = (output / "explore" / "index.html").read_text()
            self.assertNotIn("explore-pit-support", explore_html)
            for path in output.rglob("*.html"):
                html = path.read_text()
                self.assertNotIn("pagead2.googlesyndication.com", html, path)
                self.assertNotIn("adsbygoogle", html, path)
        finally:
            shutil.rmtree(fail_closed_dir)


if __name__ == "__main__":
    unittest.main()
