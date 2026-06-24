"use client";

import { useState, type ChangeEvent } from "react";

type Pos = { ticker: string; type: string; side: string; quantity: number; entryPrice: number };

function resizeImage(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1500;
        let width = img.width, height = img.height;
        if (width > maxDim || height > maxDim) { const s = maxDim / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl.split(",")[1], dataUrl });
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

export default function ScanPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [added, setAdded] = useState(0);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setAdded(0); setPositions([]); setPreview(null); setFileName(null); setBusy(true);
    try {
      const name = file.name.toLowerCase();
      let payload: Record<string, unknown>;
      if (file.type.startsWith("image/")) {
        const { base64, dataUrl } = await resizeImage(file);
        setPreview(dataUrl);
        payload = { imageBase64: base64, mimeType: "image/jpeg" };
      } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        setFileName(file.name);
        payload = { imageBase64: await readBase64(file), mimeType: "application/pdf" };
      } else if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv") || file.type.startsWith("text/")) {
        setFileName(file.name);
        payload = { text: await file.text() };
      } else {
        throw new Error("Unsupported file type. Upload an image, PDF, or CSV.");
      }
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setPositions(Array.isArray(data.positions) ? data.positions : []);
      if (!data.positions || data.positions.length === 0) setError("Couldn't read any positions from that file. For a PDF use the holdings page; for a screenshot make it clear and close.");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  function updatePos(i: number, field: string, value: string) {
    setPositions((ps) => ps.map((p, idx) => idx === i ? { ...p, [field]: (field === "quantity" || field === "entryPrice") ? Number(value) : value } : p));
  }
  function removePos(i: number) { setPositions((ps) => ps.filter((_, idx) => idx !== i)); }

  async function addAll() {
    setBusy(true); setError(null);
    let count = 0;
    try {
      for (const p of positions) {
        const res = await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, mode: "REAL", strategy: "Imported", notes: "Imported from file" }) });
        if (res.ok) count++;
      }
      setAdded(count); setPositions([]);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold gradient-text">Scan &amp; Import</h1>
        <p className="text-gray-400 text-sm mt-1">Upload a screenshot, a PDF statement, or a CSV export — the AI reads it and logs your positions.</p>
      </header>

      <div className="card p-6">
        <label className="block">
          <span className="text-sm text-gray-200">Upload a photo, PDF, or CSV</span>
          <input type="file" accept="image/*,.pdf,.csv,.txt" onChange={handleFile} disabled={busy}
            className="mt-2 block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-white hover:file:bg-emerald-500" />
        </label>
        {busy && <p className="text-pink-300 text-sm mt-3">Reading file…</p>}
        {error && <p className="text-red-400 text-sm mt-3">⚠ {error}</p>}
        {preview && <img src={preview} alt="preview" className="mt-4 max-h-48 rounded-lg border border-gray-800" />}
        {fileName && !preview && <p className="mt-3 text-sm text-gray-300">📄 {fileName}</p>}
      </div>

      {added > 0 && <div className="card p-4 text-emerald-300 text-sm">✓ Added {added} position(s) to your journal. Check the Dashboard.</div>}

      {positions.length > 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Review before adding</h2>
          <p className="text-xs text-gray-400">Check each row against your file and fix anything the AI misread.</p>
          <div className="space-y-2">
            {positions.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input className="input col-span-3" value={p.ticker} onChange={(e) => updatePos(i, "ticker", e.target.value)} />
                <select className="input col-span-2" value={p.type} onChange={(e) => updatePos(i, "type", e.target.value)}><option value="STOCK">Stock</option><option value="OPTION">Option</option><option value="FUTURE">Future</option></select>
                <select className="input col-span-2" value={p.side} onChange={(e) => updatePos(i, "side", e.target.value)}><option value="BUY">Buy</option><option value="SELL">Sell</option></select>
                <input className="input col-span-2" type="number" step="any" value={p.quantity} onChange={(e) => updatePos(i, "quantity", e.target.value)} />
                <input className="input col-span-2" type="number" step="any" value={p.entryPrice} onChange={(e) => updatePos(i, "entryPrice", e.target.value)} />
                <button onClick={() => removePos(i)} className="col-span-1 text-gray-500 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
          <button onClick={addAll} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg px-5 py-2.5 font-medium">{busy ? "Adding…" : "Add all to journal"}</button>
        </div>
      )}
    </div>
  );
}
