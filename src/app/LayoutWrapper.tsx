"use client";
import Link from "next/link";
import Header from "@/components/Header";
import { usePathname } from "next/navigation";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin');

  return (
    <>
      {/* Header / Navbar - Hidden on admin pages */}
      {!isAdminPage && <Header />}

      {/* ✅ Page Content */}
      <main>{children}</main>

      {/* ✅ Footer - Hidden on admin pages */}
      {!isAdminPage && (
        <footer className="w-full border-t border-[var(--foreground)] border-opacity-10 bg-[var(--background)] mt-12">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 text-sm text-[var(--foreground)] opacity-70 flex flex-col md:flex-row justify-between gap-4">
            <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:opacity-100 transition">Privacy</Link>
              <Link href="/support" className="hover:opacity-100 transition">Support</Link>
              <Link href="/ListerPlan" className="hover:opacity-100 transition">Renew Subscription</Link>
              <a href="mailto:atmosdevltd@gmail.com" className="hover:opacity-100 transition">Contact</a>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
