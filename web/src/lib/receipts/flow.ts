// Where an employee's week stands. Every week is the same three steps:
//   write   the private AI on 0G writes the list (until then, simple rules draft it)
//   sign    lock every line and every number with the key on this laptop
//   send    one read-only Arkiv record, owned by you; the list sealed for the company on Swarm
// The whole week is sent as written: nothing can be picked out or edited.

export type StepState = "done" | "current" | "todo";
export type WeekStep = "write" | "sign" | "send";
export const WEEK_STEPS: WeekStep[] = ["write", "sign", "send"];

export type WeekStatus = {
  /** The private AI wrote this week's list. */
  aiWritten: boolean;
  /** Sessions arrived after the AI wrote it. */
  storyStale: boolean;
  /** A signed receipt is saved for this week. */
  signed: boolean;
  /** The week changed after it was signed (rescan, a new write-up), so the signature is out of date. */
  receiptStale: boolean;
  /** The signed receipt was sent to the company. */
  sent: boolean;
};

export type WeekFlow = Record<WeekStep, StepState> & { next: WeekStep | "done" };

export function weekFlow(s: WeekStatus): WeekFlow {
  const signedOk = s.signed && !s.receiptStale;
  const done: Record<WeekStep, boolean> = {
    // Signing a list the rules drafted is allowed; writing is then simply skipped.
    write: (s.aiWritten && !s.storyStale) || signedOk,
    sign: signedOk,
    send: signedOk && s.sent,
  };
  const next = WEEK_STEPS.find((k) => !done[k]) ?? "done";
  const state = (k: WeekStep): StepState => (done[k] ? "done" : k === next ? "current" : "todo");
  return { write: state("write"), sign: state("sign"), send: state("send"), next };
}

/** One word for a saved week, for the employee's list of past receipts. */
export function receiptStatus(saved: { signature?: string; share?: { arkivKey?: string } } | undefined): "sent" | "signed" | "not signed" {
  if (saved?.share?.arkivKey) return "sent";
  if (saved?.signature) return "signed";
  return "not signed";
}
