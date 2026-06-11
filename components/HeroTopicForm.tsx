'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HeroTopicForm() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const topic = q.trim();
    if (topic) router.push(`/studio?q=${encodeURIComponent(topic)}`);
    else router.push('/studio');
  }

  return (
    <form className="topicbox reveal" onSubmit={onSubmit}>
      <div className="topicfield">
        <label htmlFor="hero-topic" className="sr-only">카드뉴스로 만들 주제</label>
        <span className="mg" aria-hidden="true">⌕</span>
        <input
          id="hero-topic"
          name="q"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="어떤 주제로 만들까요? 예: 기준금리, K-팝, 서울 전시"
          autoComplete="off"
        />
        <button className="btn btn--dark go" type="submit">
          뉴스 모으기 <span className="ar" aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
