import { api, body } from "../../../../lib/http";
import { requireUser } from "../../../../lib/auth";
import { importSchema } from "../../../../lib/contracts";
import { importCsv } from "../../../../lib/csv";
export function POST(req: Request) {
  return api(async () => {
    const user = await requireUser(true);
    const { csv, commit } = importSchema.parse(await body(req));
    return importCsv(user.id, csv, commit);
  });
}
