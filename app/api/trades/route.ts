import { api, body } from "../../../lib/http";
import { requireUser } from "../../../lib/auth";
import { listTrades, createTrade } from "../../../lib/trades";
export const dynamic = "force-dynamic";
export function GET() {
  return api(async () => listTrades((await requireUser()).id));
}
export function POST(req: Request) {
  return api(async () => {
    const user = await requireUser(true);
    return createTrade(user.id, await body(req));
  });
}
