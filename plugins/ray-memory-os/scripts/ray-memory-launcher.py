import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "memory-os"))
from ray_memory_os import connect, mcp_dispatch, sync_once  # noqa: E402


def send_http(payload, config):
    headers = {"content-type": "application/json", **config.get("headers", {})}
    if config.get("token"):
        headers["authorization"] = "Bearer " + config["token"]
    request = urllib.request.Request(
        config["endpoint"],
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = json.loads(response.read() or b"{}")
            return {"status": response.status, "body": body}
    except urllib.error.HTTPError as error:
        try:
            body = json.loads(error.read() or b"{}")
        except Exception:
            body = {"error": str(error)}
        return {"status": error.code, "body": body}
    except Exception as error:
        return {"status": 503, "body": {"error": str(error)}}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "hook"
    db = Path(os.environ.get("RAY_MEMORY_DB", str(ROOT / ".ray-memory" / "memory.sqlite3")))
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(db)
    try:
        message = json.loads(sys.stdin.read() or "{}")
        if mode == "mcp":
            result = mcp_dispatch(conn, message, {"projectId": os.environ.get("RAY_MEMORY_PROJECT_ID", "")})
        elif mode == "sync":
            config = {
                "endpoint": os.environ.get("RAY_MEMORY_ENDPOINT", ""),
                "token": os.environ.get("RAY_MEMORY_TOKEN", ""),
                "tenantId": os.environ.get("RAY_MEMORY_TENANT_ID", ""),
                "bankId": os.environ.get("RAY_MEMORY_BANK_ID", ""),
                "projectId": os.environ.get("RAY_MEMORY_PROJECT_ID", ""),
                "headers": {key: value for key, value in {"x-dev-subject": os.environ.get("RAY_MEMORY_DEV_SUBJECT", ""), "x-dev-tenant-id": os.environ.get("RAY_MEMORY_DEV_TENANT_ID", ""), "x-dev-bank-id": os.environ.get("RAY_MEMORY_DEV_BANK_ID", ""), "x-dev-project-id": os.environ.get("RAY_MEMORY_DEV_PROJECT_ID", ""), "x-dev-scopes": os.environ.get("RAY_MEMORY_DEV_SCOPES", "")}.items() if value},
            }
            result = sync_once(conn, send_http, config)
        else:
            result = {"ok": True, "status": "queued", "edgeOnly": True}
        print(json.dumps(result))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
