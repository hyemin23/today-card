'use client';

import { useId, useRef, useState } from 'react';
import type { Card, Magazine } from '@/types/db';
import CardFace, { alignIndex } from './CardFace';
import { TEXT_COLORS } from './data';
import { fileToDataUrl } from './imageFile';

const MAX_UPLOAD_MB = 12;

const COLOR_LABELS: Record<string, string> = {
  '#ffffff': '흰색',
  '#111110': '검정',
  '#e7d9b8': '베이지',
  '#b8c6e7': '연한 파랑',
};

const ALIGN_LABELS = ['좌상단', '상단 가운데', '우상단', '좌측 가운데', '정중앙', '우측 가운데', '좌하단', '하단 가운데', '우하단'];

function kindLabelOf(kind: Card['kind']) {
  return kind === 'cover' ? '표지' : kind === 'cta' ? 'CTA' : '본문';
}

export default function EditorStage({
  cards,
  sel,
  setSel,
  updateCard,
  restoreCard,
  hasOriginals,
  magazine,
  onGo,
  isAdmin,
}: {
  cards: Card[];
  sel: number;
  setSel: (i: number) => void;
  updateCard: (idx: number, patch: Partial<Card>) => void;
  restoreCard: (idx: number) => void;
  hasOriginals?: boolean;
  magazine: Magazine;
  onGo: (n: number) => void;
  isAdmin?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [imgBusy, setImgBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const card = cards[sel];
  if (!card) return null;

  const kindLabel = kindLabelOf(card.kind);
  const sizePx = Math.round(42 * card.fontScale);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || uploading) return;
    if (!f.type.startsWith('image/')) {
      alert('이미지 파일만 올릴 수 있어요. (JPG · PNG 등)');
      return;
    }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      alert(`이미지가 너무 커요. ${MAX_UPLOAD_MB}MB 이하로 올려주세요.`);
      return;
    }
    setUploading(true);
    try {
      // downscaled data: URL — survives reload (sessionStorage) and PNG export
      const dataUrl = await fileToDataUrl(f);
      updateCard(sel, { imageUrl: dataUrl });
    } catch {
      alert('이 이미지를 불러오지 못했어요. JPG나 PNG로 변환해 다시 올려주세요.');
    } finally {
      setUploading(false);
    }
  }
  function onResetImage() {
    if (card.imageUrl && !window.confirm('이 카드의 이미지를 제거할까요?')) return;
    updateCard(sel, { imageUrl: null });
  }
  // admin only — server re-verifies the session cookie before any (paid) generation
  async function genImage() {
    if (!isAdmin || imgBusy) return;
    setImgBusy(true);
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: card.title, category: card.category || '뉴스' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      updateCard(sel, { imageUrl: data.image });
    } catch (e: any) {
      alert('AI 이미지 생성 실패: ' + (e.message || ''));
    } finally {
      setImgBusy(false);
    }
  }

  return (
    <div className="editor">
      <h1 className="sr-only">2단계 · 카드 편집</h1>
      {/* rail */}
      <nav className="rail" aria-label="카드 5컷">
        <div className="rail__lb" aria-hidden="true">5컷 · 카드</div>
        <div className="thumbs" role="group" aria-label="카드 선택">
          {cards.map((c, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === sel}
              aria-label={`${String(i + 1).padStart(2, '0')} ${kindLabelOf(c.kind)} 카드${c.title ? `: ${c.title}` : ''}`}
              className={`thumb ${c.kind !== 'body' ? 'dark' : ''} ${i === sel ? 'is-on' : ''}`}
              onClick={() => setSel(i)}
            >
              <span className="tnum" aria-hidden="true">{String(i + 1).padStart(2, '0')} {kindLabelOf(c.kind)}</span>
              <CardFace card={c} magazine={magazine} ctx="thumb" />
            </button>
          ))}
        </div>
      </nav>

      {/* canvas */}
      <div className="stage">
        <div className="stage__bar">
          <p className="aiflag"><span className="dot" aria-hidden="true" /> AI가 5컷을 생성했어요 · 자유롭게 다듬어보세요</p>
        </div>
        <div className="canvas" role="group" aria-label={`${kindLabel} 카드 미리보기: ${card.title}`}>
          <CardFace card={card} magazine={magazine} ctx="canvas" />
          {card.kind === 'cover' && !card.imageUrl && (
            /* the visual "이미지를 올려주세요" hint lives in CardFace — this makes it actually clickable */
            <button
              type="button"
              className="canvas__uploadhit"
              aria-label="표지 이미지 올리기"
              onClick={() => fileRef.current?.click()}
            />
          )}
        </div>
        <div className="stage__nav">
          <button className="btn btn--ghost btn--sm" onClick={() => setSel(Math.max(0, sel - 1))} disabled={sel === 0}>← 이전 카드</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setSel(Math.min(cards.length - 1, sel + 1))} disabled={sel === cards.length - 1}>다음 카드 →</button>
        </div>
      </div>

      {/* inspector */}
      <aside className="insp" aria-label={`${kindLabel} 카드 편집`}>
        <div className="insp__head"><h2>{kindLabel} 카드 편집</h2><span className="badge">{String(sel + 1).padStart(2, '0')} / 05</span></div>
        <div className="insp__body">
          <div className="ig">
            <div className="ig__t" id={`${titleId}-img`}>이미지</div>
            <div className="btnrow" role="group" aria-labelledby={`${titleId}-img`}>
              <button className="minib" onClick={() => fileRef.current?.click()} aria-busy={uploading} aria-disabled={uploading}>{uploading ? '◌ 불러오는 중…' : '⤒ 이미지 변경'}</button>
              <button className="minib" style={{ flex: 'none', width: 44 }} aria-label="이미지 제거" onClick={onResetImage}>↺</button>
            </div>
            {isAdmin && (
              <button
                className="minib"
                style={{ width: '100%', marginTop: 8 }}
                onClick={genImage}
                aria-disabled={imgBusy}
                aria-busy={imgBusy}
                title="기사 주제 기반 흑백 에디토리얼 배경을 생성합니다 (관리자 전용)"
              >
                {imgBusy ? '◌ AI 이미지 생성 중…' : '✨ AI 이미지 생성 (관리자)'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} aria-label="이미지 파일 선택" />
          </div>
          <div className="ig">
            <label className="ig__t" htmlFor={titleId}>{card.kind === 'cover' ? '표지 헤드라인' : card.kind === 'cta' ? 'CTA 문구' : '소제목'} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 비우면 삭제</span></label>
            <textarea id={titleId} className="ta" value={card.title} onChange={(e) => updateCard(sel, { title: e.target.value })} placeholder="비우면 카드에서 사라져요" />
          </div>
          {card.kind === 'body' && (
            <div className="ig">
              <label className="ig__t" htmlFor={`${titleId}-body`}>본문 텍스트 <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 비우면 삭제</span></label>
              <textarea id={`${titleId}-body`} className="ta" style={{ minHeight: 100 }} value={card.body || ''} onChange={(e) => updateCard(sel, { body: e.target.value })} placeholder="비우면 카드에서 사라져요" />
            </div>
          )}
          {card.kind === 'cover' && (
            <div className="ig">
              <label className="ig__t" htmlFor={`${titleId}-cat`}>카테고리 라벨 <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 비우면 삭제</span></label>
              <input id={`${titleId}-cat`} className="input" value={card.category || ''} onChange={(e) => updateCard(sel, { category: e.target.value })} placeholder="예: 경제 (비우면 숨김)" />
            </div>
          )}
          {card.kind === 'cta' && (
            <div className="ig">
              <label className="ig__t" htmlFor={`${titleId}-tags`}>해시태그 <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 비우면 삭제</span></label>
              <textarea id={`${titleId}-tags`} className="ta" value={(card.hashtags || []).join(' ')} onChange={(e) => updateCard(sel, { hashtags: e.target.value.split(' ') })} placeholder="#태그1 #태그2 (비우면 숨김)" />
            </div>
          )}
          <div className="ig">
            <div className="ig__t" id={`${titleId}-color`}>글자색</div>
            <div className="swrow" role="group" aria-labelledby={`${titleId}-color`}>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sw2 ${card.textColor === c ? 'on' : ''}`}
                  style={{ background: c }}
                  aria-label={`글자색 ${COLOR_LABELS[c] || c}`}
                  aria-pressed={card.textColor === c}
                  onClick={() => updateCard(sel, { textColor: c })}
                />
              ))}
            </div>
          </div>
          <div className="ig">
            <label className="ig__t" htmlFor={`${titleId}-size`}>글자 크기</label>
            <input
              id={`${titleId}-size`}
              className="range"
              type="range"
              min={0.7}
              max={1.5}
              step={0.05}
              value={card.fontScale}
              aria-valuetext={`${sizePx} 픽셀`}
              onChange={(e) => updateCard(sel, { fontScale: Number(e.target.value) })}
            />
            <div className="rlabels" aria-hidden="true"><span>S</span><span>{sizePx} PX</span><span>XL</span></div>
          </div>
          <div className="ig">
            <div className="ig__t" id={`${titleId}-align`}>위치 · 정렬</div>
            <div className="align" role="group" aria-labelledby={`${titleId}-align`}>
              {Array.from({ length: 9 }).map((_, i) => (
                <button key={i} type="button" className={alignIndex(card.align) === i ? 'on' : ''} aria-label={ALIGN_LABELS[i]} aria-pressed={alignIndex(card.align) === i} onClick={() => updateCard(sel, { align: String(i) })}><span className="d" aria-hidden="true" /></button>
              ))}
            </div>
          </div>
          <div className="ig">
            <div className="ig__t">표시 요소</div>
            <div className="tog">
              <span className="tog__lb">페이지 번호 ({String(sel + 1).padStart(2, '0')}/05)</span>
              <button type="button" role="switch" aria-checked={!card.hideNum} aria-label="페이지 번호 표시" className="switch" onClick={() => updateCard(sel, { hideNum: !card.hideNum })} />
            </div>
            {(card.kind === 'body' || card.kind === 'cta') && (
              <div className="tog">
                <span className="tog__lb">구분 라벨 ({card.kind === 'cta' ? 'CTA' : '본문'})</span>
                <button type="button" role="switch" aria-checked={!card.hideLabel} aria-label="구분 라벨 표시" className="switch" onClick={() => updateCard(sel, { hideLabel: !card.hideLabel })} />
              </div>
            )}
            {card.kind === 'cta' && (
              <div className="tog">
                <span className="tog__lb">핸들 {magazine.handle ? `(${magazine.handle})` : ''}</span>
                <button type="button" role="switch" aria-checked={!card.hideHandle} aria-label="인스타 핸들 표시" className="switch" onClick={() => updateCard(sel, { hideHandle: !card.hideHandle })} />
              </div>
            )}
          </div>
          {hasOriginals && (
            <div className="ig">
              <div className="ig__t">되돌리기</div>
              <button
                className="btn btn--ghost btn--sm"
                style={{ width: '100%' }}
                onClick={() => restoreCard(sel)}
                title="이 카드의 문구를 AI가 처음 써준 내용으로 되돌립니다 (이미지·색은 유지)"
              >
                ↺ AI가 써준 원래 문구로 되돌리기
              </button>
            </div>
          )}
        </div>
        <div className="insp__foot">
          <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => onGo(1)}>← 주제</button>
          <button className="btn btn--dark btn--sm" style={{ flex: 2 }} onClick={() => onGo(3)}>완성 · 내보내기 →</button>
        </div>
      </aside>
    </div>
  );
}
