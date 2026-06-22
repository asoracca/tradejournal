import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "../../../lib/marketData";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const quote = await getQuote(ticker);
    return NextResponse.json(quote);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
