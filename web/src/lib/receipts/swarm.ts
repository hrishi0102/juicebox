// Swarm storage through the standard Bee HTTP API (a local Bee node, or any gateway that accepts
// uploads). Server-side only. Uploads need a postage batch id; reads work through any gateway.
//
//   SWARM_API_URL             where to upload (default http://localhost:1633, a local Bee node)
//   SWARM_POSTAGE_BATCH_ID    the postage batch that pays for storage
//   SWARM_GATEWAY_URL         where to read and link from (default: the same as SWARM_API_URL)

export type SwarmConfig = { api: string; batch?: string; gateway: string };

export function swarmConfig(): SwarmConfig {
  const api = (process.env.SWARM_API_URL || "http://localhost:1633").replace(/\/$/, "");
  return { api, batch: process.env.SWARM_POSTAGE_BATCH_ID?.trim() || undefined, gateway: (process.env.SWARM_GATEWAY_URL || api).replace(/\/$/, "") };
}

export function swarmReady(cfg = swarmConfig()) {
  return !!cfg.batch;
}

async function upload(path: string, data: Uint8Array, headers: Record<string, string>, cfg: SwarmConfig) {
  if (!cfg.batch) throw new Error("Swarm is not set up: add SWARM_POSTAGE_BATCH_ID (and SWARM_API_URL) to web/.env.local");
  const r = await fetch(`${cfg.api}${path}`, {
    method: "POST",
    headers: { "swarm-postage-batch-id": cfg.batch, "swarm-deferred-upload": "false", ...headers },
    body: Buffer.from(data),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Swarm upload failed (${r.status}): ${text.slice(0, 200)}`);
  const ref = (JSON.parse(text) as { reference?: string }).reference;
  if (!ref || !/^[0-9a-f]{64}([0-9a-f]{64})?$/.test(ref)) throw new Error("Swarm did not return a reference");
  return ref;
}

/** Upload raw bytes (we encrypt before calling this when the data is private). Returns the reference. */
export function uploadBytes(data: Uint8Array, cfg = swarmConfig()) {
  return upload("/bytes", data, { "Content-Type": "application/octet-stream" }, cfg);
}

/** Upload one file people can open in a browser (for example the share card PNG). */
export function uploadFile(data: Uint8Array, name: string, contentType: string, cfg = swarmConfig()) {
  return upload(`/bzz?name=${encodeURIComponent(name)}`, data, { "Content-Type": contentType }, cfg);
}

export async function downloadBytes(ref: string, cfg = swarmConfig()): Promise<Uint8Array> {
  if (!/^[0-9a-f]{64}([0-9a-f]{64})?$/.test(ref)) throw new Error("Bad Swarm reference");
  const r = await fetch(`${cfg.gateway}/bytes/${ref}`, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`Swarm download failed (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

/** A link anyone can open: the file through the gateway. */
export function fileUrl(ref: string, cfg = swarmConfig()) {
  return `${cfg.gateway}/bzz/${ref}/`;
}
