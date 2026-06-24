import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TradeGoons",
  description: "Paper trade stocks, options & futures — with a risk blobfish and AI coaching.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "TradeGoons", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0d0a12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-pink-50 min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var t=localStorage.getItem('tg_theme')||'PAPER';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();" }} />
        <nav className="sticky top-0 z-10 border-b border-white/10 bg-[#0d0a12]/80 backdrop-blur px-4 sm:px-6 py-3 flex gap-4 items-center overflow-x-auto whitespace-nowrap">
          <span className="font-bold text-lg shrink-0">🫧 <span className="gradient-text">TradeGoons</span></span>
          <Link href="/" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Dashboard</Link>
          <Link href="/coach" className="text-sm text-white/70 hover:text-violet-300 shrink-0">AI Coach</Link>
          <Link href="/trades" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Trades</Link>
          <Link href="/stats" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Stats</Link>
          <Link href="/review" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Review</Link>
          <Link href="/networth" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Net Worth</Link>
          <Link href="/options" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Options</Link>
          <Link href="/scan" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Scan</Link>
          <Link href="/learn" className="text-sm text-white/70 hover:text-violet-300 shrink-0">Learn</Link>
        </nav>
        <main className="p-4 sm:p-6">{children}</main>
      </body>
    </html>
  );
}
