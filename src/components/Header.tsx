"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { motion } from "framer-motion";
import VeltLogo from "@/components/VeltLogo";

function ComingSoonModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--background)] rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl border border-[var(--foreground)]/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-[var(--foreground)]">
          <span className="text-3xl">🚀</span>
        </div>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Coming Soon!</h2>
        <p className="text-[var(--foreground)]/60 mb-6">
          VELT for Web is currently under development. We&apos;re working hard to bring you an amazing experience. Stay tuned!
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-lg font-semibold transition hover:opacity-80 bg-[var(--foreground)] text-[var(--background)]"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

function MobileSideSheet({ isOpen, onClose, onShowComingSoon }: { isOpen: boolean; onClose: () => void; onShowComingSoon: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Side Sheet */}
      <div 
        className={`fixed top-0 right-0 h-full w-72 bg-[var(--background)] z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Close Button */}
        <div className="flex justify-between items-center p-6 border-b border-[var(--foreground)] border-opacity-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--foreground)]/10 flex items-center justify-center">
              <VeltLogo size={24} />
            </div>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-1 rounded-full bg-gradient-to-r from-[#8B7355] to-[#C4A77D]"
            />
            <span className="text-lg font-bold text-[var(--foreground)]">Menu</span>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--foreground)] hover:opacity-70 transition">
            <FaTimes size={20} />
          </button>
        </div>
        
        {/* Navigation Links */}
        <nav className="flex flex-col p-6 gap-4">
          <Link href="/" onClick={onClose} className="py-3 px-4 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-lg transition">
            Home
          </Link>
          <Link href="/investors" onClick={onClose} className="py-3 px-4 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-lg transition">
            Investor Boardview
          </Link>
          <Link href="/ListerPlan" onClick={onClose} className="py-3 px-4 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-lg transition">
            Renew Subscription
          </Link>
          <Link href="/privacy" onClick={onClose} className="py-3 px-4 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-lg transition">
            Privacy
          </Link>
          <Link href="/support" onClick={onClose} className="py-3 px-4 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-lg transition">
            Support
          </Link>
          <Link href="/WaitList" onClick={onClose} className="py-3 px-4 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 rounded-lg transition">
            Waitlist
          </Link>
          
          {/* VELT for Web Button */}
          <button
            onClick={() => {
              onClose();
              onShowComingSoon();
            }}
            className="mt-4 py-3 px-4 rounded-lg font-semibold transition hover:opacity-80 text-center bg-[var(--foreground)] text-[var(--background)]"
          >
            VELT for Web
          </button>
        </nav>
      </div>
    </>
  );
}

export default function Header() {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sideSheetOpen, setSideSheetOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSideSheetOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll when side sheet is open
  useEffect(() => {
    if (sideSheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sideSheetOpen]);

  return (
    <>
      {/* Coming Soon Modal */}
      <ComingSoonModal isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} />
      
      {/* Mobile Side Sheet */}
      <MobileSideSheet 
        isOpen={sideSheetOpen} 
        onClose={() => setSideSheetOpen(false)} 
        onShowComingSoon={() => setShowComingSoon(true)}
      />
      
      {/* Header / Navbar */}
      <header className="w-full border-b border-[var(--foreground)] border-opacity-10 bg-[var(--background)] sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--foreground)]/10 flex items-center justify-center">
              <VeltLogo size={24} />
            </div>
            <span className="text-xl font-bold text-[var(--foreground)]">VELT</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 text-sm text-[var(--foreground)]">
            <Link href="/" className="hover:opacity-70 transition">Home</Link>
            <Link href="/investors" className="hover:opacity-70 transition">Investor Boardview</Link>
            <Link href="/ListerPlan" className="hover:opacity-70 transition">Renew Subscription</Link>
            <Link href="/privacy" className="hover:opacity-70 transition">Privacy</Link>
            <Link href="/support" className="hover:opacity-70 transition">Support</Link>
            <Link href="/WaitList" className="hover:opacity-70 transition">Waitlist</Link>
            <button
              onClick={() => setShowComingSoon(true)}
              className="px-4 py-2 rounded-lg font-semibold transition hover:opacity-80 bg-[var(--foreground)] text-[var(--background)]"
            >
              VELT for Web
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setSideSheetOpen(true)}
            className="md:hidden p-2 text-[var(--foreground)] hover:opacity-70 transition"
            aria-label="Open menu"
          >
            <FaBars size={24} />
          </button>
        </nav>
      </header>
    </>
  );
}
