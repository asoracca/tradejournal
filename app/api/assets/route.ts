import { api, body } from "../../../lib/http";
import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/db";
import { assetSchema } from "../../../lib/contracts";
export const dynamic = "force-dynamic";
export function GET() {
  return api(async () =>
    prisma.asset.findMany({ where: { userId: (await requireUser()).id } }),
  );
}
export function POST(req: Request) {
  return api(async () => {
    const u = await requireUser(true);
    return prisma.asset.create({
      data: { ...assetSchema.parse(await body(req)), userId: u.id },
    });
  });
}
