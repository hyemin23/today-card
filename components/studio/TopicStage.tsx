'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  const resultsHeadRef = useRef<HTMLHeadingElement>(null);
  const inputId = useId();

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (reveal.current) clearTimeout(reveal.current);
  }, []);

  // move focus to the results heading once a crawl completes (SR + keyboard context)
  useEffect(() => {
    if (results && resultsHeadRef.current) resultsHeadRef.current.focus();
  }, [results]);

  const scope = tags.length ? tags.join(' · ') : topic || '전체';
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

    const q = topic || tags[0] || '';
    const cat = tags.find((t) => CATEGORIES.includes(t));
    let fetched: Article[] | null = null;
    const qs = `q=${encodeURIComponent(q)}${cat ? `&category=${encodeURIComponent(cat)}` : ''}`;
    const fetchPromise = fetch(`/api/search?${qs}`)
      .then((r) => r.json())
      .then((d) => (d.items as Article[]) || [])
      .catch(() => [] as Article[])
      .then((items) => { fetched = items; return items; });

    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + Math.random() * 16 + 7);
      setPct(p);
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
        <h1 id="stage1-head" tabIndex={-1}>어떤 주제로 만들까요?</h1>
        <p>주제를 입력하거나 태그를 골라 ‘뉴스 크롤링’을 누르면 관련 기사를 모아와요.</p>
      </div>

      <div className="composer">
        <form className="topicfield" onSubmit={runCrawl}>
          <label htmlFor={inputId} className="sr-only">카드뉴스로 만들 주제</label>
          <span className="mg" aria-hidden="true">⌕</span>
          <input
            id={inputId}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            autoComplete="off"
            placeholder="주제를 직접 입력 — 예: 기준금리, K-팝 컴백, 서울 전시"
          />
          <button className="btn btn--dark" type="submit" style={{ padding: '13px 22px' }} disabled={crawling}>
            뉴스 크롤링 <span className="ar" aria-hidden="true">→</span>
          </button>
        </form>

        {tags.length > 0 && (
          <ul className="seltags" aria-label="선택한 태그">
            {tags.map((t) => (
              <li className="seltag" key={t}>
                {t}
                <button type="button" aria-label={`${t} 태그 제거`} onClick={() => toggleTag(t)}>✕</button>
              </li>
            ))}
          </ul>
        )}

        <div className="picker">
          <div className="picker__row" role="group" aria-label="카테고리 — 분야 좁히기">
            <div className="picker__lb" aria-hidden="true">카테고리 — 분야 좁히기</div>
            <div className="tagcloud">
              {CATEGORIES.map((c) => (
                <button type="button" key={c} className={`ptag ${tags.includes(c) ? 'on' : ''}`} aria-pressed={tags.includes(c)} onClick={() => toggleTag(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="picker__row" role="group" aria-label="추천 태그 — 눌러서 추가">
            <div className="picker__lb" aria-hidden="true">추천 태그 — 눌러서 추가</div>
            <div className="tagcloud">
              {KEYWORDS.map((c) => (
                <button type="button" key={c} className={`ptag kw ${tags.includes(c) ? 'on' : ''}`} aria-pressed={tags.includes(c)} onClick={() => toggleTag(c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {crawling && (
        <div className="crawl show">
          {/* only the stable headline is announced; the % and live count would
              otherwise re-announce every 170ms and spam the screen reader */}
          <div className="crawl__head" role="status" aria-live="polite"><span className="spin" aria-hidden="true" /> <span>‘{crawlTopic}’ 관련 기사를 모으는 중…</span></div>
          <div
            className="crawl__bar"
            role="progressbar"
            aria-label="수집 진행률"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="crawl__srcs" aria-hidden="true">
            {CRAWL_SOURCES.map((s, i) => (
              <span key={s} className={`crawl__src ${i < hitN ? 'hit' : ''}`}>{s}</span>
            ))}
          </div>
          <div className="crawl__count" aria-hidden="true">수집된 기사 {count}건</div>
        </div>
      )}

      {results && (
        <div className="results">
          <div className="resbar">
            <h2 id="results-head" ref={resultsHeadRef} tabIndex={-1}>모아온 기사 <b>{results.length}</b>건 · <span style={{ color: 'var(--ink-3)' }}>{scope}</span></h2>
            <div className="sort" aria-hidden="true"><span className="on">최신순</span><span>관련도순</span></div>
          </div>
          {results.length === 0 ? (
            <p style={{ padding: '28px 4px', color: 'var(--ink-2)', fontSize: 14 }}>
              관련 기사를 찾지 못했어요. 다른 주제나 태그로 다시 시도해 보세요.
            </p>
          ) : (
            <ul className="arts" aria-label={`${scope} 관련 기사 ${results.length}건 — 누르면 카드뉴스를 생성합니다`}>
              {results.map((a, i) => (
                <li key={i} style={{ display: 'contents' }}>
                  <button type="button" className="art" onClick={() => onPick(a)} aria-label={`${a.title} — ${a.source}. 이 기사로 카드뉴스 만들기`}>
                    {a.thumb && (
                      <span className="art__thumb" aria-hidden="true">
                        <img src={a.thumb} alt="" loading="lazy" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                      </span>
                    )}
                    <span className="art__body">
                      <span className="art__top"><span className="art__cat">{a.category}</span><span className="art__date">{a.date}</span></span>
                      <span className="art__title">{a.title}</span>
                      {a.summary && <span className="art__sum">{a.summary}</span>}
                      <span className="art__foot">
                        <span className="art__src">출처 · <b>{a.source}</b></span>
                        <span className="art__make" aria-hidden="true">이 기사로 만들기 →</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
