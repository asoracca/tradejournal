import { api, body } from "../../../../../lib/http";
import { requireUser } from "../../../../../lib/auth";
import { closeTrade } from "../../../../../lib/trades";
export function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () =>
    closeTrade(
      (await requireUser(true)).id,
      (await params).id,
      await body(req),
    ),
  );
}
