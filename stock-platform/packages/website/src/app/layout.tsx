import type { Metadata } from 'next';
import React from 'react';
import { Lexend, Work_Sans, Inter } from 'next/font/google';
import { CartProvider } from '@/lib/cart';
import './globals.css';
import { LayoutShell } from '@/components/LayoutShell';

const lexend = Lexend({ subsets: ['latin'], weight: ['400', '700', '800', '900'], variable: '--font-lexend', display: 'swap' });
const workSans = Work_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-work-sans', display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'HAMDI PC — Informatique & High-Tech',
  description: 'Hamdi PC — Votre destination pour les produits informatiques, electroniques et accessoires au meilleur prix.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'HAMDI PC — Informatique & High-Tech',
    description: 'Produits informatiques, electroniques et accessoires au meilleur prix.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${lexend.variable} ${workSans.variable} ${inter.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <CartProvider>
          <LayoutShell>{children}</LayoutShell>
        </CartProvider>
      </body>
    </html>
  );
}
