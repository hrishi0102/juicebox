"use client";

// "Sign in with 0G": pay for the private AI from your own 0G account (iAI or credits) instead of
// the app's key. The browser logs in through 0G's Privy app, swaps that login for a 0G router
// session, and makes the AI calls itself. This laptop's server builds every message and keeps the
// answers (see /api/week/browser). Works on http://localhost:3000, the origin 0G allows.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chatBody, readChatReply, ZG_MODELS, ZG_ROUTER, type ChatReply } from "@/lib/receipts/judge-core";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmn5w697g01xp0bl80c8dskc8";
const ALLOWED_ORIGIN = "http://localhost:3000";

export function ZeroGPay({ week }: { week: string }) {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page origin is only known in the browser
    setOrigin(window.location.origin);
  }, []);
  if (origin === null) return null;
  if (origin !== ALLOWED_ORIGIN)
    return (
      <p className="text-sm text-muted-foreground">
        Want to pay with your own 0G credits? Open this app at <a className="text-primary hover:underline" href={`${ALLOWED_ORIGIN}/?week=${week}`}>{ALLOWED_ORIGIN}</a>, the address 0G sign-in allows.
      </p>
    );
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["google", "twitter", "discord", "email", "wallet"],
        appearance: { walletChainType: "ethereum-only", theme: "light" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <Inner week={week} />
    </PrivyProvider>
  );
}

type ZgSession = { token: string; wallet: string };
type Plan = { system: string; sessions: { sessionId: string; user: string; hash: `0x${string}` }[]; next?: Next };
type Next = { system: string; user: string; hash: `0x${string}` };

function Inner({ week }: { week: string }) {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [zg, setZg] = useState<ZgSession | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  // Once signed in to Privy, swap that login for a 0G router session.
  useEffect(() => {
    if (!ready || !authenticated || zg) return;
    let stop = false;
    (async () => {
      try {
        const privyToken = await getAccessToken();
        if (!privyToken || stop) return;
        const r = await fetch(`${ZG_ROUTER}/auth/privy`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: privyToken }) });
        if (!r.ok) throw new Error(`0G sign-in failed (${r.status}). Sign in once on pc.0g.ai, then try again.`);
        const j = (await r.json()) as { token: string; wallet_address: string };
        if (stop) return;
        setZg({ token: j.token, wallet: j.wallet_address });
        const b = await fetch(`${ZG_ROUTER}/account/balance`, { credentials: "include", headers: { Authorization: `Bearer ${j.token}` } });
        if (b.ok && !stop) setBalance(formatBalance(await b.json()));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      stop = true;
    };
  }, [ready, authenticated, zg, getAccessToken]);

  async function call(session: ZgSession, system: string, user: string, maxTokens: number): Promise<ChatReply> {
    let last = "";
    for (const model of ZG_MODELS) {
      const res = await fetch(`${ZG_ROUTER}/chat/completions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}`, "X-0G-Provider-Trust-Mode": "private" },
        body: JSON.stringify(chatBody(model, system, user, { zeroG: true, maxTokens })),
      });
      if (res.status === 401 || res.status === 402 || res.status === 403) throw new Error(`0G refused the call (${res.status}). Check your balance on pc.0g.ai.`);
      if (!res.ok) {
        last = `${model}: ${res.status}`;
        continue;
      }
      const reply = readChatReply(await res.json(), (h) => res.headers.get(h), true, model);
      if (reply.content.trim()) return reply;
    }
    throw new Error(`0G could not answer (${last})`);
  }

  async function post<T>(body: unknown): Promise<T> {
    const r = await fetch("/api/week/browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j as T;
  }

  async function write() {
    if (!zg) return;
    setBusy(true);
    const t = toast.loading("Reading your sessions privately on 0G, paid from your 0G account");
    try {
      const plan = await post<Plan>({ action: "plan", week });
      let next = plan.next;
      if (plan.sessions.length) {
        const answers: { sessionId: string; content: string; hash: string; reply: ChatReply }[] = [];
        let done = 0;
        const queue = [...plan.sessions];
        await Promise.all(
          Array.from({ length: Math.min(4, queue.length) }, async () => {
            for (let s = queue.shift(); s; s = queue.shift()) {
              try {
                const reply = await call(zg, plan.system, s.user, 700);
                answers.push({ sessionId: s.sessionId, content: reply.content, hash: s.hash, reply });
              } catch (e) {
                if (String(e).includes("refused")) throw e;
              }
              done++;
              toast.loading(`Private AI on 0G: ${done} of ${plan.sessions.length} sessions`, { id: t });
            }
          }),
        );
        next = (await post<{ next: Next }>({ action: "sessions", week, payer: zg.wallet, answers })).next;
      }
      if (!next) throw new Error("Nothing to write for this week");
      toast.loading("Writing your week", { id: t });
      const reply = await call(zg, next.system, next.user, 1800);
      const out = await post<{ items: number; verified?: boolean }>({ action: "week", week, payer: zg.wallet, answer: { content: reply.content, hash: next.hash, reply } });
      toast.success(`Done: ${out.items} things, paid from your 0G account${out.verified ? ", all TEE verified" : ""}.`, { id: t, duration: 6000 });
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { id: t });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!authenticated)
    return (
      <p className="text-sm text-muted-foreground">
        Or pay with your own 0G credits:{" "}
        <button type="button" onClick={login} className="font-medium text-primary hover:underline">
          Sign in with 0G
        </button>
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Button variant="outline" onClick={write} disabled={!zg || busy}>
        {busy ? "Writing with your 0G credits" : "Write it with my 0G credits"}
      </Button>
      <span className="text-muted-foreground">
        {zg ? `Signed in with 0G, ${zg.wallet.slice(0, 6)}…${zg.wallet.slice(-4)}${balance ? `, ${balance} left` : ""}.` : "Connecting to 0G…"}{" "}
        <button
          type="button"
          className="hover:text-foreground"
          onClick={() => {
            setZg(null);
            setBalance(null);
            void logout();
          }}
        >
          Sign out
        </button>
      </span>
    </div>
  );
}

/** The balance answer's exact shape is not documented; show the first dollar amount we can find. */
function formatBalance(j: unknown): string | null {
  const flat: Record<string, unknown> = {};
  const walk = (o: unknown, p = "") => {
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    else flat[p] = o;
  };
  walk(j);
  const micro = Object.entries(flat).find(([k, v]) => /usd_micro/i.test(k) && v !== null && !Number.isNaN(Number(v)));
  if (micro) return `$${(Number(micro[1]) / 1e6).toFixed(2)}`;
  const usd = Object.entries(flat).find(([k, v]) => /usd/i.test(k) && v !== null && !Number.isNaN(Number(v)));
  return usd ? `$${Number(usd[1]).toFixed(2)}` : null;
}
