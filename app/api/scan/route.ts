import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType, text } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set in Vercel" }, { status: 400 });
  if (!imageBase64 && !text) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const prompt =
    "This is a brokerage trade confirmation, holdings/portfolio screen, account statement, or a CSV export. " +
    "Extract every position you can clearly identify. For each: ticker symbol (uppercase), " +
    "type (STOCK, OPTION, or FUTURE), side (BUY for holdings or long, SELL for short), " +
    "quantity (shares or contracts), and entryPrice (average cost or price per share/contract). " +
    "If it is a holdings list, side is BUY and entryPrice is the average cost / cost basis per share. " +
    "Only include rows you are confident about. If you cannot read it, return an empty list.";

  const schema = {
    type: "OBJECT",
    properties: {
      positions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            ticker: { type: "STRING" },
            type: { type: "STRING", enum: ["STOCK", "OPTION", "FUTURE"] },
            side: { type: "STRING", enum: ["BUY", "SELL"] },
            quantity: { type: "NUMBER" },
            entryPrice: { type: "NUMBER" },
          },
          required: ["ticker", "quantity", "entryPrice"],
        },
      },
    },
    required: ["positions"],
  };

  const parts = text
    ? [{ text: prompt + "\n\nFile contents:\n" + String(text).slice(0, 20000) }]
    : [{ text: prompt }, { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }];

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ error: "Gemini " + res.status + ": " + t.slice(0, 300) }, { status: 500 });
  }

  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let parsed: { positions?: Array<Record<string, unknown>> } = {};
  try { parsed = JSON.parse(out); } catch { parsed = { positions: [] }; }

  const positions = (parsed.positions || []).map((p) => ({
    ticker: String(p.ticker || "").toUpperCase(),
    type: (p.type as string) || "STOCK",
    side: (p.side as string) || "BUY",
    quantity: Number(p.quantity) || 0,
    entryPrice: Number(p.entryPrice) || 0,
  })).filter((p) => p.ticker);

  return NextResponse.json({ positions });
}
