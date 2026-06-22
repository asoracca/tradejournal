import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Paper Trading AI",
  description: "Paper trading with AI commentary and a Congress comparison.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-4 flex gap-6 items-center">
          <span className="font-bold text-lg">📈 Paper Trading AI</span>
          <Link href="/" className="hover:text-emerald-400">Dashboard</Link>
          <Link href="/trades" className="hover:text-emerald-400">Trades</Link>
          <Link href="/options" className="hover:text-emerald-400">Options</Link>
          <Link href="/congress" className="hover:text-emerald-400">vs Congress</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
