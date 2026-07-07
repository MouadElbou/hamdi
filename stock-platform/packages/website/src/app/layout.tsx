import type { Metadata } from 'next';
import React from 'react';
import { Lexend, Work_Sans, Inter } from 'next/font/google';
import { CartProvider } from '@/lib/cart';
import './globals.css';
import { LayoutShell } from '@/components/LayoutShell';

// "Precision" type system — Lexend display, Work Sans body, Inter labels.
const headline = Lexend({ subsets: ['latin'], weight: ['400', '700', '800', '900'], variable: '--ff-display', display: 'swap' });
const body = Work_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--ff-body', display: 'swap' });
const label = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--ff-label', display: 'swap' });

export const metadata: Metadata = {
  title: 'HAMDI PC — Pièces & Réparation PC portable au Maroc',
  description: 'Écrans, batteries, chargeurs, claviers et réparation pour ordinateurs portables. Trouvez la pièce exacte de votre PC — livraison rapide partout au Maroc.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'HAMDI PC — Pièces & Réparation PC portable',
    description: 'Écrans, batteries, chargeurs, claviers & réparation. Trouvez la pièce exacte de votre PC portable.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${headline.variable} ${body.variable} ${label.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body>
        <CartProvider>
          <LayoutShell>{children}</LayoutShell>
        </CartProvider>
      </body>
    </html>
  );
}
