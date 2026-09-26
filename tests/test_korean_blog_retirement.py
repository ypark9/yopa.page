import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class KoreanBlogRetirementTests(unittest.TestCase):
    def test_repository_has_no_korean_blog_article_sources(self):
        self.assertEqual(list((ROOT / "content/blog").glob("*.ko.md")), [])

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
