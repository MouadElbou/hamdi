'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { CatalogBrowser } from '@/components/CatalogBrowser';

export function CatalogPageWrapper(): React.JSX.Element {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') ?? '';
  const subCategory = searchParams.get('subCategory') ?? '';
  const brand = searchParams.get('brand') ?? '';
  const search = searchParams.get('search') ?? '';

  // Remount on param change: the browser seeds its filter state once, so a
  // mega-menu jump from /catalogue to another category must start it over.
  return (
    <CatalogBrowser
      key={`${category}|${subCategory}|${brand}|${search}`}
      initialCategory={category}
      initialSubCategory={subCategory}
      initialBrand={brand}
      initialSearch={search}
    />
  );
}
