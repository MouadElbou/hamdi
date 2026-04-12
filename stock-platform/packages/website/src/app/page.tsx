import React from 'react';
import { HeroBanner } from '@/components/HeroBanner';
import { CategoryStrip } from '@/components/CategoryGrid';
import { ServiceFeatures } from '@/components/ServiceFeatures';
import { BrandBar } from '@/components/BrandBar';
import { ShowcaseGrid } from '@/components/ShowcaseGrid';
import { PromoBannerSection } from '@/components/PromoBannerSection';
import { WhyChooseUs } from '@/components/WhyChooseUs';
import { CTASection } from '@/components/CTASection';

export default function HomePage() {
  return (
    <>
      <HeroBanner />

      <CategoryStrip />

      {/* ── Showcase: Featured Products ── */}
      <ShowcaseGrid />

      {/* ── Promo Banner ── */}
      <PromoBannerSection />

      {/* ── Why Choose Us ── */}
      <WhyChooseUs />

      {/* ── CTA to Catalogue ── */}
      <CTASection />

      <BrandBar />

      <ServiceFeatures />
    </>
  );
}
