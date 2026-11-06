import { ChevronDown } from "lucide-react";

/**
 * A section that shows one line until opened. Built on <details>, so it works without
 * JavaScript and is keyboard accessible. `hint` is a short summary shown while closed.
 */
export function Collapsible({
  title,
  hint,
  defaultOpen,
  children,
  className = "",
}: {
  title: string;
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`group rounded-lg border border-border bg-card ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{title}</span>
        {hint && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{hint}</span>}
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
