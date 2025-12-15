"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

function ComingSoonModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#D4AF37" }}>
          <span className="text-3xl">🚀</span>
        </div>
        <h2 className="text-2xl font-bold text-black mb-2">Coming Soon!</h2>
        <p className="text-gray-600 mb-6">
          VELT for Web is currently under development. We&apos;re working hard to bring you an amazing experience. Stay tuned!
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-lg font-semibold text-black transition hover:opacity-90"
          style={{ backgroundColor: "#D4AF37" }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

export default function Header() {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
      {/* Coming Soon Modal */}
      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} />
      
      {/* Header / Navbar */}
      <header className="w-full border-b border-gray-200 bg-white sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-black">
            VELT
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-6 text-sm text-black">
            <Link href="/" className="hover:opacity-70 transition hidden md:block">Home</Link>
            <Link href="/investors" className="hover:opacity-70 transition hidden md:block">investor boardview</Link>
            <Link href="/ListerPlan" className="hover:opacity-70 transition hidden md:block">Renew subscription</Link>
            <Link href="/privacy" className="hover:opacity-70 transition hidden md:block">Privacy</Link>
            <Link href="/support" className="hover:opacity-70 transition hidden md:block">Support</Link>
            <Link href="/WaitList" className="hover:opacity-70 transition hidden md:block">Waitlist</Link>
            {/* VELT for Web button - hidden on mobile, shows Coming Soon on click */}
            {!isMobile && (
              <button
                onClick={() => setShowComingSoon(true)}
                className="px-4 py-2 rounded-lg font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "#D4AF37", color: "#000" }}
              >
                VELT for Web
              </button>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
