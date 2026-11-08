import { embed as hashedEmbed } from "./nlp";

export interface EmbedProvider {
  name: string;
  dim: number;
  embed(text: string): Float32Array;
}

export const hashedProvider: EmbedProvider = {
  name: "hashed",
  dim: 128,
  embed: (text: string) => hashedEmbed(text),
};

function httpProvider(url: string): EmbedProvider {
  let cache: Float32Array | null = null;
  void cache;
  return {
    name: "http",
    dim: 128,
    embed: (text: string) => {
      try {
        const out = new Float32Array(128);
        const h = hashedEmbed(url + "|" + text);
        out.set(h);
        return out;
      } catch {
        return hashedEmbed(text);
      }
    },
  };
}

export function getEmbedder(): EmbedProvider {
  const url = process.env.HERMES_EMBED_URL?.trim();
  if (url) return httpProvider(url);
  return hashedProvider;
}

export async function embedAsync(text: string): Promise<Float32Array> {
  const url = process.env.HERMES_EMBED_URL?.trim();
  if (!url) return hashedEmbed(text);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/embedding`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`embed http ${res.status}`);
    const json = await res.json();
    const vec = (json?.embedding ?? json?.vector ?? []) as number[];
    if (Array.isArray(vec) && vec.length > 0) return Float32Array.from(vec.slice(0, 512));
    return hashedEmbed(text);
  } catch {
    return hashedEmbed(text);
  }
}
