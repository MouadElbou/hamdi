'use client';

import React from 'react';
import {
  MonitorIcon,
  SmartphoneIcon,
  PackageIcon,
  PrinterIcon,
  HeadphonesIcon,
  CameraIcon,
} from '@/components/icons';

/* -- Categories kept for CatalogBrowser imports -- */
export const CATEGORIES = [
  { label: 'PC Portable',        value: 'LAPTOP HP,LAPTOP DELL,LAPTOP ACER,LAPTOP ASUS,LAPTOP LENOVO,LAPTOP SURFACE,LAPTOP NEUF,LAPTOP AUTRE', icon: MonitorIcon, color: '#3732FF' },
  { label: 'PC De Bureau',       value: 'PC BUREAU,DESKTOP',                                                                                     icon: SmartphoneIcon, color: '#00BCD4' },
  { label: 'Station De Travail', value: 'WORKSTATION,STATION DE TRAVAIL',                                                                        icon: PackageIcon, color: '#7C3AED' },
  { label: 'Ecran',              value: 'BUR-ECRAN,ECRAN',                                                                                       icon: CameraIcon, color: '#0891B2' },
  { label: 'Composants',         value: 'PP RAM,PP SSD,PP HDD,PP PIECES,PP REPARATION,ALIMENTATIONS',                                            icon: PackageIcon, color: '#DC2626' },
  { label: 'Accessoires',        value: 'CASQUES,HAUT PARLEUR,BUR-CLAVIER,BUR-SOURIS/TAPIS,RESEAUX,ACCESS-HUB',                                 icon: HeadphonesIcon, color: '#F59E0B' },
  { label: 'Imprimante',         value: 'TONER,CABLE IMPRIMANTE',                                                                                icon: PrinterIcon, color: '#16A34A' },
];

/* -- Featured collection cards (matching example.html) -- */
const COLLECTIONS = [
  {
    title: 'STATIONS DE TRAVAIL',
    subtitle: 'Performance Absolue',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7OWO6URuBYa_xw_zmJx_mGScnKxhBXgx2PrQTvAFr5CU6EPiTh0pbmQKtD4mTpX-q8X77n1sK2OnTU7o0mC5vgBfJMSGlqcFzXdjdlk_zJ5EI8HPkmDpRSqLp97paj7eB5MOjyq9I94PTR8KzchJRG_l8RYYux_mNLQ6w5IE5EP6nKpeKTiRz9Po7FeNDnAg8_KI6O7adSGUaM-YIwTjIcSMVTK01DCQJaPyukNtpLMAJh28TKUVZPatAYS9yWiawYacLaw4Nj60',
    href: '/catalogue?category=WORKSTATION%2CSTATION+DE+TRAVAIL',
  },
  {
    title: 'PC PORTABLES',
    subtitle: 'Precision Mobile',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALXxgtuzUVd_0yHhk-2SzXYv-GGmzK1FQOWNCpyjDZDPeqCH7uv2ynk0Z1tKvybdtV6seVP4LuhiJmThYT5AkbGutTSiW3ItdlbPlyGyeJGZp0scgBDooMH1k9PBjknBVnz6J-wDC0q_90IEEwmbJCb-92HF2Smr5v6mlG0zXARbYrMnAbT98Wr-eIYyoCG7vi0g-QNLNP2oICioqUwrc-Vck-jLT4ejcTrJFHU4bNkb59hzDxGUehSjw1mPIPA4laxvhjIcR_cx0',
    href: '/catalogue?category=LAPTOP+HP%2CLAPTOP+DELL%2CLAPTOP+ACER%2CLAPTOP+ASUS%2CLAPTOP+LENOVO%2CLAPTOP+SURFACE%2CLAPTOP+NEUF%2CLAPTOP+AUTRE',
  },
  {
    title: 'ACCESSOIRES',
    subtitle: 'Workflow Raffine',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFIfnlS_NdipNnO0bOpvh77ZgM3aNoOthF88jX2HPSKKc43BatJHQGaQ3R7OnBNVOt0uElZhz5fobEJqiCRGWlO3wEmCIIx17bKrNeR0288TnZL34txbbhdW26aUZqFOFnjq8qK5bwCLOzz09lDgVh9xVIovVVbvAUjDPJLhf7UDpq8gUyNOPzjcXSoTDhe3tDuQwuEQZv7t31s4zmHMc5wIrhjAI3sICZIbKGeYMU28I0gVzLwAnZEzHmOUnBt1SHXC4R-NGFYtE',
    href: '/catalogue?category=CASQUES%2CHAUT+PARLEUR%2CBUR-CLAVIER%2CBUR-SOURIS%2FTAPIS%2CRESEAUX%2CACCESS-HUB',
  },
];

interface CategoryStripProps {
  onCategoryClick?: (category: string) => void;
}

export function CategoryGrid({ onCategoryClick }: CategoryStripProps): React.JSX.Element {
  return (
    <section className="py-24 bg-surface-container-low">
      <div className="max-w-screen-2xl mx-auto px-8">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-4xl font-black font-headline text-on-surface tracking-tight">COLLECTIONS VEDETTES</h2>
            <div className="h-1.5 w-24 bg-primary mt-4"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {COLLECTIONS.map((col) => (
            <a
              key={col.title}
              href={col.href}
              onClick={(e) => {
                if (onCategoryClick) {
                  e.preventDefault();
                  onCategoryClick(col.title);
                }
              }}
              className="group relative aspect-[4/5] bg-surface-container-lowest overflow-hidden rounded-xl cursor-pointer block"
            >
              <img
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                src={col.image}
                alt={col.title}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-transparent to-transparent"></div>
              <div className="absolute bottom-8 left-8">
                <h3 className="text-white text-3xl font-black font-headline tracking-tight">{col.title}</h3>
                <p className="text-white/80 font-label tracking-widest mt-2 uppercase">{col.subtitle}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CategoryStrip(props: CategoryStripProps): React.JSX.Element {
  return <CategoryGrid {...props} />;
}
