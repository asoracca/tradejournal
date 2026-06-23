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
        <nav className="sticky top-0 z-10 border-b border-pink-900/30 bg-[#140a14]/70 backdrop-blur px-6 py-4 flex gap-6 items-center">
          <span className="font-bold text-lg">🫧 <span className="gradient-text">TradeGoons</span></span>
          <Link href="/" className="text-sm text-pink-100/80 hover:text-pink-300">Dashboard</Link>
          <Link href="/trades" className="text-sm text-pink-100/80 hover:text-pink-300">Trades</Link>
          <Link href="/scan" className="text-sm text-pink-100/80 hover:text-pink-300">Scan</Link>
          <Link href="/options" className="text-sm text-pink-100/80 hover:text-pink-300">Options</Link>
          <Link href="/learn" className="text-sm text-pink-100/80 hover:text-pink-300">Learn</Link>
          <Link href="/congress" className="text-sm text-pink-100/80 hover:text-pink-300">vs Congress</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
