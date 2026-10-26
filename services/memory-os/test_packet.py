import unittest
from test_ray_memory_os import RayMemorySpoolTests
from ray_memory_os import archive_memory, capture, mcp_dispatch, recall_packet


class PacketTests(unittest.TestCase):
    def setUp(self):
        self.temp = __import__('tempfile').TemporaryDirectory()
        from pathlib import Path
        self.conn = __import__('ray_memory_os').connect(Path(self.temp.name) / 'memory.sqlite3')
        capture(self.conn, {"projectId": "p", "sessionId": "s", "turnId": "1", "eventType": "Stop", "content": "We decided to use Postgres. token=secret"})

    def tearDown(self):
        self.conn.close()
        self.temp.cleanup()

    def test_packet_is_bounded_and_scoped(self):
        packet = recall_packet(self.conn, "p", "decision", 180)
        self.assertLessEqual(len(packet["text"].encode()), 180)
        self.assertIn("decision", packet["text"])
        self.assertNotIn("secret", packet["text"])

    def test_archive_preserves_episode(self):
        memory_id = self.conn.execute("select id from memories").fetchone()[0]
        self.assertTrue(archive_memory(self.conn, "p", memory_id, "now"))
        self.assertEqual(self.conn.execute("select status from memories").fetchone()[0], "archived")
        self.assertEqual(self.conn.execute("select count(*) from episodes").fetchone()[0], 1)

    def test_mcp_requires_scope(self):
        result = mcp_dispatch(self.conn, {"method": "memory_recall", "params": {}}, {})
        self.assertFalse(result["ok"])


if __name__ == "__main__":
    unittest.main()
