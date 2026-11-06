"use client";

// Sign in with 0G: the one way the web app pays for the private AI. You log in with 0G's own
// Privy app (the one pc.0g.ai uses), that login is swapped for a 0G router session, and every
// private AI call is made from this browser tab with it, so the cost comes out of your own 0G
// credits (your iAI daily credits or a top-up). This laptop's server still builds every message
// and keeps the answers. 0G's Privy app only allows http://localhost:3000, so on any other address
// the context says it is unavailable and the pages say where to open the app instead.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { chatBody, readChatReply, ZG_MODELS, ZG_ROUTER, type ChatReply } from "@/lib/receipts/judge-core";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmn5w697g01xp0bl80c8dskc8";
export const ZERO_G_ORIGIN = "http://localhost:3000";

export type ZgBalance = { text: string; value?: number };

export type ZeroG = {
  /** This address can use 0G sign-in (only http://localhost:3000). */
  available: boolean;
  ready: boolean;
  /** Logged in and holding a 0G router session. */
  signedIn: boolean;
  connecting: boolean;
  error?: string;
  wallet?: string;
  balance?: ZgBalance | null;
  signIn: () => void;
  signOut: () => void;
  refreshBalance: () => Promise<ZgBalance | null>;
  call: (system: string, user: string, maxTokens: number) => Promise<ChatReply>;
};

const unavailable: ZeroG = {
  available: false,
  ready: true,
  signedIn: false,
  connecting: false,
  signIn: () => {},
  signOut: () => {},
  refreshBalance: async () => null,
  call: async () => {
    throw new Error(`Sign in with 0G only works at ${ZERO_G_ORIGIN}.`);
  },
};

const Ctx = createContext<ZeroG>(unavailable);

export function useZeroG() {
  return useContext(Ctx);
}

/** `allowed` comes from the server, which knows the address this page was opened at. */
export function ZeroGProvider({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  if (!allowed) return <Ctx.Provider value={unavailable}>{children}</Ctx.Provider>;
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["google", "twitter", "discord", "email", "wallet"],
        appearance: { walletChainType: "ethereum-only", theme: "light" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <Session>{children}</Session>
    </PrivyProvider>
  );
}

type ZgSession = { token: string; wallet: string };

function Session({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [zg, setZg] = useState<ZgSession | null>(null);
  const [balance, setBalance] = useState<ZgBalance | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  const readBalance = useCallback(async (s: ZgSession) => {
    try {
      const b = await fetch(`${ZG_ROUTER}/account/balance`, { credentials: "include", headers: { Authorization: `Bearer ${s.token}` } });
      const out = b.ok ? parseBalance(await b.json()) : null;
      setBalance(out);
      return out;
    } catch {
      setBalance(null);
      return null;
    }
  }, []);

  // Once logged in to 0G's Privy app, swap that login for a 0G router session.
  useEffect(() => {
    if (!ready || !authenticated || zg || error) return;
    let stop = false;
    (async () => {
      try {
        const privyToken = await getAccessToken();
        if (!privyToken || stop) return;
        const r = await fetch(`${ZG_ROUTER}/auth/privy`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: privyToken }) });
        if (!r.ok) throw new Error(`0G sign-in failed (${r.status}). Sign in once on pc.0g.ai, then try again.`);
        const j = (await r.json()) as { token: string; wallet_address: string };
        if (stop) return;
        const s = { token: j.token, wallet: j.wallet_address };
        setZg(s);
        await readBalance(s);
      } catch (e) {
        if (stop) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(msg);
      }
    })();
    return () => {
      stop = true;
    };
  }, [ready, authenticated, zg, error, attempt, getAccessToken, readBalance]);

  const call = useCallback(
    async (system: string, user: string, maxTokens: number): Promise<ChatReply> => {
      if (!zg) throw new Error("Sign in with 0G first.");
      let last = "";
      for (const model of ZG_MODELS) {
        const res = await fetch(`${ZG_ROUTER}/chat/completions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${zg.token}`, "X-0G-Provider-Trust-Mode": "private" },
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
    },
    [zg],
  );

  const value = useMemo<ZeroG>(
    () => ({
      available: true,
      ready,
      signedIn: !!zg,
      connecting: ready && authenticated && !zg && !error,
      error,
      wallet: zg?.wallet,
      balance,
      signIn: () => {
        if (!authenticated) {
          setError(undefined);
          login();
          return;
        }
        // Logged in to Privy, but the 0G session failed: try the swap again.
        setError(undefined);
        setAttempt((n) => n + 1);
      },
      signOut: () => {
        setZg(null);
        setBalance(undefined);
        setError(undefined);
        void logout();
      },
      refreshBalance: async () => (zg ? readBalance(zg) : null),
      call,
    }),
    [ready, authenticated, zg, error, balance, login, logout, readBalance, call],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * The balance answer's exact shape is not documented: use the first dollar amount we can find,
 * else the first credit count. Small amounts keep four decimals, so a one-cent week shows up.
 */
function parseBalance(j: unknown): ZgBalance | null {
  const flat: Record<string, unknown> = {};
  const walk = (o: unknown, p = "") => {
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    else flat[p] = o;
  };
  walk(j);
  const find = (re: RegExp) => {
    const hit = Object.entries(flat).find(([k, v]) => re.test(k) && v !== null && v !== "" && !Number.isNaN(Number(v)));
    return hit ? Number(hit[1]) : undefined;
  };
  const micro = find(/usd_micro/i);
  const usd = micro !== undefined ? micro / 1e6 : find(/usd/i);
  if (usd !== undefined) return { text: `$${usd < 10 ? usd.toFixed(4) : usd.toFixed(2)}`, value: usd };
  const credits = find(/credit/i) ?? find(/balance/i);
  if (credits !== undefined) return { text: `${credits < 10 ? credits.toFixed(4) : credits.toFixed(2)} credits`, value: credits };
  return null;
}

export function shortWallet(w?: string) {
  return w ? `${w.slice(0, 6)}…${w.slice(-4)}` : "";
}

/** "Your 0G credits went from $4.2100 to $4.2031." Shown after every paid call. */
export function spentLine(before?: ZgBalance | null, after?: ZgBalance | null) {
  if (before?.value !== undefined && after?.value !== undefined && after.value < before.value) return `Your 0G credits went from ${before.text} to ${after.text}.`;
  if (after) return `Your 0G credits: ${after.text}.`;
  return "";
}

/** The small "0G 0xab…cd, $4.21" chip in the header, or the Sign in with 0G button. */
export function ZeroGAccount() {
  const zg = useZeroG();
  if (!zg.available || !zg.ready) return null;
  if (!zg.signedIn)
    return (
      <button type="button" onClick={zg.signIn} disabled={zg.connecting} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-sm hover:bg-accent">
        <ZeroGMark />
        {zg.connecting ? "Connecting to 0G" : "Sign in with 0G"}
      </button>
    );
  return (
    <span className="inline-flex items-center gap-2 text-sm" title={`0G account ${zg.wallet}`}>
      <ZeroGMark />
      <span>
        {shortWallet(zg.wallet)}
        {zg.balance ? <span className="text-muted-foreground">, {zg.balance.text} left</span> : null}
      </span>
      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={zg.signOut}>
        Sign out
      </button>
    </span>
  );
}

export function ZeroGMark() {
  return (
    <span aria-hidden="true" className="inline-flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold leading-none text-background">
      0G
    </span>
  );
}
