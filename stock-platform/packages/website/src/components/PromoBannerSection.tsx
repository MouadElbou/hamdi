import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, PhoneIcon, MonitorIcon, SmartphoneIcon } from '@/components/icons';

export function PromoBannerSection(): React.JSX.Element {
  return (
    <section className="promo-section">
      <div className="container">
        <div className="promo-strip">
          {/* Main promo */}
          <div className="promo-block promo-block--hero">
            <div className="promo-block-inner">
              <div className="promo-block-content">
                <span className="promo-tag">01 — Nouveautés 2026</span>
                <h3 className="promo-block-title">
                  Laptops &<br />Ordinateurs
                </h3>
                <p className="promo-block-desc">
                  HP, Dell, Lenovo, Asus — les derniers modèles pour professionnels, étudiants et gamers.
                </p>
                <Link href="/catalogue?category=ordinateur" className="promo-block-cta">
                  Voir la sélection <ArrowRightIcon size={15} />
                </Link>
              </div>
              <div className="promo-block-graphic" aria-hidden="true">
                <MonitorIcon size={120} />
              </div>
            </div>
          </div>

          {/* Side promos */}
          <div className="promo-side">
            <Link href="/catalogue?category=téléphone" className="promo-block promo-block--side">
              <div className="promo-block-inner">
                <div className="promo-block-content">
                  <span className="promo-tag">02 — Populaire</span>
                  <h3 className="promo-block-title">Smartphones</h3>
                  <p className="promo-block-desc">Samsung, Xiaomi, Huawei au meilleur prix.</p>
                </div>
                <div className="promo-block-graphic promo-graphic-sm" aria-hidden="true">
                  <SmartphoneIcon size={56} />
                </div>
              </div>
            </Link>

            <div className="promo-block promo-block--whatsapp">
              <div className="promo-block-inner">
                <div className="promo-block-content">
                  <span className="promo-tag promo-tag--green">03 — WhatsApp</span>
                  <h3 className="promo-block-title">Commandez directement</h3>
                  <p className="promo-block-desc">Ajoutez au panier, envoyez par WhatsApp.</p>
                  <a href="https://wa.me/212622265053" className="promo-block-cta promo-cta--green" target="_blank" rel="noopener noreferrer">
                    <PhoneIcon size={14} /> Contactez-nous
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
