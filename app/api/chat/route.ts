import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ reply: "Add GEMINI_API_KEY in Vercel to chat with the coach." });

  const system =
    "You are a warm, concise trading mentor inside a paper-trading app called TradeGoons, helping a beginner learn. " +
    "Explain concepts in plain language with simple examples, and keep answers fairly short. You can discuss risk, strategy mechanics, " +
    "leverage, options/futures basics, and how to think about trades. You do NOT give buy/sell advice, price targets, or predictions. " +
    "If portfolio context is provided, you may reference the user's positions." +
    (context ? "\n\nUser's current open positions:\n" + String(context).slice(0, 3000) : "");

  const contents = (Array.isArray(messages) ? messages : []).slice(-12).map((mm: { role: string; text: string }) => ({
    role: mm.role === "assistant" ? "model" : "user",
    parts: [{ text: String(mm.text || "") }],
  }));

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 700, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) { const t = await res.text(); return NextResponse.json({ reply: "Coach unavailable: " + t.slice(0, 150) }); }
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I didn't catch that.";
  return NextResponse.json({ reply });
}
