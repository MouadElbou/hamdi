import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — Hamdi PC',
  description: 'Contactez Hamdi PC par téléphone, WhatsApp ou en magasin à Oujda. Service client 7j/7.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
