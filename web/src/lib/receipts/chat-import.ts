/* eslint-disable @typescript-eslint/no-explicit-any -- untyped export JSON from other apps */
// Read a ChatGPT or Claude.ai data export in the browser and turn it into Wrapped inputs.
// Nothing here uploads anything: the page reads the file, keeps the messages in memory for as long
// as the tab is open, and only numbers ever leave it (for the share card).
// Browser-safe: no Node imports.

import { unzipSync, strFromU8 } from "fflate";
import { ChatStatsBuilder } from "./chat-stats";
import { buildWrapped, SOURCE_NAMES, type Wrapped, type WrappedInput } from "./wrapped";

export type ExportTool = "chatgpt" | "claude-ai";
type Msg = { ts: number; text: string; images: number };
export type ImportedConversation = { startedAt: number; msgs: Msg[]; replies: number[] };
export type ImportedExport = { tool: ExportTool; conversations: ImportedConversation[]; first: number; last: number };

const toMs = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v; // ChatGPT uses seconds
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? NaN : t;
  }
  return NaN;
};

/** ChatGPT: conversations.json is a list of conversations, each a tree of messages in `mapping`. */
function readChatGpt(data: any[]): ImportedConversation[] {
  const out: ImportedConversation[] = [];
  for (const c of data) {
    if (!c || typeof c !== "object" || !c.mapping) continue;
    const start = toMs(c.create_time);
    const msgs: Msg[] = [];
    const replies: number[] = [];
    for (const node of Object.values<any>(c.mapping)) {
      const m = node?.message;
      if (!m) continue;
      const ts = toMs(m.create_time ?? c.create_time);
      const role = m.author?.role;
      if (role === "user") {
        if (m.metadata?.is_visually_hidden_from_conversation || m.metadata?.is_user_system_message) continue;
        const parts: unknown[] = Array.isArray(m.content?.parts) ? m.content.parts : [];
        const text = parts.filter((p): p is string => typeof p === "string").join("\n").trim();
        const images = parts.filter((p: any) => p && typeof p === "object" && /image/.test(String(p.content_type ?? ""))).length;
        if (text || images) msgs.push({ ts, text, images });
      } else if (role === "assistant" || role === "tool") {
        replies.push(ts);
      }
    }
    if (msgs.length) out.push({ startedAt: Number.isNaN(start) ? Math.min(...msgs.map((m) => m.ts)) : start, msgs, replies });
  }
  return out;
}

/** Claude.ai: conversations.json is a list of conversations with a flat `chat_messages` list. */
function readClaude(data: any[]): ImportedConversation[] {
  const out: ImportedConversation[] = [];
  for (const c of data) {
    if (!c || typeof c !== "object" || !Array.isArray(c.chat_messages)) continue;
    const msgs: Msg[] = [];
    const replies: number[] = [];
    for (const m of c.chat_messages) {
      const ts = toMs(m?.created_at);
      if (m?.sender === "human") {
        const blocks = Array.isArray(m.content) ? m.content.filter((b: any) => b?.type === "text").map((b: any) => String(b.text ?? "")) : [];
        let text = (typeof m.text === "string" && m.text.trim() ? m.text : blocks.join("\n")).trim();
        // Attached documents count as pasted text (a brain dump); images count as images.
        if (Array.isArray(m.attachments) && m.attachments.length) text += "\n[Pasted text]";
        const images = Array.isArray(m.files) ? m.files.length : 0;
        if (text || images) msgs.push({ ts, text, images });
      } else if (m?.sender === "assistant") {
        replies.push(ts);
      }
    }
    const start = toMs(c.created_at);
    if (msgs.length) out.push({ startedAt: Number.isNaN(start) ? Math.min(...msgs.map((m) => m.ts)) : start, msgs, replies });
  }
  return out;
}

export function detectExport(data: unknown): ExportTool | undefined {
  if (!Array.isArray(data)) return undefined;
  const c = data.find((x) => x && typeof x === "object");
  if (!c) return undefined;
  if ("mapping" in c) return "chatgpt";
  if ("chat_messages" in c) return "claude-ai";
  return undefined;
}

export function readExport(data: unknown): ImportedExport {
  const tool = detectExport(data);
  if (!tool) throw new Error("This does not look like a ChatGPT or Claude.ai export (conversations.json).");
  const conversations = tool === "chatgpt" ? readChatGpt(data as any[]) : readClaude(data as any[]);
  if (!conversations.length) throw new Error("No messages found in this export.");
  const times = conversations.flatMap((c) => c.msgs.map((m) => m.ts)).filter((t) => !Number.isNaN(t));
  return { tool, conversations, first: Math.min(...times), last: Math.max(...times) };
}

/** Read the file the person picked: conversations.json, or the whole export zip. */
export async function readExportFile(file: File): Promise<ImportedExport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes, { filter: (f) => /(^|\/)conversations\.json$/.test(f.name) });
    const name = Object.keys(files)[0];
    if (!name) throw new Error("No conversations.json inside this zip.");
    text = strFromU8(files[name]);
  } else {
    text = new TextDecoder().decode(bytes);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Could not read this file as JSON.");
  }
  return readExport(data);
}

export type ImportRange = "30d" | "year" | "all";
export const IMPORT_RANGES: { id: ImportRange; label: string }[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "year", label: "This year" },
  { id: "all", label: "Everything" },
];

/** Wrapped for one range of an export. Messages outside the range are left out. */
export function wrappedFromExport(x: ImportedExport, range: ImportRange, now = Date.now()): Wrapped | undefined {
  const from = range === "30d" ? now - 30 * 86400_000 : range === "year" ? new Date(new Date(now).getFullYear(), 0, 1).getTime() : -Infinity;
  const inputs: WrappedInput[] = [];
  for (const c of x.conversations) {
    const msgs = c.msgs.filter((m) => m.ts >= from);
    if (!msgs.length) continue;
    const b = new ChatStatsBuilder();
    for (const m of msgs) b.message(m.ts, m.text, m.images);
    for (const r of c.replies) if (r >= from) b.seen(r);
    const chat = b.finish();
    if (chat) inputs.push({ tool: x.tool, startedAt: new Date(msgs[0].ts).toISOString(), minutes: chat.minutes ?? 0, usd: 0, chat });
  }
  const label = `${IMPORT_RANGES.find((r) => r.id === range)?.label ?? "Everything"} on ${SOURCE_NAMES[x.tool]}`;
  return buildWrapped(inputs, { label, from: Number.isFinite(from) ? new Date(from).toISOString() : new Date(x.first).toISOString(), to: new Date(now).toISOString() });
}
