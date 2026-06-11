'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Article, Card, GenerateResult, Magazine } from '@/types/db';
import { MAGAZINES } from './data';
import Topbar from './Topbar';
import TopicStage from './TopicStage';
import EditorStage from './EditorStage';
import ExportStage from './ExportStage';
import MagazineDrawer from './MagazineDrawer';
import GenOverlay from './GenOverlay';

/** Client-side fallback so the flow never lands on an empty editor (network failure etc.). */
function fallbackCards(article: Article): GenerateResult {
  const base = { imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' };
  return {
    cards: [
      { ...base, idx: 0, kind: 'cover', title: article.title },
      { ...base, idx: 1, kind: 'body', title: '핵심 한 줄', body: article.summary.split('. ')[0] || article.summary, textColor: '#111110' },
      { ...base, idx: 2, kind: 'body', title: '무슨 일이', body: article.summary, textColor: '#111110' },
      { ...base, idx: 3, kind: 'body', title: '왜 중요한가', body: '자세한 내용은 기사 원문에서 확인할 수 있어요.', textColor: '#111110' },
      { ...base, idx: 4, kind: 'cta', title: '팔로우하고 더 보기' },
    ],
    caption: `${article.summary} 오늘의 한 장면, INK.에서 정리했어요. ✦`,
    hashtags: ['#카드뉴스', '#오늘의이슈', '#INK매거진', '#뉴스요약'],
  };
}

export default function StudioClient() {
  const initialTopic = useSearchParams().get('q') || '';

  const [stage, setStageRaw] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [magazine, setMagazine] = useState<Magazine>(MAGAZINES[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [sel, setSel] = useState(0);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [source, setSource] = useState('뉴스');
  const [isAdmin, setIsAdmin] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const genTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  // studio.css ships body{overflow:hidden} — scope it to this route so it
  // doesn't leak to the landing page after a client-side navigation
  useEffect(() => {
    document.body.classList.add('studio-body');
    return () => document.body.classList.remove('studio-body');
  }, []);

  // anonymous session so per-user saves / rate limiting work when Supabase is configured
  // (dynamic import keeps supabase-js out of the initial bundle — unused without env keys)
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    import('@/lib/supabase/client').then(({ getBrowserSupabase }) => {
      const supa = getBrowserSupabase();
      if (!supa) return;
      supa.auth.getSession().then(({ data }) => {
        if (!data.session) supa.auth.signInAnonymously().catch(() => {});
      });
    });
  }, []);

  // prototype resets scroll on every stage switch (studio.js setStage);
  // also move focus to the newly active pane so SR/keyboard users get context.
  useEffect(() => {
    window.scrollTo(0, 0);
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.scrollTop = 0;
    wrap.querySelectorAll<HTMLElement>('.stage-pane').forEach((p) => { p.scrollTop = 0; });
    // skip the initial mount so first load doesn't yank focus off the skip link
    if (!mounted.current) { mounted.current = true; return; }
    const active = wrap.querySelector<HTMLElement>('.stage-pane.is-active');
    active?.focus({ preventScroll: true });
  }, [stage]);

  // block interaction with the stages behind the full-screen generating overlay
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.inert = generating;
  }, [generating]);

  useEffect(() => () => { if (genTimeout.current) clearTimeout(genTimeout.current); }, []);

  // admin mode is carried by the httpOnly session cookie (set at /admin login).
  // Ask the server whether this browser is logged in to decide on showing the
  // AI image button; the API re-verifies the cookie on every call regardless.
  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.admin))
      .catch(() => {});
  }, []);

  function setStage(n: number) {
    if (n > maxReached) return;
    setStageRaw(n);
  }
  function unlock(n: number) {
    setMaxReached((m) => Math.max(m, n));
  }

  function updateCard(idx: number, patch: Partial<Card>) {
    setCards((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function pickArticle(article: Article) {
    if (generating) return;
    setGenerating(true);
    setSource(article.source);
    const started = Date.now();
    let result: GenerateResult | null = null;
    let error = '';
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
      });
      const data = await res.json();
      if (!res.ok) error = data?.error || '';
      else result = data;
    } catch {
      // offline / network error → editable fallback below
    }

    // rate limit etc. — stay on stage 1 and surface the server message
    if (error) {
      setGenerating(false);
      alert(error);
      return;
    }
    if (!result?.cards?.length) result = fallbackCards(article);

    // keep the overlay up for a beat so the animation reads
    const wait = Math.max(0, 1900 - (Date.now() - started));
    const final = result;
    genTimeout.current = setTimeout(() => {
      const built = final.cards.map((c, i) => ({
        ...c,
        idx: i,
        category: article.category,
        source: article.source,
      }));
      built[0].title = article.title;
      setCards(built);
      setCaption(final.caption || '');
      setHashtags(final.hashtags || []);
      setSel(0);
      unlock(2);
      unlock(3);
      setStageRaw(2);
      setGenerating(false);
    }, wait);
  }

  return (
    <div className="studio">
      <a href="#studio-main" className="skip-link">본문으로 건너뛰기</a>
      <Topbar
        stage={stage}
        maxReached={maxReached}
        onGo={setStage}
        magazine={magazine}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="stagewrap" id="studio-main" role="main" ref={wrapRef}>
        <section className={`stage-pane ${stage === 1 ? 'is-active' : ''}`} tabIndex={-1} aria-label="1단계: 주제" aria-hidden={stage !== 1}>
          <TopicStage initialTopic={initialTopic} onPick={pickArticle} />
        </section>
        <section className={`stage-pane ${stage === 2 ? 'is-active' : ''}`} tabIndex={-1} aria-label="2단계: 편집" aria-hidden={stage !== 2}>
          {cards.length > 0 && (
            <EditorStage cards={cards} sel={sel} setSel={setSel} updateCard={updateCard} magazine={magazine} onGo={setStage} isAdmin={isAdmin} />
          )}
        </section>
        <section className={`stage-pane ${stage === 3 ? 'is-active' : ''}`} tabIndex={-1} aria-label="3단계: 내보내기" aria-hidden={stage !== 3}>
          {cards.length > 0 && (
            <ExportStage cards={cards} magazine={magazine} caption={caption} hashtags={hashtags} source={source} onGo={setStage} />
          )}
        </section>
      </div>

      <GenOverlay show={generating} />
      <MagazineDrawer open={drawerOpen} current={magazine} onClose={() => setDrawerOpen(false)} onSave={setMagazine} />
    </div>
  );
}
