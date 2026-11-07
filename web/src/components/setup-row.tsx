import { Check } from "lucide-react";

/** One item of a setup checklist: a number (or a tick when done), a title, what to do, and Done or To do. */
export function SetupRow({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="su">
      <span className={`su-n ${done ? "is-done" : ""}`} aria-hidden="true">
        {done ? <Check className="size-4" strokeWidth={2.6} /> : n}
      </span>
      <div className="su-main min-w-0">
        <h2 className="su-t">
          {title}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </h2>
        <div className="su-body">{children}</div>
      </div>
      <span className={`su-stat ${done ? "done" : "todo"}`} aria-hidden="true">
        {done ? "Done" : "To do"}
      </span>
    </li>
  );
}
