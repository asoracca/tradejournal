import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ news: [], error: "ticker required" });
  try {
    const url = "https://query1.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(ticker) + "&newsCount=8&quotesCount=0";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 600 } });
    if (!res.ok) throw new Error("news " + res.status);
    const data = await res.json();
    const news = (data.news || []).map((n: { title: string; publisher: string; link: string; providerPublishTime: number }) => ({
      title: n.title, publisher: n.publisher, link: n.link, time: n.providerPublishTime,
    }));
    return NextResponse.json({ news });
  } catch (err) {
    return NextResponse.json({ news: [], error: (err as Error).message });
  }
}
