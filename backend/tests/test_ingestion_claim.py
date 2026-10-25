import asyncio
import os
import unittest
import uuid

from core.ingestion_state import claim_document


@unittest.skipUnless(os.environ.get("TEST_DATABASE_HOST"), "Requires isolated CI database")
class TestIngestionClaim(unittest.IsolatedAsyncioTestCase):
    async def test_duplicate_ingestion_is_denied_and_failed_or_unindexed_files_can_recover(self):
        import asyncpg  # type: ignore[import-untyped]

        host = os.environ["TEST_DATABASE_HOST"]
        self.assertIn(host, ("localhost", "127.0.0.1", "postgres"))
        options = dict(host=host, user=os.environ["TEST_DATABASE_USER"],
                       password=os.environ["TEST_DATABASE_PASSWORD"], database=os.environ["TEST_DATABASE_NAME"])
        first = await asyncpg.connect(**options)
        second = await asyncpg.connect(**options)
        schema = "ingestion_claim_" + uuid.uuid4().hex
        created = False
        try:
            await first.execute(f'CREATE SCHEMA "{schema}"')
            created = True
            for connection in (first, second):
                await connection.execute(f'SET search_path TO "{schema}"')
            await first.execute('CREATE TABLE "Document" (id text PRIMARY KEY, status text, "errorMessage" text, "updatedAt" timestamptz)')
            await first.execute('CREATE TABLE "Chunk" (id text PRIMARY KEY, "documentId" text)')
            await first.execute('INSERT INTO "Document" (id, status) VALUES ($1, $2)', "test-doc", "failed")
            admitted = await asyncio.gather(claim_document(first, "test-doc"), claim_document(second, "test-doc"))
            self.assertEqual(sum(admitted), 1)
            await first.execute('UPDATE "Document" SET status = $1', "ready")
            self.assertTrue(await claim_document(first, "test-doc"))
            await first.execute('UPDATE "Document" SET status = $1', "ready")
            await first.execute('INSERT INTO "Chunk" VALUES ($1, $2)', "test-chunk", "test-doc")
            self.assertFalse(await claim_document(first, "test-doc"))
            self.assertFalse(await claim_document(first, "missing-doc"))
        finally:
            if created:
                await first.execute(f'DROP SCHEMA "{schema}" CASCADE')
            await asyncio.gather(first.close(), second.close())
