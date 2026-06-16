'use client';

import { useId, useRef, useState } from 'react';
import type { Card, Magazine } from '@/types/db';
import CardFace, { alignIndex, stripEmphasis, cleanMarkers } from './CardFace';
import { TEXT_COLORS, FONTS } from './data';
import { fileToDataUrl, resizeDataUrl } from './imageFile';
import { IconSpark } from '@/components/icons';

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
  ratio,
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
  ratio?: '1:1' | '4:5';
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const titleTaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [imgBusy, setImgBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [emphHint, setEmphHint] = useState('');
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

  /** Wrap the textarea selection in an emphasis marker (** bold / == highlight). */
  function wrapSelection(
    ref: React.RefObject<HTMLTextAreaElement | null>,
    field: 'title' | 'body',
    marker: '**' | '=='
  ) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    if (s === e) {
      ta.focus();
      // non-blocking nudge instead of a jarring alert
      setEmphHint('강조할 글자를 드래그로 선택한 뒤 눌러주세요');
      setTimeout(() => setEmphHint(''), 2600);
      return;
    }
    setEmphHint('');
    const picked = value.slice(s, e);
    // toggle off when the selection is already wrapped
    const wrapped = value.slice(s - 2, s) === marker && value.slice(e, e + 2) === marker;
    const next = wrapped
      ? value.slice(0, s - 2) + picked + value.slice(e + 2)
      : value.slice(0, s) + marker + picked + marker + value.slice(e);
    updateCard(sel, { [field]: next } as Partial<Card>);
    requestAnimationFrame(() => {
      ta.focus();
      const from = wrapped ? s - 2 : s;
      ta.setSelectionRange(from, from + picked.length + (wrapped ? 0 : 4));
    });
  }

  /** Strip every emphasis marker from the field (plain text). */
  function clearEmphasis(field: 'title' | 'body') {
    updateCard(sel, { [field]: stripEmphasis(String(card[field] || '')) } as Partial<Card>);
  }
  const hasEmphasis = (field: 'title' | 'body') => {
    const v = String(card[field] || '');
    return v.includes('**') || v.includes('==');
  };

  const emphasisTools = (ref: React.RefObject<HTMLTextAreaElement | null>, field: 'title' | 'body') => (
    <span className="mtools" role="group" aria-label="텍스트 강조">
      <button type="button" className="mtool" title="선택한 글자 굵게" onClick={() => wrapSelection(ref, field, '**')}>
        <b>B</b>
      </button>
      <button type="button" className="mtool" title="선택한 글자 형광펜" onClick={() => wrapSelection(ref, field, '==')}>
        <i className="hl">가</i>
      </button>
      {hasEmphasis(field) && (
        <button type="button" className="mtool mtool--clear" title="이 칸의 강조 모두 지우기" onClick={() => clearEmphasis(field)}>
          강조 지우기
        </button>
      )}
    </span>
  );
  // admin only — server re-verifies the session cookie before any (paid) generation
  async function requestImage(c: Card): Promise<string> {
    // body cards carry the substance in `body` — fold it into the prompt so the
    // image reflects the card's actual content, not just a generic heading
    const promptTitle = c.body ? `${c.title} — ${c.body.slice(0, 90)}` : c.title;
    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: promptTitle, category: c.category || '뉴스', style: magazine.coverStyle || 'trend', imageStyle: magazine.benchImagePrompt || '' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '생성 실패');
    // squeeze the megabyte PNG base64 down before it hits state/sessionStorage
    return resizeDataUrl(data.image);
  }

  /** Image patch + readability: a white body card gains the dark scrim, so flip its default ink text to white. */
  function imagePatch(c: Card, imageUrl: string): Partial<Card> {
    return c.kind === 'body' && c.textColor === '#111110'
      ? { imageUrl, textColor: '#ffffff' }
      : { imageUrl };
  }

  async function genImage() {
    if (!isAdmin || imgBusy || batchBusy) return;
    setImgBusy(true);
    try {
      updateCard(sel, imagePatch(card, await requestImage(card)));
    } catch (e: any) {
      alert('AI 이미지 생성 실패: ' + (e.message || ''));
    } finally {
      setImgBusy(false);
    }
  }

  /** Batch: fill every card that doesn't have an image yet, sequentially. */
  async function genAllImages() {
    if (!isAdmin || imgBusy || batchBusy) return;
    const targets = cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.imageUrl);
    if (targets.length === 0) {
      alert('모든 카드에 이미 이미지가 있어요. 비우고 싶은 카드에서 ↺로 제거한 뒤 다시 시도하세요.');
      return;
    }
    if (!window.confirm(`이미지가 없는 카드 ${targets.length}장의 배경을 AI로 일괄 생성할까요?\n(이미지가 있는 카드는 건너뛰어요)`)) return;
    setBatchBusy(true);
    let failed = 0;
    for (let k = 0; k < targets.length; k++) {
      const { c, i } = targets[k];
      setBatchMsg(`${k + 1}/${targets.length} 생성 중…`);
      try {
        updateCard(i, imagePatch(c, await requestImage(c)));
      } catch {
        failed++;
      }
    }
    setBatchBusy(false);
    setBatchMsg('');
    if (failed > 0) alert(`${failed}장은 생성에 실패했어요. 해당 카드에서 개별 생성으로 다시 시도해 주세요.`);
  }

  return (
    <div className="editor">
      <h1 className="sr-only">2단계 · 카드 편집</h1>
      {/* rail */}
      <nav className="rail" aria-label={`카드 ${cards.length}컷`}>
        <div className="rail__lb" aria-hidden="true">{cards.length}컷 · 카드</div>
        <div className="thumbs" role="group" aria-label="카드 선택">
          {cards.map((c, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === sel}
              aria-label={`${String(i + 1).padStart(2, '0')} ${kindLabelOf(c.kind)} 카드${c.title ? `: ${stripEmphasis(c.title)}` : ''}`}
              className={`thumb ${c.kind !== 'body' ? 'dark' : ''} ${i === sel ? 'is-on' : ''}`}
              onClick={() => setSel(i)}
            >
              <span className="tnum" aria-hidden="true">{String(i + 1).padStart(2, '0')} {kindLabelOf(c.kind)}</span>
              <CardFace card={c} magazine={magazine} ctx="thumb" ratio={ratio} total={cards.length} />
            </button>
          ))}
        </div>
      </nav>

      {/* canvas */}
      <div className="stage">
        <div className="stage__bar">
          <p className="aiflag"><span className="dot" aria-hidden="true" /> AI가 {cards.length}컷을 생성했어요 · 자유롭게 다듬어보세요</p>
        </div>
        <div className="canvas" role="group" aria-label={`${kindLabel} 카드 미리보기: ${stripEmphasis(card.title)}`}>
          {/* fixed 540px layout scaled down on mobile, so the preview keeps the
              exact text-to-card proportions of the exported 1080px PNG */}
          <div className="canvas__fit">
            <CardFace card={card} magazine={magazine} ctx="canvas" ratio={ratio} total={cards.length} />
          </div>
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
        <div className="insp__head"><h2>{kindLabel} 카드 편집</h2><span className="badge">{String(sel + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</span></div>
        <div className="insp__body">
          <div className="ig">
            <div className="ig__t" id={`${titleId}-img`}>이미지</div>
            <div className="btnrow" role="group" aria-labelledby={`${titleId}-img`}>
              <button className="minib" onClick={() => fileRef.current?.click()} aria-busy={uploading} aria-disabled={uploading}>{uploading ? '◌ 불러오는 중…' : '⤒ 이미지 변경'}</button>
              <button className="minib" style={{ flex: 'none', width: 44 }} aria-label="이미지 제거" onClick={onResetImage}>↺</button>
            </div>
            {isAdmin && (
              <>
                <button
                  className="minib"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={genImage}
                  aria-disabled={imgBusy || batchBusy}
                  aria-busy={imgBusy}
                  title="이 카드의 주제 기반 흑백 에디토리얼 배경을 생성합니다 (관리자 전용)"
                >
                  {imgBusy ? '◌ AI 이미지 생성 중…' : <><IconSpark width={13} height={13} /> 이 카드 AI 이미지</>}
                </button>
                <button
                  className="minib"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={genAllImages}
                  aria-disabled={imgBusy || batchBusy}
                  aria-busy={batchBusy}
                  title="이미지가 없는 카드 전체의 배경을 순서대로 생성합니다 (관리자 전용)"
                >
                  {batchBusy ? `◌ ${batchMsg}` : <><IconSpark width={13} height={13} /> 빈 카드 전체 일괄 생성</>}
                </button>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} aria-label="이미지 파일 선택" />
          </div>
          <div className="ig">
            <div className="ig__row">
              <label className="ig__t" htmlFor={titleId}>{card.kind === 'cover' ? '표지 헤드라인' : card.kind === 'cta' ? 'CTA 문구' : '소제목'} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 비우면 삭제</span></label>
              {emphasisTools(titleTaRef, 'title')}
            </div>
            <textarea ref={titleTaRef} id={titleId} className="ta" value={card.title} onChange={(e) => updateCard(sel, { title: e.target.value })} onBlur={() => { const c = cleanMarkers(card.title); if (c !== card.title) updateCard(sel, { title: c }); }} placeholder="비우면 카드에서 사라져요" />
            <p className="emhint">{emphHint || <>강조할 글자를 드래그 → <b>B</b>(굵게)·형광펜 버튼. 위 미리보기에 바로 반영돼요.</>}</p>
          </div>
          {(card.kind === 'body' || card.kind === 'cta') && (
            <div className="ig">
              <div className="ig__row">
                <label className="ig__t" htmlFor={`${titleId}-body`}>{card.kind === 'cta' ? '카피 문구' : '본문 텍스트'} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· 비우면 삭제</span></label>
                {emphasisTools(bodyTaRef, 'body')}
              </div>
              <textarea ref={bodyTaRef} id={`${titleId}-body`} className="ta" style={{ minHeight: card.kind === 'cta' ? 70 : 100 }} value={card.body || ''} onChange={(e) => updateCard(sel, { body: e.target.value })} onBlur={() => { const c = cleanMarkers(card.body || ''); if (c !== (card.body || '')) updateCard(sel, { body: c }); }} placeholder={card.kind === 'cta' ? '매거진 설정의 카피가 기본값이에요' : '비우면 카드에서 사라져요'} />
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
              <label className={`sw2 sw2--custom ${TEXT_COLORS.includes(card.textColor) ? '' : 'on'}`} title="원하는 색 직접 선택">
                <input
                  type="color"
                  value={card.textColor}
                  onChange={(e) => updateCard(sel, { textColor: e.target.value })}
                  aria-label="글자색 직접 선택"
                />
              </label>
            </div>
          </div>
          <div className="ig">
            <label className="ig__t" htmlFor={`${titleId}-font`}>글씨체</label>
            <div className="fontsel">
              <select
                id={`${titleId}-font`}
                className="input"
                value={card.fontFamily || ''}
                onChange={(e) => updateCard(sel, { fontFamily: e.target.value })}
                style={{ fontFamily: FONTS.find((f) => f.key === (card.fontFamily || ''))?.css }}
              >
                {FONTS.map((f) => (
                  <option key={f.key} value={f.key} style={{ fontFamily: f.css }}>{f.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="minib fontsel__all"
                title="이 글씨체를 전체 카드에 적용"
                onClick={() => { const ff = card.fontFamily || ''; cards.forEach((_, i) => updateCard(i, { fontFamily: ff })); }}
              >
                전체 적용
              </button>
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
              <span className="tog__lb">페이지 번호 ({String(sel + 1).padStart(2, '0')}/{String(cards.length).padStart(2, '0')})</span>
              <button type="button" role="switch" aria-checked={!card.hideNum} aria-label="페이지 번호 표시" className="switch" onClick={() => updateCard(sel, { hideNum: !card.hideNum })} />
            </div>
            {(card.kind === 'body' || card.kind === 'cta') && (
              <div className="tog">
                <span className="tog__lb">구분 라벨 ({card.kind === 'cta' ? 'CTA' : '본문'})</span>
                <button type="button" role="switch" aria-checked={!card.hideLabel} aria-label="구분 라벨 표시" className="switch" onClick={() => updateCard(sel, { hideLabel: !card.hideLabel })} />
              </div>
            )}
            {card.kind === 'cover' && (
              <div className="tog">
                <span className="tog__lb">넘김 유도 문구 (밀어서 보기 →)</span>
                <button type="button" role="switch" aria-checked={!card.hideSwipe} aria-label="넘김 유도 문구 표시" className="switch" onClick={() => updateCard(sel, { hideSwipe: !card.hideSwipe })} />
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
