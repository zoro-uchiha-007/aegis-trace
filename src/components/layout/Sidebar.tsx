'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUserCaseId } from '@/lib/auth';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: 'grid_view',
    color: 'text-primary',
  },
  {
    name: 'Stage 1: Fast Triage',
    href: '/stage-1-fast-triage',
    icon: 'bolt',
    color: 'text-primary',
  },
  {
    name: 'Stage 2: Deep Forensics',
    href: '/stage-2-deep-forensics',
    icon: 'smb_share',
    color: 'text-primary',
  },
  {
    name: 'Threat Graph',
    href: '/threat-graph',
    icon: 'hub',
    color: 'text-secondary',
  },
  {
    name: 'Geolocation & Infra',
    href: '/geolocation-threat-infrastructure',
    icon: 'public',
    color: 'text-tertiary',
  },
  {
    name: 'Evidence Vault',
    href: '/evidence-vault',
    icon: 'lock',
    color: 'text-error',
    badge: 'NEW',
  },
  {
    name: 'Final Forensic Report',
    href: '/final-forensic-report',
    icon: 'description',
    color: 'text-on-surface-variant',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const pathname = usePathname();

  const [isAnalyzed, setIsAnalyzed] = React.useState(false);

  React.useEffect(() => {
    const checkStatus = async () => {
      const { isCaseAnalyzed } = await import('@/lib/services/cases');
      setIsAnalyzed(isCaseAnalyzed());
    };
    checkStatus();
    window.addEventListener('aegis-case-updated', checkStatus);
    return () => window.removeEventListener('aegis-case-updated', checkStatus);
  }, []);

  const handleLogout = () => {
    // Clear session cookie (SameSite=Lax matches the one set on login)
    document.cookie = 'aegis_session=; path=/; max-age=0; SameSite=Lax';
    // Clear case state from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aegis_trace_case_state_v1');
    }
    // Full page reload so middleware sees the cleared cookie
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col justify-between select-none border-r border-outline-variant/10 transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo & Brand Header */}
          <div className="h-16 px-space-xl flex items-center gap-space-md bg-surface-container-lowest border-b border-outline-variant/10">
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shadow-inner border border-primary/20">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                shield_with_house
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none font-bold">
                AEGIS-TRACE
              </span>
              <span className="font-label-sm text-label-sm text-primary tracking-wider uppercase leading-none mt-space-xs font-semibold">
                CYBER FORENSICS
              </span>
            </div>
          </div>

          {/* Active Case File Identifier */}
          <div className="px-space-lg pt-space-md">
            <div className="px-space-md py-space-xs bg-surface-container-low rounded-lg flex items-center justify-between border border-outline-variant/20">
              <span className="font-code-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                {isAnalyzed ? 'ACTIVE CASE' : 'CASE STANDBY'}
              </span>
              <span className={`font-code-sm text-xs font-bold ${isAnalyzed ? 'text-primary' : 'text-on-surface-variant'}`}>
                {getUserCaseId()}
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-space-xs px-space-lg pt-space-lg">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-all ${
                    isActive
                      ? 'bg-surface-container-high text-primary font-bold shadow-sm border-l-2 border-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${isActive ? 'text-primary' : item.color}`}>
                    {item.icon}
                  </span>
                  <span className="font-body-md text-body-md flex-1">{item.name}</span>
                  {'badge' in item && item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-primary/10 text-primary border border-primary/20">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Logout */}
            <div className="pt-space-md mt-space-sm border-t border-outline-variant/15">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-colors text-on-surface-variant hover:bg-error-container/20 hover:text-error"
              >
                <span className="material-symbols-outlined text-error text-base">logout</span>
                <span className="font-body-md text-body-md">Sign Out</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer Enclave Status */}
        <div className="p-space-lg m-space-md bg-surface-container-low rounded-xl flex flex-col gap-space-xs border border-outline-variant/15">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold">
              TELEMETRY MESH
            </span>
            <span className="inline-flex items-center gap-1 px-space-xs py-0.5 rounded bg-tertiary/10 text-tertiary font-code-sm text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              ONLINE
            </span>
          </div>
          <div className="font-code-md text-code-md text-on-surface font-semibold">
            NODE-US-EAST-01
          </div>
          <div className="flex items-center gap-space-xs pt-space-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-xs">lock</span>
            <span className="font-code-sm text-[10px]">TLS 1.3 256-BIT ENCRYPTED</span>
          </div>
        </div>
      </aside>
    </>
  );
};
