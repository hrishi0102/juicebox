/** The little printer drawings for write (a slip prints), sign (the violet stamp) and send (the stub tears off). */
export function StepIllo({ kind }: { kind: "write" | "sign" | "send" }) {
  return (
    <div className="fd-illo" aria-hidden="true">
      <div className="fd-m-printer" />
      <div className="fd-m-paper">
        <i className="k" />
        <i />
        <i className="s" />
        <i />
        <i className="s" />
        <i />
      </div>
      {kind === "sign" && <div className="fd-m-stamp" />}
      {kind === "send" && <div className="fd-m-stub" />}
    </div>
  );
}
