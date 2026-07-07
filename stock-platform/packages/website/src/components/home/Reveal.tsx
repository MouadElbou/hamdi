'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper. Adds `.in` to a `.reveal-group` once it enters the
 * viewport; children marked `.reveal-item` (with an optional `--i` index) then
 * stagger in. One observer per group.
 */
export function Reveal({ children, className = '', style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-group ${seen ? 'in' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}
