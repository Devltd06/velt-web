// File: src/app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "ATMOSDEV - Social Content Management",
  description: "Upload your content to billboards across the country",
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
            <div className="flex gap-6 text-sm text-black">
              <Link href="/" className="hover:opacity-70 transition">Home</Link>
              <Link href="/privacy" className="hover:opacity-70 transition">Privacy</Link>
              <Link href="/support" className="hover:opacity-70 transition">Support</Link>
              <Link href="/renewal-subscription" className="hover:opacity-70 transition">Renew Subscription</Link>
              <Link href="/signup" className="hover:opacity-70 transition">Sign Up</Link>
            </div>
          </nav>
        </header>

        {/* ✅ Page Content */}
        <main>{children}</main>

        {/* ✅ Footer */}
        <footer className="w-full border-t border-gray-200 bg-white mt-12">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 text-sm text-gray-700 flex justify-between">
            <p>© {new Date().getFullYear()} Atmosdev. All rights reserved.</p>
            <div className="flex gap-6">
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


