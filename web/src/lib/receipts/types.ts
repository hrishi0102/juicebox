// Shared types for Receipts.
// Everything here is derived data. Raw prompts never get stored in these shapes,
// except `PrivateDigest`, which only lives in memory or in the private local cache.

export type TokenCounts = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};

export type ModelCost = TokenCounts & { usd: number; requests: number; webSearches: number };

export type SessionCost = {
  usd: number; // computed by Receipts from the token counts in the log
  claudeReportedUsd?: number; // Claude Code's own number (cost-state record), when present
  tokens: TokenCounts;
  byModel: Record<string, ModelCost>;
  webSearches: number;
  unknownModels: string[];
};

export type GitPrRef = { repo: string; number: number; url: string; action?: string };

export type SessionGit = {
  commits: { sha: string; branch?: string; at: string }[];
  pushes: { branch: string; at: string }[];
  prs: GitPrRef[];
};

export type SessionSignals = {
  userPrompts: number;
  assistantTurns: number; // unique API responses
  toolCalls: number;
  toolErrors: number;
  maxErrorStreak: number;
  repeatedCommands: number; // identical Bash commands run 3+ times
  maxEditsSameFile: number;
  testRuns: number;
  apiErrors: number;
  compactions: number;
  interruptions: number;
  readOnlyRatio: number; // share of tool calls that only read (Read, Grep, Glob, WebFetch, WebSearch...)
  subagents: number;
};

export type Session = {
  id: string;
  projectDir: string; // folder name under ~/.claude/projects
  cwd: string; // most used working folder
  repos: string[]; // owner/name, best effort
  branches: string[]; // excludes HEAD / main / master
  startedAt: string;
  endedAt: string;
  activeMinutes: number;
  title?: string; // AI or custom title. Private: stays on the owner's machine.
  models: string[];
  cost: SessionCost;
  filesEdited: string[];
  linesAdded: number;
  linesRemoved: number;
  git: SessionGit;
  signals: SessionSignals;
  tools: Record<string, number>;
};

// What the private judge gets to see. Built on demand, never written to the repo.
export type PrivateDigest = {
  sessionId: string;
  prompts: string[]; // trimmed user prompts
  toolSummary: string;
  outcomeSummary: string;
  costSummary: string;
};

export type ChangeKind = "feature" | "fix" | "refactor" | "test" | "docs" | "chore" | "other";

// A unit of shipped (or not shipped) work: a pull request, or a direct commit.
export type Change = {
  key: string; // "owner/repo#123" or "owner/repo@sha"
  repo: string;
  type: "pr" | "commit";
  number?: number;
  sha?: string;
  url: string;
  title: string;
  author?: string;
  kind: ChangeKind;
  state: "merged" | "open" | "closed" | "direct";
  createdAt?: string;
  mergedAt?: string;
  baseRef?: string;
  headRef?: string;
  additions: number;
  deletions: number;
  files: string[];
  commitShas: string[];
  mergeCommitSha?: string;
  reverted: boolean;
  revertedBy?: string;
  survival?: SurvivalResult;
};

export type SurvivalResult = {
  measuredAt: string; // commit date used for the check
  matured: boolean; // true when 30 days have passed since merge
  linesAdded: number; // lines added in the sampled files
  linesAlive: number; // of those, lines still attributed to this change
  ratio: number; // linesAlive / linesAdded (0..1)
  filesChecked: number;
  method: "blame" | "estimate";
};

export type MatchReason = "pr-link" | "commit" | "branch" | "files-time";

export type SessionMatch = {
  sessionId: string;
  changeKey: string;
  reason: MatchReason;
  confidence: number; // 0..1
};

export type Label = "Shipped" | "Learned" | "Looped" | "Abandoned" | "Overkill";
export const LABELS: Label[] = ["Shipped", "Learned", "Looped", "Abandoned", "Overkill"];
// "Pending" = work still in flight (open PR, or fresh edits). Not judged yet, not counted as waste.
export type SessionLabel = Label | "Pending";

export type Judgement = {
  sessionId: string;
  label: SessionLabel;
  difficulty: 1 | 2 | 3 | 4 | 5;
  kind: ChangeKind;
  confidence: number;
  reason: string; // short and generic, never quotes prompts or code
  judge: JudgeInfo;
};

export type JudgeInfo = {
  engine: "heuristic" | "0g-tee" | "openai-compatible";
  model?: string;
  provider?: string; // 0G provider address that served the request
  requestId?: string; // 0G router request id (x_0g_trace.request_id)
  chatId?: string; // ZG-Res-Key, used to fetch the TEE signature
  trustMode?: string; // private | verified | standard
  sealed?: boolean; // X-0G-E2EE: sealed (prompt encrypted to the provider enclave)
  teeVerified?: boolean; // the router says it checked the TEE signature
  selfVerified?: boolean; // we checked the TEE signature ourselves with the 0G SDK
  verified?: boolean; // teeVerified || selfVerified
  requestHash?: string; // keccak256 of exactly what was sent (proves what was judged, without revealing it)
  responseHash?: string;
  at: string;
};

export type Task = {
  changeKey: string;
  repo: string;
  url: string;
  title: string;
  kind: ChangeKind;
  difficulty: number;
  state: Change["state"];
  reverted: boolean;
  survival: number | null; // 0..1, null when unknown
  survivalMatured: boolean;
  costUsd: number; // share of linked session cost
  sessions: string[];
  keptWork: number; // 0..1
  mergedAt?: string;
};

export type BucketStat = {
  difficulty: number;
  tasks: number;
  keptWork: number;
  costUsd: number;
  costPerKept: number | null;
};

export type PeriodSummary = {
  owner?: string;
  periodStart: string;
  periodEnd: string;
  sessions: number;
  spendUsd: number;
  shippedTasks: number;
  survivalPct: number | null; // weighted by lines
  keptWork: number;
  keptWorkPer100Usd: number | null;
  labelCounts: Record<SessionLabel, number>;
  labelSpend: Record<SessionLabel, number>;
  wasteUsd: number;
  wastePct: number;
  buckets: BucketStat[];
  tasks: Task[];
  tips: string[];
};
