import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { summary } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ review: "Add GEMINI_API_KEY in Vercel for the AI portfolio review." });

  const systemPrompt = "You are a warm trading mentor reviewing a beginner's entire paper-trading portfolio. In 2-3 short paragraphs: (1) overall concentration and diversification - is too much in one name or one theme/sector? (2) leverage exposure - specifically call out any 3x leveraged ETFs and what holding several of them means. (3) one or two concrete, plain-language things to watch or consider. Encouraging and educational, never buy/sell advice or price predictions.";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: String(summary || "") }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) { const t = await res.text(); return NextResponse.json({ review: "Review unavailable: " + t.slice(0, 150) }); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return NextResponse.json({ review: text || "No review generated." });
}
