import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TradeGoons",
  description: "Paper trade stocks, options & futures — with a risk blobfish and AI coaching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-pink-50 min-h-screen">
        <nav className="sticky top-0 z-10 border-b border-pink-900/30 bg-[#140a14]/80 backdrop-blur px-4 sm:px-6 py-3 flex gap-4 items-center overflow-x-auto whitespace-nowrap">
          <span className="font-bold text-lg shrink-0">🫧 <span className="gradient-text">TradeGoons</span></span>
          <Link href="/" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">Dashboard</Link>
          <Link href="/trades" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">Trades</Link>
          <Link href="/review" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">AI Review</Link>
          <Link href="/networth" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">Net Worth</Link>
          <Link href="/scan" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">Scan</Link>
          <Link href="/learn" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">Learn</Link>
          <Link href="/congress" className="text-sm text-pink-100/80 hover:text-pink-300 shrink-0">vs Congress</Link>
        </nav>
        <main className="p-4 sm:p-6">{children}</main>
      </body>
    </html>
  );
}
