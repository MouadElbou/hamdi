'use client';

import { useEffect, useState } from 'react';
import { getApiBase } from '@/lib/api';
import { CATEGORIES } from '@/lib/catalog-taxonomy';

export interface NavSubCategory { name: string; count?: number }
export interface NavCategory {
  key: string;
  category: string;
  count?: number;
  subCategories: NavSubCategory[];
  brands: string[];
  /**
   * True when the entry came from the database. Sub-category names in the
   * static taxonomy are curated labels ("Dalles 15.6\"") that mostly do NOT
   * match the free-typed values products carry ("15.6\""), so a ?subCategory=
   * link built from the fallback would filter to nothing. Consumers must link
   * to the category alone unless this is set.
   */
  live: boolean;
}

const KEY_BY_LABEL = new Map(CATEGORIES.map((c) => [c.label, c.key]));
const ORDER_BY_LABEL = new Map(CATEGORIES.map((c, i) => [c.label, i]));

/** Static taxonomy shape — what renders before (or instead of) the live tree. */
export const FALLBACK_TREE: NavCategory[] = CATEGORIES.map((c) => ({
  key: c.key,
  category: c.label,
  subCategories: c.subCategories.map((name) => ({ name })),
  brands: [],
  live: false,
}));

interface ApiCategory {
  category: string;
  count: number;
  subCategories: Array<{ name: string; count: number }>;
  brands: string[];
}

/** Live categories first in taxonomy order; anything unknown keeps its own slot at the end. */
function normalise(rows: ApiCategory[]): NavCategory[] {
  return rows
    .filter((r) => r.category)
    .map((r) => ({
      key: KEY_BY_LABEL.get(r.category) ?? r.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: r.category,
      count: r.count,
      subCategories: r.subCategories ?? [],
      brands: r.brands ?? [],
      live: true,
    }))
    .sort(
      (a, b) =>
        (ORDER_BY_LABEL.get(a.category) ?? 99) - (ORDER_BY_LABEL.get(b.category) ?? 99) ||
        a.category.localeCompare(b.category, 'fr'),
    );
}

// One fetch per page load, shared by every consumer (header + mobile drawer).
let cached: NavCategory[] | null = null;
let inFlight: Promise<NavCategory[]> | null = null;

function loadNavTree(): Promise<NavCategory[]> {
  if (cached) return Promise.resolve(cached);
  inFlight ??= fetch(`${getApiBase()}/stock/nav`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { tree?: ApiCategory[] }) => {
      const tree = normalise(d.tree ?? []);
      // An empty catalogue is a valid answer and worth caching; a failure is not
      // (the route answers 503), so it drops into the retry-enabling catch.
      cached = tree.length ? tree : FALLBACK_TREE;
      return cached;
    })
    .catch(() => {
      inFlight = null; // uncached: a later mount retries
      return FALLBACK_TREE;
    });
  return inFlight;
}

/** Start the fetch before anything needs it, so the first hover has live data. */
export function prefetchNavTree(): void {
  void loadNavTree();
}

/** Category tree for the nav — live data when the API answers, taxonomy otherwise. */
export function useNavTree(): NavCategory[] {
  const [tree, setTree] = useState<NavCategory[]>(() => cached ?? FALLBACK_TREE);

  useEffect(() => {
    if (cached) { setTree(cached); return; }
    let alive = true;
    void loadNavTree().then((t) => { if (alive) setTree(t); });
    return () => { alive = false; };
  }, []);

  return tree;
}

export const catalogueHref = (category: string, extra?: Record<string, string>): string => {
  const p = new URLSearchParams({ category, ...extra });
  return `/catalogue?${p.toString()}`;
};
