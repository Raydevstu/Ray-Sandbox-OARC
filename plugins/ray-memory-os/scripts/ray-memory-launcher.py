import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
if not (Path(__file__).resolve().parent / "ray_memory_os.py").exists():
    sys.path.insert(0, str(ROOT / "services" / "memory-os"))


def diagnostic_log(message):
    try:
        root = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "RayMemory"
        root.mkdir(parents=True, exist_ok=True)
        with (root / "hook.log").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(message, sort_keys=True) + "\n")
    except Exception:
        pass


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
    raw = sys.stdin.read() or "{}"
    try:
        diagnostic = json.loads(raw)
    except Exception:
        diagnostic = {}
    diagnostic_log({
        "pluginRoot": str(PLUGIN_ROOT),
        "pluginData": os.environ.get("PLUGIN_DATA", ""),
        "eventName": diagnostic.get("hook_event_name") or diagnostic.get("eventType") or diagnostic.get("event", "unknown"),
        "sessionId": diagnostic.get("session_id") or diagnostic.get("sessionId", ""),
        "turnId": diagnostic.get("turn_id") or diagnostic.get("turnId", ""),
    })
    from ray_memory_os import capture, connect, mcp_dispatch, recall_packet, resolve_project, sync_once

    mode = sys.argv[1] if len(sys.argv) > 1 else "hook"
    data_root = Path(os.environ.get("PLUGIN_DATA") or (PLUGIN_ROOT / ".ray-memory"))
    db = Path(os.environ.get("RAY_MEMORY_DB") or (data_root / "memory.sqlite3"))
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = connect(db)
    try:
        message = json.loads(raw)
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
            cwd = message.get("cwd") or os.environ.get("PWD") or os.getcwd()
            binding = resolve_project(
                conn,
                cwd,
                message.get("projectDisplayName"),
                message.get("projectId") or os.environ.get("RAY_MEMORY_PROJECT_ID"),
                message.get("hostProjectId"),
            )
            event_type = message.get("hook_event_name") or message.get("eventType") or message.get("event") or "unknown"
            content = message.get("content") or message.get("prompt") or message.get("message") or message.get("last_assistant_message") or message.get("lastAssistantMessage") or ""
            event = {
                **message,
                "projectId": binding["projectId"],
                "sessionId": message.get("session_id") or message.get("sessionId"),
                "turnId": message.get("turn_id") or message.get("turnId"),
                "eventType": event_type,
                "content": content,
            }
            result = capture(conn, event) if content.strip() else {"ok": True, "status": "skipped", "project": binding["projectId"]}
            if event_type in ("SessionStart", "UserPromptSubmit"):
                packet = recall_packet(conn, binding["projectId"], content, 1800)
                result["hookSpecificOutput"] = {"hookEventName": event_type, "additionalContext": packet["text"]}
        print(json.dumps(result))
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("{}")
