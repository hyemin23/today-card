'use client';

import { useEffect, useState } from 'react';
import type { Magazine } from '@/types/db';
import { MAGAZINES, BG_SWATCHES, ACCENT_SWATCHES } from './data';

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

  useEffect(() => { setDraft(current); }, [current, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = (patch: Partial<Magazine>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'show' : ''}`} aria-label="매거진 설정">
        <div className="drawer__head">
          <h2>매거진 설정</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="drawer__body">
          <section className="fset">
            <div className="fset__t"><span className="idx">01</span><h3>매거진 선택</h3></div>
            <div className="mags">
              {MAGAZINES.map((m) => (
                <label key={m.id} className={`mag-card ${draft.id === m.id ? 'is-active' : ''}`} onClick={() => setDraft(m)}>
                  <span className="sw" style={{ background: m.bgColor }} />
                  <span className="nm">{m.name}</span>
                </label>
              ))}
              <button type="button" className="mag-card add">＋ 추가</button>
            </div>
          </section>

          <section className="fset">
            <div className="fset__t"><span className="idx">02</span><h3>이름 · 로고</h3></div>
            <div className="field"><label>매거진 이름</label><input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="row2">
              <div className="field"><label>로고 텍스트</label><input className="input" value={draft.logoText} onChange={(e) => set({ logoText: e.target.value })} /></div>
              <div className="field"><label>인스타 핸들</label><input className="input" value={draft.handle} onChange={(e) => set({ handle: e.target.value })} /></div>
            </div>
            <div className="field"><label>마지막 카드 로고 이미지</label><div className="uploader"><div className="ic">⤒</div><p>로고 업로드</p><span>PNG · 투명 배경 권장</span></div></div>
          </section>

          <section className="fset">
            <div className="fset__t"><span className="idx">03</span><h3>멘트 · 해시태그</h3></div>
            <div className="field"><label>마지막 카드 헤드라인</label><input className="input" value={draft.ctaHeadline} onChange={(e) => set({ ctaHeadline: e.target.value })} /></div>
            <div className="field"><label>카피</label><textarea className="textarea" value={draft.ctaCopy} onChange={(e) => set({ ctaCopy: e.target.value })} /></div>
            <div className="field">
              <label>기본 해시태그</label>
              <div className="taglist">
                {draft.hashtags.map((h) => (
                  <div className="t" key={h}>{h} <span onClick={() => set({ hashtags: draft.hashtags.filter((x) => x !== h) })}>✕</span></div>
                ))}
              </div>
              <input className="input" placeholder="태그 입력 후 Enter" onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { const tag = v.startsWith('#') ? v : '#' + v; if (!draft.hashtags.includes(tag)) set({ hashtags: [...draft.hashtags, tag] }); (e.target as HTMLInputElement).value = ''; }
                }
              }} />
            </div>
          </section>

          <section className="fset">
            <div className="fset__t"><span className="idx">04</span><h3>색</h3></div>
            <div className="field"><label>배경색</label><div className="swatches">
              {BG_SWATCHES.map((c) => {
                const light = c === '#ffffff' || c === '#f6f4ef';
                return <span key={c} className={`swatch ${light ? 'light' : 'dark'} ${draft.bgColor === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => set({ bgColor: c })} />;
              })}
            </div></div>
            <div className="field"><label>포인트색</label><div className="swatches">
              {ACCENT_SWATCHES.map((c) => {
                const light = c === '#ffffff';
                return <span key={c} className={`swatch ${light ? 'light' : 'dark'} ${draft.accentColor === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => set({ accentColor: c })} />;
              })}
            </div></div>
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
