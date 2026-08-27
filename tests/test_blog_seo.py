import json
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SeoHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.author_meta = []
        self.author_links = []
        self.json_ld = []
        self._in_json_ld = False
        self._script_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("name") == "author":
            self.author_meta.append(attributes.get("content"))
        if tag == "a" and "author" in attributes.get("rel", "").split():
            self.author_links.append(attributes.get("href"))
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self._in_json_ld = True
            self._script_parts = []

    def handle_data(self, data):
        if self._in_json_ld:
            self._script_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._in_json_ld:
            self.json_ld.append(json.loads("".join(self._script_parts)))
            self._in_json_ld = False


class BlogSeoRenderingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output_dir = Path(tempfile.mkdtemp(prefix="yopa-blog-seo-test-"))
        subprocess.run(
            [
                "hugo",
                "--gc",
                "--minify",
                "--environment",
                "production",
                "--cacheDir",
                str(cls.output_dir / ".hugo-cache"),
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

    def parse(self, relative_path):
        html = (self.output_dir / relative_path).read_text()
        parser = SeoHTMLParser()
        parser.feed(html)
        return html, parser

    def assert_blog_posting(self, relative_path, language, about_path, about_href):
        html, parser = self.parse(relative_path)
        self.assertEqual(parser.author_meta, ["Yoonsoo Park"])
        self.assertEqual(parser.author_links, [about_href])
        postings = [item for item in parser.json_ld if item.get("@type") == "BlogPosting"]
        self.assertEqual(len(postings), 1)
        posting = postings[0]
        self.assertEqual(posting["@context"], "https://schema.org")
        self.assertEqual(posting["author"], posting["publisher"])
        self.assertEqual(posting["author"]["@type"], "Person")
        self.assertEqual(posting["author"]["name"], "Yoonsoo Park")
        self.assertTrue(posting["author"]["url"].endswith(about_path))
        self.assertEqual(posting["mainEntityOfPage"]["@type"], "WebPage")
        self.assertTrue(posting["mainEntityOfPage"]["@id"].endswith("/" + str(relative_path)))
        self.assertTrue(posting["headline"])
        self.assertTrue(posting["description"])
        self.assertTrue(posting["datePublished"])
        self.assertTrue(posting["dateModified"])
        self.assertGreater(posting["wordCount"], 0)
        self.assertEqual(html.count("class=field-dispatch"), 1)
        self.assertLess(html.index("class=article-atlas-trails"), html.index("class=field-dispatch"))
        expected_dispatch = "yopa-field-dispatch-ko.beehiiv.com" if language == "ko" else "yopapage.beehiiv.com"
        self.assertIn(expected_dispatch, html)

    def test_english_and_korean_posts_render_author_and_blog_posting_once(self):
        self.assert_blog_posting(
            Path("blog/2026-08-01-real-time-voice-agents-with-nova-2-sonic.html"),
            "en",
            "/about.html",
            "../about.html",
        )
        self.assert_blog_posting(
            Path("ko/blog/2026-08-01-real-time-voice-agents-with-nova-2-sonic.html"),
            "ko",
            "/ko/about.html",
            "../../ko/about.html",
        )

    def test_archived_post_has_structured_data_but_no_dispatch(self):
        html, parser = self.parse(Path("blog/2023-06-19-how-to-delete-unwanted-files-from-a-pull-request.html"))
        self.assertEqual(len([item for item in parser.json_ld if item.get("@type") == "BlogPosting"]), 1)
        self.assertNotIn("class=field-dispatch", html)

    def test_home_and_expedition_keep_one_dispatch_each(self):
        for relative_path in (Path("index.html"), Path("expeditions/safe-agent-operations.html")):
            html = (self.output_dir / relative_path).read_text()
            self.assertEqual(html.count("class=field-dispatch"), 1)


if __name__ == "__main__":
    unittest.main()
