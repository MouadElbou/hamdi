'use client';

import React, { useRef } from 'react';
import {
  MonitorIcon,
  SmartphoneIcon,
  GamepadIcon,
  HeadphonesIcon,
  WifiIcon,
  PackageIcon,
  PrinterIcon,
  BatteryIcon,
} from '@/components/icons';
import { useStaggerReveal } from '@/lib/anime-utils';

export const CATEGORIES = [
  { label: 'Ordinateurs', value: 'LAPTOP HP,LAPTOP DELL,LAPTOP ACER,LAPTOP ASUS,LAPTOP LENOVO,LAPTOP SURFACE,LAPTOP NEUF,LAPTOP AUTRE', Icon: MonitorIcon },
  { label: 'Téléphonie', value: 'GSM,GSM NEUF,GSM BATTERIE,GSM CABLES,GSM CHARGEUR,GSM KIT,GSM PRISE', Icon: SmartphoneIcon },
  { label: 'Gaming', value: 'GAMING,PLAY', Icon: GamepadIcon },
  { label: 'Périphériques', value: 'CASQUES,HAUT PARLEUR,BUR-CLAVIER,BUR-SOURIS/TAPIS,BUR-ECRAN,BUR-HDD,BUR-RAM,BUR RAM,MICRO', Icon: HeadphonesIcon },
  { label: 'Réseaux', value: 'RESEAUX,ACCESS-HUB', Icon: WifiIcon },
  { label: 'Composants', value: 'PP RAM,PP SSD,PP HDD,PP PIECES,PP REPARATION,PP COVER,PP BATTERIE HP,PP BATTERIE DELL,PP BATTERIE ACER,PP BATTERIE ASUS,PP BATTERIE LENOVO,PP BATTERIE MAC,PP BATTERIE TOSHIBA,PP BATTERIE CABLES,PP CLAVIER HP,PP CLAVIER DELL,PP CLAVIER ACER,PP CLAVIER ASUS,PP CLAVIER LEN,PP CLAVIER SAM,PP CLAVIER TOSHIBA,ALIMENTATIONS,PP-TABLE', Icon: PackageIcon },
  { label: 'Imprimantes', value: 'TONER,CABLE IMPRIMANTE', Icon: PrinterIcon },
  { label: 'Stockage', value: 'FLASH/SD,HDD EXTERNE,CASE HDD 2,5 ET CABLE,CASE M2/NVME,GRAVEUR EXTERNE', Icon: BatteryIcon },
];

interface CategoryStripProps {
  onCategoryClick?: (category: string) => void;
}

export function CategoryStrip({ onCategoryClick }: CategoryStripProps): React.JSX.Element {
  const stripRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(stripRef, '.category-strip-item', {}, { stagger: 50 });

  const handleClick = (value: string) => {
    if (onCategoryClick) {
      onCategoryClick(value);
    }
    // Navigate to catalogue with category filter
    if (value) {
      window.location.href = `/catalogue?category=${encodeURIComponent(value)}`;
    } else {
      window.location.href = '/catalogue';
    }
  };

  return (
    <section className="category-strip-section" id="categories">
      <div className="container">
        <div className="category-strip" role="list" ref={stripRef}>
          {CATEGORIES.map(({ label, value, Icon }) => (
            <button
              key={value}
              className="category-strip-item anime-hidden"
              onClick={() => handleClick(value)}
              role="listitem"
            >
              <span className="category-strip-icon">
                <Icon size={28} />
              </span>
              <span className="category-strip-label">{label}</span>
            </button>
          ))}
          <button
            className="category-strip-item anime-hidden"
            onClick={() => handleClick('')}
            role="listitem"
          >
            <span className="category-strip-icon">
              <PackageIcon size={28} />
            </span>
            <span className="category-strip-label">Tout</span>
          </button>
        </div>
      </div>
    </section>
  );
}
