// Tiny .env.local loader for the CLI (Next.js loads it on its own for the web app).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadEnvLocal(dir = process.cwd()) {
  for (const name of [".env.local", ".env"]) {
    const p = join(dir, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
