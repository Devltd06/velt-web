
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export const metadata = {
  title: "Velt",
  description: "Marketplace • Social Network • Productivity",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // Routes that should render full-bleed "page screen" layout (no global header)
  const hideHeaderOn = ["/"]; // add more paths here if you want full-bleed pages
  const hideHeader = hideHeaderOn.includes(pathname);

  // Main container classes: full-bleed for page screens, spacious centered container otherwise
  const mainContainerClass = hideHeader
    ? "w-full px-6 md:px-8 lg:px-16 py-8 min-h-[calc(100vh-120px)] bg-white text-slate-900"
    : "max-w-7xl mx-auto px-8 md:px-12 lg:px-16 py-16 min-h-[calc(100vh-160px)] bg-white text-slate-900";

  return (
    <html lang="en">
      <body className="bg-white text-slate-900 font-sans antialiased">
        {/* Conditionally render header (hidden on 'page screen' routes such as Home) */}
        {!hideHeader && (
          <header className="w-full border-b border-slate-100 bg-white sticky top-0 z-50">
            <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm">
                    <span className="text-sm font-bold text-white">V</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">VELT</div>
                    <div className="text-xs text-slate-500">billboards • listings • creators</div>
                  </div>
                </Link>
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm">
                <Link href="/" className="text-slate-700 hover:text-slate-900 transition">
                  Home
                </Link>
                <Link href="/features" className="text-slate-700 hover:text-slate-900 transition">
                  Features
                </Link>
                <Link href="/about" className="text-slate-700 hover:text-slate-900 transition">
                  About
                </Link>
                <Link href="/contact" className="text-slate-700 hover:text-slate-900 transition">
                  Contact
                </Link>

                <Link
                  href={`/login?next=${encodeURIComponent("/lister-plan")}`}
                  className="text-white bg-blue-600 px-3 py-2 rounded-md border border-blue-600 hover:bg-blue-700 transition"
                >
                  Lister Login
                </Link>

                <Link href="/auth/signup" className="bg-blue-500 text-white px-3 py-2 rounded-md font-semibold hover:bg-blue-600 transition">
                  Sign Up
                </Link>
              </div>

              {/* mobile compact */}
              <div className="md:hidden flex items-center gap-3">
                <Link href="/auth/signup" className="bg-blue-500 text-white px-3 py-2 rounded-md font-semibold">
                  Sign Up
                </Link>
              </div>
            </nav>
          </header>
        )}

        {/* Page Content: light, spacious layout */}
        <main className={mainContainerClass}>
          {/* Card-like container on non-page-screen routes for visual depth */}
          {!hideHeader ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm min-h-[60vh]">
              {children}
            </div>
          ) : (
            // Full-bleed pages (home/landing) get raw children so they control the hero, etc.
            <div className="w-full">{children}</div>
          )}
        </main>

        {/* Footer — light theme, blue accents */}
        <footer className="w-full border-t border-slate-100 bg-white mt-12">
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-700">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded bg-blue-500 flex items-center justify-center text-white font-bold">V</div>
                <div>
                  <div className="font-bold text-slate-900">VELT</div>
                  <div className="text-xs text-slate-500">billboards • listings • creators</div>
                </div>
              </div>
              <p className="text-sm text-slate-500">Questions? Email <a href="mailto:support@velt.com" className="underline text-blue-600">support@velt.com</a></p>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Explore</h4>
              <ul className="space-y-2 text-slate-600">
                <li><Link href="/">Home</Link></li>
                <li><Link href="/ListerPlan">Lister plan</Link></li>
                <li><Link href="/privacy">Privacy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Get started</h4>
              <div className="flex gap-3">
                <Link href="/auth/signup" className="bg-blue-500 text-white px-4 py-2 rounded-md">Sign up</Link>
                <Link href={`/login?next=${encodeURIComponent("/lister-plan")}`} className="border border-slate-200 px-4 py-2 rounded-md text-slate-700">Lister Login</Link>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} VELT • All rights reserved
          </div>
        </footer>
      </body>
    </html>
  );
}




