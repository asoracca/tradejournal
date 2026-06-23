import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { summary } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ analysis: "Add GEMINI_API_KEY in Vercel for deep AI analysis." });

  const systemPrompt = "You are a warm trading mentor writing a deeper analysis of a paper trade for a beginner. Write two short paragraphs. Paragraph 1: what the position is, the instrument's character (leverage, volatility, sector) and what the recent price trend means in plain language. Paragraph 2: the risk picture and what to watch from here, concretely and educationally. If it is a leveraged ETF, far OTM option, or very volatile name, explain that mechanic. Never give buy/sell advice or price predictions.";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: String(summary || "") }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.8 },
    }),
  });
  if (!res.ok) { const t = await res.text(); return NextResponse.json({ analysis: "Analysis unavailable: " + t.slice(0, 150) }); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return NextResponse.json({ analysis: text || "No analysis generated." });
}
