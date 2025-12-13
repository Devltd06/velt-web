// File: src/app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "VELT - Creators, Marketplace & Billboards",
  description: "Discover creators, buy and sell local goods, book billboards - all in one platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black font-sans">
        {/* ✅ Header / Navbar */}
        <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
          <nav className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="text-xl font-bold text-black">
              VELT
            </Link>

            {/* Navigation */}
            <div className="flex items-center gap-6 text-sm text-black">
              <Link href="/" className="hover:opacity-70 transition">Home</Link>
              <Link href="/explore" className="hover:opacity-70 transition">Explore</Link>
              <Link href="/marketplace" className="hover:opacity-70 transition">Marketplace</Link>
              <Link href="/billboards" className="hover:opacity-70 transition">Billboards</Link>
              <Link href="/privacy" className="hover:opacity-70 transition">Privacy</Link>
              <Link href="/support" className="hover:opacity-70 transition">Support</Link>
              <Link 
                href="/app/welcome" 
                className="px-4 py-2 rounded-lg font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "#D4AF37", color: "#000" }}
              >
                VELT for Web
              </Link>
            </div>
          </nav>
        </header>

        {/* ✅ Page Content */}
        <main>{children}</main>

        {/* ✅ Footer */}
        <footer className="w-full border-t border-gray-200 bg-white mt-12">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 text-sm text-gray-700 flex flex-col md:flex-row justify-between gap-4">
            <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/explore">Explore</Link>
              <Link href="/marketplace">Marketplace</Link>
              <Link href="/billboards">Billboards</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/support">Support</Link>
              <a href="mailto:support@velt.app">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}


