'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { Card, FlowCard, FlowDeck, FlowInput, FlowRole, Magazine } from '@/types/db';
import { DEFAULT_FLOW_TONE, MAGAZINES, FONT_CSS } from '@/components/studio/data';
import { FLOW_HANDOFF_KEY, type FlowHandoff, renumberDeck } from '@/lib/flowShared';
import CardFace, { stripEmphasis } from '@/components/studio/CardFace';
import { renderCardNode, downloadPngZip } from '@/lib/cardExport';
import { buildImagePrompt, generateCardImage, imagePatch } from '@/lib/imageGen';
import { fetchStyleProfile } from '@/lib/styleProfile';
import { fileToDataUrl } from '@/components/studio/imageFile';
import type { StyleProfile } from '@/lib/styleAnalyze';
import ThemeToggle from '@/components/ThemeToggle';

const STUDIO_SESSION_KEY = 'ink.studio.v1'; // 기존 작업 보호용(StudioClient SESSION_KEY)

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

// 작업(입력 + 구성표) 자동 저장 — 새로고침/뒤로가기에도 같은 탭에서 살아있게(StudioClient와 동일 철학).
const FLOW_SESSION_KEY = 'ink.flow.v1';

interface PersistedFlow {
  input: FlowInput;
  deck: FlowDeck | null;
  magazine?: Magazine;
}

function loadFlowJSON<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function saveFlowJSON(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — 편집은 계속되고, 저장만 안 될 뿐 */
  }
}
/** 저장 전 이미지 data URL을 비운다 — 메가바이트 PNG가 sessionStorage 쿼터를 넘겨
    텍스트 구성표까지 통째로 못 저장하는 일이 없게(이미지는 관리자가 다시 생성 가능). */
function deckWithoutImages(deck: FlowDeck | null): FlowDeck | null {
  return deck ? { ...deck, cards: deck.cards.map((c) => ({ ...c, imageUrl: null })) } : null;
}

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
  const [imgProvider, setImgProvider] = useState<'gemini' | 'higgsfield'>('gemini');
  const [demo, setDemo] = useState(false); // 서버가 mock:true로 응답한 체험 모드 덱
  const [genIdx, setGenIdx] = useState<number | null>(null); // 개별 이미지 생성 중인 카드
  const [batchMsg, setBatchMsg] = useState(''); // 전체 이미지 생성 진행률
  const [genId, setGenId] = useState(0); // 생성 회차 — 결과 입장 애니메이션 재실행 키
  const [genStage, setGenStage] = useState(0); // 생성 중 단계 메시지 인덱스
  const [restored, setRestored] = useState(false); // 작업 복구 패스 완료 여부(이후에만 저장)
  const [magazine, setMagazine] = useState<Magazine>(MAGAZINES[0]); // 미리보기·이미지 톤 기준(레퍼런스 스타일 적용 대상)
  const [benchBusy, setBenchBusy] = useState(false); // 레퍼런스 스타일 분석 중
  const renderRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const benchShotRef = useRef<HTMLInputElement>(null);
  const batchCancelRef = useRef(false); // 일괄 이미지 생성 중단 플래그 — 다음 장 호출 전에 검사
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

  // 작업 복구: 새로고침/뒤로가기로 돌아와도 입력·구성표가 살아있게(같은 탭).
  // hydration 불일치를 피하려 마운트 후 1회. 이미지는 저장하지 않으므로 복구되지 않는다.
  useEffect(() => {
    const saved = loadFlowJSON<PersistedFlow>(FLOW_SESSION_KEY);
    if (saved?.input) setInput(saved.input);
    if (saved?.deck?.cards?.length) { setDeck(saved.deck); setGenId((g) => g + 1); }
    if (saved?.magazine?.id) setMagazine(saved.magazine);
    setRestored(true);
  }, []);

  // 의미 있는 변경마다 저장(복구 패스 이후에만 — 빈 초기 상태가 저장본을 덮지 않게). 이미지는 빼고 저장(쿼터 보호).
  useEffect(() => {
    if (!restored) return;
    saveFlowJSON(FLOW_SESSION_KEY, { input, deck: deckWithoutImages(deck), magazine } satisfies PersistedFlow);
  }, [restored, input, deck, magazine]);

  // 구성표가 있거나 입력 중이면 탭 닫기/새로고침 전에 경고(sessionStorage는 탭을 닫으면 사라짐)
  useEffect(() => {
    if (!deck && !input.topic.trim()) return;
    function onBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = ''; }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [deck, input.topic]);

  const setField = (k: keyof FlowInput, v: string) => setInput((s) => ({ ...s, [k]: v }));

  /** 템플릿(매거진) 선택 = 글씨체+색+표지 스타일을 덱 전체에 일괄 적용. */
  function applyTemplate(m: Magazine) {
    setMagazine(m);
    setImgStyle(m.coverStyle || 'trend');
    setDeck((d) => (d ? { ...d, cards: d.cards.map((c) => ({ ...c, fontFamily: m.fontKey || '' })) } : d));
  }

  async function generate() {
    if (!input.topic.trim() || loading) return;
    setLoading(true);
    setError('');
    setStatus('카드 구성표를 만드는 중…');
    try {
      const res = await fetch('/api/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, styleTone: magazine.benchTone || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '생성에 실패했어요.');
      const built = data as FlowDeck & { mock?: boolean };
      setDemo(!!built.mock); // 체험 모드(예시 덱) 여부 — 결과 배너에 표시
      // 선택된 템플릿 글씨체를 새 덱 전 카드에 적용
      setDeck(magazine.fontKey ? { ...built, cards: built.cards.map((c) => ({ ...c, fontFamily: magazine.fontKey })) } : built);
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

  // ── 이미지 생성 (관리자 전용, Gemini/Higgsfield — lib/imageGen 공유) ─────
  async function requestImage(c: FlowCard): Promise<string> {
    return generateCardImage({
      title: buildImagePrompt(c.title, c.body),
      category: deck?.meta.topic?.slice(0, 40) || '카드뉴스',
      style: imgStyle,
      imageStyle: magazine.benchImagePrompt || '', // 레퍼런스 아트디렉션(있으면)
      provider: imgProvider,
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
    if (!window.confirm(`이미지가 없는 카드 ${targets.length}장의 배경을 일괄 생성할까요?\n(장당 유료 호출이 발생해요 · 진행 중 언제든 중단할 수 있어요)`)) return;
    setError('');
    batchCancelRef.current = false;
    let failed = 0;
    let done = 0;
    for (let k = 0; k < targets.length; k++) {
      if (batchCancelRef.current) break; // 사용자가 중단 — 남은 장수는 호출하지 않음(비용 보호)
      const { c, i } = targets[k];
      setBatchMsg(`이미지 생성 중… ${k + 1}/${targets.length}`);
      setStatus(`이미지 생성 중… ${k + 1}/${targets.length}`);
      try {
        updateCard(i, imagePatch(c, await requestImage(c)));
        done++;
      } catch {
        failed++;
      }
    }
    setBatchMsg('');
    if (batchCancelRef.current) {
      setStatus(`중단했어요 — ${done}장 완료, 나머지는 생성하지 않았어요.`);
    } else {
      setStatus(failed ? `완료 — ${failed}장 실패. 다시 시도해 보세요.` : `이미지 ${targets.length}장을 모두 만들었어요.`);
      if (failed) setError(`${failed}장 생성에 실패했어요(관리자 로그인 상태와 이미지 모델 권한을 확인하세요).`);
    }
  }

  function clearImage(idx: number) {
    if (!deck || imgWorking) return;
    const c = deck.cards[idx];
    const patch: Partial<FlowCard> = { imageUrl: null };
    if (c.kind === 'body' && c.textColor === '#ffffff') patch.textColor = '#111110'; // 흰 글자 되돌리기
    updateCard(idx, patch);
  }

  // ── 레퍼런스 스타일 적용 (관리자 전용 — /studio MagazineDrawer와 동일 분석 경로) ──
  function applyProfile(p: StyleProfile) {
    setMagazine((m) => ({
      ...m,
      coverStyle: p.layout,
      bgColor: p.bgColor,
      accentColor: p.accentColor,
      benchName: p.name,
      benchSummary: p.summary,
      benchTone: p.tone,
      benchImagePrompt: p.imagePrompt,
    }));
    setImgStyle(p.layout); // 풀컬러/흑백 토글도 분석 결과에 맞춤
  }
  function clearBench() {
    setMagazine((m) => ({ ...m, benchName: '', benchSummary: '', benchTone: '', benchImagePrompt: '' }));
  }
  async function onBenchShots(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4);
    e.target.value = '';
    if (!files.length || benchBusy) return;
    setBenchBusy(true);
    setError('');
    setStatus('레퍼런스 스타일을 분석하는 중…');
    try {
      const images = await Promise.all(
        files.filter((f) => f.type.startsWith('image/')).map((f) => fileToDataUrl(f, { maxEdge: 900, quality: 0.8 }))
      );
      if (!images.length) throw new Error('이미지 파일(JPG·PNG)만 올릴 수 있어요.');
      const p = await fetchStyleProfile({ images });
      applyProfile(p);
      setStatus(`‘${p.name}’ 스타일을 입혔어요 — 색·이미지 톤에 반영, 말투는 다시 생성 시 적용돼요.`);
    } catch (e2: any) {
      setError(e2?.message || '스타일 분석에 실패했어요.');
      setStatus('');
    } finally {
      setBenchBusy(false);
    }
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
    const handoff: FlowHandoff = { cards, caption: buildCaption(deck), hashtags: cta?.hashtags || [], source: deck.meta.topic || '카드뉴스', magazine };
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
          <div className="flow__field flow__field--wide">
            <label>템플릿 <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 글씨체·색·스타일 한 번에</span></label>
            <div className="flow__examples" role="group" aria-label="템플릿 선택">
              {MAGAZINES.map((m) => {
                const on = magazine.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="flow__chip"
                    aria-pressed={on}
                    onClick={() => applyTemplate(m)}
                    style={{ fontFamily: FONT_CSS[m.fontKey || ''], outline: on ? '2px solid var(--ink, #111110)' : undefined, outlineOffset: 1 }}
                  >
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: m.bgColor, border: '1px solid var(--line-2, #d4d0c6)', marginRight: 6, verticalAlign: 'middle' }} />
                    {m.name}
                  </button>
                );
              })}
            </div>
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
          {isAdmin === false && (
            <p className="flow__adminnote" style={{ marginTop: 8 }}>
              지금은 체험 모드 — 예시 구성표로 흐름을 볼 수 있어요. 실제 AI 생성은 <Link href="/admin">관리자 로그인</Link> 후 가능해요.
            </p>
          )}
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
              📋 <b>카드 구성표</b> · 총 {n}장 (단계 {stepCount}개){demo && <b> · 체험 모드(예시)</b>}
              <span>확인·수정 후 아래 미리보기에서 이미지 생성</span>
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
                    <div className="flow__styletoggle" role="group" aria-label="이미지 생성 제공자">
                      <button type="button" className={imgProvider === 'gemini' ? 'on' : ''} aria-pressed={imgProvider === 'gemini'} onClick={() => setImgProvider('gemini')} disabled={imgWorking} title="기본 제공자 — 나노바나나(Gemini)">Gemini</button>
                      <button type="button" className={imgProvider === 'higgsfield' ? 'on' : ''} aria-pressed={imgProvider === 'higgsfield'} onClick={() => setImgProvider('higgsfield')} disabled={imgWorking} title="대체 제공자 — Higgsfield">Higgsfield</button>
                    </div>
                    <button type="button" className="flow__btn flow__btn--primary" onClick={genAll} disabled={imgWorking} aria-busy={!!batchMsg}>
                      {batchMsg || '✦ 전체 이미지 생성'}
                    </button>
                    {!!batchMsg && (
                      <button type="button" className="flow__btn flow__btn--ghost" onClick={() => { batchCancelRef.current = true; }} title="현재 장까지만 만들고 멈춰요 — 남은 장은 호출하지 않아요">
                        ⏹ 중단
                      </button>
                    )}
                    {magazine.benchName ? (
                      <span className="flow__benchchip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        ✦ {magazine.benchName}
                        <button type="button" onClick={clearBench} aria-label="레퍼런스 스타일 해제" style={{ textDecoration: 'underline' }}>해제</button>
                      </span>
                    ) : (
                      <button type="button" className="flow__btn flow__btn--ghost" onClick={() => benchShotRef.current?.click()} disabled={benchBusy || imgWorking} aria-busy={benchBusy} title="레퍼런스 카드뉴스 스크린샷(최대 4장)을 올리면 색·이미지 톤·말투를 비슷하게 맞춰요">
                        {benchBusy ? '◌ 분석 중…' : '✦ 레퍼런스로 스타일'}
                      </button>
                    )}
                    <input ref={benchShotRef} type="file" accept="image/*" multiple hidden onChange={onBenchShots} aria-label="레퍼런스 스크린샷 선택(최대 4장)" />
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
                      <CardFace card={c} magazine={magazine} ctx="slide" ratio="4:5" total={n} />
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
              <CardFace card={c} magazine={magazine} ctx="canvas" hint={false} ratio="4:5" total={n} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
