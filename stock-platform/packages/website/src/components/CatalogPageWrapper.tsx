'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { CatalogBrowser } from '@/components/CatalogBrowser';

export function CatalogPageWrapper(): React.JSX.Element {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') ?? '';

  return <CatalogBrowser initialCategory={category} />;
}
