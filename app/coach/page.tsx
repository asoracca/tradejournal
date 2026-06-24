"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };
type T = { status: string; side: string; quantity: number; ticker: string; type: string; entryPrice: number; mode: string };

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: "Hey! I'm your TradeGoons coach 🫧 Ask me anything — what a strategy means, how risky a trade looks, options or futures basics, or how to think about your positions. (I won't tell you what to buy or sell.)" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/trades").then((r) => r.json()).then((d) => {
      const open = (Array.isArray(d) ? d : []).filter((t: T) => t.status === "OPEN");
      setContext(open.map((t: T) => "- " + t.side + " " + t.quantity + " " + t.ticker + " (" + t.type + ") @ $" + t.entryPrice + (t.mode === "REAL" ? " [REAL]" : "")).join("\n"));
    }).catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, context }) });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply || "…" }]);
    } catch { setMessages((m) => [...m, { role: "assistant", text: "Hmm, I couldn't reach the AI. Try again in a moment." }]); }
    finally { setBusy(false); }
  }

  const prompts = ["Is my portfolio too concentrated?", "What does mean reversion mean?", "Explain a covered call simply", "Why are leveraged ETFs risky?"];

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
      <header className="mb-3">
        <h1 className="text-2xl font-bold gradient-text">AI Coach</h1>
        <p className="text-gray-400 text-sm">Chat about strategy, risk, and your positions. Educational — not financial advice.</p>
      </header>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-line " + (m.role === "user" ? "bg-emerald-600 text-white" : "card text-gray-200")}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="card px-4 py-2 text-sm text-pink-300">thinking…</div></div>}
        <div ref={endRef} />
      </div>
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {prompts.map((p) => <button key={p} onClick={() => setInput(p)} className="text-xs card px-3 py-1.5 text-gray-300 hover:text-pink-300">{p}</button>)}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
        <input className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your coach…" />
        <button type="submit" disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-5 font-medium">Send</button>
      </form>
    </div>
  );
}
