import { api, body, mutationOrigin } from "../../../../../lib/http";
import { requireUser } from "../../../../../lib/auth";
import { tradeApi } from "../../../../../lib/trade-api";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export function GET(_req: Request, { params }: Context) {
  return api(async () =>
    tradeApi(
      (await requireUser()).id,
      "/v1/trades/" + encodeURIComponent((await params).id) + "/comments",
    ),
  );
}
export function PATCH(req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser(true);
    return tradeApi(
      u.id,
      "/v1/trades/" + encodeURIComponent((await params).id) + "/comments",
      "PATCH",
      await body(req),
    );
  });
}
export function DELETE(req: Request, { params }: Context) {
  return api(async () => {
    const u = await requireUser(true);
    mutationOrigin(req);
    return tradeApi(
      u.id,
      "/v1/trades/" + encodeURIComponent((await params).id) + "/comments",
      "DELETE",
    );
  });
}
