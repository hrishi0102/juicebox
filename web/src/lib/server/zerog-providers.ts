// Which 0G providers serve a model, from 0G's public provider list (cached for an hour). Used to
// link to 0G's TEE check of the provider when a week's own records do not name one (the demo).
import { ZG_MODELS } from "@/lib/receipts/judge-core";

type Provider = { address: string; canonical_id?: string | null; model_id?: string; tee_acknowledged?: boolean; is_healthy?: boolean };

export async function providersFor(model: string = ZG_MODELS[0]): Promise<string[]> {
  try {
    const r = await fetch("https://router-api.0g.ai/v1/providers", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return [];
    const { data } = (await r.json()) as { data: Provider[] };
    const want = model.toLowerCase();
    return [...new Set(data.filter((p) => (p.canonical_id ?? p.model_id ?? "").toLowerCase() === want && p.tee_acknowledged).map((p) => p.address))];
  } catch {
    return [];
  }
}
