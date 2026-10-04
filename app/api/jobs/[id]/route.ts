import { cancelJob } from "@/lib/queue";
import { handle } from "@/lib/route";

export const DELETE = (_: Request, ctx: { params: Promise<{ id: string }> }) =>
  handle(async () => { await cancelJob((await ctx.params).id); return { ok: true }; });
