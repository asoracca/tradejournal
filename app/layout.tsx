import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Paper Trading AI",
  description: "Plan trades, size risk, and learn — with AI commentary.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-gray-100 min-h-screen">
        <nav className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/70 backdrop-blur px-6 py-4 flex gap-6 items-center">
          <span className="font-bold text-lg">📈 <span className="gradient-text">Paper Trading AI</span></span>
          <Link href="/" className="text-sm text-gray-300 hover:text-emerald-400">Dashboard</Link>
          <Link href="/trades" className="text-sm text-gray-300 hover:text-emerald-400">Trades</Link>
          <Link href="/options" className="text-sm text-gray-300 hover:text-emerald-400">Options</Link>
          <Link href="/congress" className="text-sm text-gray-300 hover:text-emerald-400">vs Congress</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
