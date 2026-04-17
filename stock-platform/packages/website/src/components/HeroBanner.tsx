'use client';

import React from 'react';

export function HeroBanner(): React.JSX.Element {
  return (
    <section className="relative h-[870px] flex items-center overflow-hidden bg-surface">
      <div className="max-w-screen-2xl mx-auto px-8 w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="z-10 space-y-8">
          <span className="font-label font-semibold text-primary uppercase tracking-[0.2em]">Performance Nouvelle Generation</span>
          <h1 className="text-6xl md:text-8xl font-black font-headline text-on-surface leading-[0.9] tracking-tighter">
            ELITE <br/>PRECISION <br/><span className="text-primary-container">PRO X1</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-md font-body">
            Concu pour les createurs et professionnels. Decouvrez la precision architecturale de notre station de travail la plus puissante jamais concue.
          </p>
          <div className="pt-4">
            <a
              href="/catalogue"
              className="primary-gradient text-on-primary px-10 py-5 rounded-xl font-headline font-bold text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform inline-block"
            >
              Voir le catalogue
            </a>
          </div>
        </div>
        <div className="relative group">
          <div className="absolute -inset-10 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
          <img
            alt="Premium Laptop"
            className="relative z-10 w-full h-auto transform -rotate-6 group-hover:rotate-0 transition-transform duration-700 drop-shadow-2xl"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsQSdMnk-LC9Y_JGZpPEagJW1hoAvaK0Ng-sBvNxx8f5kCvWaEVTMhoHNt2aihygYO96JiJi3rlzObPPOMG4VhfAO7_mnK2ZHYKIvEvS73ferdAit4beLcpPlVJ3UgDWjzuynqo1GJkV5UhmdZd4KYIzKZUQ0fqm3oJS8heDgbqXGAuTYLlBKt7RJeop8M4fhLxw31f4KCMQX3PXvwpmQn9CU4bdjKqBn0pVSdOrVgR_u4bvOw4Hs6TtqlHqR8GMRWZjQ2ieq5sBU"
          />
        </div>
      </div>
    </section>
  );
}
