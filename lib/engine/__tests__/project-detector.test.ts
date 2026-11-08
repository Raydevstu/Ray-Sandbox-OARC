import { describe, expect, it } from "vitest";
import { detectProject, slugifyProject, ProjectDetection } from "../project-detector";

describe("project detector", () => {
  it("detects explicit project name from 'Project: X' pattern", () => {
    const result = detectProject("Project: Alpha\nWe are building a CRM SaaS.");
    expect(result.projectName).toBe("Alpha");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("detects project name from 'Project X' pattern", () => {
    const result = detectProject("Project Alpha architecture notes");
    expect(result.projectName).toBe("Alpha");
  });

  it("detects tech stack as project name when no explicit name", () => {
    const result = detectProject("We are using Next.js + PostgreSQL for the frontend and database.");
    expect(result.projectName).toContain("Next.js");
  });

  it("returns null when no project indicators found", () => {
    const result = detectProject("The weather is nice today.");
    expect(result.projectName).toBeNull();
    expect(result.confidence).toBeLessThan(0.3);
  });

  it("slugifies project names correctly", () => {
    expect(slugifyProject("Project Alpha")).toBe("project-alpha");
    expect(slugifyProject("Next.js + PostgreSQL")).toBe("nextjs-postgresql");
    expect(slugifyProject("My Cool Project!")).toBe("my-cool-project");
  });

  it("detects multiple projects in a transcript", () => {
    const result = detectProject("Project Alpha uses React. Project Beta uses Vue.");
    expect(result.detectedProjects).toContain("Alpha");
    expect(result.detectedProjects).toContain("Beta");
  });

  it("returns confidence score between 0 and 1", () => {
    const result = detectProject("Building a memory system with TypeScript");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});