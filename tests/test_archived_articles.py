import csv
import re
import subprocess
import tempfile
import unittest
from io import StringIO
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def frontmatter(path):
    source = path.read_text()
    block = re.match(r"^---\s*\n(.*?)\n---\s*\n", source, re.DOTALL).group(1)
    return {
        match.group(1): match.group(2).strip().strip('"\'')
        for line in block.splitlines()
        if (match := re.match(r"^([^:]+):\s*(.+)$", line))
    }


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
    def test_every_archived_article_has_one_bilingual_replacement_lineage(self):
        rows = csv.DictReader(
            StringIO(
                subprocess.run(
                    ["hugo", "list", "all"],
                    cwd=ROOT,
                    check=True,
                    capture_output=True,
                    text=True,
                ).stdout
            )
        )
        permalink_by_path = {
            row["path"]: urlsplit(row["permalink"]).path
            for row in rows
            if row["path"].startswith("content/blog/")
        }
        archived = []
        replacement_files = set()

        for original in sorted((ROOT / "content" / "blog").glob("*.md")):
            original_data = frontmatter(original)
            if original_data.get("maintenance_status") != "archived":
                continue
            archived.append(original)
            target_url = original_data["replacement_url_en"]
            self.assertTrue(target_url.startswith("/blog/2026-08-01-"))
            basename = target_url.rsplit("/", 1)[-1].removesuffix(".html")
            original_url = permalink_by_path[str(original.relative_to(ROOT))]

            for language in ("en", "ko"):
                replacement = ROOT / "content" / "blog" / f"{basename}.{language}.md"
                replacement_files.add(replacement)
                data = frontmatter(replacement)
                self.assertEqual(data.get("maintenance_status"), "replacement")
                self.assertEqual(data.get("date"), original_data.get("date"))
                self.assertEqual(data.get("lastmod"), "2026-08-01")
                self.assertEqual(data.get("reviewed_at"), "2026-08-01")
                self.assertEqual(data.get("replaces_url"), original_url)

        self.assertEqual(len(archived), 43)
        self.assertEqual(len(replacement_files), 86)

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

    def test_validator_requires_replacement_lineage_metadata(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "validate_frontmatter", ROOT / "scripts/validate_frontmatter.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        article = """---
title: Rewritten guide
date: 2023-01-01
author: Yoonsoo Park
description: Rewritten guide
categories:
  - Programming
tags:
  - maintenance
maintenance_status: replacement
---
Body
"""
        with tempfile.NamedTemporaryFile("w", suffix=".md") as handle:
            handle.write(article)
            handle.flush()
            errors = module.validate_frontmatter(handle.name)

        self.assertTrue(any("lastmod" in error for error in errors))
        self.assertTrue(any("reviewed_at" in error for error in errors))
        self.assertTrue(any("replaces_url" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
