'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { FlowCard, FlowDeck, FlowInput, FlowRole } from '@/types/db';
import { DEFAULT_FLOW_TONE, MAGAZINES } from '@/components/studio/data';
import { renumberDeck } from '@/lib/flowShared';
import CardFace from '@/components/studio/CardFace';
import ThemeToggle from '@/components/ThemeToggle';

const MAGAZINE = MAGAZINES[0]; // 미리보기용 기본 매거진(INK Daily) — 색·핸들 기준
const RENDER_SIZE = 540; // 4:5 → 1080×1350 (pixelRatio 2)
const RENDER_H = Math.round((RENDER_SIZE * 5) / 4); // 675
const MAX_STEPS = 6; // 총 10장 상한 (card-flow.md §3)

const ROLE_KO: Record<FlowRole, string> = { hook: 'Hook', pain: 'Pain', step: 'Step', result: 'Result', cta: 'CTA' };

const EXAMPLES: FlowInput[] = [
  { topic: '사회초년생 첫 적금 시작하기', target: '막 취업한 20대, 저축 처음', tone: DEFAULT_FLOW_TONE, goal: '오늘 자유적금 1개 개설 + 자동이체 걸기' },
  { topic: '노션으로 가계부 시작하기', target: '가계부를 3일이면 포기하는 직장인', tone: DEFAULT_FLOW_TONE, goal: '오늘 노션 가계부 템플릿 복제하고 첫 기록' },
];

let cachedFontCss: string | null = null;

export default function FlowClient() {
  const [input, setInput] = useState<FlowInput>({ topic: '', target: '', tone: DEFAULT_FLOW_TONE, goal: '' });
  const [deck, setDeck] = useState<FlowDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState(''); // 보조기기 안내(aria-live)
  const renderRef = useRef<HTMLDivElement>(null);

  const setField = (k: keyof FlowInput, v: string) => setInput((s) => ({ ...s, [k]: v }));

  async function generate() {
    if (!input.topic.trim() || loading) return;
    setLoading(true);
    setError('');
    setStatus('카드 구성표를 만드는 중…');
    try {
      const res = await fetch('/api/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '생성에 실패했어요.');
      setDeck(data as FlowDeck);
      setStatus(`카드 ${data?.cards?.length ?? 0}장 구성표를 만들었어요. 확인·수정 후 이미지를 만들 수 있어요.`);
    } catch (e: any) {
      setError(e?.message || '생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  function commitCards(cards: FlowCard[]) {
    const re = renumberDeck(cards);
    setDeck((d) => (d ? { ...d, cards: re, meta: { ...d.meta, total: re.length } } : d));
  }

  function updateCard(idx: number, patch: Partial<FlowCard>) {
    setDeck((d) => (d ? { ...d, cards: d.cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)) } : d));
  }

  function addStep() {
    if (!deck || busy) return;
    if (deck.cards.filter((c) => c.role === 'step').length >= MAX_STEPS) return; // 총 10장 상한
    const cards = [...deck.cards];
    const rIdx = cards.findIndex((c) => c.role === 'result');
    const cIdx = cards.findIndex((c) => c.role === 'cta');
    const at = rIdx >= 0 ? rIdx : cIdx >= 0 ? cIdx : cards.length;
    const blank: FlowCard = { idx: 0, role: 'step', kind: 'body', title: '새 단계', body: '', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' };
    cards.splice(at, 0, blank);
    commitCards(cards);
  }

  function removeCard(idx: number) {
    if (!deck || busy) return;
    const c = deck.cards[idx];
    if (c.role === 'hook' || c.role === 'cta') return; // 표지·CTA는 유지
    commitCards(deck.cards.filter((_, i) => i !== idx));
  }

  async function renderCard(node: HTMLElement): Promise<string> {
    const htmlToImage = await import('html-to-image');
    await document.fonts.ready;
    if (cachedFontCss === null) cachedFontCss = await htmlToImage.getFontEmbedCSS(node);
    return htmlToImage.toPng(node, { pixelRatio: 2, width: RENDER_SIZE, height: RENDER_H, fontEmbedCSS: cachedFontCss });
  }

  async function downloadZip() {
    if (!deck || busy) return;
    const count = deck.cards.length; // 스냅샷: 렌더 중 편집돼도 노드 수와 어긋나지 않게
    setBusy(true);
    setError('');
    setStatus(`PNG ${count}장을 만드는 중…`);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const nodes = renderRef.current?.children;
      if (!nodes || nodes.length !== count) throw new Error('render targets out of sync');
      for (let i = 0; i < count; i++) {
        const dataUrl = await renderCard(nodes[i] as HTMLElement);
        zip.file(`card-${String(i + 1).padStart(2, '0')}.png`, dataUrl.split(',')[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cardnews-${count}컷.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setCopied('zip');
      setStatus(`카드 ${count}장을 ZIP으로 저장했어요.`);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('PNG 내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  function toMarkdown(d: FlowDeck): string {
    const head = '| # | 역할 | 라벨 | 큰 제목 | 짧은 본문 |\n|---|---|---|---|---|';
    const rows = d.cards.map((c) =>
      `| ${c.idx + 1} | ${ROLE_KO[c.role]} | ${c.label || '—'} | ${(c.title || '').replace(/\n/g, '<br>')} | ${(c.body || '—').replace(/\n/g, ' ')} |`
    );
    return [
      `주제: ${d.meta.topic}`,
      `타깃: ${d.meta.target || '—'}`,
      `톤: ${d.meta.tone || '—'}`,
      `최종행동: ${d.meta.goal || '—'}`,
      `총 ${d.cards.length}장`,
      '',
      head,
      ...rows,
    ].join('\n');
  }

  async function copy(kind: 'md' | 'json') {
    if (!deck) return;
    const txt = kind === 'md' ? toMarkdown(deck) : JSON.stringify(deck, null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(kind);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setError('복사에 실패했어요.');
    }
  }

  const n = deck?.cards.length ?? 0;
  const stepCount = deck?.cards.filter((c) => c.role === 'step').length ?? 0;

  return (
    <div className="flow">
      <header className="flow__top">
        <Link className="flow__brand" href="/">INK<span>.</span> <small>자동 흐름</small></Link>
        <div className="flow__topr">
          <Link className="flow__homelink" href="/studio">스튜디오 →</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flow__main">
        <section className="flow__intro">
          <span className="flow__kicker">CARD-FLOW · 자동 카드뉴스</span>
          <h1>주제만 넣으면 <b>카드 구성표</b>부터</h1>
          <p>입력 4개로 <b>Hook → Pain → Steps(단계만큼) → Result → CTA</b> 흐름을 짭니다. 단계 수에 따라 장수가 늘어나요(5~10장).
            <br /><strong>이미지는 구성표를 확인·수정한 뒤에 만듭니다.</strong></p>
        </section>

        {/* 입력 폼 */}
        <section className="flow__form" aria-label="입력">
          <div className="flow__field flow__field--wide">
            <label htmlFor="f-topic">주제 <em>*</em></label>
            <textarea id="f-topic" rows={2} placeholder="카드뉴스로 만들 주제 또는 기사 내용" value={input.topic} onChange={(e) => setField('topic', e.target.value)} />
          </div>
          <div className="flow__field">
            <label htmlFor="f-target">타깃</label>
            <input id="f-target" placeholder="누가 볼까요? (예: 저축 처음인 20대)" value={input.target} onChange={(e) => setField('target', e.target.value)} />
          </div>
          <div className="flow__field">
            <label htmlFor="f-goal">최종행동</label>
            <input id="f-goal" placeholder="보고 나서 할 행동 (예: 오늘 적금 개설)" value={input.goal} onChange={(e) => setField('goal', e.target.value)} />
          </div>
          <div className="flow__field flow__field--wide">
            <label htmlFor="f-tone">톤</label>
            <input id="f-tone" value={input.tone} onChange={(e) => setField('tone', e.target.value)} />
          </div>
          <div className="flow__actions">
            <div className="flow__examples">
              예시:
              {EXAMPLES.map((ex, i) => (
                <button key={i} type="button" className="flow__chip" onClick={() => setInput(ex)}>{ex.topic}</button>
              ))}
            </div>
            <button className="flow__btn flow__btn--primary" onClick={generate} disabled={loading || !input.topic.trim()} aria-busy={loading}>
              {loading ? '◌ 구성표 만드는 중…' : '카드 구성표 만들기'}
            </button>
          </div>
          {error && <p className="flow__error" role="alert">{error}</p>}
        </section>

        {/* 진행/완료 안내 (스크린리더) */}
        <p className="flow__status" role="status" aria-live="polite">{status}</p>

        {!deck && !loading && (
          <section className="flow__empty" aria-hidden="true">
            <div className="flow__emptyicon">📋</div>
            <p><b>주제를 넣고 “카드 구성표 만들기”</b>를 누르면<br />여기에 <b>Hook → Pain → Steps → Result → CTA</b> 카드 구성표가 나와요.</p>
            <p className="flow__emptysub">이미지는 구성표를 확인·수정한 뒤에 만듭니다.</p>
          </section>
        )}

        {deck && (
          <>
            <div className="flow__banner">
              📋 <b>카드 구성표</b> · 총 {n}장 (단계 {deck.cards.filter((c) => c.role === 'step').length}개)
              <span>확인·수정 후 → 이미지(NB2)는 다음 단계</span>
            </div>

            {/* 카드 구성표 (편집 가능) */}
            <section className="flow__table" aria-label="카드 구성표">
              <div className="flow__row flow__row--head" aria-hidden="true">
                <span>#</span><span>역할</span><span>큰 제목</span><span>짧은 본문</span><span></span>
              </div>
              {deck.cards.map((c, i) => (
                <div className={`flow__row flow__row--${c.role}`} key={i}>
                  <span className="flow__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flow__role">
                    <b>{ROLE_KO[c.role]}</b>
                    {c.label && <small>{c.label}</small>}
                    <code>{c.kind}</code>
                  </span>
                  <textarea
                    className="flow__title"
                    rows={2}
                    value={c.title}
                    placeholder="큰 제목"
                    aria-label={`${i + 1}번 ${ROLE_KO[c.role]} 카드 · 큰 제목`}
                    onChange={(e) => updateCard(i, { title: e.target.value })}
                  />
                  <textarea
                    className="flow__body"
                    rows={2}
                    value={c.body || ''}
                    placeholder={c.role === 'hook' ? '(Hook은 본문 없어도 됨)' : '짧은 본문'}
                    aria-label={`${i + 1}번 ${ROLE_KO[c.role]} 카드 · 짧은 본문`}
                    onChange={(e) => updateCard(i, { body: e.target.value })}
                  />
                  <span className="flow__rowact">
                    {c.role !== 'hook' && c.role !== 'cta' && (
                      <button type="button" aria-label={`${i + 1}번 카드 삭제`} onClick={() => removeCard(i)} disabled={busy}>✕</button>
                    )}
                  </span>
                </div>
              ))}
              <div className="flow__tableact">
                <span className="flow__addwrap">
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={addStep} disabled={busy || stepCount >= MAX_STEPS}>＋ 단계 추가</button>
                  {stepCount >= MAX_STEPS && <small className="flow__hint">단계는 최대 {MAX_STEPS}개 (총 10장)</small>}
                </span>
                <div className="flow__copygrp">
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={() => copy('md')}>{copied === 'md' ? '✓ 복사됨' : '표 복사(MD)'}</button>
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={() => copy('json')}>{copied === 'json' ? '✓ 복사됨' : 'JSON 복사'}</button>
                  <button type="button" className="flow__btn flow__btn--primary" onClick={downloadZip} disabled={busy} aria-busy={busy}>{busy ? '◌ 내보내는 중…' : copied === 'zip' ? '✓ 저장됨' : '⤓ PNG ZIP'}</button>
                </div>
              </div>
            </section>

            {/* 라이브 미리보기 */}
            <section className="flow__previewwrap" aria-label="미리보기">
              <h2 className="flow__h2">미리보기 <small>4:5 · 이미지 없이 텍스트 카드</small></h2>
              <div className="flow__rail">
                {deck.cards.map((c, i) => (
                  <figure className="flow__pcard" key={i}>
                    <div className="flow__pcard-inner">
                      <CardFace card={c} magazine={MAGAZINE} ctx="slide" ratio="4:5" total={n} />
                    </div>
                    <figcaption>{String(i + 1).padStart(2, '0')} · {ROLE_KO[c.role]}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* 오프스크린 렌더 타깃 (PNG/ZIP 내보내기용) */}
      {deck && (
        <div ref={renderRef} aria-hidden style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }}>
          {deck.cards.map((c, i) => (
            <div key={i} style={{ position: 'relative', width: RENDER_SIZE, maxWidth: RENDER_SIZE, height: RENDER_H, overflow: 'hidden' }}>
              <CardFace card={c} magazine={MAGAZINE} ctx="canvas" hint={false} ratio="4:5" total={n} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
