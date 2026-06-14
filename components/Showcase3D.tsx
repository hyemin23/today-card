'use client';

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Spotlight } from '@/components/ui/spotlight';

// three.js / R3F is heavy → code-split and only pulled in when the scene mounts.
const CardScene = lazy(() => import('@/components/ui/card-scene'));

/**
 * Landing "Interactive 3D" showcase band — a dark editorial section housing a
 * monotone floating card-news 3D scene (React Three Fiber) + Spotlight.
 *
 * Performance/A11y:
 *  - The three.js scene mounts ONLY when the stage nears the viewport
 *    (IntersectionObserver) — never on initial load.
 *  - prefers-reduced-motion → the 3D + spotlight are skipped and a lightweight
 *    static orb stands in, so the section is still complete.
 *  - The panel stays dark in both themes via --fill-strong / --on-strong.
 */
export default function Showcase3D() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [motionOk, setMotionOk] = useState(false);
  const [load3d, setLoad3d] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setMotionOk(true);
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setLoad3d(true);
            io.disconnect();
          }
        }),
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const orb = (
    <div className="splite-fallback" aria-hidden="true">
      <span className="splite-orb" />
    </div>
  );

  return (
    <section className="section splite">
      <div className="wrap">
        <div className="splite-card reveal">
          {motionOk && <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />}

          <div className="splite-copy">
            <span className="kicker">Interactive 3D</span>
            <h2>
              주제 한 줄이면,
              <br />
              AI가 움직입니다
            </h2>
            <p>
              기사를 고르는 순간, AI가 표지부터 마무리까지 5컷을 짜 올려요. 마우스를 올려 떠다니는
              카드와 함께 살아 있는 작업 흐름을 만나보세요.
            </p>
            <div className="acts">
              <Link className="splite-btn" href="/studio" data-magnetic>
                스튜디오 열기 <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="splite-stage" ref={stageRef}>
            {load3d ? (
              <Suspense fallback={orb}>
                <CardScene className="splite-spline" />
              </Suspense>
            ) : (
              orb
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
