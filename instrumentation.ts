import { ensureSchema } from "./lib/server/pg-client";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await ensureSchema();
      console.log("[boot] schema ensured");
    } catch (e) {
      console.error("[boot] schema ensure failed:", e);
    }
  }
}
