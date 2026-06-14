'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { IconSearch } from '@/components/icons';

export default function HeroTopicForm() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const topic = q.trim();
    if (!topic) {
      setShowHint(true);
      inputRef.current?.focus();
      return;
    }
    router.push(`/studio?q=${encodeURIComponent(topic)}`);
  }

  return (
    <form className="topicbox reveal" onSubmit={onSubmit}>
      <div className="topicfield">
        <label htmlFor="hero-topic" className="sr-only">카드뉴스로 만들 주제</label>
        <span className="mg" aria-hidden="true"><IconSearch /></span>
        <input
          ref={inputRef}
          id="hero-topic"
          name="q"
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (showHint) setShowHint(false);
          }}
          placeholder="어떤 주제로 만들까요? 예: 기준금리, K-팝, 서울 전시"
          autoComplete="off"
        />
        <button className="btn btn--dark go" type="submit" data-magnetic>
          뉴스 모으기 <span className="ar" aria-hidden="true">→</span>
        </button>
      </div>
      <p className="topichint" aria-live="polite">
        {showHint ? '주제를 입력하거나 아래 인기 주제를 눌러보세요' : ''}
      </p>
    </form>
  );
}
