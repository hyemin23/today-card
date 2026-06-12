'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Magazine } from '@/types/db';
import { MAGAZINES, BG_SWATCHES, ACCENT_SWATCHES } from './data';
import { fileToDataUrl } from './imageFile';

const COLOR_NAME: Record<string, string> = {
  '#111110': '잉크 블랙',
  '#ffffff': '화이트',
  '#f6f4ef': '아이보리',
  '#1a2b22': '딥 그린',
  '#2a2438': '플럼',
  '#9a8456': '카멜',
  '#7c8f6b': '올리브',
};

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

  const logoRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  async function onLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || logoBusy) return;
    if (!f.type.startsWith('image/')) { alert('이미지 파일만 올릴 수 있어요. (PNG 권장)'); return; }
    if (f.size > 4 * 1024 * 1024) { alert('로고가 너무 커요. 4MB 이하로 올려주세요.'); return; }
    setLogoBusy(true);
    try {
      // PNG keeps the recommended transparent background intact
      const dataUrl = await fileToDataUrl(f, { maxEdge: 360, mime: 'image/png' });
      set({ logoUrl: dataUrl });
    } catch {
      alert('이 이미지를 불러오지 못했어요. PNG로 변환해 다시 올려주세요.');
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
            <div className="fset__t"><span className="idx" aria-hidden="true">01</span><h3 id={`${id}-s1`}>매거진 선택</h3></div>
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
                  <span className="nm">{m.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="fset" aria-labelledby={`${id}-s2`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">02</span><h3 id={`${id}-s2`}>이름 · 로고</h3></div>
            <div className="field"><label htmlFor={`${id}-name`}>매거진 이름</label><input id={`${id}-name`} className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="row2">
              <div className="field"><label htmlFor={`${id}-logo`}>로고 텍스트</label><input id={`${id}-logo`} className="input" value={draft.logoText} onChange={(e) => set({ logoText: e.target.value })} /></div>
              <div className="field"><label htmlFor={`${id}-handle`}>인스타 핸들</label><input id={`${id}-handle`} className="input" value={draft.handle} onChange={(e) => set({ handle: e.target.value })} /></div>
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
            <div className="field"><label htmlFor={`${id}-cta`}>마지막 카드 헤드라인</label><input id={`${id}-cta`} className="input" value={draft.ctaHeadline} onChange={(e) => set({ ctaHeadline: e.target.value })} /></div>
            <div className="field"><label htmlFor={`${id}-copy`}>카피</label><textarea id={`${id}-copy`} className="textarea" value={draft.ctaCopy} onChange={(e) => set({ ctaCopy: e.target.value })} /></div>
            <div className="field">
              <label htmlFor={`${id}-tag`}>기본 해시태그</label>
              <ul className="taglist" aria-label="기본 해시태그">
                {draft.hashtags.map((h) => (
                  <li className="t" key={h}>{h} <button type="button" aria-label={`${h} 삭제`} onClick={() => set({ hashtags: draft.hashtags.filter((x) => x !== h) })}>✕</button></li>
                ))}
              </ul>
              <input id={`${id}-tag`} className="input" placeholder="태그 입력 후 Enter" onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { const tag = v.startsWith('#') ? v : '#' + v; if (!draft.hashtags.includes(tag)) set({ hashtags: [...draft.hashtags, tag] }); (e.target as HTMLInputElement).value = ''; }
                }
              }} />
            </div>
          </section>

          <section className="fset" aria-labelledby={`${id}-s4`}>
            <div className="fset__t"><span className="idx" aria-hidden="true">04</span><h3 id={`${id}-s4`}>색</h3></div>
            <div className="field"><span className="field-label" id={`${id}-bg`}>배경색</span><div className="swatches" role="group" aria-labelledby={`${id}-bg`}>
              {BG_SWATCHES.map((c) => {
                const light = c === '#ffffff' || c === '#f6f4ef';
                return <button key={c} type="button" className={`swatch ${light ? 'light' : 'dark'} ${draft.bgColor === c ? 'is-on' : ''}`} style={{ background: c }} aria-label={`배경색 ${COLOR_NAME[c] || c}`} aria-pressed={draft.bgColor === c} onClick={() => set({ bgColor: c })} />;
              })}
              <label className={`swatch swatch--custom ${BG_SWATCHES.includes(draft.bgColor) ? '' : 'is-on'}`} title="원하는 색 직접 선택">
                <input type="color" value={draft.bgColor} onChange={(e) => set({ bgColor: e.target.value })} aria-label="배경색 직접 선택" />
              </label>
            </div><p className="hint">표지·CTA 카드의 배경에 적용돼요. 무지개 원을 누르면 모든 색을 직접 고를 수 있어요.</p></div>
            <div className="field"><span className="field-label" id={`${id}-ac`}>포인트색</span><div className="swatches" role="group" aria-labelledby={`${id}-ac`}>
              {ACCENT_SWATCHES.map((c) => {
                const light = c === '#ffffff';
                return <button key={c} type="button" className={`swatch ${light ? 'light' : 'dark'} ${draft.accentColor === c ? 'is-on' : ''}`} style={{ background: c }} aria-label={`포인트색 ${COLOR_NAME[c] || c}`} aria-pressed={draft.accentColor === c} onClick={() => set({ accentColor: c })} />;
              })}
              <label className={`swatch swatch--custom ${ACCENT_SWATCHES.includes(draft.accentColor) ? '' : 'is-on'}`} title="원하는 색 직접 선택">
                <input type="color" value={draft.accentColor} onChange={(e) => set({ accentColor: e.target.value })} aria-label="포인트색 직접 선택" />
              </label>
            </div><p className="hint">형광펜 강조의 기본색으로도 쓰여요.</p></div>
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
