// Local data store. Real data lives in ~/.receipts (outside the repo) so transcripts and
// derived data can never be committed by accident. Demo data lives in web/fixtures/demo.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DATA_DIR = process.env.RECEIPTS_DATA_DIR || join(homedir(), ".receipts");
export const DEMO_DIR = join(process.cwd(), "fixtures", "demo");

export type Source = "local" | "demo";

export function dirFor(source: Source) {
  return source === "demo" ? DEMO_DIR : DATA_DIR;
}

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function readJson<T>(source: Source, name: string, fallback: T): T {
  const p = join(dirFor(source), name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(source: Source, name: string, data: unknown) {
  const dir = ensureDir(dirFor(source));
  const p = join(dir, name);
  const sub = p.slice(0, p.lastIndexOf("/"));
  ensureDir(sub);
  writeFileSync(p, JSON.stringify(data, null, 2), { mode: 0o600 });
  return p;
}

export function hasData(source: Source) {
  return existsSync(join(dirFor(source), "sessions.json"));
}
