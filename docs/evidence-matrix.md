# Evidence matrix

This project reports capability and proof separately.

| Label | Meaning |
|---|---|
| IMPLEMENTED | Source code or documented contract exists. |
| TESTED | Automated tests pass. |
| LOCALLY VERIFIED | A real local runtime and durable store path was exercised. |
| BROWSER VERIFIED | A real browser journey passed. |
| LIVE CONNECTOR VERIFIED | An authorized external connector delivered traceable durable evidence. |
| PRODUCTION VERIFIED | The authorized production deployment was exercised. |

Published benchmark figures, synthetic fixtures, HTTP 200 responses, and typechecks never upgrade a feature to a stronger label.

## Current gates

| Area | Current evidence |
|---|---|
| Browser simulation | IMPLEMENTED / TESTED |
| PostgreSQL runtime | IMPLEMENTED / TESTED; local verification requires configured PostgreSQL |
| MCP session and scope checks | IMPLEMENTED / TESTED |
| Hermes tools/call | IMPLEMENTED; live smoke must pass before LOCALLY VERIFIED |
| Worker lifecycle | IMPLEMENTED / TESTED; durable completion requires a live PostgreSQL run |
| Competitor benchmarks | Imported references remain reference-only; provider runs require authorized adapters and credentials |
| Production deployment | NOT VERIFIED |
