'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { Card, FlowCard, FlowDeck, FlowInput, FlowRole } from '@/types/db';
import { DEFAULT_FLOW_TONE, MAGAZINES } from '@/components/studio/data';
import { FLOW_HANDOFF_KEY, type FlowHandoff, renumberDeck } from '@/lib/flowShared';
import CardFace, { stripEmphasis } from '@/components/studio/CardFace';
import { renderCardNode, downloadPngZip } from '@/lib/cardExport';
import { buildImagePrompt, generateCardImage, imagePatch } from '@/lib/imageGen';
import ThemeToggle from '@/components/ThemeToggle';

const STUDIO_SESSION_KEY = 'ink.studio.v1'; // 기존 작업 보호용(StudioClient SESSION_KEY)

const MAGAZINE = MAGAZINES[0]; // 미리보기용 기본 매거진(INK Daily) — 색·핸들 기준
const RENDER_SIZE = 540; // 4:5 → 1080×1350 (pixelRatio 2)
const RENDER_H = Math.round((RENDER_SIZE * 5) / 4); // 675
const MAX_STEPS = 6; // 총 10장 상한 (card-flow.md §3)

const ROLE_KO: Record<FlowRole, string> = { hook: 'Hook', pain: 'Pain', step: 'Step', result: 'Result', cta: 'CTA' };

const STEPS = ['입력', '카드 구성표', '이미지', '내보내기'];
const GEN_STAGES = ['주제를 분석하는 중…', 'Hook → Pain → Steps 흐름을 짜는 중…', '카드 문구를 다듬는 중…', '거의 다 됐어요…'];
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const EXAMPLES: FlowInput[] = [
  { topic: '사회초년생 첫 적금 시작하기', target: '막 취업한 20대, 저축 처음', tone: DEFAULT_FLOW_TONE, goal: '오늘 자유적금 1개 개설 + 자동이체 걸기' },
  { topic: '노션으로 가계부 시작하기', target: '가계부를 3일이면 포기하는 직장인', tone: DEFAULT_FLOW_TONE, goal: '오늘 노션 가계부 템플릿 복제하고 첫 기록' },
];

export default function FlowClient() {
  const router = useRouter();
  const [input, setInput] = useState<FlowInput>({ topic: '', target: '', tone: DEFAULT_FLOW_TONE, goal: '' });
  const [deck, setDeck] = useState<FlowDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState(''); // 보조기기 안내(aria-live)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [imgStyle, setImgStyle] = useState<'trend' | 'editorial'>('trend');
  const [genIdx, setGenIdx] = useState<number | null>(null); // 개별 이미지 생성 중인 카드
  const [batchMsg, setBatchMsg] = useState(''); // 전체 이미지 생성 진행률
  const [genId, setGenId] = useState(0); // 생성 회차 — 결과 입장 애니메이션 재실행 키
  const [genStage, setGenStage] = useState(0); // 생성 중 단계 메시지 인덱스
  const renderRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const imgWorking = genIdx !== null || !!batchMsg;
  const reduce = useReducedMotion();

  // 이미지 생성(NB2)은 관리자 전용 — 버튼 노출 여부 결정
  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d?.admin))
      .catch(() => setIsAdmin(false));
  }, []);

  // 생성 중 단계 메시지를 순차 진행 — ~10초 대기를 가이드처럼 보이게
  useEffect(() => {
    if (!loading) { setGenStage(0); return; }
    const id = setInterval(() => setGenStage((s) => Math.min(s + 1, GEN_STAGES.length - 1)), 2400);
    return () => clearInterval(id);
  }, [loading]);

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
      setGenId((g) => g + 1); // 결과 입장 애니메이션 재실행
      setStatus(`카드 ${data?.cards?.length ?? 0}장 구성표를 만들었어요. 확인·수정 후 이미지를 만들 수 있어요.`);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 120);
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

  async function downloadZip() {
    if (!deck || busy) return;
    const count = deck.cards.length; // 스냅샷: 렌더 중 편집돼도 노드 수와 어긋나지 않게
    setBusy(true);
    setError('');
    setStatus(`PNG ${count}장을 만드는 중…`);
    try {
      const nodes = renderRef.current?.children;
      if (!nodes || nodes.length !== count) throw new Error('render targets out of sync');
      const files: { name: string; dataUrl: string }[] = [];
      for (let i = 0; i < count; i++) {
        const dataUrl = await renderCardNode(nodes[i] as HTMLElement, { width: RENDER_SIZE, height: RENDER_H });
        files.push({ name: `card-${String(i + 1).padStart(2, '0')}.png`, dataUrl });
      }
      await downloadPngZip(files, `cardnews-${count}컷.zip`);
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

  // ── 이미지 생성 (NB2, 관리자 전용 — lib/imageGen 공유) ─────────────────
  async function requestImage(c: FlowCard): Promise<string> {
    return generateCardImage({
      title: buildImagePrompt(c.title, c.body),
      category: deck?.meta.topic?.slice(0, 40) || '카드뉴스',
      style: imgStyle,
    });
  }

  async function genOne(idx: number) {
    if (!deck || !isAdmin || imgWorking) return;
    setGenIdx(idx);
    setError('');
    setStatus(`${idx + 1}번 카드 이미지를 만드는 중…`);
    try {
      const url = await requestImage(deck.cards[idx]);
      updateCard(idx, imagePatch(deck.cards[idx], url));
      setStatus(`${idx + 1}번 카드 이미지를 만들었어요.`);
    } catch (e: any) {
      setError(e?.message || '이미지 생성에 실패했어요.');
      setStatus('');
    } finally {
      setGenIdx(null);
    }
  }

  async function genAll() {
    if (!deck || !isAdmin || imgWorking) return;
    const targets = deck.cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.imageUrl);
    if (!targets.length) {
      setError('이미 모든 카드에 이미지가 있어요. 카드별 “↺ 이미지 제거” 후 다시 시도하세요.');
      return;
    }
    setError('');
    let failed = 0;
    for (let k = 0; k < targets.length; k++) {
      const { c, i } = targets[k];
      setBatchMsg(`이미지 생성 중… ${k + 1}/${targets.length}`);
      setStatus(`이미지 생성 중… ${k + 1}/${targets.length}`);
      try {
        updateCard(i, imagePatch(c, await requestImage(c)));
      } catch {
        failed++;
      }
    }
    setBatchMsg('');
    setStatus(failed ? `완료 — ${failed}장 실패. 다시 시도해 보세요.` : `이미지 ${targets.length}장을 모두 만들었어요.`);
    if (failed) setError(`${failed}장 생성에 실패했어요(관리자 로그인·NB2 권한을 확인하세요).`);
  }

  function clearImage(idx: number) {
    if (!deck || imgWorking) return;
    const c = deck.cards[idx];
    const patch: Partial<FlowCard> = { imageUrl: null };
    if (c.kind === 'body' && c.textColor === '#ffffff') patch.textColor = '#111110'; // 흰 글자 되돌리기
    updateCard(idx, patch);
  }

  // ── 스튜디오 편집기로 보내기 ────────────────────────────────────────────
  function buildCaption(d: FlowDeck): string {
    const clean = (t?: string) => stripEmphasis(t || '').replace(/\n/g, ' ').trim();
    const hook = d.cards.find((c) => c.role === 'hook');
    const points = d.cards
      .filter((c) => c.role === 'pain' || c.role === 'step' || c.role === 'result')
      .map((c) => `• ${clean(c.title)}${c.body ? ` — ${clean(c.body)}` : ''}`);
    return [clean(hook?.title) || d.meta.topic, ...(points.length ? ['', ...points] : [])].join('\n');
  }

  function sendToStudio() {
    if (!deck || imgWorking || loading) return;
    try {
      const existing = sessionStorage.getItem(STUDIO_SESSION_KEY);
      if (existing) {
        const p = JSON.parse(existing);
        if (p?.cards?.length && !window.confirm('스튜디오에 편집 중인 카드가 있어요. 이 구성으로 덮어쓸까요?')) return;
      }
    } catch { /* ignore */ }
    const cards: Card[] = deck.cards.map((c, i) => ({ ...c, idx: i }));
    const cta = deck.cards.find((c) => c.role === 'cta');
    const handoff: FlowHandoff = { cards, caption: buildCaption(deck), hashtags: cta?.hashtags || [], source: deck.meta.topic || '카드뉴스' };
    try {
      sessionStorage.setItem(FLOW_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      setError('덱이 너무 커서 스튜디오로 전달하지 못했어요(이미지가 많을 때). 일부 이미지를 “↺ 제거”한 뒤 다시 시도해 주세요.');
      return;
    }
    router.push('/studio');
  }

  const n = deck?.cards.length ?? 0;
  const stepCount = deck?.cards.filter((c) => c.role === 'step').length ?? 0;

  // 진행 단계: 입력(1) → 구성표(2) → 이미지(3) → 내보내기(4)
  const step = !deck ? 1 : deck.cards.some((c) => c.imageUrl) ? 3 : 2;
  // 입장 애니메이션 — ease-out, 짧고 절제된 스태거(접근성: reduced-motion이면 0)
  const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.055, delayChildren: reduce ? 0 : 0.04 } } };
  const itemV: Variants = { hidden: { opacity: 0, y: reduce ? 0 : 14 }, show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.45, ease: EASE } } };
  const fadeV: Variants = { hidden: { opacity: 0, y: reduce ? 0 : 8 }, show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.35, ease: EASE } } };

  return (
    <div className="flow">
      <header className="flow__top">
        <Link className="flow__brand" href="/">INK<span>.</span> <small>카드 기획</small></Link>
        <div className="flow__topr">
          <Link className="flow__homelink" href="/studio">기사로 만들기 →</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flow__main">
        <section className="flow__intro">
          <span className="flow__kicker">CARD-FLOW · 주제로 기획</span>
          <h1>주제와 목표만으로 <b>카드 구성표</b>부터</h1>
          <p>주제·타깃·톤·최종행동 4개만 넣으면 <b>Hook → Pain → Steps(단계만큼) → Result → CTA</b> 흐름을 짭니다. 단계 수에 따라 5~10장으로 늘어나요.
            <br /><strong>구성이 마음에 들면 ‘✎ 스튜디오에서 편집’으로 넘겨 색·글자·위치를 다듬어요.</strong> 기사로 바로 만들려면 <Link href="/studio">기사로 만들기</Link>.</p>
        </section>

        {/* 진행 스텝 — 스튜디오(편집)와 달리 '기획 → 이미지 → 내보내기' 흐름임을 보여줌 */}
        <nav className="flow__steps" aria-label="진행 단계">
          <span className="flow__steps-line" aria-hidden="true"><i style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} /></span>
          {STEPS.map((s, i) => {
            const num = i + 1;
            const state = num < step ? 'done' : num === step ? 'current' : 'upcoming';
            return (
              <div key={s} className={`flow__step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="flow__stepdot">{num < step ? '✓' : num}</span>
                <span className="flow__steplb">{s}</span>
              </div>
            );
          })}
        </nav>

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
            <button className={`flow__btn flow__btn--primary${input.topic.trim() && !loading ? ' is-ready' : ''}`} onClick={generate} disabled={loading || !input.topic.trim()} aria-busy={loading}>
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

        {/* 생성 중 — 스피너 대신 '구성표가 짜이는' 스켈레톤 + 단계 메시지 */}
        {loading && (
          <section className="flow__skeleton" aria-hidden="true">
            <div className="flow__skelmsg"><span className="flow__skeldot" />{GEN_STAGES[genStage]}</div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="flow__skelrow" key={i} style={{ animationDelay: `${i * 90}ms` }}>
                <span className="sk sk--num" />
                <span className="sk sk--role" />
                <span className="sk sk--title" />
                <span className="sk sk--body" />
              </div>
            ))}
          </section>
        )}

        {deck && (
          <div className="flow__result" ref={resultRef}>
            <motion.div className="flow__banner" variants={fadeV} initial="hidden" animate="show" key={`b${genId}`}>
              📋 <b>카드 구성표</b> · 총 {n}장 (단계 {stepCount}개)
              <span>확인·수정 후 아래 미리보기에서 이미지(NB2) 생성</span>
            </motion.div>

            {/* 카드 구성표 (편집 가능) */}
            <section className="flow__table" aria-label="카드 구성표">
              <div className="flow__row flow__row--head" aria-hidden="true">
                <span>#</span><span>역할</span><span>큰 제목</span><span>짧은 본문</span><span></span>
              </div>
              <motion.div className="flow__rows" variants={listV} initial="hidden" animate="show" key={`t${genId}`}>
              {deck.cards.map((c, i) => (
                <motion.div className={`flow__row flow__row--${c.role}`} key={i} variants={itemV}>
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
                </motion.div>
              ))}
              </motion.div>
              <div className="flow__tableact">
                <span className="flow__addwrap">
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={addStep} disabled={busy || stepCount >= MAX_STEPS}>＋ 단계 추가</button>
                  {stepCount >= MAX_STEPS && <small className="flow__hint">단계는 최대 {MAX_STEPS}개 (총 10장)</small>}
                </span>
                <div className="flow__copygrp">
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={() => copy('md')}>{copied === 'md' ? '✓ 복사됨' : '표 복사(MD)'}</button>
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={() => copy('json')}>{copied === 'json' ? '✓ 복사됨' : 'JSON 복사'}</button>
                  <button type="button" className="flow__btn flow__btn--ghost" onClick={sendToStudio} disabled={imgWorking || loading} title="이 구성을 스튜디오 편집기로 보내 폰트·색·위치를 다듬어요">✎ 스튜디오에서 편집</button>
                  <button type="button" className="flow__btn flow__btn--primary" onClick={downloadZip} disabled={busy} aria-busy={busy}>{busy ? '◌ 내보내는 중…' : copied === 'zip' ? '✓ 저장됨' : '⤓ PNG ZIP'}</button>
                </div>
              </div>
            </section>

            {/* 라이브 미리보기 + 이미지(NB2) */}
            <section className="flow__previewwrap" aria-label="미리보기">
              <div className="flow__previewhead">
                <h2 className="flow__h2">미리보기 <small>4:5{deck.cards.some((c) => c.imageUrl) ? '' : ' · 이미지 없이 텍스트 카드'}</small></h2>
                {isAdmin && (
                  <div className="flow__imgctl">
                    <div className="flow__styletoggle" role="group" aria-label="이미지 스타일">
                      <button type="button" className={imgStyle === 'trend' ? 'on' : ''} aria-pressed={imgStyle === 'trend'} onClick={() => setImgStyle('trend')} disabled={imgWorking}>풀컬러</button>
                      <button type="button" className={imgStyle === 'editorial' ? 'on' : ''} aria-pressed={imgStyle === 'editorial'} onClick={() => setImgStyle('editorial')} disabled={imgWorking}>흑백</button>
                    </div>
                    <button type="button" className="flow__btn flow__btn--primary" onClick={genAll} disabled={imgWorking} aria-busy={!!batchMsg}>
                      {batchMsg || '✦ 전체 이미지 생성 (NB2)'}
                    </button>
                  </div>
                )}
                {isAdmin === false && (
                  <span className="flow__adminnote">이미지 생성은 관리자 전용 — <Link href="/admin">/admin 로그인</Link></span>
                )}
              </div>
              <motion.div className="flow__rail" variants={listV} initial="hidden" animate="show" key={`p${genId}`}>
                {deck.cards.map((c, i) => (
                  <motion.figure className="flow__pcard" key={i} variants={itemV} whileHover={reduce ? undefined : { y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
                    <div className="flow__pcard-inner">
                      <CardFace card={c} magazine={MAGAZINE} ctx="slide" ratio="4:5" total={n} />
                    </div>
                    <figcaption>
                      <span>{String(i + 1).padStart(2, '0')} · {ROLE_KO[c.role]}</span>
                      {isAdmin && (c.imageUrl
                        ? <button type="button" className="flow__pcardbtn" onClick={() => clearImage(i)} disabled={imgWorking}>↺ 제거</button>
                        : <button type="button" className="flow__pcardbtn" onClick={() => genOne(i)} disabled={imgWorking} aria-busy={genIdx === i}>{genIdx === i ? '◌ 생성…' : '✦ 이미지'}</button>
                      )}
                    </figcaption>
                  </motion.figure>
                ))}
              </motion.div>
            </section>
          </div>
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
