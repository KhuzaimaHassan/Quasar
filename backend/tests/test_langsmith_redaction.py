import unittest
from core.langsmith_client import redact_sensitive_data

class TestLangSmithRedaction(unittest.TestCase):
    def test_github_token_redaction_in_dict(self):
        payload = {
            "task": "Create a README file",
            "execution_target": "github",
            "target_repo": "user/test-repo",
            "github_token": "ghp_1234567890abcdefghijklmnopqrstuvwxyz1234",
            "approved": True
        }
        redacted = redact_sensitive_data(payload)
        
        self.assertEqual(redacted["task"], "Create a README file")
        self.assertEqual(redacted["github_token"], "[REDACTED]")
        self.assertEqual(redacted["approved"], True)
        self.assertNotIn("ghp_1234567890", str(redacted))

    def test_nested_command_resume_payload(self):
        payload = {
            "configurable": {"thread_id": "test-thread-123"},
            "resume": {
                "approved": True,
                "github_token": "ghp_super_secret_github_token_value_99999",
                "nested_secrets": {
                    "apiKey": "sk-123456789",
                    "safe_data": "hello world"
                }
            }
        }
        redacted = redact_sensitive_data(payload)
        
        self.assertEqual(redacted["resume"]["github_token"], "[REDACTED]")
        self.assertEqual(redacted["resume"]["nested_secrets"]["apiKey"], "[REDACTED]")
        self.assertEqual(redacted["resume"]["nested_secrets"]["safe_data"], "hello world")
        self.assertNotIn("ghp_super_secret", str(redacted))
        self.assertNotIn("sk-123456789", str(redacted))

    def test_token_in_raw_string(self):
        text = "Executing with token ghp_abcdefghijklmnopqrstuvwxyz1234567890 for commit"
        redacted = redact_sensitive_data(text)
        self.assertNotIn("ghp_abcdefghijklmnopqrstuvwxyz", redacted)
        self.assertIn("[REDACTED]", redacted)

    def test_safe_whitelist_keys_preserved(self):
        payload = {
            "totalTokens": 1420,
            "token_count": 350,
            "prompt_tokens": 1070
        }
        redacted = redact_sensitive_data(payload)
        self.assertEqual(redacted["totalTokens"], 1420)
        self.assertEqual(redacted["token_count"], 350)
        self.assertEqual(redacted["prompt_tokens"], 1070)

    def test_list_and_tuple_traversal(self):
        payload = [
            {"github_token": "ghp_token1"},
            {"github_token": "ghp_token2", "other": "ok"},
            "plain string"
        ]
        redacted = redact_sensitive_data(payload)
        self.assertEqual(redacted[0]["github_token"], "[REDACTED]")
        self.assertEqual(redacted[1]["github_token"], "[REDACTED]")
        self.assertEqual(redacted[1]["other"], "ok")
        self.assertEqual(redacted[2], "plain string")

if __name__ == "__main__":
    unittest.main()
