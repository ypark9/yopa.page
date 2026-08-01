import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ArchivedArticleTemplateTests(unittest.TestCase):
    def test_discovery_surfaces_filter_archived_articles(self):
        paths = [
            "layouts/index.html",
            "layouts/_default/list.html",
            "layouts/explore/single.html",
            "layouts/_default/archives.html",
            "layouts/index.json",
            "layouts/index.llms.txt",
            "layouts/index.rss.xml",
            "layouts/_default/rss.xml",
            "layouts/rss.xml",
        ]
        for path in paths:
            with self.subTest(path=path):
                contents = (ROOT / path).read_text()
                self.assertIn('"Params.maintenance_status" "ne" "archived"', contents)

    def test_article_page_shows_archive_notice_and_filters_related_posts(self):
        template = (ROOT / "layouts/_default/single.html").read_text()
        self.assertIn('eq .Params.maintenance_status "archived"', template)
        self.assertIn("replacement_url_en", template)
        self.assertIn("replacement_url_ko", template)
        self.assertIn('"Params.maintenance_status" "ne" "archived"', template)


class ArchivedArticleFrontmatterTests(unittest.TestCase):
    def test_validator_requires_archive_metadata(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "validate_frontmatter", ROOT / "scripts/validate_frontmatter.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        article = """---
title: Old guide
date: 2023-01-01
author: Yoonsoo Park
description: Old guide
categories:
  - Programming
tags:
  - legacy
maintenance_status: archived
---
Body
"""
        with tempfile.NamedTemporaryFile("w", suffix=".md") as handle:
            handle.write(article)
            handle.flush()
            errors = module.validate_frontmatter(handle.name)

        self.assertTrue(any("replacement_url_en" in error for error in errors))
        self.assertTrue(any("replacement_url_ko" in error for error in errors))
        self.assertTrue(any("archive_reason" in error for error in errors))

    def test_validator_rejects_directory_style_replacement_urls(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "validate_frontmatter", ROOT / "scripts/validate_frontmatter.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        article = """---
title: Old guide
date: 2023-01-01
author: Yoonsoo Park
description: Old guide
categories:
  - Programming
tags:
  - legacy
maintenance_status: archived
reviewed_at: 2026-08-01
archive_reason: Superseded
replacement_url_en: /blog/new-guide/
replacement_url_ko: /ko/blog/new-guide/
---
Body
"""
        with tempfile.NamedTemporaryFile("w", suffix=".md") as handle:
            handle.write(article)
            handle.flush()
            errors = module.validate_frontmatter(handle.name)

        self.assertTrue(any("replacement_url_en" in error and ".html" in error for error in errors))
        self.assertTrue(any("replacement_url_ko" in error and ".html" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
