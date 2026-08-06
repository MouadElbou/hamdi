'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { catIcon } from '@/components/home/cat-icons';
import { useNavTree, catalogueHref, type NavCategory } from './nav-data';

const SERVICES_LABEL = 'Services & Réparation';

function Count({ n }: { n?: number }): React.JSX.Element | null {
  if (!n) return null;
  return <span className="mega-count">{n}</span>;
}

function SubList({ cat, onNavigate }: { cat: NavCategory; onNavigate: () => void }): React.JSX.Element {
  return (
    <ul className="mega-sublist">
      {cat.subCategories.map((s) => (
        <li key={s.name}>
          <Link
            // Taxonomy labels are not the values products are tagged with, so
            // only a live tree may emit a ?subCategory= filter.
            href={cat.live ? catalogueHref(cat.category, { subCategory: s.name }) : catalogueHref(cat.category)}
            className="mega-sublink"
            onClick={onNavigate}
          >
            <span className="mega-sublink-dot" aria-hidden />
            <span className="mega-sublink-text">{s.name}</span>
            <Count n={s.count} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────── CATALOGUE ─────────────────────────── */

export function CataloguePanel({ onNavigate }: { onNavigate: () => void }): React.JSX.Element {
  const tree = useNavTree();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const active = useMemo(
    () => tree.find((c) => c.key === activeKey) ?? tree[0],
    [tree, activeKey],
  );

  if (!active) return <div className="mega-panel" />;

  return (
    <div className="mega-panel mega-panel--split">
      {/* rail — every category, hover to preview */}
      <div className="mega-rail" aria-label="Catégories">
        {tree.map((c) => {
          const on = c.key === active.key;
          return (
            <Link
              key={c.key}
              href={catalogueHref(c.category)}
              aria-current={on ? 'true' : undefined}
              className={`mega-rail-item${on ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveKey(c.key)}
              onFocus={() => setActiveKey(c.key)}
              onClick={onNavigate}
            >
              <span className="mega-rail-icon" aria-hidden>{catIcon(c.key)}</span>
              <span className="mega-rail-label">{c.category}</span>
              <Count n={c.count} />
              <span className="mega-rail-caret" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
              </span>
            </Link>
          );
        })}
      </div>

      {/* detail — swaps under the cursor */}
      <div className="mega-detail" key={active.key}>
        <div className="mega-detail-head">
          <div>
            <span className="mega-eyebrow">Catégorie</span>
            <h3 className="mega-title">{active.category}</h3>
          </div>
          <Link href={catalogueHref(active.category)} className="mega-cta" onClick={onNavigate}>
            {active.count ? `Voir les ${active.count} réf.` : 'Voir tout'}
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M12 5l7 7-7 7" /></svg>
          </Link>
        </div>

        {active.subCategories.length > 0 && <SubList cat={active} onNavigate={onNavigate} />}

        {active.brands.length > 0 && (
          <div className="mega-brands">
            <span className="mega-brands-label">Marques</span>
            <div className="mega-brands-row">
              {active.brands.map((b) => (
                <Link
                  key={b}
                  href={catalogueHref(active.category, { brand: b })}
                  className="mega-chip"
                  onClick={onNavigate}
                >
                  {b}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── RÉPARATION ────────────────────────── */

export function ServicesPanel({ onNavigate }: { onNavigate: () => void }): React.JSX.Element {
  const tree = useNavTree();
  const services = tree.find((c) => c.category === SERVICES_LABEL);

  return (
    <div className="mega-panel mega-panel--single">
      <div className="mega-detail" key={services?.key ?? 'services'}>
        <div className="mega-detail-head">
          <div>
            <span className="mega-eyebrow">Atelier HAMDI</span>
            <h3 className="mega-title">Réparation &amp; Services</h3>
          </div>
          <Link href={catalogueHref(SERVICES_LABEL)} className="mega-cta" onClick={onNavigate}>
            Toutes les prestations
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M12 5l7 7-7 7" /></svg>
          </Link>
        </div>

        {services && services.subCategories.length > 0 && (
          <SubList cat={services} onNavigate={onNavigate} />
        )}

        <p className="mega-note">
          Diagnostic honnête, devis clair avant intervention — vous payez uniquement si c&apos;est réparé.
        </p>
      </div>
    </div>
  );
}
