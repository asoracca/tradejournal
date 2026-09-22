import { api } from "../../../../lib/http";
import { requireUser } from "../../../../lib/auth";
import { exportCsv } from "../../../../lib/csv";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return api(async () => {
    const user = await requireUser();
    return new Response(
      await exportCsv(
        user.id,
        new URL(req.url).searchParams.get("id") || undefined,
      ),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="paper-trades.csv"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  });
}
