'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface ShellLayoutProps {
  children: React.ReactNode;
}

export const ShellLayout: React.FC<ShellLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // On Login page, render full width without fixed SOC sidebar
  const isLoginPage = pathname === '/login';

  // Client-side auth guard: redirect to login if no session cookie
  useEffect(() => {
    if (!isLoginPage) {
      const hasSession = document.cookie
        .split('; ')
        .some((row) => row.startsWith('aegis_session='));

      if (!hasSession) {
        window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
      }
    }
  }, [pathname, isLoginPage]);

  if (isLoginPage) {
    return (
      <div className="min-h-screen w-full bg-surface-container-lowest flex items-center justify-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <Sidebar
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Header onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="relative pt-16 min-h-screen w-full px-4 sm:px-6 lg:px-gutter-desktop bg-surface">
          {children}
        </main>
      </div>
    </div>
  );
};
