"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { Logo } from "@/components/space-header";

import { REPO } from "@/components/repo";

/** The front door's own header: the logo, three links, GitHub and the demo, and a menu on phones. */
export function FrontNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="fd-nav">
      <div className="fd-wrap fd-nav-in">
        <Link className="t-logo" href="/" aria-label="Receipts, front door">
          <Logo />
          <span className="t-logo-word">Receipts</span>
        </Link>
        <nav className="fd-links" aria-label="Main">
          <a href="#how">How it works</a>
          <Link href="/verify">Check a receipt</Link>
          <Link href="/wrapped">AI Wrapped</Link>
        </nav>
        <div className="fd-nav-right">
          <a className="fd-quiet" href={REPO} target="_blank" rel="noreferrer">
            GitHub
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          <a className="btn btn-primary" href="#demo">
            Try the demo
          </a>
          <button className="fd-menu-btn" type="button" aria-expanded={open} aria-controls="fd-sheet" onClick={() => setOpen(!open)}>
            Menu
          </button>
        </div>
      </div>
      {open && (
        <div className="fd-sheet" id="fd-sheet">
          <a href="#how" onClick={close}>
            How it works
          </a>
          <Link href="/verify">Check a receipt</Link>
          <Link href="/wrapped">AI Wrapped</Link>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub, opens github.com
          </a>
          <a href="#demo" onClick={close}>
            Try the demo
          </a>
        </div>
      )}
    </header>
  );
}

/**
 * The hero: a receipt printing out of a small printer, then the violet Signed stamp. It is an
 * example slip, so the lines are drawn as blanks rather than made-up numbers. The barcode is drawn
 * from a real demo record on Arkiv.
 */
export function HeroReceipt({ barcodeHex }: { barcodeHex: string }) {
  const [run, setRun] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const raf = useRef(0);
  const rx = 9 + tilt.rx;
  const ry = -14 + tilt.ry;
  return (
    <div
      className="fd-stage"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => setTilt({ rx: -dy * 8, ry: dx * 12 }));
      }}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
    >
      <div className="fd-tilt" style={{ transform: `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(1.2deg)` }}>
        <div className="fd-printer" aria-hidden="true">
          <span className="fd-printer-name">Receipts</span>
          <span className="fd-led" />
        </div>
        <div className="fd-feed">
          <div className="fd-paper-wrap" key={run}>
            <article className="paper" aria-label="An example receipt: a week of AI sessions, what they got done and what it cost, signed by the person who did the work">
              <div className="r-head">
                <div className="r-name">Receipts</div>
                <div className="r-faint">What did you get done this week?</div>
                <div style={{ marginTop: 8 }}>Your week, on your laptop</div>
                <div className="r-faint">You, your team, your company</div>
              </div>
              <hr className="r-rule" />
              <Group color="var(--c-built)" name="Built" rows={[64, 48, 72, 56]} />
              <div style={{ marginTop: 10 }}>
                <Group color="var(--c-figured)" name="Figured out" rows={[60]} />
              </div>
              <hr className="r-rule" />
              <Blank k="AI sessions" w={18} />
              <Blank k="Claude Code" w={44} />
              <Blank k="Codex" w={44} />
              <div className="r-row strong">
                <span>Total</span>
                <span className="leader" />
                <span className="fd-bar k" style={{ width: 52 }} />
              </div>
              <Blank k="Shipped" w={30} />
              <Blank k="Idea to merged" w={36} />
              <div className="mark-row" style={{ justifyContent: "flex-start" }}>
                <div className="mark">
                  <b>
                    <span className="fd-bar k" style={{ width: 28, height: 8 }} />
                  </b>
                  <span>things done</span>
                </div>
              </div>
              <hr className="r-rule" />
              <div className="r-row">
                <span>Written by</span>
                <span className="leader" />
                <span>0G private AI</span>
              </div>
              <div className="r-row">
                <span>Checked</span>
                <span className="leader" />
                <span>TEE verified</span>
              </div>
              <div className="r-row">
                <span>Signature</span>
                <span className="leader" />
                <span>EIP-712</span>
              </div>
              <Barcode hex={barcodeHex} />
              <div className="r-hash">{`${barcodeHex.slice(0, 10)}…${barcodeHex.slice(-6)}`}</div>
              <div className="r-foot">Prompts not included. Ever.</div>
            </article>
            <div className="fd-stamp" aria-hidden="true">
              <b>Signed</b>
              <span>by you, with a key</span>
              <span>made on your laptop</span>
            </div>
          </div>
        </div>
      </div>
      <div className="fd-cast" aria-hidden="true" />
      <button type="button" className="fd-replay" onClick={() => setRun(run + 1)}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Print it again
      </button>
    </div>
  );
}

function Group({ color, name, rows }: { color: string; name: string; rows: number[] }) {
  return (
    <>
      <div className="r-gname">
        <span className="sq" style={{ background: color }} />
        {name}
      </div>
      {rows.map((w, i) => (
        <div key={i} className="r-row" style={{ alignItems: "center", minHeight: 20 }}>
          <span className="fd-bar" style={{ width: `${w}%` }} />
          <span className="leader" style={{ transform: "none" }} />
          <span className="fd-bar k" style={{ width: 38 }} />
        </div>
      ))}
    </>
  );
}

function Blank({ k, w }: { k: string; w: number }) {
  return (
    <div className="r-row">
      <span>{k}</span>
      <span className="leader" />
      <span className="fd-bar k" style={{ width: w }} />
    </div>
  );
}

/** Bars drawn from a hex digest, so the barcode really encodes a record. */
export function Barcode({ hex }: { hex: string }) {
  const bits = hex
    .replace(/^0x/, "")
    .split("")
    .flatMap((c) => parseInt(c, 16).toString(2).padStart(4, "0").split(""));
  let x = 0;
  let d = "";
  bits.forEach((b, i) => {
    const w = b === "1" ? 2 : 1;
    if (i % 2 === 0) d += `M${x} 0h${w}v34h-${w}z`;
    x += w + 1;
  });
  return (
    <svg className="barcode" viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
