// What goes on the share card. Built in the browser from what the person picked and edited, sent to
// /api/card, drawn as a PNG. No prompts, no session ids, and no cost unless they turn it on.
import { z } from "zod";
import { CATEGORIES } from "./types";

export const CardInput = z.object({
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  range: z.string().max(60),
  name: z.string().max(40).optional(),
  sentence: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        category: z.enum(CATEGORIES as [string, ...string[]]),
        title: z.string().min(1).max(90),
        costUsd: z.number().min(0).max(1e6).optional(),
      }),
    )
    .min(1)
    .max(12),
  sessions: z.number().int().min(0).max(100000),
  tools: z.array(z.string().max(30)).max(5),
  totalUsd: z.number().min(0).max(1e7).optional(),
  writtenBy: z.string().max(60),
});
export type CardInput = z.infer<typeof CardInput>;

/** Text for "Post on X": the list in a few lines, short enough for one post. */
export function cardPostText(c: CardInput) {
  const head = "What did I get done this week?";
  const lines: string[] = [];
  let len = head.length + 40;
  for (const i of c.items) {
    const line = `${i.category}: ${i.title}`;
    if (len + line.length + 1 > 250) break;
    lines.push(line);
    len += line.length + 1;
  }
  const more = c.items.length - lines.length;
  return [head, "", ...lines, ...(more > 0 ? [`and ${more} more`] : []), "", "Made with Receipts, written by a private AI on 0G"].join("\n");
}
