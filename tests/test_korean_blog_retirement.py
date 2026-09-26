import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class KoreanBlogRetirementTests(unittest.TestCase):
    def test_repository_has_no_korean_blog_article_sources(self):
        self.assertEqual(list((ROOT / "content/blog").glob("*.ko.md")), [])

    def test_retired_korean_redirects_land_on_current_english_articles(self):
        # A redirect to an archived page would make readers click through the
        # archive banner a second time. Point the redirect at the replacement.
        fixture = ROOT / "tests/fixtures/retired-korean-article-redirects.csv"
        with fixture.open(newline="") as handle:
            rows = list(csv.DictReader(handle))
        self.assertEqual(len(rows), 76)
        for row in rows:
            slug = row["english_path"].removeprefix("/blog/").removesuffix(".html")
            source = (ROOT / "content/blog" / f"{slug}.en.md").read_text()
            front_matter = source.split("---", 2)[1]
            self.assertNotRegex(
                front_matter,
                r"(?m)^maintenance_status:\s*archived\s*$",
                row["old_path"],
            )

    def test_korean_site_does_not_build_taxonomy_pages(self):
        # Read the indented block under languages.ko without a YAML dependency.
        lines = (ROOT / "config.yaml").read_text().splitlines()
        start = lines.index("  ko:") + 1
        ko_block = []
        for line in lines[start:]:
            if line and not line.startswith("    "):
                break
            ko_block.append(line)
        self.assertIn("    taxonomies: {}", ko_block)

    def test_frontmatter_validator_detects_a_reintroduced_korean_article(self):
        spec = importlib.util.spec_from_file_location(
            "validate_frontmatter", ROOT / "scripts/validate_frontmatter.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "example.en.md").touch()
            Path(directory, "example.ko.md").touch()
            self.assertEqual(
                module.find_korean_blog_articles(directory), ["example.ko.md"]
            )


if __name__ == "__main__":
    unittest.main()
