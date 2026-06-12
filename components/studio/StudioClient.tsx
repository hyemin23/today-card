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

/* Work-in-progress survives reload / back-navigation within the tab; the
   magazine branding survives across visits. Both fail soft (private mode). */
const SESSION_KEY = 'ink.studio.v1';
const MAGAZINE_KEY = 'ink.magazine.v1';

interface PersistedSession {
  cards: Card[];
  originalCards: Card[];
  caption: string;
  hashtags: string[];
  source: string;
  stage: number;
  maxReached: number;
  sel: number;
  genFallback: boolean;
  article: Article | null;
}

function loadJSON<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveJSON(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — editing still works, it just won't survive reload */
  }
}

export default function StudioClient() {
  const initialTopic = useSearchParams().get('q') || '';

  const [stage, setStageRaw] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [magazine, setMagazine] = useState<Magazine>(MAGAZINES[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [originalCards, setOriginalCards] = useState<Card[]>([]);
  const [sel, setSel] = useState(0);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [source, setSource] = useState('뉴스');
  const [genFallback, setGenFallback] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [restored, setRestored] = useState(false);

  const uiRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const genTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastArticle = useRef<Article | null>(null);
  const mounted = useRef(false);

  // studio.css ships body{overflow:hidden} — scope it to this route so it
  // doesn't leak to the landing page after a client-side navigation
  useEffect(() => {
    document.body.classList.add('studio-body');
    return () => document.body.classList.remove('studio-body');
  }, []);

  // restore work-in-progress after reload / back-navigation (post-hydration to
  // avoid a server/client markup mismatch), and the saved magazine branding
  useEffect(() => {
    const mag = loadJSON<Magazine>(localStorage, MAGAZINE_KEY);
    if (mag?.id && mag.name) setMagazine(mag);

    const s = loadJSON<PersistedSession>(sessionStorage, SESSION_KEY);
    if (s?.cards?.length) {
      setCards(s.cards);
      setOriginalCards(s.originalCards || []);
      setCaption(s.caption || '');
      setHashtags(s.hashtags || []);
      setSource(s.source || '뉴스');
      setMaxReached(s.maxReached || 3);
      setStageRaw(Math.min(Math.max(s.stage || 2, 1), 3));
      setSel(Math.min(s.sel || 0, s.cards.length - 1));
      setGenFallback(!!s.genFallback);
      lastArticle.current = s.article;
    }
    setRestored(true);
  }, []);

  // persist after every meaningful change (skip until the restore pass ran,
  // so an empty initial state can't clobber a stored session)
  useEffect(() => {
    if (!restored || cards.length === 0) return;
    saveJSON(sessionStorage, SESSION_KEY, {
      cards, originalCards, caption, hashtags, source, stage, maxReached, sel, genFallback,
      article: lastArticle.current,
    } satisfies PersistedSession);
  }, [restored, cards, originalCards, caption, hashtags, source, stage, maxReached, sel, genFallback]);

  useEffect(() => {
    if (restored) saveJSON(localStorage, MAGAZINE_KEY, magazine);
  }, [restored, magazine]);

  // warn before closing the tab mid-generation or with work on screen —
  // sessionStorage survives a reload, but not a closed tab
  useEffect(() => {
    if (!generating && cards.length === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [generating, cards.length]);

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

  // block interaction with everything behind the full-screen generating overlay
  // (topbar included — it sits outside the stage wrap but is equally covered)
  useEffect(() => {
    if (uiRef.current) uiRef.current.inert = generating;
  }, [generating]);

  useEffect(() => () => {
    if (genTimeout.current) clearTimeout(genTimeout.current);
    abortRef.current?.abort();
  }, []);

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

  /** Restore a single card's AI-written copy (text fields only — keeps the user's image/colors). */
  function restoreCard(idx: number) {
    const orig = originalCards[idx];
    if (!orig) return;
    updateCard(idx, { title: orig.title, body: orig.body, hashtags: orig.hashtags, category: orig.category });
  }

  function cancelGenerate() {
    abortRef.current?.abort();
    if (genTimeout.current) clearTimeout(genTimeout.current);
    setGenerating(false);
  }

  async function pickArticle(article: Article, opts?: { force?: boolean }) {
    if (generating) return;
    if (
      !opts?.force &&
      cards.length > 0 &&
      !window.confirm('새 기사로 만들면 지금 편집 중인 카드가 사라져요. 계속할까요?')
    ) return;

    setGenerating(true);
    setSource(article.source);
    lastArticle.current = article;
    const started = Date.now();
    let result: GenerateResult | null = null;
    let error = '';
    let failed = false;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        error = data?.error || '';
        if (!error) failed = true; // 504/HTML error page — no JSON message to show
      } else result = data;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') { setGenerating(false); return; }
      failed = true; // offline / network error → editable fallback below, with a banner
    }

    // rate limit etc. — stay on stage 1 and surface the server message
    if (error) {
      setGenerating(false);
      alert(error);
      return;
    }
    if (!result?.cards?.length) {
      result = fallbackCards(article);
      failed = true;
    }

    // keep the overlay up for a beat so the animation reads
    const wait = Math.max(0, 1900 - (Date.now() - started));
    const final = result;
    const usedFallback = failed;
    genTimeout.current = setTimeout(() => {
      const built = final.cards.map((c, i) => ({
        ...c,
        idx: i,
        category: article.category,
        source: article.source,
      }));
      built[0].title = article.title;
      setCards(built);
      setOriginalCards(built.map((c) => ({ ...c })));
      setCaption(final.caption || '');
      setHashtags(final.hashtags || []);
      setSel(0);
      setGenFallback(usedFallback);
      unlock(2);
      unlock(3);
      setStageRaw(2);
      setGenerating(false);
    }, wait);
  }

  function retryGenerate() {
    if (lastArticle.current) pickArticle(lastArticle.current, { force: true });
  }

  return (
    <div className="studio">
      <a href="#studio-main" className="skip-link">본문으로 건너뛰기</a>
      <div ref={uiRef} style={{ display: 'contents' }}>
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
            {genFallback && cards.length > 0 && (
              <div className="fbnote" role="alert">
                <p><b>AI 생성에 실패해 기본 구성으로 채웠어요.</b> 카드를 직접 다듬거나, 다시 생성해 보세요.</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={retryGenerate}>↻ 다시 생성</button>
              </div>
            )}
            {cards.length > 0 && (
              <EditorStage cards={cards} sel={sel} setSel={setSel} updateCard={updateCard} restoreCard={restoreCard} hasOriginals={originalCards.length > 0} magazine={magazine} onGo={setStage} isAdmin={isAdmin} />
            )}
          </section>
          <section className={`stage-pane ${stage === 3 ? 'is-active' : ''}`} tabIndex={-1} aria-label="3단계: 내보내기" aria-hidden={stage !== 3}>
            {cards.length > 0 && (
              <ExportStage cards={cards} magazine={magazine} caption={caption} hashtags={hashtags} source={source} onGo={setStage} />
            )}
          </section>
        </div>
      </div>

      <GenOverlay show={generating} onCancel={cancelGenerate} />
      <MagazineDrawer open={drawerOpen} current={magazine} onClose={() => setDrawerOpen(false)} onSave={setMagazine} />
    </div>
  );
}
