import { ChevronDown } from "lucide-react";

/**
 * A section that shows one line until opened. Built on <details>, so it works without
 * JavaScript and is keyboard accessible. `hint` is a short summary shown while closed. Put several
 * inside a <div className="disc"> and pass `grouped` to draw them as one box.
 */
export function Collapsible({
  title,
  hint,
  defaultOpen,
  grouped,
  children,
  className = "",
}: {
  title: string;
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  grouped?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`${grouped ? "disc-row" : "disc-solo"} ${className}`}>
      <summary className="disc-sum">
        <span className="disc-t">{title}</span>
        {hint && <span className="disc-h">{hint}</span>}
        <ChevronDown className="disc-chev size-[18px]" aria-hidden="true" />
      </summary>
      <div className="disc-body">{children}</div>
    </details>
  );
}
