// File: src/app/layout.tsx
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Velt",
  description: "Marketplace • Social Network • Productivity",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground font-sans">
        {/* ✅ Header / Navbar */}
        <header className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black sticky top-0 z-50">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="text-xl font-bold">
              Velt
            </Link>

            {/* Navigation */}
            <div className="flex gap-6 text-sm">
              <Link href="/">Home</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/auth/signup">Sign Up</Link>
            </div>
          </nav>
        </header>

        {/* ✅ Page Content */}
        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>

        {/* ✅ Footer */}
        <footer className="w-full border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black mt-12">
          <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-gray-500 flex justify-between">
            <p>© {new Date().getFullYear()} Velt. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}


