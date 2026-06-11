'use client';

import { useEffect, useRef, useState } from 'react';
import type { Article } from '@/types/db';
import { CATEGORIES, KEYWORDS, CRAWL_SOURCES } from './data';

export default function TopicStage({
  initialTopic,
  onPick,
}: {
  initialTopic: string;
  onPick: (a: Article) => void;
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [tags, setTags] = useState<string[]>([]);
  const [crawling, setCrawling] = useState(false);
  const [pct, setPct] = useState(0);
  const [count, setCount] = useState(0);
  const [results, setResults] = useState<Article[] | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reveal = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (reveal.current) clearTimeout(reveal.current);
  }, []);

  const scope = tags.length ? tags.join(' · ') : topic || '전체';
  // prototype crawl headline prefers the typed topic, then the first tag
  const crawlTopic = topic || tags[0] || '전체';

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function runCrawl(e?: React.FormEvent) {
    e?.preventDefault();
    if (crawling) return;
    setResults(null);
    setCrawling(true);
    setPct(0);
    setCount(0);

    // kick off the real fetch in parallel with the progress animation
    const q = topic || tags[0] || '';
    let fetched: Article[] | null = null;
    const fetchPromise = fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => (d.items as Article[]) || [])
      .catch(() => [] as Article[])
      .then((items) => { fetched = items; return items; });

    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + Math.random() * 16 + 7);
      setPct(p);
      // count toward the real total once the fetch has resolved
      setCount(Math.round((p / 100) * (fetched ? fetched.length : 24)));
      if (p >= 100) {
        clearInterval(iv);
        timer.current = null;
        fetchPromise.then((items) => {
          setCount(items.length);
          reveal.current = setTimeout(() => {
            setResults(items);
            setCrawling(false);
          }, 300);
        });
      }
    }, 170);
    timer.current = iv;
  }

  const hitN = Math.round((pct / 100) * CRAWL_SOURCES.length);

  return (
    <div className="topic">
      <div className="topic__head">
        <span className="kicker">Step 1 · Topic</span>
        <h1>어떤 주제로 만들까요?</h1>
        <p>주제를 입력하거나 태그를 골라 ‘뉴스 크롤링’을 누르면 관련 기사를 모아와요.</p>
      </div>

      <div className="composer">
        <form className="topicfield" onSubmit={runCrawl}>
          <span className="mg">⌕</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            autoComplete="off"
            placeholder="주제를 직접 입력 — 예: 기준금리, K-팝 컴백, 서울 전시"
          />
          <button className="btn btn--dark" type="submit" style={{ padding: '13px 22px' }}>
            뉴스 크롤링 <span className="ar">→</span>
          </button>
        </form>

        {tags.length > 0 && (
          <div className="seltags">
            {tags.map((t) => (
              <span className="seltag" key={t}>
                {t} <b onClick={() => toggleTag(t)}>✕</b>
              </span>
            ))}
          </div>
        )}

        <div className="picker">
          <div className="picker__row">
            <div className="picker__lb">카테고리 — 분야 좁히기</div>
            <div className="tagcloud">
              {CATEGORIES.map((c) => (
                <span key={c} className={`ptag ${tags.includes(c) ? 'on' : ''}`} onClick={() => toggleTag(c)}>{c}</span>
              ))}
            </div>
          </div>
          <div className="picker__row">
            <div className="picker__lb">추천 태그 — 눌러서 추가</div>
            <div className="tagcloud">
              {KEYWORDS.map((c) => (
                <span key={c} className={`ptag kw ${tags.includes(c) ? 'on' : ''}`} onClick={() => toggleTag(c)}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {crawling && (
        <div className="crawl show">
          <div className="crawl__head"><span className="spin" /> <span>‘{crawlTopic}’ 관련 기사를 모으는 중…</span></div>
          <div className="crawl__bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="crawl__srcs">
            {CRAWL_SOURCES.map((s, i) => (
              <span key={s} className={`crawl__src ${i < hitN ? 'hit' : ''}`}>{s}</span>
            ))}
          </div>
          <div className="crawl__count">수집된 기사 {count}건</div>
        </div>
      )}

      {results && (
        <div className="results">
          <div className="resbar">
            <h2>모아온 기사 <b>{results.length}</b>건 · <span style={{ color: 'var(--ink-3)' }}>{scope}</span></h2>
            <div className="sort"><span className="on">최신순</span><span>관련도순</span></div>
          </div>
          {results.length === 0 && (
            <p style={{ padding: '28px 4px', color: 'var(--ink-2)', fontSize: 14 }}>
              관련 기사를 찾지 못했어요. 다른 주제나 태그로 다시 시도해 보세요.
            </p>
          )}
          <div className="arts">
            {results.map((a, i) => (
              <div className="art" key={i} onClick={() => onPick(a)}>
                <div className="art__top"><span className="art__cat">{a.category}</span><span className="art__date">{a.date}</span></div>
                <h3 className="art__title">{a.title}</h3>
                <p className="art__sum">{a.summary}</p>
                <div className="art__foot">
                  <span className="art__src">출처 · <b>{a.source}</b></span>
                  <span className="art__make">이 기사로 만들기 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
