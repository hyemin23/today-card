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
        <span className="mg">⌕</span>
        <input
          name="q"
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="어떤 주제로 만들까요? 예: 기준금리, K-팝, 서울 전시"
          autoComplete="off"
        />
        <button className="btn btn--dark go" type="submit">
          뉴스 모으기 <span className="ar">→</span>
        </button>
      </div>
    </form>
  );
}
