'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/**
 * Landing-page motion, ported from the reference index.html (GSAP + Lenis build).
 *
 * Layered so the page is never dependent on the fancy layer:
 *  - Base (always): section reveals, headline line-lift, sticky process swap,
 *    hero card-fan mouse tilt — pure DOM/IO, survive reduced-motion & no libs.
 *  - Flair (.fx, motion-OK only): scroll progress bar, card-fan parallax.
 *  - Desktop flair (fine pointer): Lenis smooth scroll, marquee velocity skew,
 *    magnetic buttons, blend-mode cursor.
 * Everything is torn down on unmount so smooth-scroll/cursor never leak into /studio.
 */
export default function LandingFx() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fineHover =
      window.matchMedia('(hover:hover)').matches &&
      window.matchMedia('(pointer:fine)').matches;

    /* ---------- section reveals (IO + scroll sweep + hard safety) ---------- */
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
    const sweepRaf = requestAnimationFrame(sweep);
    window.addEventListener('scroll', sweep, { passive: true });
    const safety = window.setTimeout(() => items.forEach(show), 1500);
    cleanups.push(() => {
      io?.disconnect();
      window.removeEventListener('scroll', sweep);
      clearTimeout(safety);
      cancelAnimationFrame(sweepRaf);
    });

    /* ---------- headline line-lift ---------- */
    const lifts = Array.from(document.querySelectorAll<HTMLElement>('.hero h1 .lift'));
    const liftTimers = lifts.map((el, i) =>
      window.setTimeout(() => el.classList.add('in'), 150 + i * 130)
    );
    cleanups.push(() => liftTimers.forEach(clearTimeout));

    /* ---------- process: sticky preview swaps per active step (no library) ---------- */
    const steps = Array.from(document.querySelectorAll<HTMLElement>('[data-step]'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'));
    const numEl = document.querySelector<HTMLElement>('[data-num]');
    const activate = (i: number) => {
      panels.forEach((p, pi) => p.classList.toggle('is-active', pi === i));
      steps.forEach((s, si) => s.classList.toggle('is-active', si === i));
      if (numEl) numEl.textContent = '0' + (i + 1);
    };
    if (steps.length) {
      const procObs = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) activate(steps.indexOf(e.target as HTMLElement));
          }),
        { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
      );
      steps.forEach((s) => procObs.observe(s));
      cleanups.push(() => procObs.disconnect());
    }

    /* ---------- hero card-fan mouse tilt (works without any library) ---------- */
    const fan = document.getElementById('fan');
    const hero = document.querySelector<HTMLElement>('.hero');
    if (!reduce && fineHover && fan && hero) {
      let raf = 0;
      const onMove = (e: MouseEvent) => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          fan.style.transform = `rotateY(${px * 14}deg) rotateX(${-py * 12}deg)`;
        });
      };
      const onLeave = () => {
        fan.style.transform = 'rotateY(0) rotateX(0)';
      };
      fan.style.willChange = 'transform';
      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        hero.removeEventListener('mousemove', onMove);
        hero.removeEventListener('mouseleave', onLeave);
        fan.style.willChange = 'auto';
      });
    }

    /* ---------- GSAP + Lenis additive flair ---------- */
    let lenis: Lenis | null = null;
    let tickerFn: ((t: number) => void) | null = null;
    const ownTriggers: ScrollTrigger[] = [];

    if (!reduce) {
      const html = document.documentElement;
      html.classList.add('fx');
      gsap.registerPlugin(ScrollTrigger);

      /* scroll progress bar — drives off native or smooth scroll alike */
      const bar = document.querySelector<HTMLElement>('.progress');
      if (bar) {
        ownTriggers.push(
          ScrollTrigger.create({
            start: 0,
            end: 'max',
            onUpdate: (s) => {
              bar.style.transform = `scaleX(${s.progress})`;
            },
          })
        );
      }

      /* hero card-fan vertical parallax (transform only — never hides content) */
      if (document.querySelector('.fan-stage')) {
        const st = gsap.to('.fan-stage', {
          yPercent: -10,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        }).scrollTrigger;
        if (st) ownTriggers.push(st);
      }

      /* Desktop-only: Lenis smooth scroll + pointer flair (skip on touch to keep native feel) */
      if (fineHover) {
        lenis = new Lenis({ lerp: 0.135, wheelMultiplier: 1.0, touchMultiplier: 1.6 });
        lenis.on('scroll', () => ScrollTrigger.update());
        tickerFn = (t: number) => lenis!.raf(t * 1000);
        gsap.ticker.add(tickerFn);
        gsap.ticker.lagSmoothing(0);

        /* smooth in-page anchor jumps */
        const anchorOffs = Array.from(
          document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
        ).map((a) => {
          const handler = (e: Event) => {
            const id = a.getAttribute('href') || '';
            if (id.length > 1) {
              const t = document.querySelector(id);
              if (t) {
                e.preventDefault();
                lenis!.scrollTo(t as HTMLElement, { offset: -70 });
              }
            }
          };
          a.addEventListener('click', handler);
          return () => a.removeEventListener('click', handler);
        });
        cleanups.push(() => anchorOffs.forEach((off) => off()));

        /* category marquee — velocity-reactive skew (one reusable tween) */
        const cats = document.querySelector<HTMLElement>('.cats');
        if (cats) {
          const clampSkew = gsap.utils.clamp(-3, 3);
          const skewTo = gsap.quickTo(cats, 'skewX', { duration: 0.5, ease: 'power3' });
          lenis.on('scroll', () => skewTo(clampSkew((lenis!.velocity || 0) * 0.14)));
        }

        /* magnetic buttons */
        document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
          const qx = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
          const qy = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
          const onMove = (e: MouseEvent) => {
            const r = btn.getBoundingClientRect();
            qx((e.clientX - r.left - r.width / 2) * 0.3);
            qy((e.clientY - r.top - r.height / 2) * 0.45);
          };
          const onLeave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,.4)' });
          btn.addEventListener('mousemove', onMove);
          btn.addEventListener('mouseleave', onLeave);
          cleanups.push(() => {
            btn.removeEventListener('mousemove', onMove);
            btn.removeEventListener('mouseleave', onLeave);
            gsap.set(btn, { x: 0, y: 0 });
          });
        });

        /* blend-mode custom cursor */
        const ring = document.querySelector<HTMLElement>('.cursor');
        const dot = document.querySelector<HTMLElement>('.cursor-dot');
        if (ring && dot) {
          html.classList.add('fx-cursor');
          gsap.set([ring, dot], { xPercent: -50, yPercent: -50 });
          const dx = gsap.quickTo(dot, 'x', { duration: 0.06, ease: 'power2' });
          const dy = gsap.quickTo(dot, 'y', { duration: 0.06, ease: 'power2' });
          const rx = gsap.quickTo(ring, 'x', { duration: 0.22, ease: 'power3' });
          const ry = gsap.quickTo(ring, 'y', { duration: 0.22, ease: 'power3' });
          const onCursor = (e: MouseEvent) => {
            dx(e.clientX);
            dy(e.clientY);
            rx(e.clientX);
            ry(e.clientY);
          };
          window.addEventListener('mousemove', onCursor);
          cleanups.push(() => window.removeEventListener('mousemove', onCursor));

          const bigOffs = Array.from(
            document.querySelectorAll<HTMLElement>('a, button, input, .htag, .trio__c')
          ).map((el) => {
            const enter = () => ring.classList.add('big');
            const leave = () => ring.classList.remove('big');
            el.addEventListener('mouseenter', enter);
            el.addEventListener('mouseleave', leave);
            return () => {
              el.removeEventListener('mouseenter', enter);
              el.removeEventListener('mouseleave', leave);
            };
          });
          cleanups.push(() => bigOffs.forEach((off) => off()));
        }
      }

      const onLoad = () => ScrollTrigger.refresh();
      if (document.readyState !== 'complete') window.addEventListener('load', onLoad);
      const refreshT = window.setTimeout(() => ScrollTrigger.refresh(), 800);
      cleanups.push(() => {
        window.removeEventListener('load', onLoad);
        clearTimeout(refreshT);
      });

      ScrollTrigger.refresh();
    }

    /* ---------- teardown ---------- */
    return () => {
      cleanups.forEach((fn) => fn());
      ownTriggers.forEach((t) => t.kill());
      if (tickerFn) {
        gsap.ticker.remove(tickerFn);
        gsap.ticker.lagSmoothing(500, 33);
      }
      lenis?.destroy();
      const html = document.documentElement;
      html.classList.remove('fx', 'fx-cursor');
    };
  }, []);

  return null;
}
