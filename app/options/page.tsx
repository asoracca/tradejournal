export default function OptionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Options Chain</h1>
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 max-w-md">
        <label className="block text-sm text-gray-400 mb-1">Ticker</label>
        <input className="w-full bg-gray-800 rounded px-3 py-2 text-sm" placeholder="SOXL" />
      </div>
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-gray-500">
        Options chain table goes here
      </div>
    </div>
  );
}
