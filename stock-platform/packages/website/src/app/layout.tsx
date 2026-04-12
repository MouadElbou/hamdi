import type { Metadata } from 'next';
import React from 'react';
import { CartProvider } from '@/lib/cart';
import './globals.css';
import { LayoutShell } from '@/components/LayoutShell';

export const metadata: Metadata = {
  title: 'Hamdi PC — Informatique & Électronique',
  description: 'Hamdi PC — Votre destination pour les produits informatiques, électroniques et accessoires au meilleur prix.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Hamdi PC — Informatique & Électronique',
    description: 'Produits informatiques, électroniques et accessoires au meilleur prix.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <CartProvider>
          <LayoutShell>{children}</LayoutShell>
        </CartProvider>
      </body>
    </html>
  );
}
