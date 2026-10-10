import { describe, expect, it } from "vitest";

import { buildReleaseCandidateManifest } from "../../scripts/release-candidate-manifest.mjs";

describe("release candidate manifest", () => {
  it("blocks promotion when untracked files or divergent remote tips are present", () => {
    const manifest = buildReleaseCandidateManifest({
      head: "candidate",
      status: ["?? lib/new-file.ts"],
      localRefs: { main: "local-main" },
      remoteRefs: { "oarc/main": "remote-main" },
      mergeBase: null,
    });

    expect(manifest.promotionEligible).toBe(false);
    expect(manifest.blockers).toContain("untracked files require explicit candidate selection");
    expect(manifest.blockers).toContain("remote main relationship is unresolved");
  });

  it("allows a clean candidate with matching remote history", () => {
    const manifest = buildReleaseCandidateManifest({
      head: "candidate",
      status: [],
      localRefs: { main: "main-tip" },
      remoteRefs: { "oarc/main": "main-tip" },
      mergeBase: "main-tip",
    });

    expect(manifest.promotionEligible).toBe(true);
    expect(manifest.blockers).toEqual([]);
  });
});
