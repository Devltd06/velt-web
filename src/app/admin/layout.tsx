"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FaHome, FaClipboardList, FaImage, FaMapMarkerAlt, FaUsers, FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const checkAuth = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/admin/login');
        setIsLoading(false);
        return;
      }

      // Verify admin status from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        // If profile doesn't exist or error, still deny access
        await supabase.auth.signOut();
        router.push('/admin/login');
        setIsLoading(false);
        return;
      }

      if (!profile?.is_admin) {
        // Not an admin, sign out and redirect to login
        await supabase.auth.signOut();
        router.push('/admin/login');
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsLoading(false);
      router.push('/admin/login');
    }
  }, [router]);

  useEffect(() => {
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        checkAuth();
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        router.push('/admin/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: FaHome },
    { href: '/admin/bookings', label: 'Bookings', icon: FaClipboardList },
    { href: '/admin/media', label: 'Media', icon: FaImage },
    { href: '/admin/locations', label: 'Locations', icon: FaMapMarkerAlt },
    { href: '/admin/users', label: 'Users', icon: FaUsers },
  ];

  // Show login page without layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-800 border-b border-gray-700 z-50 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold text-[#D4AF37]">Velt Admin</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-700 transition"
        >
          {sidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 w-64 h-full bg-gray-800 border-r border-gray-700 z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold text-[#D4AF37]">Velt Billboard</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Dashboard</p>
        </div>
        
        <nav className="p-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || 
              (link.href !== '/admin' && pathname?.startsWith(link.href));
            const Icon = link.icon;
            
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition mt-1
                  ${isActive 
                    ? 'bg-[#D4AF37]/15 border-l-3 border-[#D4AF37] text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                  }
                `}
                style={isActive ? { borderLeft: '3px solid #D4AF37' } : {}}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 transition mt-8"
          >
            <FaSignOutAlt className="w-5 h-5" />
            Logout
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
