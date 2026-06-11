'use client';

import { useRef } from 'react';
import type { Card, Magazine } from '@/types/db';
import CardFace, { alignIndex } from './CardFace';
import { TEXT_COLORS } from './data';

export default function EditorStage({
  cards,
  sel,
  setSel,
  updateCard,
  magazine,
  onGo,
}: {
  cards: Card[];
  sel: number;
  setSel: (i: number) => void;
  updateCard: (idx: number, patch: Partial<Card>) => void;
  magazine: Magazine;
  onGo: (n: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const card = cards[sel];
  if (!card) return null;

  const kindLabel = card.kind === 'cover' ? '표지' : card.kind === 'cta' ? 'CTA' : '본문';

  function releaseImage(url?: string | null) {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      releaseImage(card.imageUrl);
      updateCard(sel, { imageUrl: URL.createObjectURL(f) });
    }
    e.target.value = ''; // allow re-selecting the same file
  }
  function onResetImage() {
    releaseImage(card.imageUrl);
    updateCard(sel, { imageUrl: null });
  }

  return (
    <div className="editor">
      {/* rail */}
      <aside className="rail">
        <div className="rail__lb">5컷 · 카드</div>
        <div className="thumbs">
          {cards.map((c, i) => (
            <div
              key={i}
              className={`thumb ${c.kind !== 'body' ? 'dark' : ''} ${i === sel ? 'is-on' : ''}`}
              onClick={() => setSel(i)}
            >
              <span className="tnum">0{i + 1} {c.kind === 'cover' ? '표지' : c.kind === 'cta' ? 'CTA' : '본문'}</span>
              <CardFace card={c} magazine={magazine} ctx="thumb" />
            </div>
          ))}
        </div>
        <div className="rail__add">＋ 카드 추가</div>
      </aside>

      {/* canvas */}
      <div className="stage">
        <div className="stage__bar">
          <div className="aiflag"><span className="dot" /> AI가 5컷을 생성했어요 · 자유롭게 다듬어보세요</div>
          <div className="zoom"><button>−</button><span>72%</span><button>+</button></div>
        </div>
        <div className="canvas">
          <CardFace card={card} magazine={magazine} ctx="canvas" />
        </div>
        <div className="stage__nav">
          <button className="btn btn--ghost btn--sm" onClick={() => setSel(Math.max(0, sel - 1))}>← 이전 카드</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setSel(Math.min(cards.length - 1, sel + 1))}>다음 카드 →</button>
        </div>
      </div>

      {/* inspector */}
      <aside className="insp">
        <div className="insp__head"><h3>{kindLabel} 카드 편집</h3><span className="badge">0{sel + 1} / 05</span></div>
        <div className="insp__body">
          <div className="ig">
            <div className="ig__t">이미지</div>
            <div className="btnrow">
              <button className="minib" onClick={() => fileRef.current?.click()}>⤒ 이미지 변경</button>
              <button className="minib" style={{ flex: 'none', width: 44 }} onClick={onResetImage}>↺</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
          </div>
          <div className="ig">
            <div className="ig__t">제목 텍스트</div>
            <textarea className="ta" value={card.title} onChange={(e) => updateCard(sel, { title: e.target.value })} />
          </div>
          <div className="ig">
            <div className="ig__t">글자색</div>
            <div className="swrow">
              {TEXT_COLORS.map((c) => (
                <span key={c} className={`sw2 ${card.textColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => updateCard(sel, { textColor: c })} />
              ))}
            </div>
          </div>
          <div className="ig">
            <div className="ig__t">글자 크기</div>
            <input className="range" type="range" min={0.7} max={1.5} step={0.05} value={card.fontScale} onChange={(e) => updateCard(sel, { fontScale: Number(e.target.value) })} />
            <div className="rlabels"><span>S</span><span>{Math.round(42 * card.fontScale)} PX</span><span>XL</span></div>
          </div>
          <div className="ig">
            <div className="ig__t">위치 · 정렬</div>
            <div className="align">
              {Array.from({ length: 9 }).map((_, i) => (
                <button key={i} className={alignIndex(card.align) === i ? 'on' : ''} onClick={() => updateCard(sel, { align: String(i) })}><span className="d" /></button>
              ))}
            </div>
          </div>
          <div className="ig">
            <div className="ig__t">AI 다시 쓰기</div>
            <button className="btn btn--ghost btn--sm" style={{ width: '100%' }}>↻ 이 카드 문구 다시 생성</button>
          </div>
        </div>
        <div className="insp__foot">
          <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => onGo(1)}>← 주제</button>
          <button className="btn btn--dark btn--sm" style={{ flex: 2 }} onClick={() => onGo(3)}>완성 · 내보내기 →</button>
        </div>
      </aside>
    </div>
  );
}
