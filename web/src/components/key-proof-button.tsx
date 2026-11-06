"use client";

// Publish the GitHub key proof (a public gist on your own account), or, if that is not possible,
// show the exact text to put in a gist yourself, and check again afterwards.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROOF_FILE } from "@/lib/receipts/key-proof";

export function KeyProofButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "check" | null>(null);
  const [manual, setManual] = useState<{ error: string; text?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  async function run(action: "publish" | "check") {
    setBusy(action);
    try {
      const r = await fetch("/api/key-proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (action === "publish") {
        if (!j.ok) {
          setManual({ error: j.error, text: j.text });
          return;
        }
        setManual(null);
        toast.success(j.existed ? "Your key was already proven on GitHub" : "Proof published on your GitHub account", { description: j.url });
      } else if (j.status === "proven") {
        setManual(null);
        toast.success("Found it: your key is proven on GitHub");
      } else {
        toast.error(j.status === "unknown" ? `Could not check GitHub just now (${j.reason})` : "No proof found on your GitHub account yet");
        return;
      }
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => run("publish")} disabled={!!busy}>
        {busy === "publish" ? "Publishing" : "Publish the proof gist"}
      </Button>
      {manual && (
        <div className="space-y-2 rounded-lg border border-border bg-background p-3 text-sm">
          <p className="text-destructive">{manual.error}</p>
          {manual.text && (
            <>
              <p>
                Make it yourself: create a <span className="font-medium">public</span> gist on gist.github.com named <code>{PROOF_FILE}</code> with exactly this
                text, then check again.
              </p>
              <pre className="overflow-x-auto rounded-md bg-card p-3 text-xs">{manual.text}</pre>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(manual.text!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy the text"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => run("check")} disabled={!!busy}>
                  {busy === "check" ? "Checking" : "Check again"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
