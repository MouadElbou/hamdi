'use client';

import React, { useRef } from 'react';
import { useCountUp, useStaggerReveal } from '@/lib/anime-utils';

const STATS = [
  { target: 25, suffix: '+', label: 'Années d\'expérience', detail: 'Depuis 1997 à Oujda' },
  { target: 100, suffix: '%', label: 'Produits authentiques', detail: 'Garantie constructeur' },
  { target: 48, suffix: 'h', label: 'Livraison express', detail: 'Partout au Maroc' },
  { target: 1000, suffix: '+', label: 'Clients satisfaits', detail: 'Oujda & tout le Maroc', format: (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n) },
];

export function WhyChooseUs(): React.JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const numRef0 = useRef<HTMLSpanElement>(null);
  const numRef1 = useRef<HTMLSpanElement>(null);
  const numRef2 = useRef<HTMLSpanElement>(null);
  const numRef3 = useRef<HTMLSpanElement>(null);
  const numRefs = [numRef0, numRef1, numRef2, numRef3];

  useStaggerReveal(barRef, '.stat-block', { translateY: [16, 0], duration: 500 }, { stagger: 100 });
  useCountUp(numRef0, STATS[0]!.target, { suffix: STATS[0]!.suffix });
  useCountUp(numRef1, STATS[1]!.target, { suffix: STATS[1]!.suffix });
  useCountUp(numRef2, STATS[2]!.target, { suffix: STATS[2]!.suffix });
  useCountUp(numRef3, STATS[3]!.target, { suffix: STATS[3]!.suffix, format: STATS[3]!.format });

  return (
    <section className="stats-section">
      <div className="container">
        <div className="stats-bar" ref={barRef}>
          {STATS.map((stat, i) => (
            <div key={stat.label} className="stat-block anime-hidden">
              <span className="stat-number" ref={numRefs[i]}>{stat.format ? stat.format(stat.target) + stat.suffix : `${stat.target}${stat.suffix}`}</span>
              <span className="stat-label">{stat.label}</span>
              <span className="stat-detail">{stat.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
