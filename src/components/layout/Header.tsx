'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { EvidenceUploadModal } from '@/components/evidence/EvidenceUploadModal';
import { getUserCaseId } from '@/lib/auth';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  // Empty initial value matches SSR — populated client-side only to avoid hydration mismatch
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    setCaseId(getUserCaseId());
  }, []);

  const notifications = [
    { id: 1, title: 'Multi-Vector Anomaly Detected', time: '4m ago', type: 'critical' },
    { id: 2, title: 'Origin Hop 1 Flagged in Singapore', time: '18m ago', type: 'warning' },
    { id: 3, title: 'SPF Mismatch Alert on CFO Email', time: '42m ago', type: 'info' },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-40 px-space-md lg:px-space-xl flex items-center justify-between border-b border-outline-variant/10">
        {/* Left Search & Mobile Trigger */}
        <div className="flex items-center gap-space-md flex-1 max-w-2xl">
          {/* Mobile menu button */}
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-space-xs text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-high transition-colors"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>

          {/* Search Input Bar */}
          <div className="relative w-full max-w-md flex items-center">
            <span className="material-symbols-outlined absolute left-space-md text-outline pointer-events-none text-sm">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchModal(true)}
              placeholder="Search IOC / SHA-256 / Relay Node..."
              className="w-full bg-surface-container-low rounded-lg pl-9 pr-space-md py-space-xs font-code-sm text-code-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-high focus:ring-1 focus:ring-primary/40 transition-colors border border-outline-variant/15"
            />
          </div>

          {/* Telemetry Active Badge (Desktop) */}
          <div className="hidden xl:flex items-center gap-space-sm px-space-md py-space-xs bg-surface-container-low rounded-lg border border-outline-variant/15">
            <span className="h-2 w-2 rounded-full bg-tertiary animate-pulse" />
            <span className="font-code-sm text-code-sm text-on-surface font-medium">
              SIH-2026 Telemetry Active
            </span>
          </div>
        </div>

        {/* Right Actions & Profile Deck */}
        <div className="flex items-center gap-space-md lg:gap-space-lg">
          {/* Ingest Evidence Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-code-sm text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            <span className="hidden sm:inline">+ Ingest Evidence</span>
          </button>

          {/* Crypto-Seal Verified Badge */}
          <div className="hidden md:flex items-center gap-space-xs px-space-sm py-0.5 rounded bg-surface-container-high font-code-sm text-code-sm text-tertiary border border-tertiary/20">
            <span className="material-symbols-outlined text-xs">verified_user</span>
            <span className="font-semibold text-[11px] tracking-wide">CRYPTO-SEAL VERIFIED</span>
          </div>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-space-xs rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors relative"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-base">notifications</span>
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-high rounded-xl p-3 shadow-2xl border border-outline-variant/30 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20 mb-2">
                  <span className="font-label-sm uppercase font-bold text-on-surface">SOC Alerts</span>
                  <span className="font-code-sm text-[10px] text-primary">3 New</span>
                </div>
                <div className="flex flex-col gap-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 ${
                            n.type === 'critical' ? 'bg-error animate-ping' : 'bg-secondary'
                          }`}
                        />
                        <div>
                          <p className="font-body-sm text-xs font-semibold text-on-surface leading-tight">
                            {n.title}
                          </p>
                          <span className="font-code-sm text-[10px] text-on-surface-variant">
                            {n.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Badge */}
          <div className="flex items-center gap-space-md pl-space-xs lg:pl-space-md border-l border-outline-variant/15">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs">
              CV
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-body-sm text-body-sm font-semibold text-on-surface leading-tight">
                C. Vance
              </span>
              <span className="font-label-sm text-label-sm text-primary leading-tight font-mono">
                SOC Tier-III Lead
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Quick IOC Search Modal */}
      {showSearchModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-start justify-center pt-24 px-4"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="w-full max-w-xl bg-surface-container-low rounded-xl p-4 shadow-2xl border border-outline-variant/30 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <span className="material-symbols-outlined text-base">saved_search</span>
                <span className="font-code-sm text-sm">Forensic IOC Rapid Lookup</span>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-on-surface-variant hover:text-on-surface font-code-sm text-xs"
              >
                ESC to close
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter IP, hash, domain, or email..."
              className="w-full bg-surface-container rounded-lg p-3 font-code-md text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
            />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                Quick Jump
              </span>
              <Link
                href="/geolocation-threat-infrastructure"
                onClick={() => setShowSearchModal(false)}
                className="p-2 rounded bg-surface-container-lowest hover:bg-surface-container flex items-center justify-between"
              >
                <span className="font-code-sm text-tertiary">Geolocation &amp; Infrastructure Map</span>
                <span className="text-on-surface-variant">Stage 4</span>
              </Link>
              <Link
                href="/threat-graph"
                onClick={() => setShowSearchModal(false)}
                className="p-2 rounded bg-surface-container-lowest hover:bg-surface-container flex items-center justify-between"
              >
                <span className="font-code-sm text-secondary">IOC Threat Graph</span>
                <span className="text-on-surface-variant">Stage 3</span>
              </Link>
              <Link
                href="/stage-2-deep-forensics"
                onClick={() => setShowSearchModal(false)}
                className="p-2 rounded bg-surface-container-lowest hover:bg-surface-container flex items-center justify-between"
              >
                <span className="font-code-sm text-primary">Deep Forensics &amp; Audio Analysis</span>
                <span className="text-on-surface-variant">Stage 2</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Global Ingest Evidence Modal */}
      <EvidenceUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        caseId={caseId}
      />
    </>
  );
};
