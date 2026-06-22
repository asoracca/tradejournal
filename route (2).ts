import { NextResponse } from "next/server";
import {
  fetchHouseStockWatcherData,
  parseTransactions,
  getRepresentatives,
} from "@/lib/congress";

/**
 * GET /api/congress — list available representatives.
 * GET /api/congress?representative=Nancy+Pelosi — that rep's trades.
 */
export async function GET(req: Request) {
  try {
    const raw = await fetchHouseStockWatcherData();
    const trades = parseTransactions(raw);

    const { searchParams } = new URL(req.url);
    const rep = searchParams.get("representative");

    if (rep) {
      const repTrades = trades.filter((t) => t.representative === rep);
      return NextResponse.json(repTrades);
    }

    return NextResponse.json({ representatives: getRepresentatives(trades) });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
