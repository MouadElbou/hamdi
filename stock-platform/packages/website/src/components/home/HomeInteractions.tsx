'use client';

import { useEffect } from 'react';

/**
 * Wires the home page's vanilla motion: scroll-reveal for `.reveal` elements
 * and count-up for `[data-count]` stats. Mounted once, operates on the DOM.
 */
export function HomeInteractions(): null {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    let counted = false;
    const first = document.querySelector('[data-count]');
    const cio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting && !counted) {
        counted = true;
        document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
          const t = Number(el.dataset.count) || 0;
          const suf = el.querySelector('span')?.outerHTML || '';
          let n = 0;
          const step = Math.max(1, Math.round(t / 38));
          const iv = setInterval(() => { n += step; if (n >= t) { n = t; clearInterval(iv); } el.innerHTML = n + suf; }, 22);
        });
      }
    }), { threshold: 0.4 });
    if (first) cio.observe(first);

    return () => { io.disconnect(); cio.disconnect(); };
  }, []);
  return null;
}
