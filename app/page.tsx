"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type Trade = {
  id: string;
  ticker: string;
  type: string;
  side: string;
  quantity: number;
  entryPrice: number;
  optionType: string | null;
  strike: number | null;
  aiComment?: { text: string } | null;
};

const emptyForm = {
  ticker: "", type: "STOCK", side: "BUY", quantity: "", entryPrice: "",
  optionType: "CALL", strike: "", expiration: "", strategy: "", notes: "", emotion: "",
};

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTrades() {
    try {
      const res = await fetch("/api/trades");
      if (!res.ok) throw new Error("Failed to load trades");
      const data = await res.json();
      setTrades(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { loadTrades(); }, []);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save trade");
      setForm(emptyForm);
      await loadTrades();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const isOption = form.type === "OPTION";

  return (
    <div className="space-y-8 max-w-4xl">
      <section>
        <h1 className="text-2xl font-bold mb-4">Log a Trade</h1>
        <form onSubmit={submit} className="bg-gray-900 border border-gray-800 rounded-lg p-5 grid grid-cols-2 gap-4">
          <Field label="Ticker">
            <input className="input" value={form.ticker} onChange={(e) => update("ticker", e.target.value)} placeholder="AAPL" required />
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => update("type", e.target.value)}>
              <option value="STOCK">Stock</option>
              <option value="OPTION">Option</option>
              <option value="FUTURE">Future</option>
            </select>
          </Field>
          <Field label="Side">
            <select className="input" value={form.side} onChange={(e) => update("side", e.target.value)}>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </Field>
          <Field label="Quantity">
            <input className="input" type="number" step="any" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} required />
          </Field>
          <Field label="Entry Price">
            <input className="input" type="number" step="any" value={form.entryPrice} onChange={(e) => update("entryPrice", e.target.value)} required />
          </Field>
          {isOption && (
            <>
              <Field label="Call / Put">
                <select className="input" value={form.optionType} onChange={(e) => update("optionType", e.target.value)}>
                  <option value="CALL">Call</option>
                  <option value="PUT">Put</option>
                </select>
              </Field>
              <Field label="Strike">
                <input className="input" type="number" step="any" value={form.strike} onChange={(e) => update("strike", e.target.value)} />
              </Field>
              <Field label="Expiration">
                <input className="input" type="date" value={form.expiration} onChange={(e) => update("expiration", e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Strategy">
            <input className="input" value={form.strategy} onChange={(e) => update("strategy", e.target.value)} placeholder="breakout, momentum..." />
          </Field>
          <Field label="Emotion">
            <input className="input" value={form.emotion} onChange={(e) => update("emotion", e.target.value)} placeholder="calm, fomo..." />
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea className="input" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} />
            </Field>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded px-4 py-2 font-medium">
              {loading ? "Saving..." : "Add Trade"}
            </button>
            {error && <span className="text-red-400 text-sm">{error}</span>}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Recent Trades</h2>
        {trades.length === 0 ? (
          <p className="text-gray-500">No trades yet. Add one above.</p>
        ) : (
          <div className="space-y-3">
            {trades.map((t) => (
              <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="font-bold">{t.ticker}</span>
                  <span className={t.side === "BUY" ? "text-emerald-400" : "text-red-400"}>{t.side}</span>
                  <span className="text-gray-400 text-sm">
                    {t.quantity} @ {t.entryPrice}
                    {t.type === "OPTION" && t.strike ? ` ${t.optionType} ${t.strike}` : ""}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">{t.type}</span>
                </div>
                {t.aiComment?.text && (
                  <p className="mt-2 text-sm text-gray-300 border-l-2 border-emerald-700 pl-3">🤖 {t.aiComment.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
