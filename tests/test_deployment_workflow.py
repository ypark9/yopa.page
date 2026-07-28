import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


class DeploymentWorkflowTests(unittest.TestCase):
    def test_real_deploy_job_is_reported_to_github_production(self):
        workflow = (ROOT / ".github" / "workflows" / "main.yml").read_text()
        deploy_job = workflow.split("\n  deploy:\n", 1)[1]

        self.assertIn("name: deploy (auto, non-destructive only)", deploy_job)
        self.assertIn("if: github.event_name == 'push'", deploy_job)
        self.assertIn(
            "    environment:\n"
            "      name: production\n"
            "      url: https://yopa.page\n",
            deploy_job,
        )
        self.assertIn("run: make ENV=global safe-apply", deploy_job)
        self.assertIn("run: make ENV=prod deploy", deploy_job)
        self.assertIn("run: make ENV=prod safe-promote", deploy_job)
        self.assertIn("run: make ENV=prod invalidate", deploy_job)


if __name__ == "__main__":
    unittest.main()
