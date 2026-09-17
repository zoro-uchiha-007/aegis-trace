import type { Metadata } from 'next';
import './globals.css';
import { ShellLayout } from '@/components/layout/ShellLayout';

export const metadata: Metadata = {
  title: 'AEGIS-TRACE — Cyber Forensics & SOC Investigation Console',
  description: 'Production cyber-forensics platform with real-time multi-vector threat triage, neural audio analysis, interactive 3D globe geolocation routing, and threat graph mapping.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen">
        <ShellLayout>{children}</ShellLayout>
      </body>
    </html>
  );
}
