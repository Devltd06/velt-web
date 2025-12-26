"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ToastProvider } from '@/components/admin/Toast';
import { 
  FaHome, 
  FaClipboardList, 
  FaImage, 
  FaMapMarkerAlt, 
  FaUsers, 
  FaSignOutAlt, 
  FaBars, 
  FaTimes,
  FaBell,
  FaCog,
  FaListAlt,
  FaCalendarAlt,
  FaShoppingBag,
  FaGavel,
  FaDollarSign
} from 'react-icons/fa';
import VeltLogo from '@/components/VeltLogo';

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('billboard_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(count || 0);
    } catch {
      // Silently fail - table might not exist
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/admin/login');
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, is_admin')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        await supabase.auth.signOut();
        router.push('/admin/login');
        setIsLoading(false);
        return;
      }

      setAdminUser({
        id: profile.id,
        email: profile.email || session.user.email || '',
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      });
      setIsAuthenticated(true);
      fetchPendingCount();
      setIsLoading(false);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsLoading(false);
      router.push('/admin/login');
    }
  }, [router, fetchPendingCount]);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        checkAuth();
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setAdminUser(null);
        router.push('/admin/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAuth, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchPendingCount]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: FaHome, exact: true },
    { href: '/admin/bookings', label: 'Bookings', icon: FaClipboardList, badge: pendingCount },
    { href: '/admin/monetization', label: 'Monetization', icon: FaDollarSign },
    { href: '/admin/events', label: 'Events', icon: FaCalendarAlt },
    { href: '/admin/shop', label: 'Shop', icon: FaShoppingBag },
    { href: '/admin/auctions', label: 'Auctions', icon: FaGavel },
    { href: '/admin/media', label: 'Media', icon: FaImage },
    { href: '/admin/locations', label: 'Locations', icon: FaMapMarkerAlt },
    { href: '/admin/users', label: 'Users', icon: FaUsers },
    { href: '/admin/waitlist', label: 'Waitlist', icon: FaListAlt },
  ];

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-white/5" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#D4AF37] animate-spin" />
          </div>
          <p className="text-white/40 mt-6 text-sm tracking-wide">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return 'A';
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-black text-white">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-black border-b border-white/[0.06] z-50">
          <div className="flex items-center justify-between h-full px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
              </button>
              <span className="font-semibold text-[#D4AF37]">Velt Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
                <FaBell size={18} className="text-white/40" />
                {pendingCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed left-0 top-0 w-72 h-full bg-black border-r border-white/[0.06] z-50
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <VeltLogo size={32} />
              </div>
              <div>
                <h1 className="font-semibold text-white">Velt Billboard</h1>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Admin Console</p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            <p className="px-3 py-2 text-[10px] font-medium text-white/25 uppercase tracking-wider">
              Main Menu
            </p>
            {navLinks.map((link) => {
              const isActive = link.exact 
                ? pathname === link.href 
                : pathname === link.href || pathname?.startsWith(link.href + '/');
              const Icon = link.icon;
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                    ${isActive 
                      ? 'bg-[#D4AF37]/10 text-[#D4AF37]' 
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                    }
                  `}
                >
                  <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-[#D4AF37]' : 'text-white/35 group-hover:text-white/60'}`} />
                  <span className="font-medium text-sm">{link.label}</span>
                  {link.badge && link.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400 rounded-full">
                      {link.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/[0.02] mb-2">
              {adminUser?.avatar_url ? (
                <img 
                  src={adminUser.avatar_url} 
                  alt="Admin" 
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center">
                  <span className="text-black font-semibold text-sm">
                    {getInitials(adminUser?.full_name, adminUser?.email)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {adminUser?.full_name || 'Admin'}
                </p>
                <p className="text-xs text-white/40 truncate">{adminUser?.email}</p>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <FaCog className="w-4 h-4 text-white/35" />
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <FaSignOutAlt className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:pl-72 pt-16 lg:pt-0 min-h-screen">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
