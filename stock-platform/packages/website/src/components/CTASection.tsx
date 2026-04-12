import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';

export function CTASection(): React.JSX.Element {
  return (
    <section className="cta-catalogue-section">
      <div className="container">
        <div className="cta-inner">
          <span className="cta-eyebrow">Catalogue en ligne</span>
          <h2 className="cta-headline">Explorez notre catalogue complet</h2>
          <p className="cta-sub">
            Découvrez notre gamme complète de produits informatiques — ordinateurs,
            périphériques, composants et accessoires — disponibles en magasin à Oujda
            et en livraison partout au Maroc.
          </p>
          <Link href="/catalogue" className="cta-link">
            Voir le catalogue <ArrowRightIcon size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
