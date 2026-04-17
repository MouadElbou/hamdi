'use client';

import React, { useState } from 'react';
import {
  PhoneIcon,
  MapPinIcon,
} from '@/components/icons';

const CONTACT_METHODS = [
  {
    Icon: PhoneIcon,
    title: 'Téléphone',
    lines: ['+212 536 69 03 06'],
    action: { label: 'Appeler maintenant', href: 'tel:+212536690306' },
  },
  {
    Icon: PhoneIcon,
    title: 'WhatsApp',
    lines: ['+212 622 26 50 53', '+212 672 53 29 98'],
    action: { label: 'Envoyer un message', href: 'https://wa.me/212622265053' },
  },
  {
    Icon: MapPinIcon,
    title: 'Adresse',
    lines: ['Souk Mlilia n°914', 'Oujda, Maroc'],
    action: { label: 'Voir sur la carte', href: '#contact-map' },
  },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const [phoneError, setPhoneError] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitted) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = (data.get('name') as string).trim();
    const phone = (data.get('phone') as string).trim();
    const subject = (data.get('subject') as string) || '';
    const message = (data.get('message') as string).trim();

    // Phone validation: Moroccan format or international
    if (!/^\+?[0-9\s-]{7,15}$/.test(phone)) {
      setPhoneError('Numéro de téléphone invalide');
      return;
    }
    setPhoneError('');

    // Build WhatsApp message
    const text = `Bonjour, je suis ${name}.\nTéléphone: ${phone}\nSujet: ${subject}\n\n${message}`;
    window.open(`https://wa.me/212622265053?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
    form.reset();
    setTimeout(() => setSubmitted(false), 5000);
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="contact-hero">
        <div className="container">
          <span className="contact-eyebrow">Contact</span>
          <h1 className="contact-hero-title">Parlons ensemble</h1>
          <p className="contact-hero-sub">
            Besoin d&apos;un conseil, d&apos;un devis ou d&apos;une information&nbsp;?
            Notre équipe est à votre écoute.
          </p>
        </div>
      </section>

      {/* ── Contact Cards ── */}
      <section className="contact-methods">
        <div className="container">
          <div className="contact-methods-grid">
            {CONTACT_METHODS.map(({ Icon, title, lines, action }) => (
              <div key={title} className="contact-method-card">
                <div className="contact-method-icon" aria-hidden="true">
                  <Icon size={24} />
                </div>
                <h3 className="contact-method-title">{title}</h3>
                {lines.map((line) => (
                  <p key={line} className="contact-method-line">{line}</p>
                ))}
                <a
                  href={action.href}
                  className="contact-method-action"
                  target={action.href.startsWith('http') ? '_blank' : undefined}
                  rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {action.label}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form + Map ── */}
      <section className="contact-form-section">
        <div className="container contact-form-grid">
          <div className="contact-form-wrapper">
            <h2 className="contact-form-title">Envoyez-nous un message</h2>
            <p className="contact-form-sub">
              Remplissez le formulaire ci-dessous et nous vous répondrons via WhatsApp dans les plus brefs délais.
            </p>

            {submitted && (
              <div className="contact-success">
                Votre message a été envoyé avec succès via WhatsApp !
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="contact-field">
                <label htmlFor="contact-name">Nom complet</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Votre nom"
                  autoComplete="name"
                />
              </div>
              <div className="contact-field">
                <label htmlFor="contact-phone">Téléphone</label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  pattern="\+?[0-9\s\-]{7,15}"
                  title="Numéro de téléphone valide (ex: +212 6XX XXX XXX)"
                  placeholder="+212 6XX XXX XXX"
                  autoComplete="tel"
                  onChange={() => phoneError && setPhoneError('')}
                />
                {phoneError && <span style={{ color: 'var(--error)', fontSize: 13 }}>{phoneError}</span>}
              </div>
              <div className="contact-field">
                <label htmlFor="contact-subject">Sujet</label>
                <select id="contact-subject" name="subject" required>
                  <option value="">Sélectionnez un sujet</option>
                  <option value="Demande de prix">Demande de prix</option>
                  <option value="Disponibilité produit">Disponibilité produit</option>
                  <option value="Service après-vente">Service après-vente</option>
                  <option value="Livraison">Livraison</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div className="contact-field contact-field-full">
                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  maxLength={1000}
                  placeholder="Décrivez votre demande..."
                />
              </div>
              <button type="submit" className="contact-submit">
                Envoyer via WhatsApp
              </button>
            </form>
          </div>

          <div className="contact-map-wrapper" id="contact-map">
            <h2 className="contact-form-title">Notre emplacement</h2>
            <p className="contact-form-sub">
              Souk Mlilia n°914, Oujda — Du lundi au samedi, 9h–19h
            </p>
            <div className="contact-map">
              <iframe
                title="Hamdi PC — Souk Mlilia, Oujda"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3281.5!2d-1.9!3d34.68!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sSouk+Mlilia+Oujda!5e0!3m2!1sfr!2sma!4v1"
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: '0.5rem' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Hours ── */}
      <section className="contact-hours">
        <div className="container">
          <h2 className="contact-hours-title">Horaires d&apos;ouverture</h2>
          <div className="contact-hours-grid">
            <div className="contact-hours-row">
              <span>Lundi – Vendredi</span>
              <strong>9h00 – 19h00</strong>
            </div>
            <div className="contact-hours-row">
              <span>Samedi</span>
              <strong>9h00 – 18h00</strong>
            </div>
            <div className="contact-hours-row contact-hours-closed">
              <span>Dimanche</span>
              <strong>Fermé</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
