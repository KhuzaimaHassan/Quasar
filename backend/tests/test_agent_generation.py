import importlib.util
from pathlib import Path
import sys
import unittest
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, patch

from agents import generation
from agents.execution import execute_graph, agent_error_message


class ProviderError(Exception):
    def __init__(self, code):
        super().__init__("private provider response")
        self.code = code


class Clock:
    def __init__(self):
        self.now = 0.0
        self.delays = []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.delays.append(seconds)
        self.now += seconds


class TestAgentGeneration(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.clock_patch = patch.object(generation, "time", self.clock)
        self.clock_patch.start()
        self.addCleanup(self.clock_patch.stop)
        self.client = SimpleNamespace(models=SimpleNamespace(generate_content=Mock()))
        self.config = {"response_mime_type": "application/json", "response_schema": dict}

    def generate(self):
        return generation.generate_content(
            self.client, model="chosen-model", contents="synthetic task", config=self.config,
        )

    def test_temporary_server_error_recovers_once_without_changing_model_or_schema(self):
        for status in (500, 502, 503, 504):
            with self.subTest(status=status):
                request = self.client.models.generate_content
                request.reset_mock()
                response = object()
                request.side_effect = [ProviderError(status), response]
                self.assertIs(self.generate(), response)
                self.assertEqual(request.call_count, 2)
                for call in request.call_args_list:
                    self.assertEqual(call.kwargs["model"], "chosen-model")
                    self.assertEqual(call.kwargs["contents"], "synthetic task")
                    self.assertIs(call.kwargs["config"]["response_schema"], dict)
                    self.assertEqual(call.kwargs["config"]["http_options"]["retry_options"], {"attempts": 1})
        self.assertNotIn("http_options", self.config)

    def test_auth_quota_validation_and_transport_failures_are_not_retried(self):
        for error in [*(ProviderError(code) for code in (400, 401, 403, 404, 429)), TimeoutError(), ConnectionError()]:
            with self.subTest(error=type(error).__name__, code=getattr(error, "code", None)):
                request = self.client.models.generate_content
                request.reset_mock()
                request.side_effect = error
                with self.assertRaises(type(error)):
                    self.generate()
                self.assertEqual(request.call_count, 1)
        self.assertEqual(self.clock.delays, [])

    def test_persistent_provider_failure_stops_after_second_attempt_and_keeps_safe_reference(self):
        self.client.models.generate_content.side_effect = ProviderError(503)
        with self.assertRaises(ProviderError) as raised:
            self.generate()
        self.assertEqual(self.client.models.generate_content.call_count, 2)
        self.assertEqual(self.clock.delays, [1.0])
        message = agent_error_message(raised.exception, "synthetic-reference")
        self.assertIn("503", message)
        self.assertIn("synthetic-reference", message)
        self.assertNotIn("private provider response", message)

    def test_all_nodes_share_budget_and_later_request_timeout_shrinks(self):
        def response(**kwargs):
            self.clock.now += 55
            return object()
        self.client.models.generate_content.side_effect = response
        with generation.generation_budget():
            self.generate()
            self.generate()
            self.client.models.generate_content.side_effect = ProviderError(503)
            with self.assertRaises(ProviderError):
                self.generate()
        timeouts = [call.kwargs["config"]["http_options"]["timeout"] for call in self.client.models.generate_content.call_args_list]
        self.assertEqual(timeouts, [60000, 60000, 10000, 9000])
        self.assertIsNone(generation._deadline.get())

    def test_exhausted_budget_starts_no_more_generation_or_retry(self):
        with generation.generation_budget():
            self.clock.now = 120
            with self.assertRaises(generation.AgentGenerationTimeout):
                self.generate()
        self.client.models.generate_content.assert_not_called()
        self.clock.now = 0
        def late_error(**kwargs):
            self.clock.now = 119.5
            raise ProviderError(503)
        self.client.models.generate_content.side_effect = late_error
        with generation.generation_budget(), self.assertRaises(generation.AgentGenerationTimeout):
            self.generate()
        self.assertEqual(self.client.models.generate_content.call_count, 1)
        self.assertEqual(self.clock.delays, [])

    def test_late_success_does_not_continue_to_approval(self):
        def late_response(**kwargs):
            self.clock.now = 121
            return object()
        self.client.models.generate_content.side_effect = late_response
        with generation.generation_budget(), self.assertRaises(generation.AgentGenerationTimeout) as raised:
            self.generate()
        self.assertIn("smaller task", agent_error_message(raised.exception, "test-reference"))
        self.assertIsNone(generation._deadline.get())

    def test_sdk_accepts_bounded_per_request_configuration(self):
        from google.genai import types
        self.client.models.generate_content.return_value = object()
        self.generate()
        parsed = types.GenerateContentConfig.model_validate(self.client.models.generate_content.call_args.kwargs["config"])
        self.assertEqual(parsed.http_options.timeout, 60000)
        self.assertEqual(parsed.http_options.retry_options.attempts, 1)


class TestAgentApprovalAfterRecovery(unittest.IsolatedAsyncioTestCase):
    async def test_real_graph_recovery_still_pauses_and_writes_once_after_approval(self):
        from google import genai
        from langgraph.checkpoint.memory import InMemorySaver
        from langgraph.types import Command
        from agents.schemas import PlanOutput, CodeOutput, GeneratedFile, ReviewOutput

        class LocalSaver(InMemorySaver):
            def __init__(self, unused_pool):
                super().__init__()

            def setup(self):
                pass

        settings_module = ModuleType("core.config")
        settings_module.settings = SimpleNamespace(
            GOOGLE_API_KEY="synthetic", DATABASE_URL="postgresql://synthetic",
            GOOGLE_GENERATIVE_MODEL="chosen-model",
        )
        filesystem = ModuleType("tools.filesystem")
        filesystem.write_file = Mock(return_value={"status": "written"})
        github = ModuleType("tools.github")
        github.create_or_update_file = Mock()
        request = Mock(side_effect=[
            ProviderError(503),
            SimpleNamespace(parsed=PlanOutput(steps=["Create one text file"])),
            SimpleNamespace(parsed=CodeOutput(files=[GeneratedFile(path="agent-check.txt", content="QUASAR_AGENT_OK\n")])),
            SimpleNamespace(parsed=ReviewOutput(approved=True, notes="Matches the task", issues=[])),
        ])
        client = SimpleNamespace(models=SimpleNamespace(generate_content=request))
        graph_path = Path(__file__).parents[1] / "agents" / "main_graph.py"
        spec = importlib.util.spec_from_file_location("agents._approval_fixture", graph_path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"core.config": settings_module, "tools.filesystem": filesystem, "tools.github": github}), patch.object(genai, "Client", return_value=client), patch("psycopg_pool.ConnectionPool"), patch("langgraph.checkpoint.postgres.PostgresSaver", LocalSaver), patch.object(generation.time, "sleep"):
            spec.loader.exec_module(module)
            config = {"configurable": {"thread_id": "synthetic-approval-test"}}
            state = await execute_graph(module.graph, {"task": "Create a text file", "workspace_id": "test-workspace", "execution_target": "sandbox"}, config)
            self.assertTrue(state.tasks[0].interrupts)
            self.assertEqual(state.tasks[0].interrupts[0].value["pendingFiles"], ["agent-check.txt"])
            filesystem.write_file.assert_not_called()
            github.create_or_update_file.assert_not_called()
            self.assertEqual(request.call_count, 4)
            final = await execute_graph(module.graph, Command(resume={"approved": True}), config)
            filesystem.write_file.assert_called_once_with("test-workspace", "agent-check.txt", "QUASAR_AGENT_OK\n")
            github.create_or_update_file.assert_not_called()
            self.assertEqual(request.call_count, 4)
            self.assertEqual(final.next, ())
            self.assertIn("Successfully wrote 1 files", final.values["final_output"])
