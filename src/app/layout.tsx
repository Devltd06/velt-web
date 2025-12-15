// File: src/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata = {
  title: "VELT - Creators, Lifestyle & Billboards",
  description: "Discover creators, buy original Products and book billboards , all in one platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black font-sans">
        {/* Header / Navbar */}
        <Header />

        {/* ✅ Page Content */}
        <main>{children}</main>

        {/* ✅ Footer */}
        <footer className="w-full border-t border-gray-200 bg-white mt-12">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 text-sm text-gray-700 flex flex-col md:flex-row justify-between gap-4">
            <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy">Privacy</Link>
              <Link href="/support">Support</Link>
              <Link href="/ListerPlan">renew your subscription</Link>
              <a href="mailto:atmosdevltd@gmail.com">Contact</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}


