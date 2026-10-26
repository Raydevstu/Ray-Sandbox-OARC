import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_MAX_BYTES = 4096


def connect(path):
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("pragma journal_mode=wal")
    conn.execute("pragma foreign_keys=on")
    conn.executescript(
        """
        create table if not exists projects (
            project_id text primary key, display_name text not null, root text not null unique,
            created_at text not null default current_timestamp
        );
        create table if not exists aliases (
            alias text primary key, project_id text not null references projects(project_id)
        );
        create table if not exists episodes (
            id integer primary key autoincrement, project_id text not null references projects(project_id),
            session_id text, turn_id text, event_type text not null, content text not null,
            idempotency_key text not null unique, truncated integer not null default 0,
            created_at text not null default current_timestamp
        );
        create table if not exists captures (
            id integer primary key autoincrement, episode_id integer not null unique references episodes(id),
            status text not null, extracted text, created_at text not null default current_timestamp
            , sync_status text not null default 'queued', attempts integer not null default 0,
            available_at real not null default 0, leased_until real, last_error text, canonical_event_id text
        );
        create table if not exists memories (
            id integer primary key autoincrement, project_id text not null references projects(project_id),
            episode_id integer not null references episodes(id), kind text not null, status text not null default 'active',
            content text not null, created_at text not null default current_timestamp
        );
        """
    )
    conn.commit()
    return conn


def redact(text):
    text = re.sub(r"(?i)(token|api[_-]?key|password|secret)\s*[:=]\s*\S+", r"\1=[REDACTED]", text)
    text = re.sub(r"(?i)(transcript[_-]?path|session[_-]?path)\s*[:=]\s*[^\s]+", r"\1=[REDACTED]", text)
    text = re.sub(r"(?i)\b(?:ghp|github_pat)_[A-Za-z0-9_]+\b", "[REDACTED]", text)
    text = re.sub(r"(?i)(?:[A-Za-z]:\\|/)(?:[^\s\\/]+[\\/])*[^\s]+", "[REDACTED_PATH]", text)
    return text


def resolve_project(conn, cwd, display, explicit, host_project):
    config = Path(cwd) / ".ray-memory.json"
    values = json.loads(config.read_text()) if config.exists() else {}
    project_id = explicit or host_project or values.get("projectId") or hashlib.sha256(str(Path(cwd).resolve()).encode()).hexdigest()[:16]
    name = display or values.get("displayName") or project_id
    conn.execute("insert into projects(project_id, display_name, root) values (?, ?, ?) on conflict(project_id) do update set display_name=excluded.display_name", (project_id, name, str(Path(cwd).resolve())))
    conn.commit()
    return {"projectId": project_id, "displayName": name}


def _bounded(text, max_bytes):
    raw = text.encode("utf-8")
    if len(raw) <= max_bytes:
        return text, False
    return raw[:max_bytes].decode("utf-8", errors="ignore"), True


def capture(conn, event, max_bytes=DEFAULT_MAX_BYTES):
    project = event.get("projectId")
    if not project:
        return {"ok": False, "duplicate": False, "status": "failed", "extracted": None, "error": "project scope required"}
    conn.execute("insert into projects(project_id, display_name, root) values (?, ?, ?) on conflict(project_id) do nothing", (project, project, "capture://" + project))
    content, truncated = _bounded(redact(str(event.get("content", ""))), max_bytes)
    key = event.get("idempotencyKey") or hashlib.sha256(json.dumps({k: event.get(k) for k in ("projectId", "sessionId", "turnId", "eventType", "content")}, sort_keys=True).encode()).hexdigest()
    prior = conn.execute("select e.id, c.status, c.extracted from episodes e join captures c on c.episode_id=e.id where e.idempotency_key=?", (key,)).fetchone()
    if prior:
        return {"ok": True, "duplicate": True, "project": project, "status": prior["status"], "extracted": prior["extracted"], "episodeId": prior["id"]}
    kind = "decision" if re.search(r"\b(?:decided|decision|choose|chosen)\b", content, re.I) else None
    status = "extracted:" + kind if kind else "extracted:empty"
    cur = conn.execute("insert into episodes(project_id, session_id, turn_id, event_type, content, idempotency_key, truncated) values (?, ?, ?, ?, ?, ?, ?)", (project, event.get("sessionId"), event.get("turnId"), event.get("eventType", "unknown"), content, key, int(truncated)))
    episode_id = cur.lastrowid
    conn.execute("insert into captures(episode_id, status, extracted) values (?, ?, ?)", (episode_id, status, kind))
    if kind:
        conn.execute("insert into memories(project_id, episode_id, kind, content) values (?, ?, ?, ?)", (project, episode_id, kind, content))
    conn.commit()
    return {"ok": True, "duplicate": False, "project": project, "status": status, "extracted": kind, "episodeId": episode_id, "truncated": truncated}


def health(conn, project_id=""):
    count = conn.execute("select count(*) from projects where project_id=?", (project_id,)).fetchone()[0] if project_id else 0
    return {"status": "ready" if count else "empty", "projectId": project_id}


def sync_once(conn, sender, config, now=0):
    required = ("tenantId", "bankId", "projectId")
    if any(not config.get(key) for key in required):
        count = conn.execute("select count(*) from captures where sync_status='queued'").fetchone()[0]
        return {"claimed": 0, "processed": 0, "failed": 0, "deadLettered": 0, "scopeRejected": count}
    rows = conn.execute("select c.id, c.attempts, e.* from captures c join episodes e on e.id=c.episode_id where c.sync_status in ('queued','failed') and c.available_at<=?", (now,)).fetchall()
    result = {"claimed": len(rows), "processed": 0, "failed": 0, "deadLettered": 0, "scopeRejected": 0}
    for row in rows:
        if row["project_id"] != config["projectId"]:
            conn.execute("update captures set sync_status='failed', last_error=? where id=?", ("scope mismatch", row["id"]))
            result["scopeRejected"] += 1
            continue
        key = row["idempotency_key"]
        payload = {"tenantId": config["tenantId"], "bankId": config["bankId"], "projectId": row["project_id"], "conversationId": row["session_id"] or row["project_id"], "messageId": key, "idempotencyKey": key, "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "kind": "mcp-call", "method": "conversation/message", "name": row["event_type"], "role": "user", "content": row["content"]}
        response = sender(payload, config)
        attempts = row["attempts"] + 1
        if 200 <= response.get("status", 500) < 300:
            body = response.get("body", {})
            canonical_id = body.get("eventId") or body.get("data", {}).get("eventId")
            conn.execute("update captures set sync_status='processed', attempts=?, canonical_event_id=? where id=?", (attempts, canonical_id, row["id"]))
            result["processed"] += 1
        elif attempts >= config.get("maxAttempts", 5):
            conn.execute("update captures set sync_status='dead-letter', attempts=?, last_error=? where id=?", (attempts, str(response.get("body")), row["id"]))
            result["deadLettered"] += 1
        else:
            conn.execute("update captures set sync_status='failed', attempts=?, available_at=?, last_error=? where id=?", (attempts, now + min(3600, 2 ** attempts), str(response.get("body")), row["id"]))
            result["failed"] += 1
    conn.commit()
    return result


def recall_packet(conn, project_id, query, budget_chars=1800):
    rows = conn.execute("select id, kind, content, status from memories where project_id=? and status='active' and (content like ? or kind like ?) order by id desc", (project_id, "%" + query + "%", "%" + query + "%")).fetchall()
    lines = ["Ray Memory edge recall (non-canonical):"]
    for row in rows:
        lines.append(f"- {row['kind']} [{row['status']}] evidence_episode={row['id']}: {row['content']}")
    text = "\n".join(lines)
    return {"projectId": project_id, "query": query, "text": text[:budget_chars], "count": len(rows), "state": "empty" if not rows else "ready"}


def archive_memory(conn, project_id, memory_id, now):
    cur = conn.execute("update memories set status='archived' where id=? and project_id=? and status='active'", (memory_id, project_id))
    conn.commit()
    return cur.rowcount == 1


def mcp_dispatch(conn, message, scope):
    project_id = scope.get("projectId")
    if not project_id:
        return {"ok": False, "error": "project scope required"}
    method = message.get("method")
    params = message.get("params") or {}
    if method == "memory_recall":
        return {"ok": True, **recall_packet(conn, project_id, params.get("query", ""), min(int(params.get("budgetChars", 1800)), 1800))}
    if method == "memory_health":
        return {"ok": True, **health(conn, project_id)}
    if method == "memory_forget":
        return {"ok": archive_memory(conn, project_id, params.get("memoryId"), params.get("now", "now"))}
    if method == "memory_retain":
        return {"ok": bool(capture(conn, {"projectId": project_id, "eventType": "MCP", "content": params.get("content", "")})["ok"])}
    return {"ok": False, "error": "unknown method"}
