'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Magazine } from '@/types/db';
import { MAGAZINES, BG_SWATCHES, ACCENT_SWATCHES, FONT_CSS } from './data';
import { fileToDataUrl } from './imageFile';
import { fetchStyleProfile } from '@/lib/styleProfile';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

const COLOR_NAME: Record<string, string> = {
  '#111110': '잉크 블랙',
  '#ffffff': '화이트',
  '#f6f4ef': '아이보리',
  '#1a2b22': '딥 그린',
  '#2a2438': '플럼',
  '#9a8456': '카멜',
  '#7c8f6b': '올리브',
};

const LIGHT_BG = ['#ffffff', '#f6f4ef'];
const LIGHT_ACCENT = ['#ffffff'];

/** 추가/제거 가능한 색 팔레트(최대 max개). 무지개 원으로 색을 고르고 ＋로 추가, 스와치 위 ✕로 제거. */
function EditablePalette({ label, idBase, swatches, value, onValue, onSwatches, lightColors, hint, max = 5 }: {
  label: string; idBase: string; swatches: string[]; value: string;
  onValue: (c: string) => void; onSwatches: (s: string[]) => void;
  lightColors: string[]; hint: string; max?: number;
}) {
  const isLight = (c: string) => lightColors.includes(c.toLowerCase());
  const exists = swatches.map((s) => s.toLowerCase()).includes(value.toLowerCase());
  const atMax = swatches.length >= max;
  return (
    <div className="field">
      <span className="field-label" id={idBase}>{label} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 최대 {max}개</span></span>
      <div className="swatches" role="group" aria-labelledby={idBase}>
        {swatches.map((c) => (
          <span className="sw-wrap" key={c}>
            <button type="button" className={`swatch ${isLight(c) ? 'light' : 'dark'} ${value.toLowerCase() === c.toLowerCase() ? 'is-on' : ''}`} style={{ background: c }} aria-label={`${label} ${COLOR_NAME[c] || c}`} aria-pressed={value.toLowerCase() === c.toLowerCase()} onClick={() => onValue(c)} />
            <button type="button" className="sw-del" aria-label={`${COLOR_NAME[c] || c} 삭제`} onClick={() => onSwatches(swatches.filter((x) => x !== c))}>✕</button>
          </span>
        ))}
        <label className="swatch swatch--custom" title="색 직접 선택">
          <input type="color" value={value} onChange={(e) => onValue(e.target.value)} aria-label={`${label} 직접 선택`} />
        </label>
        <button
          type="button"
          className="sw-add"
          onClick={() => { if (!atMax && !exists) onSwatches([...swatches, value]); }}
          disabled={atMax || exists}
          aria-label="현재 색을 팔레트에 추가"
          title={atMax ? `최대 ${max}개까지 추가할 수 있어요` : exists ? '이미 팔레트에 있어요' : '현재 색을 팔레트에 추가'}
        >＋</button>
      </div>
      <p className="hint">{hint}</p>
    </div>
  );
}

export default function MagazineDrawer({
  open,
  current,
  onClose,
  onSave,
}: {
  open: boolean;
  current: Magazine;
  onClose: () => void;
  onSave: (m: Magazine) => void;
}) {
  const [draft, setDraft] = useState<Magazine>(current);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = useId();

  useEffect(() => { setDraft(current); }, [current, open]);

  // make the drawer inert the moment it closes — visibility lingers 0.4s for the
  // slide-out, so without this its controls stay tab-reachable while aria-hidden
  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
  }, [open]);

  // ESC to close + focus trap while open; restore focus on close.
  // Depend only on `open` so the effect doesn't thrash on every parent render;
  // defer the initial focus to rAF so the drawer's visibility has resolved.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // drawer resolves to visibility:visible immediately on open, so focus now
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const root = drawerRef.current;
      if (!root) return;
      const f = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]);

  const set = (patch: Partial<Magazine>) => setDraft((d) => ({ ...d, ...patch }));

  /* ---- benchmark account analysis ---- */
  const benchShotRef = useRef<HTMLInputElement>(null);
  const [benchUser, setBenchUser] = useState('');
  const [benchBusy, setBenchBusy] = useState(false);
  const [benchMsg, setBenchMsg] = useState('');

  async function runBenchAnalysis(images?: string[]) {
    if (benchBusy) return;
    if (!images?.length && !benchUser.trim()) {
      setBenchMsg('계정명을 입력하거나 스크린샷을 올려주세요.');
      return;
    }
    setBenchBusy(true);
    setBenchMsg(images?.length ? '스크린샷을 분석하는 중…' : '계정 게시물을 가져와 분석하는 중…');
    try {
      const p = await fetchStyleProfile(images?.length ? { images, username: benchUser.trim() } : { username: benchUser.trim() });
      set({
        coverStyle: p.layout,
        bgColor: p.bgColor,
        accentColor: p.accentColor,
        benchName: p.name,
        benchSummary: p.summary,
        benchTone: p.tone,
        benchImagePrompt: p.imagePrompt,
      });
      setBenchMsg('');
    } catch (e: any) {
      setBenchMsg(e?.message || '분석 요청에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBenchBusy(false);
    }
  }

  async function onBenchShots(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 4);
    e.target.value = '';
    if (!files.length) return;
    try {
      const images = await Promise.all(
        files
          .filter((f) => f.type.startsWith('image/'))
          .map((f) => fileToDataUrl(f, { maxEdge: 900, quality: 0.8 }))
      );
      if (images.length) await runBenchAnalysis(images);
    } catch {
      setBenchMsg('스크린샷을 불러오지 못했어요. JPG/PNG로 다시 시도해주세요.');
    }
  }

  function clearBench() {
    set({ benchName: '', benchSummary: '', benchTone: '', benchImagePrompt: '' });
  }

  const logoRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  async function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || logoBusy) return;
    if (!f.type.startsWith('image/')) { toast('이미지 파일만 올릴 수 있어요. (PNG 권장)', 'error'); return; }
    if (f.size > 4 * 1024 * 1024) { toast('로고가 너무 커요. 4MB 이하로 올려주세요.', 'error'); return; }
    setLogoBusy(true);
    try {
      // PNG keeps the recommended transparent background intact
      const dataUrl = await fileToDataUrl(f, { maxEdge: 360, mime: 'image/png' });
      set({ logoUrl: dataUrl });
    } catch {
      toast('이 이미지를 불러오지 못했어요. PNG로 변환해 다시 올려주세요.', 'error');
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        className={`drawer ${open ? 'show' : ''}`}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-hidden={!open}
      >
        <div className="drawer__head">
          <h2 id={`${id}-title`}>매거진 설정</h2>
          <button className="x" ref={closeRef} onClick={onClose} aria-label="설정 닫기">✕</button>
        </div>
        <div className="drawer__body">
          <section className="fset" aria-labelledby={`${id}-s1`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">01</span><h3 id={`${id}-s1`}>매거진 · 템플릿 <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 12 }}>· 글씨체·색·스타일</span></h3></div>
            <div className="mags" role="group" aria-labelledby={`${id}-s1`}>
              {MAGAZINES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mag-card ${draft.id === m.id ? 'is-active' : ''}`}
                  aria-pressed={draft.id === m.id}
                  onClick={() => setDraft(m)}
                >
                  <span className="sw" style={{ background: m.bgColor }} aria-hidden="true" />
                  <span className="nm" style={{ fontFamily: FONT_CSS[m.fontKey || ''] }}>{m.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="fset" aria-labelledby={`${id}-s2`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">02</span><h3 id={`${id}-s2`}>이름 · 로고</h3></div>
            <div className="field"><label htmlFor={`${id}-name`}>매거진 이름</label><Input id={`${id}-name`} value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="row2">
              <div className="field"><label htmlFor={`${id}-logo`}>로고 텍스트</label><Input id={`${id}-logo`} value={draft.logoText} onChange={(e) => set({ logoText: e.target.value })} /></div>
              <div className="field"><label htmlFor={`${id}-handle`}>인스타 핸들</label><Input id={`${id}-handle`} value={draft.handle} onChange={(e) => set({ handle: e.target.value })} /></div>
            </div>
            <div className="field">
              <span className="field-label">마지막 카드 로고 이미지</span>
              {draft.logoUrl ? (
                <div className="logoPrev">
                  <img src={draft.logoUrl} alt="업로드한 로고 미리보기" />
                  <div className="logoPrev__btns">
                    <button type="button" className="minib" onClick={() => logoRef.current?.click()}>교체</button>
                    <button type="button" className="minib" onClick={() => set({ logoUrl: null })}>제거</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="uploader" onClick={() => logoRef.current?.click()} aria-busy={logoBusy}>
                  <span className="ic" aria-hidden="true">⤒</span>
                  <span className="up-t">{logoBusy ? '불러오는 중…' : '로고 업로드'}</span>
                  <span className="up-s">PNG · 투명 배경 권장</span>
                </button>
              )}
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogoUpload} aria-label="로고 이미지 파일 선택" />
              <p className="hint">마지막(CTA) 카드의 헤드라인 위에 들어가요.</p>
            </div>
          </section>

          <section className="fset" aria-labelledby={`${id}-s3`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">03</span><h3 id={`${id}-s3`}>멘트 · 해시태그</h3></div>
            <div className="field"><label htmlFor={`${id}-cta`}>마지막 카드 헤드라인</label><Input id={`${id}-cta`} value={draft.ctaHeadline} onChange={(e) => set({ ctaHeadline: e.target.value })} /></div>
            <div className="field"><label htmlFor={`${id}-copy`}>카피</label><Textarea id={`${id}-copy`} value={draft.ctaCopy} onChange={(e) => set({ ctaCopy: e.target.value })} /></div>
            <div className="field">
              <label htmlFor={`${id}-tag`}>기본 해시태그</label>
              <ul className="taglist" aria-label="기본 해시태그">
                {draft.hashtags.map((h) => (
                  <li className="t" key={h}>{h} <button type="button" aria-label={`${h} 삭제`} onClick={() => set({ hashtags: draft.hashtags.filter((x) => x !== h) })}>✕</button></li>
                ))}
              </ul>
              <Input id={`${id}-tag`} placeholder="태그 입력 후 Enter" onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { const tag = v.startsWith('#') ? v : '#' + v; if (!draft.hashtags.includes(tag)) set({ hashtags: [...draft.hashtags, tag] }); (e.target as HTMLInputElement).value = ''; }
                }
              }} />
            </div>
            <div className="field">
              <div className="tog">
                <span className="tog__lb">AI 해시태그 자동 추천 <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 생성 시 주제 해시태그 제안</span></span>
                <button type="button" role="switch" aria-checked={!!draft.autoHashtags} aria-label="AI 해시태그 자동 추천" className="switch" onClick={() => set({ autoHashtags: !draft.autoHashtags })} />
              </div>
              <p className="hint">끄면(기본) 해시태그가 비어 있어요. 켜면 생성할 때 AI가 기사 주제에 맞는 해시태그를 제안해요.</p>
            </div>
          </section>

          <section className="fset" aria-labelledby={`${id}-s5`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">04</span><h3 id={`${id}-s5`}>표지 스타일</h3></div>
            <div className="stylepick" role="group" aria-labelledby={`${id}-s5`}>
              <button
                type="button"
                className={`stylecard ${(draft.coverStyle || 'trend') === 'trend' ? 'is-active' : ''}`}
                aria-pressed={(draft.coverStyle || 'trend') === 'trend'}
                onClick={() => set({ coverStyle: 'trend' })}
              >
                <b>트렌드 비주얼 <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 기본</span></b>
                <span>풀컬러 · 현실적이고 시선을 끄는 표지 (CTR↑)</span>
              </button>
              <button
                type="button"
                className={`stylecard ${draft.coverStyle === 'editorial' ? 'is-active' : ''}`}
                aria-pressed={draft.coverStyle === 'editorial'}
                onClick={() => set({ coverStyle: 'editorial' })}
              >
                <b>잉크 에디토리얼</b>
                <span>흑백 매거진 무드 · 차분한 신뢰감</span>
              </button>
            </div>
            <p className="hint">표지 레이아웃과 AI 이미지의 톤(컬러/흑백)이 함께 바뀌어요. 기본은 풀컬러예요.</p>

            <div className="bench">
              <div className="bench__t">벤치마킹 계정 분석 <span className="hint" style={{ display: 'inline', marginTop: 0 }}>· 관리자 전용</span></div>
              {draft.benchName ? (
                <div className="bench__applied">
                  <div>
                    <b>{draft.benchName}</b>
                    {draft.benchSummary && <span>{draft.benchSummary}</span>}
                  </div>
                  <button type="button" className="minib" onClick={clearBench}>해제</button>
                </div>
              ) : (
                <>
                  <div className="bench__row">
                    <Input
                      className="flex-1"
                      placeholder="@계정명 (공개 계정)"
                      value={benchUser}
                      onChange={(e) => setBenchUser(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runBenchAnalysis(); } }}
                      aria-label="벤치마킹할 인스타그램 계정명"
                    />
                    <button type="button" className="btn btn--dark btn--sm" onClick={() => runBenchAnalysis()} aria-busy={benchBusy} aria-disabled={benchBusy}>
                      {benchBusy ? '◌ 분석 중…' : '분석'}
                    </button>
                  </div>
                  <button type="button" className="bench__alt" onClick={() => benchShotRef.current?.click()}>
                    또는 게시물 스크린샷 올리기 (최대 4장)
                  </button>
                  <input ref={benchShotRef} type="file" accept="image/*" multiple hidden onChange={onBenchShots} aria-label="벤치마킹 스크린샷 선택" />
                </>
              )}
              {benchMsg && <p className="bench__msg" role="status">{benchMsg}</p>}
              <p className="hint">분석하면 말투·이미지 무드·색·표지 레이아웃이 그 계정 느낌으로 맞춰져요.</p>
            </div>
          </section>

          <section className="fset" aria-labelledby={`${id}-s4`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">05</span><h3 id={`${id}-s4`}>색</h3></div>
            <EditablePalette
              label="배경색" idBase={`${id}-bg`}
              swatches={draft.bgSwatches ?? BG_SWATCHES} value={draft.bgColor}
              onValue={(c) => set({ bgColor: c })} onSwatches={(s) => set({ bgSwatches: s })}
              lightColors={LIGHT_BG}
              hint="표지·CTA 카드의 배경에 적용돼요. 무지개 원으로 색을 고르고 ＋로 팔레트에 추가, 스와치의 ✕로 제거해요."
            />
            <EditablePalette
              label="포인트색" idBase={`${id}-ac`}
              swatches={draft.accentSwatches ?? ACCENT_SWATCHES} value={draft.accentColor}
              onValue={(c) => set({ accentColor: c })} onSwatches={(s) => set({ accentSwatches: s })}
              lightColors={LIGHT_ACCENT}
              hint="형광펜 강조의 기본색으로도 쓰여요."
            />
          </section>
        </div>
        <div className="drawer__foot">
          <button className="btn btn--dark" onClick={() => { onSave(draft); onClose(); }}>저장</button>
          <span className="note">브라우저에만 보관됨</span>
        </div>
      </aside>
    </>
  );
}
