"use client";

// The private AI buttons of the employee app. Each is paid from your own 0G account.
import { ZeroGButton } from "@/components/zero-g-button";
import { judgeSessions, reviewWeek, writeWeek } from "@/lib/zerog-tasks";

export function WriteWeekButton({ week, label, variant = "default" }: { week: string; label: string; variant?: "default" | "outline" }) {
  return (
    <ZeroGButton
      icon
      accountLine
      size="lg"
      variant={variant}
      label={label}
      busyLabel="Writing your week"
      run={async (zg, progress) => {
        const r = await writeWeek(zg, week, progress);
        return `Done: ${r.items} things, written by the private AI on 0G${r.verified ? ", all TEE verified" : ""}.`;
      }}
    />
  );
}

export function ReviewWeekButton({ week, label }: { week: string; label: string }) {
  return (
    <ZeroGButton
      size="sm"
      variant="outline"
      label={label}
      busyLabel="Asking the private AI for a review"
      run={async (zg) => {
        const r = await reviewWeek(zg, week);
        return `Private review ready${r.verified ? ", TEE verified" : ""}.`;
      }}
    />
  );
}

export function JudgeSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <ZeroGButton
      variant="outline"
      label="Ask the private AI about this session"
      busyLabel="Asking the private AI"
      run={async (zg, progress) => {
        const r = await judgeSessions(zg, [sessionId], progress);
        return r.judged ? "The private AI wrote this session's line." : "0G could not answer this time.";
      }}
    />
  );
}
