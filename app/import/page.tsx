"use client";
import { useState } from "react";
type Row = {
  row: number;
  errors: string[];
  duplicate: boolean;
  data?: { ticker: string };
};
export default function CsvImport() {
  const [csv, setCsv] = useState(
    "ticker,type,side,quantity,entryPrice,tradeDate,notes\nSYNTH,STOCK,BUY,2,100,2026-01-05,Synthetic CSV example",
  );
  const [rows, setRows] = useState<Row[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(commit: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/trades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, commit }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setRows(data.rows);
      setMessage(
        commit
          ? `${data.imported} trades imported. Duplicates skipped.`
          : "Preview ready. No trades saved.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-3xl font-bold gradient-text">CSV import & export</h1>
      <p>
        Preview up to 500 rows. Repeated identical rows are skipped for your
        account. All imports default to paper trades.
      </p>
      <label className="block">
        CSV data
        <textarea
          className="block w-full h-56 bg-gray-900 rounded p-4 font-mono text-sm"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setRows([]);
            setMessage("");
          }}
        />
      </label>
      <div className="flex gap-4">
        <button
          className="bg-violet-600 px-4 py-2 rounded"
          disabled={busy}
          onClick={() => run(false)}
        >
          Preview
        </button>
        <button
          className="bg-emerald-700 px-4 py-2 rounded disabled:opacity-40"
          disabled={
            busy || !rows.length || rows.some((r) => r.errors.length > 0)
          }
          onClick={() => run(true)}
        >
          Import valid rows
        </button>
        <a href="/api/trades/export" download="paper-trades.csv" className="underline">
          Export my trades
        </a>
      </div>
      <p role="status">{message}</p>
      <ul>
        {rows.map((r) => (
          <li className="card p-3" key={r.row}>
            Row {r.row}:{" "}
            {r.errors.length
              ? r.errors.join("; ")
              : `${r.data?.ticker} — ${r.duplicate ? "duplicate, will skip" : "valid"}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
