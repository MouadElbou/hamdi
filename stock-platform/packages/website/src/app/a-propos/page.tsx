import React from 'react';
import type { Metadata } from 'next';
import {
  PackageIcon,
  ShieldCheckIcon,
  TruckIcon,
  PhoneIcon,
  MapPinIcon,
  AwardIcon,
  HeadphonesIcon,
} from '@/components/icons';

export const metadata: Metadata = {
  title: 'À propos — Hamdi PC',
  description:
    'Découvrez Hamdi PC, votre partenaire informatique depuis 1997 à Oujda. Plus de 25 ans d\'expérience en vente de matériel informatique et électronique.',
};

const VALUES = [
  {
    Icon: ShieldCheckIcon,
    title: 'Produits Authentiques',
    desc: 'Nous ne vendons que des produits originaux avec garantie constructeur officielle.',
  },
  {
    Icon: AwardIcon,
    title: 'Expertise Reconnue',
    desc: 'Plus de 25 ans d\'expérience nous permettent de vous conseiller avec précision.',
  },
  {
    Icon: TruckIcon,
    title: 'Livraison Rapide',
    desc: 'Expédition sous 48h partout au Maroc avec suivi de votre colis.',
  },
  {
    Icon: HeadphonesIcon,
    title: 'Support Client',
    desc: 'Une équipe disponible par téléphone et WhatsApp pour vous accompagner.',
  },
];

const MILESTONES = [
  { year: '1997', text: 'Ouverture du premier magasin à Souk Mlilia, Oujda' },
  { year: '2005', text: 'Élargissement à la téléphonie mobile et accessoires' },
  { year: '2015', text: 'Lancement du service de livraison dans tout le Maroc' },
  { year: '2024', text: 'Lancement de la boutique en ligne hamdipc.com' },
];

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="container">
          <span className="about-eyebrow">À propos</span>
          <h1 className="about-hero-title">
            L&apos;informatique depuis&nbsp;1997
          </h1>
          <p className="about-hero-sub">
            Hamdi PC est une entreprise familiale spécialisée dans la vente de matériel
            informatique, smartphones, accessoires et composants électroniques à Oujda, Maroc.
          </p>
        </div>
      </section>

      {/* ── Story ── */}
      <section className="about-story">
        <div className="container about-story-grid">
          <div className="about-story-content">
            <span className="about-section-eyebrow">Notre Histoire</span>
            <h2 className="about-section-title">
              Un parcours de passion et&nbsp;d&apos;engagement
            </h2>
            <p>
              Fondé en 1997 au cœur du Souk Mlilia à Oujda, Hamdi PC est né d&apos;une
              passion pour la technologie et d&apos;un désir de rendre l&apos;informatique
              accessible à tous. Ce qui a commencé comme une petite boutique est devenu
              une référence incontournable pour les passionnés de tech dans la région orientale.
            </p>
            <p>
              Au fil des années, nous avons élargi notre gamme pour inclure les smartphones,
              les accessoires, les composants et les périphériques — toujours avec le même
              engagement envers la qualité et le service client.
            </p>
          </div>
          <div className="about-story-stats">
            <div className="about-stat">
              <span className="about-stat-number">25+</span>
              <span className="about-stat-label">Années d&apos;expérience</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-number">1K+</span>
              <span className="about-stat-label">Clients satisfaits</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-number">100%</span>
              <span className="about-stat-label">Produits garantis</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-number">48h</span>
              <span className="about-stat-label">Délai de livraison</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="about-values">
        <div className="container">
          <span className="about-section-eyebrow">Nos Valeurs</span>
          <h2 className="about-section-title">Pourquoi nous choisir&nbsp;?</h2>
          <div className="about-values-grid">
            {VALUES.map(({ Icon, title, desc }) => (
              <div key={title} className="about-value-card">
                <div className="about-value-icon" aria-hidden="true">
                  <Icon size={28} />
                </div>
                <h3 className="about-value-title">{title}</h3>
                <p className="about-value-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className="about-timeline">
        <div className="container">
          <span className="about-section-eyebrow">Nos Jalons</span>
          <h2 className="about-section-title">Notre parcours</h2>
          <div className="about-timeline-list">
            {MILESTONES.map(({ year, text }) => (
              <div key={year} className="about-milestone">
                <span className="about-milestone-year">{year}</span>
                <div className="about-milestone-dot" />
                <p className="about-milestone-text">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Location ── */}
      <section className="about-location">
        <div className="container about-location-inner">
          <div className="about-location-info">
            <span className="about-section-eyebrow">Nous Trouver</span>
            <h2 className="about-section-title">Venez nous rendre visite</h2>
            <div className="about-location-detail">
              <MapPinIcon size={20} />
              <div>
                <strong>Souk Mlilia n°914</strong>
                <span>Oujda, Maroc</span>
              </div>
            </div>
            <div className="about-location-detail">
              <PhoneIcon size={20} />
              <div>
                <strong>+212 536 69 03 06</strong>
                <span>Du lundi au samedi, 9h–19h</span>
              </div>
            </div>
            <div className="about-location-detail">
              <PackageIcon size={20} />
              <div>
                <strong>Livraison au Maroc</strong>
                <span>Expédition sous 48h dans tout le pays</span>
              </div>
            </div>
          </div>
          <div className="about-location-map">
            <iframe
              title="Hamdi PC — Souk Mlilia, Oujda"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3281.5!2d-1.9!3d34.68!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sSouk+Mlilia+Oujda!5e0!3m2!1sfr!2sma!4v1"
              width="100%"
              height="100%"
              style={{ border: 0, borderRadius: '2px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </>
  );
}
