// Single-file entrypoint for OpenCode 1.18.13's V1 loader (proven path: a
// direct .js file in ~/.config/opencode/plugins/). Re-exports the V1 hook
// surface from the directory package so there is one source of truth.
import { RayMemory } from "./ray-memory/index.js";
export { RayMemory };
export default RayMemory;
