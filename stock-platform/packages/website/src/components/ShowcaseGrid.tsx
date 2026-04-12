'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MonitorIcon,
  SmartphoneIcon,
  GamepadIcon,
  HeadphonesIcon,
  PrinterIcon,
  WifiIcon,
  PackageIcon,
  BatteryIcon,
  ArrowRightIcon,
} from '@/components/icons';

const SHOWCASE_ITEMS = [
  { Icon: MonitorIcon, title: 'Ordinateurs', tag: '01', desc: 'Portables & bureaux — HP, Dell, Lenovo, Asus', category: 'LAPTOP HP,LAPTOP DELL,LAPTOP ACER,LAPTOP ASUS,LAPTOP LENOVO,LAPTOP SURFACE,LAPTOP NEUF,LAPTOP AUTRE' },
  { Icon: SmartphoneIcon, title: 'Smartphones', tag: '02', desc: 'Samsung, Xiaomi, Huawei — derniers modèles', category: 'GSM,GSM NEUF,GSM BATTERIE,GSM CABLES,GSM CHARGEUR,GSM KIT,GSM PRISE' },
  { Icon: GamepadIcon, title: 'Gaming', tag: '03', desc: 'PC Gaming, manettes, casques gaming', category: 'GAMING,PLAY' },
  { Icon: HeadphonesIcon, title: 'Périphériques', tag: '04', desc: 'Claviers, souris, casques, webcams', category: 'CASQUES,HAUT PARLEUR,BUR-CLAVIER,BUR-SOURIS/TAPIS,BUR-ECRAN,BUR-HDD,BUR-RAM,BUR RAM,MICRO' },
  { Icon: WifiIcon, title: 'Réseaux', tag: '05', desc: 'Routeurs, switches, câbles réseau', category: 'RESEAUX,ACCESS-HUB' },
  { Icon: PrinterIcon, title: 'Imprimantes', tag: '06', desc: 'Laser, jet d\'encre, multifonctions', category: 'TONER,CABLE IMPRIMANTE' },
  { Icon: PackageIcon, title: 'Composants', tag: '07', desc: 'RAM, SSD, GPU — upgradez votre PC', category: 'PP RAM,PP SSD,PP HDD,PP PIECES,PP REPARATION,PP COVER,ALIMENTATIONS,PP-TABLE' },
  { Icon: BatteryIcon, title: 'Batteries', tag: '08', desc: 'Batteries laptop & chargeurs', category: 'PP BATTERIE HP,PP BATTERIE DELL,PP BATTERIE ACER,PP BATTERIE ASUS,PP BATTERIE LENOVO,PP BATTERIE MAC,PP BATTERIE TOSHIBA,PP BATTERIE CABLES' },
];

const SPECS = [
  { key: 'Catalogue', val: '5 000+ produits', pct: 90 },
  { key: 'Expérience', val: '27 ans', pct: 100 },
  { key: 'Marques', val: '50+', pct: 75 },
  { key: 'Livraison', val: 'Tout le Maroc', pct: 85 },
];

export function ShowcaseGrid(): React.JSX.Element {
  const specRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = specRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e?.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="showcase-section" id="produits">
      <div className="container">
        <div className="showcase-header">
          <span className="showcase-eyebrow">Nos rayons</span>
          <h2 className="showcase-title">Ce que nous<br />proposons</h2>
        </div>
        <div className="showcase-bento">
          {/* Left: specs + categories */}
          <div>
            <div className="spec-list" ref={specRef}>
              {SPECS.map((s) => (
                <div key={s.key} className={`spec-row ${visible ? 'visible' : ''}`}>
                  <span className="spec-key">{s.key}</span>
                  <span className="spec-val">{s.val}</span>
                  <div className="spec-bar">
                    <div className="spec-fill" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {SHOWCASE_ITEMS.slice(0, 4).map((item) => (
              <Link key={item.tag} href={`/catalogue?category=${encodeURIComponent(item.category)}`} className="showcase-tile">
                <div className="showcase-tile-icon"><item.Icon size={18} /></div>
                <div className="showcase-tile-content">
                  <h3 className="showcase-tile-title">{item.title}</h3>
                  <p className="showcase-tile-desc">{item.desc}</p>
                </div>
                <span className="showcase-tile-arrow"><ArrowRightIcon size={14} /></span>
              </Link>
            ))}
          </div>
          {/* Right: remaining categories */}
          <div>
            {SHOWCASE_ITEMS.slice(4).map((item) => (
              <Link key={item.tag} href={`/catalogue?category=${encodeURIComponent(item.category)}`} className="showcase-tile">
                <div className="showcase-tile-icon"><item.Icon size={18} /></div>
                <div className="showcase-tile-content">
                  <h3 className="showcase-tile-title">{item.title}</h3>
                  <p className="showcase-tile-desc">{item.desc}</p>
                </div>
                <span className="showcase-tile-arrow"><ArrowRightIcon size={14} /></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
