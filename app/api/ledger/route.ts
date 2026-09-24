import { api } from "../../../lib/http";
import { requireUser } from "../../../lib/auth";
import { ledger } from "../../../lib/ledger";
import { z } from "zod";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return api(async () => {
    const u = await requireUser();
    const query = new URL(req.url).searchParams;
    const mode = z.enum(["PAPER", "REAL"]).parse(query.get("mode") || "PAPER");
    return ledger(
      u.id,
      mode,
      query.get("account"),
      query.get("startBalance") || "100000",
    );
  });
}
