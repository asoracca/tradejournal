import { api, body, mutationOrigin } from "../../../../lib/http";
import { requireUser } from "../../../../lib/auth";
import { readTrade, updateTrade, deleteTrade } from "../../../../lib/trades";
type Context = { params: { id: string } };
export const dynamic = "force-dynamic";
export function GET(_req: Request, { params }: Context) {
  return api(async () => readTrade((await requireUser()).id, params.id));
}
export function PATCH(req: Request, { params }: Context) {
  return api(async () => {
    const user = await requireUser(true);
    return updateTrade(user.id, params.id, await body(req));
  });
}
export function DELETE(req: Request, { params }: Context) {
  return api(async () => {
    const user = await requireUser(true);
    mutationOrigin(req);
    return deleteTrade(user.id, params.id);
  });
}
