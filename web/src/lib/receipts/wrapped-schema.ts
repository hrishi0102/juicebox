// What a Wrapped card may carry: numbers, the persona and an optional AI line. Checked on the server.
import { z } from "zod";
import { FUN } from "./chat-stats";
import { PERSONA_IDS, type PersonaId } from "./wrapped";

const ids = PERSONA_IDS as [PersonaId, ...PersonaId[]];
export const WrappedCardInput = z.object({
  l: z.string().max(40),
  p: z.enum(ids),
  m: z.number().min(0).max(1e7),
  n: z.number().int().min(0).max(1e8),
  s: z.array(z.tuple([z.enum(FUN), z.number().int().min(0).max(1e7), z.number().min(0).max(1e7)])).max(7),
  ns: z.number().min(0).max(100),
  ph: z.number().int().min(0).max(23),
  st: z.number().int().min(0).max(100000),
  t: z.array(z.enum(ids)).max(3),
  h: z.array(z.number().int().min(0).max(100)).length(24).optional(),
  r: z.string().max(220).optional(),
});
export type WrappedCardInput = z.infer<typeof WrappedCardInput>;
