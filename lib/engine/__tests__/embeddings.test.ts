import { describe, expect, it } from "vitest";
import { getEmbedder, hashedProvider } from "../embeddings";

describe("embeddings provider", () => {
  it("hashed provider returns 128-dim vectors", () => {
    const v = hashedProvider.embed("hello world");
    expect(v.length).toBe(128);
    expect(v).toBeInstanceOf(Float32Array);
  });

  it("getEmbedder returns hashed by default", () => {
    const saved = process.env.HERMES_EMBED_URL;
    delete process.env.HERMES_EMBED_URL;
    expect(getEmbedder().name).toBe("hashed");
    if (saved !== undefined) process.env.HERMES_EMBED_URL = saved;
  });

  it("getEmbedder returns http provider when URL is set", () => {
    process.env.HERMES_EMBED_URL = "http://localhost:9999/embedding";
    expect(getEmbedder().name).toBe("http");
    delete process.env.HERMES_EMBED_URL;
  });
});
