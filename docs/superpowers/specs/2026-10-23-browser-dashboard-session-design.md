# Browser Dashboard Session Design

The Dashboard browser connects to the existing JWT/JWKS security model through a same-origin session bridge. `POST /api/auth/session` accepts a bearer token over HTTPS, validates it with the existing JWT verifier, and writes it to a `HttpOnly`, `Secure` (production), `SameSite=Lax`, path-scoped cookie. The token is never returned to React or stored in browser storage.

`GET /api/auth/session` returns only public session metadata: subject, tenant ID, permissions, and allowed project IDs. Dashboard API and SSE routes authenticate either a bearer token or that cookie through the same verifier. Logout clears the cookie. Cookie authentication never weakens `APEX_REQUIRE_JWT`, tenant checks, permission checks, or `allowed_project_ids` project checks.

The Dashboard selects only a project returned by the session endpoint, clears prior data before switching, and reads its snapshot/SSE using the cookie. An absent, expired, invalid, or unauthorized session renders an explicit disconnected/sign-in state. No client fallback uses seeded metrics.

Tests cover token validation, HttpOnly cookie flags, session metadata redaction, logout, cookie authentication, project rejection, and browser-safe disconnected state. Production identity-provider login remains separate; this is a secure token-to-session bridge for the existing JWT contract.
