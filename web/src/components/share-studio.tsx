"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, FileText, Image as ImageIcon, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/category-badge";
import { cardPostText, type CardInput } from "@/lib/receipts/card";
import type { Category } from "@/lib/receipts/types";

export type ShareSeed = {
  week: string;
  range: string;
  sentence: string;
  sessions: number;
  tools: string[];
  totalUsd: number;
  writtenBy: string;
  items: { id: string; category: Category; title: string; costUsd: number }[];
};

const NAME_KEY = "receipts-card-name";

/** Pick what goes on the card, edit the wording, then download, copy, post or print it. */
export function ShareStudio({ seed, swarmReady = false }: { seed: ShareSeed; swarmReady?: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(seed.items.filter((i) => i.category !== "Wasted").map((i) => i.id)));
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [showCost, setShowCost] = useState(false);
  const [showSentence, setShowSentence] = useState(true);
  const [name, setName] = useState("");
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; for: string } | null>(null);
  const [linking, setLinking] = useState(false);
  const last = useRef<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      // Read after mount so the server and the first client render match.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only value
      if (saved) setName(saved);
    } catch {
      /* private window: start empty */
    }
  }, []);

  const card: CardInput | null = useMemo(() => {
    const items = seed.items
      .filter((i) => picked.has(i.id))
      .map((i) => ({ category: i.category, title: (titles[i.id] ?? i.title).trim() || i.title, ...(showCost ? { costUsd: i.costUsd } : {}) }));
    if (!items.length) return null;
    return {
      week: seed.week,
      range: seed.range,
      name: name.trim() || undefined,
      sentence: showSentence && seed.sentence ? seed.sentence : undefined,
      items,
      sessions: seed.sessions,
      tools: seed.tools,
      totalUsd: showCost ? seed.totalUsd : undefined,
      writtenBy: seed.writtenBy,
    };
  }, [seed, picked, titles, showCost, showSentence, name]);

  useEffect(() => {
    if (!card) return;
    const body = JSON.stringify(card);
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch("/api/card", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (!r.ok) throw new Error("Could not draw the card");
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        if (last.current) URL.revokeObjectURL(last.current);
        last.current = url;
        setImg({ url, blob });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [card]);

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function saveName(v: string) {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      /* fine */
    }
  }

  const fileName = `what-i-got-done-${seed.week}.png`;

  function download() {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url;
    a.download = fileName;
    a.click();
  }

  async function copyImage() {
    if (!img) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": img.blob })]);
      toast.success("Image copied. Paste it into your post.");
    } catch {
      toast.error("This browser could not copy images. Use Download instead.");
    }
  }

  // A Swarm link is only valid for the card exactly as it was when the link was made.
  const cardKey = card ? JSON.stringify(card) : "";
  const swarmLink = link && link.for === cardKey ? link.url : null;

  async function makeLink() {
    if (!card) return;
    setLinking(true);
    try {
      const r = await fetch("/api/card/swarm", { method: "POST", headers: { "Content-Type": "application/json" }, body: cardKey });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setLink({ url: j.url, for: cardKey });
      await navigator.clipboard.writeText(j.url).catch(() => {});
      toast.success("Your card is on Swarm. Link copied.", { description: j.url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLinking(false);
    }
  }

  const postText = () => (card ? cardPostText(card) + (swarmLink ? `\n${swarmLink}` : "") : "");

  async function copyText() {
    if (!card) return;
    await navigator.clipboard.writeText(postText());
    toast.success("Text copied");
  }

  function postOnX() {
    if (!card) return;
    // X cannot take an image through a link. With a Swarm link the post carries it; else attach the download.
    if (!swarmLink) download();
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(postText())}`, "_blank", "noopener,noreferrer");
    if (!swarmLink) toast("The image was downloaded. Attach it to the post on X.", { duration: 6000 });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_440px]">
      <div className="min-w-0 space-y-6 print:hidden">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">What goes on the card</h2>
          <p className="mt-1 text-sm text-muted-foreground">Untick anything you would rather keep to yourself, and edit any line. Only what you see on the card leaves this page.</p>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {seed.items.map((i) => {
              const on = picked.has(i.id);
              return (
                <li key={i.id} className={`flex items-center gap-3 px-3 py-2.5 ${on ? "" : "opacity-55"}`}>
                  <button
                    type="button"
                    onClick={() => toggle(i.id)}
                    aria-pressed={on}
                    aria-label={on ? `Remove ${i.title} from the card` : `Add ${i.title} to the card`}
                    className={`flex size-5 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}
                  >
                    {on && <Check className="size-3.5" aria-hidden="true" />}
                  </button>
                  <div className="w-[100px] shrink-0">
                    <CategoryBadge category={i.category} />
                  </div>
                  <input
                    value={titles[i.id] ?? i.title}
                    onChange={(e) => setTitles((t) => ({ ...t, [i.id]: e.target.value }))}
                    maxLength={90}
                    disabled={!on}
                    aria-label={`Title for ${i.title}`}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[15px] hover:border-input focus:border-ring focus:outline-none"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Options</h2>
          <label className="flex max-w-md items-center gap-3 text-[15px]">
            <span className="w-28 shrink-0">Name on card</span>
            <input
              value={name}
              onChange={(e) => saveName(e.target.value)}
              maxLength={40}
              placeholder="Optional, like @handle"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 focus:border-ring focus:outline-none"
            />
          </label>
          <Toggle on={showSentence} onChange={setShowSentence} label="Show the AI's sentence about the week" disabled={!seed.sentence} />
          <Toggle on={showCost} onChange={setShowCost} label="Show what each thing cost" />
        </section>

        <section className="flex flex-wrap gap-3">
          <Button size="lg" onClick={postOnX} disabled={!img}>
            <XLogo />
            Post on X
          </Button>
          <Button size="lg" variant="outline" onClick={download} disabled={!img}>
            <Download className="size-4" aria-hidden="true" />
            Download image
          </Button>
          <Button size="lg" variant="outline" onClick={copyImage} disabled={!img}>
            <ImageIcon className="size-4" aria-hidden="true" />
            Copy image
          </Button>
          <Button size="lg" variant="outline" onClick={copyText} disabled={!card}>
            <Copy className="size-4" aria-hidden="true" />
            Copy text
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.print()} disabled={!img}>
            <FileText className="size-4" aria-hidden="true" />
            Save as PDF
          </Button>
          {swarmReady && (
            <Button size="lg" variant="outline" onClick={makeLink} disabled={!card || linking}>
              <Link2 className="size-4" aria-hidden="true" />
              {linking ? "Putting it on Swarm" : swarmLink ? "Link copied" : "Get a Swarm link"}
            </Button>
          )}
        </section>
        {swarmLink && (
          <p className="text-sm text-muted-foreground">
            Your card lives on Swarm, not on any server of ours:{" "}
            <a href={swarmLink} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
              {swarmLink}
            </a>
            . Post on X now includes this link. Anyone with the link can see the card.
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start print:static">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-muted print:border-0">
          {img && card ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not an optimizable asset
            <img src={img.url} alt="Your card: what you got done this week" className={`h-full w-full object-contain transition-opacity ${busy ? "opacity-70" : ""}`} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{card ? "Drawing your card" : "Pick at least one thing for the card"}</div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground print:hidden">1080 x 1350, works on X, LinkedIn and Instagram.</p>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 text-[15px] ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="currentColor">
      <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
    </svg>
  );
}
