# Hermes automation with Ray Memory

This is a repository-side integration template. It does not edit the Hermes
user configuration or create a scheduled job automatically.

Hermes cron runs in its own session and can use the same MCP server registered
for interactive Hermes work. Configure the `ray_memory` MCP command from
`hermes-mcp-command.example.json`, then create a read-only scheduled check in
Hermes using its supported cron surface:

```text
hermes cron add --name ray-memory-health --schedule "every 2h" --prompt "Use the Ray Memory MCP server. Call memory_get_capture_status and memory_get_project_state for the configured project. Report only the returned state and whether capture is processed, queued, failed, or unavailable." --deliver local
```

The prompt must not request secrets or bypass the project scope. The MCP proxy
binds the provider, tenant, bank, project, and conversation context at session
initialization; the gateway rejects a project override or an unbound session.

For a one-shot verification, use the Hermes MCP proxy and call:

1. `memory_get_capture_status`
2. `memory_get_project_state`
3. `memory_recall` with a bounded query and correlation ID

The same contract is available as a repeatable local smoke command:

```text
npm run hermes:automation:smoke
```

This verifies the Ray MCP gateway directly. It is useful as a cron health
check, but it does not by itself prove that Hermes cron scheduled or delivered
the run; that still requires a Hermes terminal result and a matching dashboard
event.

Expected local evidence is a successful JSON-RPC response, a project-scoped
durable event, and a dashboard snapshot with measured operations. A scheduled
job existing in Hermes is not proof that it fired; verify its terminal result
and the Ray dashboard event stream separately.

Harmony handling remains Hermes-owned: Hermes sanitizes reserved Codex/Harmony
wire tokens before provider submission. Ray Memory receives ordinary MCP JSON-
RPC tool calls and does not attempt to parse or persist those control tokens.
