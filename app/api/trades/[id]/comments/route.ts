import { api, body, mutationOrigin } from "../../../../../lib/http";
import { requireUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/db";
import { owned } from "../../../../../lib/trades";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export function GET(_req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser();
    const t = await prisma.trade.findUniqueOrThrow({
      where: owned((await params).id, u.id),
      include: { aiComment: true },
    });
    return t.aiComment;
  });
}
export function PATCH(req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser(true);
    const data = z
      .object({ text: z.string().min(1).max(4000) })
      .strict()
      .parse(await body(req));
    return prisma.aiComment.update({
      where: { tradeId_userId: { tradeId: (await params).id, userId: u.id } },
      data,
    });
  });
}
export function DELETE(req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser(true);
    mutationOrigin(req);
    return prisma.aiComment.delete({
      where: { tradeId_userId: { tradeId: (await params).id, userId: u.id } },
    });
  });
}
