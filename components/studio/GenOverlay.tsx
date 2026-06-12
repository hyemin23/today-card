'use client';

import { useEffect, useRef, useState } from 'react';

// real generation takes 10–15s (article crawl + LLM), so the copy paces to
// match instead of burning through all four lines in under two seconds
const STEPS = ['기사 핵심을 분석하는 중…', '5컷 구성을 짜는 중…', '한국어 카피를 다듬는 중…', '매거진 톤을 입히는 중…'];
const STEP_MS = 3200;

export default function GenOverlay({ show, onCancel }: { show: boolean; onCancel?: () => void }) {
  const [msg, setMsg] = useState(STEPS[0]);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!show) return;
    let k = 0;
    setMsg(STEPS[0]);
    // the UI behind the overlay goes inert — give SR/keyboard users the context immediately
    headRef.current?.focus();
    // prototype holds the last message instead of cycling back to the first
    const iv = setInterval(() => { k = Math.min(k + 1, STEPS.length - 1); setMsg(STEPS[k]); }, STEP_MS);
    return () => clearInterval(iv);
  }, [show]);

  return (
    <div className={`genover ${show ? 'show' : ''}`} role="status" aria-live="polite" aria-hidden={!show}>
      <div className="gcard" aria-hidden="true" />
      <h3 ref={headRef} tabIndex={-1}>AI가 카드뉴스를 만들고 있어요</h3>
      <p>{msg}</p>
      <p className="genover__eta">보통 10~15초 정도 걸려요</p>
      {onCancel && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          취소하고 돌아가기
        </button>
      )}
    </div>
  );
}
