import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set in Vercel" }, { status: 400 });
  if (!imageBase64) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const prompt =
    "This image is a brokerage trade confirmation or a portfolio/holdings screen. " +
    "Extract every position you can clearly identify. For each: ticker symbol (uppercase), " +
    "type (STOCK, OPTION, or FUTURE), side (BUY for holdings or long, SELL for short), " +
    "quantity (shares or contracts), and entryPrice (average cost or price per share/contract). " +
    "If it is a holdings screenshot, side is BUY and entryPrice is the average cost. " +
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

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
      ] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 2000 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ error: "Gemini " + res.status + ": " + t.slice(0, 300) }, { status: 500 });
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let parsed: { positions?: Array<Record<string, unknown>> } = {};
  try { parsed = JSON.parse(text); } catch { parsed = { positions: [] }; }

  const positions = (parsed.positions || []).map((p) => ({
    ticker: String(p.ticker || "").toUpperCase(),
    type: (p.type as string) || "STOCK",
    side: (p.side as string) || "BUY",
    quantity: Number(p.quantity) || 0,
    entryPrice: Number(p.entryPrice) || 0,
  })).filter((p) => p.ticker);

  return NextResponse.json({ positions });
}
