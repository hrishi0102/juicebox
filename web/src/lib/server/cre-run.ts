// Runs the Chainlink CRE monthly check on this laptop, with Chainlink's own CLI: the same
// `cre workflow simulate --broadcast` as in cre/README.md. It reads the team from Arkiv, checks the
// signatures, and posts the score to TeamScoreboard on Sepolia. On the Chainlink network the monthly
// cron does this; the button that calls it only exists on the laptop, for demos.
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const creDir = () => join(process.cwd(), "..", "cre");

/** The CRE CLI, if it is installed and the workflow is next to this app. */
export function creCli(): string | undefined {
  const cli = process.env.CRE_CLI || join(homedir(), ".cre", "bin", "cre");
  return existsSync(cli) && existsSync(join(creDir(), "receipts-monthly", "main.ts")) && existsSync(join(creDir(), ".env")) ? cli : undefined;
}

/** The team the workflow checks (its config). */
export function creTeam(): string | undefined {
  try {
    return JSON.parse(readFileSync(join(creDir(), "receipts-monthly", "config.staging.json"), "utf8")).teamId;
  } catch {
    return undefined;
  }
}

export type CreRun = { ok: true; txHash?: string; score?: Record<string, number> } | { ok: false; error: string };

let running = false;

export async function runMonthlyCheck(): Promise<CreRun> {
  const cli = creCli();
  if (!cli) return { ok: false, error: "The CRE CLI or cre/.env is missing on this laptop. See cre/README.md." };
  if (running) return { ok: false, error: "The check is already running." };
  running = true;
  try {
    const out = await new Promise<string>((resolve) => {
      execFile(
        cli,
        ["workflow", "simulate", "receipts-monthly", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0", "--broadcast", "--evm-receipt-timeout", "2m"],
        {
          cwd: creDir(),
          timeout: 180_000,
          maxBuffer: 8 * 1024 * 1024,
          env: { ...process.env, PATH: [join(homedir(), ".bun", "bin"), join(homedir(), ".cre", "bin"), process.env.PATH].join(":") },
        },
        (_err, stdout, stderr) => resolve(`${stdout}\n${stderr}`),
      );
    });
    const score = out.match(/\[USER LOG\] team=\S+ asOf=\S+ score=(\{[^\n]*\})/)?.[1];
    const tx = out.match(/TeamScoreboard updated, tx (0x[0-9a-fA-F]{64})/)?.[1];
    if (tx && !/^0x0+$/.test(tx)) return { ok: true, txHash: tx, score: score ? JSON.parse(score) : undefined };
    const failed = out.match(/✗ ([^\n]+)/)?.[1] ?? out.match(/error[^\n]*/i)?.[0] ?? "The simulation did not post a score.";
    return { ok: false, error: failed.slice(0, 300) };
  } finally {
    running = false;
  }
}
