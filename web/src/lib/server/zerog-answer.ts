// The shape of one answer the browser got from 0G with the person's own 0G session ("Sign in with
// 0G"). Every route that saves such an answer checks it with these schemas.
import { z } from "zod";

export const WeekId = z.string().regex(/^\d{4}-W\d{2}$/);

export const ZgReply = z.object({
  content: z.string().max(20000),
  model: z.string().max(100).optional(),
  requestId: z.string().max(200).optional(),
  chatId: z.string().max(200).optional(),
  provider: z.string().max(100).optional(),
  sealed: z.boolean().optional(),
  teeVerified: z.boolean().optional(),
  costUsd: z.number().optional(),
});

export const ZgAnswer = z.object({
  sessionId: z.string().max(100).optional(),
  content: z.string().max(20000),
  hash: z.string().regex(/^0x[0-9a-f]{64}$/),
  reply: ZgReply,
});

/** The 0G wallet that paid, as the browser reports it. */
export const Payer = z.string().max(80);
