// File: src/app/layout.tsx
import "./globals.css";
import LayoutWrapper from "./LayoutWrapper";

export const metadata = {
  title: "VELT - Creators, Lifestyle & Billboards",
  description: "Discover creators, buy original Products and book billboards, all in one platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--background)] text-[var(--foreground)] font-sans min-h-screen">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}


