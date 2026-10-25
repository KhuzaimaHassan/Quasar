"""Real PostgreSQL admission test; refuses non-local databases."""
import asyncio
import os
import unittest
import uuid

from agents.execution import claim_run_for_resume


@unittest.skipUnless(os.environ.get("TEST_DATABASE_HOST"), "Requires isolated CI database")
class TestAgentClaim(unittest.IsolatedAsyncioTestCase):
    async def test_only_one_concurrent_resume_can_claim_the_run(self):
        import asyncpg  # type: ignore[import-untyped]

        host = os.environ["TEST_DATABASE_HOST"]
        self.assertIn(host, ("localhost", "127.0.0.1", "postgres"))
        options = dict(host=host, user=os.environ["TEST_DATABASE_USER"],
                       password=os.environ["TEST_DATABASE_PASSWORD"], database=os.environ["TEST_DATABASE_NAME"])
        first = await asyncpg.connect(**options)
        second = await asyncpg.connect(**options)
        schema = "agent_claim_" + uuid.uuid4().hex
        created = False
        try:
            await first.execute(f'CREATE SCHEMA "{schema}"')
            created = True
            for connection in (first, second):
                await connection.execute(f'SET search_path TO "{schema}"')
            await first.execute('CREATE TABLE "AgentRun" (id text PRIMARY KEY, "threadId" text, status text)')
            await first.execute('INSERT INTO "AgentRun" VALUES ($1, $2, $3)', "test-run", "test-thread", "awaiting_approval")
            admitted = await asyncio.gather(
                claim_run_for_resume(first, "test-thread"),
                claim_run_for_resume(second, "test-thread"),
            )
            self.assertEqual(sum(admitted), 1)
            self.assertFalse(await claim_run_for_resume(first, "test-thread"))
            self.assertFalse(await claim_run_for_resume(first, "missing-thread"))
        finally:
            if created:
                await first.execute(f'DROP SCHEMA "{schema}" CASCADE')
            await asyncio.gather(first.close(), second.close())
