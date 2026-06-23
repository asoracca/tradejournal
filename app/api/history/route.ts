import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "../../../lib/marketData";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const range = req.nextUrl.searchParams.get("range") || "6mo";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  try {
    const history = await getHistory(ticker, range);
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
