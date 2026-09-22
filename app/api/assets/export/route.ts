import { api, ApiError } from "../../../../lib/http";
import { requireUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { csvCell } from "../../../../lib/csv";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return api(async () => {
    const u = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    const rows = await prisma.asset.findMany({
      where: { userId: u.id, ...(id ? { id } : {}) },
    });
    if (id && !rows.length)
      throw new ApiError(404, "NOT_FOUND", "Record not found.");
    return new Response(
      "name,category,value\r\n" +
        rows
          .map((r) => [r.name, r.category, r.value].map(csvCell).join(","))
          .join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv",
          "Cache-Control": "private, no-store",
        },
      },
    );
  });
}
