import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from ray_memory_os import capture, connect, sync_once


class GovernedSyncIntegrationTests(unittest.TestCase):
    def test_edge_event_reaches_governed_sender_and_is_processed(self):
        with tempfile.TemporaryDirectory() as folder:
            conn = connect(Path(folder) / "edge.sqlite3")
            capture(conn, {"projectId": "p", "sessionId": "s", "turnId": "1", "eventType": "Stop", "content": "We decided to use Postgres."})
            received = []
            result = sync_once(conn, lambda payload, config: received.append((payload, config)) or {"status": 202, "body": {"eventId": "governed-1"}}, {"tenantId": "tenant", "bankId": "bank", "projectId": "p"})
            self.assertEqual(result["processed"], 1)
            self.assertEqual(received[0][0]["projectId"], "p")
            self.assertEqual(received[0][1]["tenantId"], "tenant")
            self.assertEqual(conn.execute("select sync_status from captures").fetchone()[0], "processed")
            conn.close()

    def test_launcher_hook_captures_codex_event(self):
        root = Path(__file__).parents[2]
        with tempfile.TemporaryDirectory() as folder:
            env = dict(os.environ, RAY_MEMORY_DB=str(Path(folder) / "edge.sqlite3"))
            event = {"eventType": "UserPromptSubmit", "content": "We decided to use PostgreSQL.", "projectId": "p1", "idempotencyKey": "hook-1"}
            proc = subprocess.run([sys.executable, str(root / "plugins/ray-memory-os/scripts/ray-memory-launcher.py"), "hook"], input=json.dumps(event), text=True, capture_output=True, env=env, check=True)
            result = json.loads(proc.stdout)
            self.assertEqual(result["status"], "extracted:decision")
            self.assertNotIn("edgeOnly", result)
            conn = connect(Path(folder) / "edge.sqlite3")
            self.assertEqual(conn.execute("select count(*) from episodes").fetchone()[0], 1)
            conn.close()

    def test_user_prompt_hook_returns_bounded_additional_context(self):
        root = Path(__file__).parents[2]
        with tempfile.TemporaryDirectory() as folder:
            env = dict(os.environ, RAY_MEMORY_DB=str(Path(folder) / "edge.sqlite3"))
            seed = {"eventType": "Stop", "content": "We decided to use PostgreSQL.", "projectId": "p1", "idempotencyKey": "seed-1"}
            subprocess.run([sys.executable, str(root / "plugins/ray-memory-os/scripts/ray-memory-launcher.py"), "hook"], input=json.dumps(seed), text=True, capture_output=True, env=env, check=True)
            event = {"eventType": "UserPromptSubmit", "content": "What did we decide?", "projectId": "p1", "idempotencyKey": "prompt-1"}
            proc = subprocess.run([sys.executable, str(root / "plugins/ray-memory-os/scripts/ray-memory-launcher.py"), "hook"], input=json.dumps(event), text=True, capture_output=True, env=env, check=True)
            result = json.loads(proc.stdout)
            self.assertLessEqual(len(result["hookSpecificOutput"]["additionalContext"]), 1800)


if __name__ == "__main__":
    unittest.main()
