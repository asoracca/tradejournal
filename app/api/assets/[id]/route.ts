import { api, body, mutationOrigin } from "../../../../lib/http";
import { requireUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { owned } from "../../../../lib/trades";
import { assetSchema } from "../../../../lib/contracts";
type Context = { params: { id: string } };
export const dynamic = "force-dynamic";
export function GET(_req: Request, { params }: Context) {
  return api(async () =>
    prisma.asset.findUniqueOrThrow({
      where: owned(params.id, (await requireUser()).id),
    }),
  );
}
export function PATCH(req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser(true);
    return prisma.asset.update({
      where: owned(params.id, u.id),
      data: assetSchema.parse(await body(req)),
    });
  });
}
export function DELETE(req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser(true);
    mutationOrigin(req);
    return prisma.asset.delete({ where: owned(params.id, u.id) });
  });
}
