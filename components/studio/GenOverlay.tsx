'use client';

import { useEffect, useState } from 'react';

const STEPS = ['기사 핵심을 분석하는 중…', '5컷 구성을 짜는 중…', '한국어 카피를 다듬는 중…', '매거진 톤을 입히는 중…'];

export default function GenOverlay({ show }: { show: boolean }) {
  const [msg, setMsg] = useState(STEPS[0]);
  useEffect(() => {
    if (!show) return;
    let k = 0;
    setMsg(STEPS[0]);
    // prototype holds the last message instead of cycling back to the first
    const iv = setInterval(() => { k = Math.min(k + 1, STEPS.length - 1); setMsg(STEPS[k]); }, 460);
    return () => clearInterval(iv);
  }, [show]);

  return (
    <div className={`genover ${show ? 'show' : ''}`}>
      <div className="gcard" />
      <h3>AI가 카드뉴스를 만들고 있어요</h3>
      <p>{msg}</p>
    </div>
  );
}
