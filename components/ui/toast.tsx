'use client';

import { useEffect, useState } from 'react';

/* 차단형 alert() 대체용 미니 토스트 — 의존성 없음.
   사용: 아무 곳에서나 toast('메시지', 'error') 호출.
   <Toasts />가 마운트되지 않은 화면에서는 alert()로 안전하게 폴백한다. */

type Tone = 'info' | 'error';
interface ToastMsg { id: number; text: string; tone: Tone }

let push: ((text: string, tone: Tone) => void) | null = null;
let seq = 0;

export function toast(text: string, tone: Tone = 'info') {
  if (push) push(text, tone);
  else if (typeof window !== 'undefined') window.alert(text);
}

const TOAST_MS = 4200;

export default function Toasts() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    push = (text, tone) => {
      const id = ++seq;
      setItems((xs) => [...xs.slice(-2), { id, text, tone }]); // 최대 3개 유지
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), TOAST_MS);
    };
    return () => { push = null; };
  }, []);

  if (!items.length) return null;
  return (
    <div className="toasts">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast${t.tone === 'error' ? ' toast--error' : ''}`}
          role={t.tone === 'error' ? 'alert' : 'status'}
          onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
          title="눌러서 닫기"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
