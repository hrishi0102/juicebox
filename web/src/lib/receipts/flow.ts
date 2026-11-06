// Where an employee's week stands. Every week is the same four steps:
//   write   the private AI on 0G writes the list (until then, simple rules draft it)
//   review  check what the company will see, keep single lines private
//   sign    lock the list and the numbers with the key on this laptop
//   send    one read-only Arkiv record, owned by you; the list sealed for the company on Swarm
// Review has no saved state of its own: you review right before you sign, so signing completes it.

export type StepState = "done" | "current" | "todo";
export type WeekStep = "write" | "review" | "sign" | "send";
export const WEEK_STEPS: WeekStep[] = ["write", "review", "sign", "send"];

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
    review: signedOk,
    sign: signedOk,
    send: signedOk && s.sent,
  };
  const next = WEEK_STEPS.find((k) => !done[k]) ?? "done";
  const state = (k: WeekStep): StepState => (done[k] ? "done" : k === next ? "current" : "todo");
  return { write: state("write"), review: state("review"), sign: state("sign"), send: state("send"), next };
}

/** One word for a saved week, for the employee's list of past receipts. */
export function receiptStatus(saved: { signature?: string; share?: { arkivKey?: string } } | undefined): "sent" | "signed" | "not signed" {
  if (saved?.share?.arkivKey) return "sent";
  if (saved?.signature) return "signed";
  return "not signed";
}
