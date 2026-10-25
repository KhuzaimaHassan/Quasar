import unittest

from core.storage_paths import safe_storage_path, FilesystemError


class TestStoragePaths(unittest.TestCase):
    def test_mixed_separators_cannot_escape_the_workspace(self):
        for path in ("../other/private.txt", r"folder\..\..\other\private.txt",
                     r"folder/..\other/private.txt", "/absolute/file", r"C:\private.txt", r"\\server\share",
                     "folder/%2e%2e/private.txt", "folder/%252e%252e/private.txt"):
            with self.subTest(path=path), self.assertRaises(FilesystemError):
                safe_storage_path("test-workspace", path)

    def test_normal_relative_paths_are_portable(self):
        self.assertEqual(safe_storage_path("test-workspace", r"src\qa.txt"), "agent-sandbox/test-workspace/src/qa.txt")
        self.assertEqual(safe_storage_path("test-workspace", "src/qa.txt"), "agent-sandbox/test-workspace/src/qa.txt")
        self.assertEqual(safe_storage_path("test-workspace", ""), "agent-sandbox/test-workspace")

    def test_workspace_identifier_cannot_change_the_storage_prefix(self):
        with self.assertRaises(FilesystemError):
            safe_storage_path("../other-workspace", "qa.txt")
