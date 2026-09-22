import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api(work: () => Promise<unknown>) {
  try {
    const data = await work();
    return data instanceof Response
      ? data
      : NextResponse.json(data, {
          headers: { "Cache-Control": "private, no-store" },
        });
  } catch (error) {
    let status = 500,
      code = "INTERNAL",
      message = "Request could not be completed.";
    let issues: unknown;
    if (error instanceof ApiError) ({ status, code, message } = error);
    else if (error instanceof ZodError) {
      status = 400;
      code = "VALIDATION";
      message = "Invalid input.";
      issues = error.issues.map(({ path, message }) => ({ path, message }));
    } else if (error instanceof SyntaxError) {
      status = 400;
      code = "INVALID_JSON";
      message = "Invalid JSON.";
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        status = 404;
        code = "NOT_FOUND";
        message = "Record not found.";
      }
      if (error.code === "P2002" || error.code === "P2034") {
        status = 409;
        code = "CONFLICT";
        message = "Conflicting request; retry safely.";
      }
    }
    return NextResponse.json(
      { error: message, code, ...(issues ? { issues } : {}) },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function mutationOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin !== new URL(process.env.NEXTAUTH_URL || req.url).origin)
    throw new ApiError(403, "ORIGIN", "Same-origin request required.");
}
export async function body(req: Request) {
  mutationOrigin(req);
  const text = await req.text();
  if (text.length > 1_000_000)
    throw new ApiError(413, "TOO_LARGE", "Request too large.");
  return JSON.parse(text);
}
