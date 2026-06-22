import { NextRequest, NextResponse } from "next/server";
import { getOptionsChain } from "../../../lib/marketData";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const expiration = req.nextUrl.searchParams.get("expiration");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const chain = await getOptionsChain(ticker, expiration ? Number(expiration) : undefined);
    return NextResponse.json(chain);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
