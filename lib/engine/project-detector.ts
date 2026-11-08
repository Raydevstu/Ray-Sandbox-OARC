export interface ProjectDetection {
  projectName: string | null;
  detectedProjects: string[];
  confidence: number;
}

export function slugifyProject(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
}

export function detectProject(text: string): ProjectDetection {
  const detectedProjects: string[] = [];
  let projectName: string | null = null;
  let confidence = 0;

  // Pattern 1: "Project: X" or "Project X"
  const projectColonMatch = text.match(/Project:\s*([A-Za-z0-9][A-Za-z0-9 _-]{1,30})/i);
  if (projectColonMatch) {
    projectName = projectColonMatch[1].trim();
    confidence = Math.max(confidence, 0.9);
    detectedProjects.push(projectName);
  }

  const projectSpaceMatch = text.match(/\bProject\s+([A-Z][A-Za-z0-9_-]{1,30})\b/g);
  if (projectSpaceMatch) {
    for (const m of projectSpaceMatch) {
      const name = m.replace(/^Project\s+/i, "").trim();
      if (name && !detectedProjects.includes(name)) {
        detectedProjects.push(name);
        if (!projectName) {
          projectName = name;
          confidence = Math.max(confidence, 0.85);
        }
      }
    }
  }

  // Pattern 2: Tech stack detection (fallback)
  if (!projectName) {
    const techStacks = ["Next.js", "React", "Vue", "Angular", "PostgreSQL", "MongoDB", "TypeScript", "Python", "Rust", "Go"];
    const found = techStacks.filter((tech) => text.includes(tech));
    if (found.length >= 2) {
      projectName = found.slice(0, 2).join(" + ");
      confidence = Math.max(confidence, 0.6);
      if (!detectedProjects.includes(projectName)) {
        detectedProjects.push(projectName);
      }
    }
  }

  // Pattern 3: Generic keyword boost
  if (text.toLowerCase().includes("project") || text.toLowerCase().includes("building") || text.toLowerCase().includes("architecture")) {
    confidence = Math.max(confidence, 0.2);
  }

  // No project found
  if (!projectName && detectedProjects.length === 0) {
    confidence = Math.min(confidence, 0.2);
  }

  return { projectName, detectedProjects, confidence };
}