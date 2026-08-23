import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TriviaPolicyPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = Path(tempfile.mkdtemp(prefix="yopa-trivia-policy-test-"))
        cls.output_dir = cls.temp_dir / "public"
        environment = os.environ.copy()
        environment["HUGO_RESOURCEDIR"] = str(cls.temp_dir / "resources")
        environment["HUGO_CACHEDIR"] = str(cls.temp_dir / "cache")
        subprocess.run(
            [
                "hugo",
                "--gc",
                "--minify",
                "--noBuildLock",
                "--environment",
                "production",
                "--destination",
                str(cls.output_dir),
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            env=environment,
        )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_dir)

    def test_policy_page_is_a_standalone_noindex_document(self):
        page = (self.output_dir / "trivia-quiz-time.html").read_text()

        self.assertIn("Trivia Quiz Time — Privacy Policy and Terms", page)
        self.assertRegex(page, r'name=robots content="noindex, nofollow"')
        self.assertIn("googletagmanager.com", page)
        self.assertNotIn("pagead2.googlesyndication.com", page)
        self.assertNotIn("article-atlas-trails", page)
        self.assertNotIn("Continue exploring", page)
        self.assertNotIn("Copy for AI", page)

    def test_policy_page_is_excluded_from_article_surfaces(self):
        search_index = json.loads((self.output_dir / "index.json").read_text())
        self.assertFalse(any(item["permalink"].endswith("/trivia-quiz-time.html") for item in search_index))

        sitemap = (self.output_dir / "sitemap.xml").read_text()
        self.assertNotIn("trivia-quiz-time.html", sitemap)

        rss = (self.output_dir / "index.xml").read_text()
        self.assertNotIn("Trivia Quiz Time", rss)

    def test_policy_page_uses_the_expected_public_url(self):
        self.assertTrue((self.output_dir / "trivia-quiz-time.html").is_file())
        self.assertFalse((self.output_dir / "trivia-quiz-time" / "index.html").exists())
