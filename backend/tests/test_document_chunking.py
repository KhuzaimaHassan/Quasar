import unittest
from unittest.mock import patch

from core import chunking


class TestDocumentChunking(unittest.TestCase):
    def setUp(self):
        self.counter = patch.object(chunking, 'get_token_count', side_effect=lambda text: len(text.split()))
        self.counter.start()
        self.addCleanup(self.counter.stop)

    def test_short_document_is_not_silently_discarded(self):
        text = "Project identifier: ORBIT-742."
        self.assertEqual(chunking.chunk_text(text), [text])

    def test_blank_document_has_no_chunks(self):
        self.assertEqual(chunking.chunk_text(" \n\n "), [])

    def test_fragment_filter_still_applies_to_larger_documents(self):
        main = " ".join(["word"] * 35)
        self.assertEqual(chunking.chunk_text(main + "\n\nsmall ending", target_tokens=35, overlap_tokens=0), [main])
