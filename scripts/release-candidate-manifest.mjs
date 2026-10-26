import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

export function buildReleaseCandidateManifest(input) {
  const status = input.status ?? [];
  const hasUntrackedFiles = status.some((line) => line.startsWith("??") || line.startsWith("!!"));
  const localMain = input.localRefs?.main ?? null;
  const remoteMain = input.remoteRefs?.["oarc/main"] ?? null;
  const remoteRelationshipKnown = Boolean(localMain && remoteMain && input.mergeBase);
  const remoteRelationshipMatches = remoteRelationshipKnown && localMain === remoteMain && input.mergeBase === remoteMain;
  const blockers = [];

  if (hasUntrackedFiles) blockers.push("untracked files require explicit candidate selection");
  if (!remoteRelationshipMatches) blockers.push("remote main relationship is unresolved");

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    head: input.head ?? null,
    status,
    localRefs: input.localRefs ?? {},
    remoteRefs: input.remoteRefs ?? {},
    mergeBase: input.mergeBase ?? null,
    promotionEligible: blockers.length === 0,
    blockers,
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function collectManifest() {
  const status = git(["status", "--porcelain=v1"]).split(/\r?\n/).filter(Boolean);
  const head = git(["rev-parse", "HEAD"]);
  const localMain = git(["rev-parse", "--verify", "refs/heads/main"]).trim();
  const remoteLines = git(["ls-remote", "--heads", "oarc"]).split(/\r?\n/).filter(Boolean);
  const remoteRefs = Object.fromEntries(remoteLines.map((line) => {
    const [sha, ref] = line.split(/\s+/);
    return [`oarc/${ref.replace("refs/heads/", "")}`, sha];
  }));
  let mergeBase = null;
  try {
    mergeBase = git(["merge-base", "refs/heads/main", "oarc/main"]);
  } catch {
    mergeBase = null;
  }
  return buildReleaseCandidateManifest({ head, status, localRefs: { main: localMain }, remoteRefs, mergeBase });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  const manifest = collectManifest();
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (output) writeFileSync(output, serialized, "utf8");
  process.stdout.write(serialized);
}
