'use client';

import { useEffect } from 'react';

/**
 * Landing-page motion effects, ported 1:1 from the reference index.html:
 * scroll reveal (+ fail-safe), headline line-lift, 3D card-fan parallax.
 * Mounted once; operates on the DOM rendered by the server component.
 */
export default function LandingFx() {
  useEffect(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('.reveal, [data-stagger]')
    );
    const show = (el: Element) => el.classList.add('in');

    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(
        (es, obs) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              show(e.target);
              obs.unobserve(e.target);
            }
          }),
        { threshold: 0.06, rootMargin: '0px 0px -4% 0px' }
      );
      items.forEach((el) => io!.observe(el));
    } catch {
      items.forEach(show);
    }

    const sweep = () =>
      items.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.98) show(el);
      });
    requestAnimationFrame(sweep);
    window.addEventListener('scroll', sweep, { passive: true });
    const safety = setTimeout(() => items.forEach(show), 1500);

    // headline line-lift
    const lifts = Array.from(document.querySelectorAll<HTMLElement>('.hero h1 .lift'));
    const liftTimers = lifts.map((el, i) =>
      setTimeout(() => el.classList.add('in'), 150 + i * 130)
    );

    // 3D parallax
    const fan = document.getElementById('fan');
    const hero = document.querySelector<HTMLElement>('.hero');
    let raf = 0;
    const canHover =
      window.matchMedia('(hover:hover)').matches &&
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    const onMove = (e: MouseEvent) => {
      if (!fan || !hero) return;
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        fan.style.transform = `rotateY(${px * 14}deg) rotateX(${-py * 12}deg)`;
      });
    };
    const onLeave = () => {
      if (fan) fan.style.transform = 'rotateY(0) rotateX(0)';
    };
    if (canHover && hero) {
      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('mouseleave', onLeave);
    }

    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', sweep);
      clearTimeout(safety);
      liftTimers.forEach(clearTimeout);
      if (hero) {
        hero.removeEventListener('mousemove', onMove);
        hero.removeEventListener('mouseleave', onLeave);
      }
    };
  }, []);

  return null;
}
