// File: src/app/layout.tsx
"use client";

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
  // Add any paths here you want to hide the header for (e.g. "/", "/landing", "/special")
  const hideHeaderOn = ["/"]; // <-- header removed on these routes (home). Add more if needed.
  const hideHeader = hideHeaderOn.includes(pathname);

  // Main container classes: full-bleed for page screens, spacious centered container otherwise
  const mainContainerClass = hideHeader
    ? "w-full px-6 md:px-8 lg:px-16 py-8 min-h-[calc(100vh-120px)]" // full-bleed page (home)
    : "max-w-7xl mx-auto px-8 md:px-12 lg:px-16 py-16 min-h-[calc(100vh-160px)]"; // spacious inner pages

  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-[#020617] via-[#071431] to-white text-foreground font-sans antialiased">
        {/* Conditionally render header (hidden on 'page screen' routes such as Home) */}
        {!hideHeader && (
          <header className="w-full border-b border-white/6 bg-transparent sticky top-0 z-50 backdrop-blur-sm">
            <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#0ea5e9] to-[#7c3aed] flex items-center justify-center shadow-lg">
                    <span className="text-sm font-bold text-black">V</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">VELT</div>
                    <div className="text-xs text-blue-200/70">billboards • listings • creators</div>
                  </div>
                </Link>
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm">
                <Link href="/" className="text-blue-100 hover:text-white transition">
                  Home
                </Link>
                <Link href="/features" className="text-blue-100 hover:text-white transition">
                  Features
                </Link>
                <Link href="/about" className="text-blue-100 hover:text-white transition">
                  About
                </Link>
                <Link href="/contact" className="text-blue-100 hover:text-white transition">
                  Contact
                </Link>

                <Link
                  href={`/login?next=${encodeURIComponent("/lister-plan")}`}
                  className="text-white bg-black/50 px-3 py-2 rounded-md border border-white/6 hover:bg-black/60 transition"
                >
                  Lister Login
                </Link>

                <Link href="/auth/signup" className="bg-[#0ea5e9] text-black px-3 py-2 rounded-md font-semibold hover:opacity-95 transition">
                  Sign Up
                </Link>
              </div>

              {/* mobile compact */}
              <div className="md:hidden flex items-center gap-3">
                <Link href="/auth/signup" className="bg-[#0ea5e9] text-black px-3 py-2 rounded-md font-semibold">
                  Sign Up
                </Link>
              </div>
            </nav>
          </header>
        )}

        {/* Page Content: spacious, rich layout */}
        <main className={mainContainerClass}>
          {/* Add subtle card-like container on non-page-screen routes for visual depth */}
          {!hideHeader ? (
            <div className="bg-white/5 border border-white/6 rounded-2xl p-8 shadow-lg min-h-[60vh]">
              {children}
            </div>
          ) : (
            // Full-bleed pages (home/landing) get raw children so they control the hero, etc.
            <div className="w-full">{children}</div>
          )}
        </main>

        {/* Footer — roomy and informative */}
        <footer className="w-full border-t border-white/6 bg-transparent mt-12">
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-blue-100/80">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded bg-gradient-to-tr from-[#0ea5e9] to-[#7c3aed] flex items-center justify-center text-black font-bold">V</div>
                <div>
                  <div className="font-bold text-white">VELT</div>
                  <div className="text-xs text-blue-200/70">billboards • listings • creators</div>
                </div>
              </div>
              <p className="text-blue-200/60">Questions? Email <a href="mailto:support@velt.com" className="underline text-white">support@velt.com</a></p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Explore</h4>
              <ul className="space-y-2 text-blue-200/70">
                <li><Link href="/">Home</Link></li>
                <li><Link href="/ListerPlan">Lister plan</Link></li>
                <li><Link href="/privacy">Privacy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Get started</h4>
              <div className="flex gap-3">
                <Link href="/auth/signup" className="bg-[#0ea5e9] text-black px-4 py-2 rounded-md">Sign up</Link>
                <Link href={`/login?next=${encodeURIComponent("/lister-plan")}`} className="border border-white/8 px-4 py-2 rounded-md">Lister Login</Link>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-blue-200/60">
            © {new Date().getFullYear()} VELT • All rights reserved
          </div>
        </footer>
      </body>
    </html>
  );
}



