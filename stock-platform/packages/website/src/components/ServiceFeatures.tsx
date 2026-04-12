import React from 'react';
import { TruckIcon, PhoneIcon, ShieldCheckIcon, PackageIcon } from '@/components/icons';

const SERVICES = [
  {
    Icon: PackageIcon,
    title: 'Depuis 1997',
    desc: 'Plus de 25 ans d\'expérience dans l\'informatique à Oujda',
  },
  {
    Icon: PhoneIcon,
    title: 'Commande WhatsApp',
    desc: 'Commandez facilement via WhatsApp, rapide et pratique',
  },
  {
    Icon: TruckIcon,
    title: 'Livraison au Maroc',
    desc: 'Nous livrons vos commandes partout au Maroc',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Produits Garantis',
    desc: 'Tous nos produits sont authentiques et garantis',
  },
];

export function ServiceFeatures(): React.JSX.Element {
  return (
    <section className="services-section" id="about" aria-label="Nos services">
      <div className="container">
        <div className="services-grid">
          {SERVICES.map(({ Icon, title, desc }) => (
            <div key={title} className="service-item">
              <div className="service-icon" aria-hidden="true">
                <Icon size={28} />
              </div>
              <h3 className="service-title">{title}</h3>
              <p className="service-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
