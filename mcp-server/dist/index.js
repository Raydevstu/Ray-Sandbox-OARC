import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";
const pool = process.env.APEX_DATABASE_URL ? new Pool({ connectionString: process.env.APEX_DATABASE_URL }) : null;
const server = new Server({ name: "hindsight-memory", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        { name: "retain", description: "Store a memory fact", inputSchema: { type: "object", properties: { content: { type: "string" }, bankId: { type: "string" }, userId: { type: "string" } }, required: ["content"] } },
        { name: "recall", description: "Search memories", inputSchema: { type: "object", properties: { query: { type: "string" }, bankId: { type: "string" }, userId: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
        { name: "list_banks", description: "List all memory banks", inputSchema: { type: "object", properties: {} } },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {});
    if (name === "retain") {
        if (!pool)
            return { content: [{ type: "text", text: "PostgreSQL not configured. Set APEX_DATABASE_URL." }] };
        const factId = `fact-${Date.now()}`;
        await pool.query(`INSERT INTO memory_facts (id, bank_id, text, scopes) VALUES ($1, $2, $3, $4)`, [factId, a.bankId ?? "default", a.content, JSON.stringify({ userId: a.userId })]);
        return { content: [{ type: "text", text: `Retained: ${factId}` }] };
    }
    if (name === "recall") {
        if (!pool)
            return { content: [{ type: "text", text: "PostgreSQL not configured." }] };
        const result = await pool.query(`SELECT text, confidence FROM memory_facts WHERE bank_id = $1 ORDER BY mentioned_at DESC LIMIT $2`, [a.bankId ?? "default", a.limit ?? 10]);
        return { content: [{ type: "text", text: JSON.stringify(result.rows) }] };
    }
    if (name === "list_banks") {
        if (!pool)
            return { content: [{ type: "text", text: "[]" }] };
        const result = await pool.query(`SELECT DISTINCT bank_id FROM memory_facts`);
        return { content: [{ type: "text", text: JSON.stringify(result.rows.map((r) => r.bank_id)) }] };
    }
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
