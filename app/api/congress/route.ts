export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { fetchHouseStockWatcherData, parseTransactions, getRepresentatives, getTradesForRepresentative } from "../../../lib/congress";

export async function GET(req: NextRequest) {
  if (process.env.MARKET_DATA_MODE !== "live") return NextResponse.json({representatives:[],trades:[],source:"synthetic"});
  const representative = req.nextUrl.searchParams.get("representative");

  try {
    const raw = await fetchHouseStockWatcherData();
    const trades = parseTransactions(raw);

    if (representative) {
      return NextResponse.json({
        representative,
        trades: getTradesForRepresentative(trades, representative).slice(-100),
      });
    }

    return NextResponse.json({
      representatives: getRepresentatives(trades),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
