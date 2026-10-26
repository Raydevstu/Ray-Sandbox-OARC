import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from ray_memory_os import capture, connect, health, redact, resolve_project


class RayMemorySpoolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "memory.sqlite3"
        self.conn = connect(self.db)

    def tearDown(self):
        self.conn.close()
        self.temp.cleanup()

    def test_project_binding_alias_and_health(self):
        root = Path(self.temp.name) / "project"
        root.mkdir()
        (root / ".ray-memory.json").write_text(json.dumps({"projectId": "ray-claude-wiki", "displayName": "Ray Wiki"}))
        first = resolve_project(self.conn, root, "", "", "")
        second = resolve_project(self.conn, root, "", "", "")
        self.assertEqual(first["projectId"], "ray-claude-wiki")
        self.assertEqual(first, second)
        self.assertEqual(health(self.conn, "ray-claude-wiki")["status"], "ready")

    def test_redacts_secrets_and_transcript_paths(self):
        text = "token=github-example-secret-0123456789 transcript_path=C:\\Users\\me\\session.json"
        result = redact(text)
        self.assertNotIn("github-example-secret", result)
        self.assertNotIn("C:\\Users\\me", result)
        self.assertIn("[REDACTED]", result)

    def test_capture_extracts_decision_with_evidence(self):
        event = {"projectId": "ray-claude-wiki", "sessionId": "s1", "turnId": "t1", "eventType": "Stop", "content": "We decided to use Postgres instead of SQLite."}
        result = capture(self.conn, event)
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "extracted:decision")
        self.assertTrue(result["episodeId"])
        self.assertEqual(result["extracted"], "decision")

    def test_duplicate_capture_returns_original(self):
        event = {"projectId": "p", "sessionId": "s", "turnId": "t", "eventType": "Stop", "content": "We decided to keep the governed path."}
        first = capture(self.conn, event)
        second = capture(self.conn, event)
        self.assertFalse(first["duplicate"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(first["episodeId"], second["episodeId"])
        self.assertEqual(self.conn.execute("select count(*) from episodes").fetchone()[0], 1)

    def test_oversized_event_is_truncated(self):
        event = {"projectId": "p", "sessionId": "s", "turnId": "t", "eventType": "Stop", "content": "x" * 10000}
        result = capture(self.conn, event, max_bytes=200)
        self.assertTrue(result["ok"])
        self.assertTrue(result["truncated"])
        self.assertLessEqual(len(self.conn.execute("select content from episodes").fetchone()[0].encode()), 200)


if __name__ == "__main__":
    unittest.main()
