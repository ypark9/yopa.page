import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ArticleTagTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location(
            "validate_article_tags", ROOT / "scripts/validate_article_tags.py"
        )
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_reviewed_article_tags_form_a_valid_graph_vocabulary(self):
        errors, frequencies = self.module.validate()
        self.assertEqual(errors, [])
        self.assertTrue(frequencies)

    def test_relationship_model_prioritizes_tags_over_categories(self):
        config = (ROOT / "config.yaml").read_text()
        related = config.split("related:", 1)[1].split("params:", 1)[0]
        category_weight = int(
            related.split("- name: categories", 1)[1].split("weight:", 1)[1].splitlines()[0]
        )
        tag_weight = int(
            related.split("- name: tags", 1)[1].split("weight:", 1)[1].splitlines()[0]
        )
        self.assertGreater(tag_weight, category_weight)


if __name__ == "__main__":
    unittest.main()
