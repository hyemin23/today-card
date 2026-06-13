'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Feather } from 'lucide-react';
import { HandWrittenTitle } from '@/components/ui/hand-writing-text';

/** 한 세션에 한 번만 인트로를 보여주기 위한 플래그 키 */
const SEEN_KEY = 'ink-intro-seen';
/** 손글씨 애니메이션(원 그리기 2.5s)이 끝나고 잠깐 머무른 뒤 사라지기까지 */
const HOLD_MS = 2600;

/**
 * 사이트 접속 시 한 번 재생되는 인트로 스플래시.
 * - 손글씨 애니메이션을 보여준 뒤 부드럽게 사라지며 메인페이지로 진입한다.
 * - 같은 세션에서 재방문하면 다시 뜨지 않는다(sessionStorage).
 * - 모션 최소화(prefers-reduced-motion) 사용자는 건너뛴다.
 * - 클릭 / ESC 로 즉시 건너뛸 수 있다.
 */
export default function IntroSplash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduceMotion) return;

    // 관리자 등 내부 화면에서는 인트로를 띄우지 않는다.
    if (window.location.pathname.startsWith('/admin')) return;

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* sessionStorage 접근 불가(프라이빗 모드 등) → 그냥 한 번 보여준다 */
    }
    if (alreadySeen) return;

    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* noop */
    }

    setShow(true);
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => setShow(false), HOLD_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  // 오버레이가 내려가는 순간 스크롤을 바로 복구한다.
  useEffect(() => {
    if (!show) document.body.style.overflow = '';
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro-splash"
          className="fixed inset-0 z-[9999] grid place-items-center bg-background px-6 cursor-pointer"
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          onClick={() => setShow(false)}
          role="presentation"
          aria-hidden="true"
        >
          <HandWrittenTitle
            title="INK."
            subtitle="귀차니즘 연구소"
            icon={<Feather className="size-9 md:size-11" strokeWidth={1.5} />}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
