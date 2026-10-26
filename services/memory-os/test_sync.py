import unittest
from test_ray_memory_os import RayMemorySpoolTests
from ray_memory_os import capture, sync_once


class SyncTests(RayMemorySpoolTests):
    def event(self):
        return {"projectId": "p", "sessionId": "s", "turnId": "t", "eventType": "Stop", "content": "We decided to use Postgres."}

    def test_success_is_processed_and_idempotent(self):
        capture(self.conn, self.event())
        seen = []
        result = sync_once(self.conn, lambda payload, config: seen.append(payload) or {"status": 200, "body": {"eventId": "canonical-1"}}, {"tenantId": "t", "bankId": "b", "projectId": "p"})
        self.assertEqual(result["processed"], 1)
        self.assertEqual(self.conn.execute("select sync_status from captures").fetchone()[0], "processed")
        self.assertEqual(seen[0]["idempotencyKey"], seen[0]["idempotencyKey"])

    def test_transport_failure_then_dead_letter(self):
        capture(self.conn, self.event())
        sender = lambda payload, config: {"status": 503, "body": {"error": "down"}}
        first = sync_once(self.conn, sender, {"tenantId": "t", "bankId": "b", "projectId": "p", "maxAttempts": 2})
        self.assertEqual(first["failed"], 1)
        self.conn.execute("update captures set available_at=0")
        second = sync_once(self.conn, sender, {"tenantId": "t", "bankId": "b", "projectId": "p", "maxAttempts": 2})
        self.assertEqual(second["deadLettered"], 1)
        self.assertEqual(self.conn.execute("select sync_status from captures").fetchone()[0], "dead-letter")

    def test_missing_or_mismatched_scope_rejects(self):
        capture(self.conn, self.event())
        missing = sync_once(self.conn, lambda *_: {"status": 200}, {})
        self.assertEqual(missing["scopeRejected"], 1)
        mismatch = sync_once(self.conn, lambda *_: {"status": 200}, {"tenantId": "t", "bankId": "b", "projectId": "other"})
        self.assertEqual(mismatch["scopeRejected"], 1)


if __name__ == "__main__":
    unittest.main()
