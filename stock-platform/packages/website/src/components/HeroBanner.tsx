'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightIcon, MonitorIcon } from '@/components/icons';

const SLIDES = [
  {
    eyebrow: 'Bienvenue chez Hamdi PC',
    title: <>L&apos;informatique depuis <span className="accent">1997</span></>,
    desc: 'Votre magasin de confiance pour le matériel informatique, les téléphones et les accessoires à Oujda.',
    cta: 'Voir le catalogue',
    ctaHref: '/catalogue',
  },
  {
    eyebrow: 'Commandez facilement',
    title: <>Commandez par <span className="accent">WhatsApp</span></>,
    desc: 'Ajoutez vos produits au panier et envoyez votre commande directement par WhatsApp. Simple et rapide.',
    cta: 'Découvrir',
    ctaHref: '/catalogue',
  },
  {
    eyebrow: 'Livraison nationale',
    title: <>Livraison partout au <span className="accent">Maroc</span></>,
    desc: 'Nous livrons vos commandes dans tout le Maroc. Passez votre commande en ligne ou en magasin.',
    cta: 'Parcourir les produits',
    ctaHref: '/catalogue',
  },
];

export function HeroBanner(): React.JSX.Element {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = SLIDES[current];
  if (!slide) return <></>;

  return (
    <section className="hero-section" aria-roledescription="carousel" aria-label="Bannière principale">
      <div className="hero-carousel">
        {SLIDES.map((s, i) => (
          <div key={i} className={`hero-slide ${i === current ? 'active' : ''}`} aria-hidden={i !== current}>
            <div className="hero-slide-content">
              <div className="hero-slide-eyebrow">{s.eyebrow}</div>
              <h1 className="hero-slide-title">{s.title}</h1>
              <p className="hero-slide-desc">{s.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={s.ctaHref} className="hero-slide-cta">
                  {s.cta} <ArrowRightIcon size={16} />
                </a>
                <a href="/a-propos" className="hero-slide-cta-outline">
                  En savoir plus
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* Static stats — outside slide loop */}
        <div className="hero-stats" style={{ position: 'absolute', bottom: '3rem', left: '3rem', zIndex: 3 }}>
          <div className="hero-stat-item">
            <div className="hero-stat-val">27+</div>
            <div className="hero-stat-label">Années d&apos;expérience</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-val">5000+</div>
            <div className="hero-stat-label">Produits disponibles</div>
          </div>
          <div className="hero-stat-item">
            <div className="hero-stat-val">100%</div>
            <div className="hero-stat-label">Satisfaction client</div>
          </div>
        </div>

        {/* Right decorative panel */}
        <div className="hero-right-panel" aria-hidden="true">
          <div className="hero-product">
            <div className="hero-product-icon">
              <MonitorIcon size={64} />
            </div>
            <span className="hero-product-label">Matériel Informatique</span>
            <span className="hero-product-tag">Depuis 1997</span>
          </div>
        </div>
      </div>

      <div className="hero-live" aria-live="polite" aria-atomic="true">
        {slide.eyebrow}
      </div>
    </section>
  );
}
