import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


class CopyAiButtonTests(unittest.TestCase):
    def test_button_stays_in_article_header_with_localized_states(self):
        template = (ROOT / "layouts" / "_default" / "single.html").read_text()

        header_end = template.index("</header>")
        button_index = template.index('id="copy-ai-button"')
        self.assertLess(button_index, header_end)
        self.assertIn('id="raw-markdown-content"', template)
        self.assertIn('data-default-label="{{ $copyLabel }}"', template)
        self.assertIn('data-success-label="{{ $copiedLabel }}"', template)
        self.assertIn('data-error-label="{{ $copyFailedLabel }}"', template)
        self.assertIn('aria-live="polite"', template)
        self.assertIn('AI용으로 복사', template)
        self.assertGreaterEqual(template.count('if eq .Section "blog"'), 2)
        self.assertNotIn("📋", template)

    def test_assets_only_load_for_blog_pages(self):
        partial = (ROOT / "layouts" / "partials" / "head" / "custom.html").read_text()

        self.assertIn('and .IsPage (eq .Section "blog")', partial)
        self.assertIn("css/copy-ai-button.css", partial)
        self.assertIn("js/copyAiButton.js", partial)
        self.assertEqual(partial.count("?v=article-atlas"), 2)

    def test_script_preserves_contract_and_quietly_ignores_other_pages(self):
        script = (ROOT / "static" / "js" / "copyAiButton.js").read_text()

        self.assertIn('getElementById("copy-ai-button")', script)
        self.assertIn('getElementById("raw-markdown-content")', script)
        self.assertIn('querySelector(".copy-ai-label")', script)
        self.assertIn('dataset.successLabel', script)
        self.assertIn('document.execCommand("copy")', script)
        self.assertNotIn("console.warn", script)


if __name__ == "__main__":
    unittest.main()
