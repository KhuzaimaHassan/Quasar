import asyncio
import threading
import unittest
from types import SimpleNamespace

from agents.execution import execute_graph, agent_error_message


class TestAgentExecution(unittest.IsolatedAsyncioTestCase):
    async def test_graph_does_not_block_event_loop_or_repeat_model_work(self):
        started = threading.Event()
        release = threading.Event()
        calls = []
        state = SimpleNamespace(values={"generated_files": {"qa.txt": "ok"}})

        class Graph:
            def stream(self, graph_input, config):
                calls.append((graph_input, config))
                started.set()
                if not release.wait(2):
                    raise RuntimeError("Event loop was blocked")
                yield {"done": True}

            def get_state(self, config):
                return state

        task = asyncio.create_task(execute_graph(Graph(), {"task": "synthetic"}, {"thread": "test"}))
        try:
            self.assertTrue(await asyncio.to_thread(started.wait, 1))
            await asyncio.wait_for(asyncio.sleep(0), timeout=0.1)
        finally:
            release.set()
        self.assertIs(await task, state)
        self.assertEqual(len(calls), 1)

    async def test_graph_errors_remain_failures_and_are_safe_to_display(self):
        class Graph:
            def stream(self, graph_input, config):
                raise RuntimeError("private-provider-details")

        with self.assertRaises(RuntimeError) as raised:
            await execute_graph(Graph(), {}, {})
        message = agent_error_message(raised.exception, "test-thread")
        self.assertNotIn("private-provider-details", message)
        self.assertIn("test-thread", message)
