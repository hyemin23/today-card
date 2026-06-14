'use client';

import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

/**
 * Lazy-loaded Spline 3D scene. The heavy @splinetool runtime is code-split and
 * only fetched when this component actually mounts — callers should gate the
 * mount behind in-view / motion-OK to keep it off the critical path.
 */
export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div
            role="status"
            aria-label="3D 씬 불러오는 중"
            className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
          />
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}
