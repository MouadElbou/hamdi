'use client';

import React from 'react';
import { useCart } from '@/lib/cart';

const PRODUCT_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA57OODCL4L3FTpse15bPqQmDkb_Ltmck95vcSytgFWSmZbNT9xbOsTJ-8a_xA8jsfKdSwM6yJZr0YnPRNg4qUit9k56ifgC5WpQ_XoZfpJTvqHN_kP-4rZ_kvAkCNUTrqsEf1gg1gi3SJ66UQ-mMGwoF7Q0pSaTPs86bP1HVRgiPda-LfOF4QR6gQSsHeowq1uwmQcTdvQnpp9TwA48KCTj-LrMP0GmiZq5FGgIy0aTN1tJECAgPNL2Kh_p0Z5mnw-SMjjc070yPA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD7fmrhpXXa8mGwOPoc1db9asX36JucoNC1Ajcnw1y_lbQtiPVQZ0R0yK19ltQDuwDf0-2zGq__RAK6JfcDUmGhU0NzR27LX9xV1okDROkOlL36MZDwraiM87B0h1aRHdmI4h3VYmwccXtEpx76LOYj1X9dq8fAIKB2YCKHWGMAGn1lqN1poy_TWCG9n9mQDDCjnOV7GH9EupYouQhFfjzqrI9U2oEzoG1im26TOYx6uFJXd5vP_f4FC7NxWafWXV84zOuPRmuaq6w',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAtbHbKYC0fEoj9ak5HDmRIywOJqNZHW3_XDjBHQlcqaKj20IJ5S_aTITrNm64XMMAGE19TovXPsSg0gFaTfUFPpxloqgP7uk4Zke531UzNLCx4_aeUQNVjb8DYJZCi9vtgHc9pffpObrwLeCRzhO6AHLuoS-68m6THQPu2B9xWb2qh_Jvs8a8xM1RnNOhLZF9fFbNu1oNvZDjdnMRdmTE77HOTKtXh5fDOjK8QU08DOeTgpn4lu0WSebpG1mRDtTPF1QIFlOyiN4o',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBjGlFOTG1L7rsAC03id6Aqyl4Gg1UZRbykXy_65sc25TAr_qvLUZzhl6EJPK2rpvun60uUvrkVn9pja9kjF8C0rzQ_VseSgg7CdK0LU74RqS6zMkU7Zxd2cYDm-Em47vCUdWA8Mwgx2XgJ2MpyZZ4BnjnCrpoueCxgCHyu9zUYZ7H9JAMJvfJJakhyMTHksCovrelmilowsiU9VQ8bpzmA3hsBfN6CVf-H3tPnJAgRJjPUEI0C0-AxB4XHMA1jAtHfXJzJrcsZuok',
];

/** Simple hash of a string to a positive integer */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Pick a deterministic tech product image from the lotId */
function getProductImage(lotId: string): string {
  return PRODUCT_IMAGES[hashString(lotId) % PRODUCT_IMAGES.length] ?? PRODUCT_IMAGES[0]!;
}

/**
 * Derive a deterministic discount percentage (10-35%) from the lotId.
 * Uses a simple hash so the same lotId always produces the same discount.
 */
function getDiscountPercent(lotId: string): number {
  return 10 + (hashString(lotId) % 26);
}

interface ProductCardProps {
  lotId: string;
  designation: string;
  category: string;
  remainingQuantity: number;
  targetResalePrice: number | null;
  supplier: string;
}

export function ProductCard({
  lotId,
  designation,
  category,
  remainingQuantity,
  targetResalePrice,
}: ProductCardProps): React.JSX.Element {
  const { addItem } = useCart();

  const discount = getDiscountPercent(lotId);

  const formatPrice = (centimes: number) =>
    `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;

  // Calculate the "old" price from the current price and discount
  const oldPrice =
    targetResalePrice != null
      ? Math.round(targetResalePrice / (1 - discount / 100))
      : null;

  return (
    <div className="group">
      {/* Image area: ghost border, square, surface-container-low bg */}
      <div className="relative aspect-square bg-surface-container-low rounded-xl overflow-hidden mb-6 ghost-border p-8 flex items-center justify-center">
        {/* Discount badge */}
        <span className="absolute top-3 left-3 z-20 bg-error text-on-error text-xs font-bold px-2 py-1 rounded-lg">
          -{discount}%
        </span>

        {/* Stock badge */}
        {remainingQuantity <= 3 && (
          <span className="absolute top-3 right-3 z-20 bg-error/10 text-error text-xs font-bold px-2 py-1 rounded-lg font-label">
            {remainingQuantity} restant(s)
          </span>
        )}

        <img
          src={getProductImage(lotId)}
          alt={designation}
          loading="lazy"
          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Glassmorphism overlay on hover */}
        <div className="absolute inset-0 bg-on-surface/40 glass-effect opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button className="bg-white text-primary px-6 py-3 rounded-full font-headline font-bold text-sm">
            Quick View
          </button>
          <button
            className="bg-primary text-on-primary p-3 rounded-full hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              addItem({ lotId, designation, category, price: targetResalePrice });
            }}
            aria-label={`Ajouter ${designation} au panier`}
          >
            <span className="material-symbols-outlined text-base">shopping_cart</span>
          </button>
        </div>
      </div>

      {/* Info below image */}
      <h3 className="font-headline font-bold text-xl text-on-surface tracking-tight line-clamp-2">
        {designation}
      </h3>

      <div className="flex items-baseline gap-3 mt-1">
        {targetResalePrice != null ? (
          <>
            <p className="font-label text-primary font-bold text-lg">{formatPrice(targetResalePrice)}</p>
            {oldPrice != null && (
              <span className="text-on-surface-variant/50 text-sm line-through font-headline">{formatPrice(oldPrice)}</span>
            )}
          </>
        ) : (
          <p className="font-headline text-on-surface-variant font-bold text-lg">Prix sur demande</p>
        )}
      </div>

      {remainingQuantity > 3 && (
        <span className="inline-block mt-2 text-xs font-label text-secondary font-semibold">
          En stock
        </span>
      )}
    </div>
  );
}
