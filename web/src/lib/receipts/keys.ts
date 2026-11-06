// Private keys from .env.local, accepted with or without the 0x prefix (wallets export both ways).
import type { Hex } from "viem";

export function envPrivateKey(name: string): Hex | undefined {
  const raw = (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return undefined;
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error(`${name} should be 64 hex characters (with or without 0x)`);
  return `0x${hex.toLowerCase()}` as Hex;
}
