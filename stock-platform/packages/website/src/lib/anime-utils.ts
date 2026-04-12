'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Lightweight scroll-triggered stagger reveal using IntersectionObserver + CSS.
 * Elements matching `selector` inside `containerRef` start with class `anime-hidden`
 * and get `anime-visible` added sequentially when the container enters the viewport.
 */
export function useStaggerReveal(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  _animProps: Record<string, unknown> = {},
  opts: { stagger?: number } = {},
) {
  const stagger = opts.stagger ?? 60;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const children = container.querySelectorAll(selector);
            children.forEach((child, i) => {
              setTimeout(() => {
                child.classList.remove('anime-hidden');
                child.classList.add('anime-visible');
              }, i * stagger);
            });
            observer.unobserve(container);
          }
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, selector, stagger]);
}

/**
 * Lightweight count-up animation triggered by IntersectionObserver.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  target: number,
  opts: { suffix?: string; duration?: number; format?: (n: number) => string } = {},
) {
  const { suffix = '', duration = 1200, format } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(el, target, suffix, duration, format);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, target, suffix, duration, format]);
}

function animate(
  el: HTMLElement,
  target: number,
  suffix: string,
  duration: number,
  format?: (n: number) => string,
) {
  const start = performance.now();

  function step(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = (format ? format(current) : String(current)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
