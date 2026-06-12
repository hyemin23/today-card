import type { ReactNode } from 'react';
import type { Card, Magazine } from '@/types/db';

type Ctx = 'canvas' | 'slide' | 'thumb';

/** 3×3 position grid, row-major: v = vertical block placement, t = text alignment */
const ALIGN: Record<number, { v: 'flex-start' | 'center' | 'flex-end'; t: 'left' | 'center' | 'right' }> = {
  0: { v: 'flex-start', t: 'left' }, 1: { v: 'flex-start', t: 'center' }, 2: { v: 'flex-start', t: 'right' },
  3: { v: 'center', t: 'left' }, 4: { v: 'center', t: 'center' }, 5: { v: 'center', t: 'right' },
  6: { v: 'flex-end', t: 'left' }, 7: { v: 'flex-end', t: 'center' }, 8: { v: 'flex-end', t: 'right' },
};

export function alignIndex(align: string): number {
  const n = Number(align);
  return Number.isNaN(n) || !(n in ALIGN) ? 6 : n;
}

export default function CardFace({ card, magazine, ctx, hint = true }: { card: Card; magazine: Magazine; ctx: Ctx; hint?: boolean }) {
  const dark = card.kind !== 'body';
  const bg = dark ? magazine.bgColor : '#ffffff';
  const fg = card.textColor || (dark ? '#ffffff' : '#111110');
  const pad = ctx === 'canvas' ? 40 : ctx === 'slide' ? 22 : 12;
  // prototype slideHTML: cover 25 / cta 23 / body 21
  const slideBase = card.kind === 'cover' ? 25 : card.kind === 'cta' ? 23 : 21;
  const titleBase = ctx === 'canvas' ? 42 : ctx === 'slide' ? slideBase : 11;
  const titleSize = Math.round(titleBase * (ctx === 'thumb' ? 1 : card.fontScale));
  const align = ALIGN[alignIndex(card.align)];
  const num = `0${card.idx + 1} / 05`;
  const mono = { fontFamily: 'var(--mono)' } as const;

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, color: fg, overflow: 'hidden' }}>
      {card.imageUrl && (
        <img src={card.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {card.kind === 'cover' && !card.imageUrl && (
        ctx === 'canvas' && hint ? (
          /* studio.css .canvas .imgslot — hatch + upload hint, visible under the gradient like the prototype */
          <div className="imgslot">
            <div className="ph">
              <div className="ic">⤒</div>
              <p>이미지를 올려주세요</p>
              <span>저작권 보호를 위해 기사 사진은 자동으로 넣지 않아요</span>
            </div>
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,#1b1b1a,#1b1b1a 12px,#202020 12px,#202020 24px)' }} />
        )
      )}
      {dark && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(17,17,16,.82),rgba(17,17,16,.2) 48%,rgba(17,17,16,.55))' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, padding: pad, display: 'flex', flexDirection: 'column' }}>
        {ctx !== 'thumb' && (() => {
          const numEl = card.hideNum ? null : <span>{num}</span>;
          const pill = card.category ? <span style={{ border: `1px solid ${dark ? 'rgba(255,255,255,.4)' : 'rgba(17,17,16,.3)'}`, borderRadius: 100, padding: '4px 10px' }}>{card.category}</span> : null;
          const label = card.hideLabel ? null : <span>{card.kind === 'cta' ? 'CTA' : '본문'}</span>;
          let left: ReactNode = null, right: ReactNode = null;
          if (card.kind === 'cover') { left = pill; right = numEl; }
          else if (card.kind === 'body') { left = label; right = numEl; }
          else { left = numEl; right = label; }
          if (!left && !right) return null;
          return (
            <div style={{ ...mono, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: ctx === 'slide' ? 9 : 11, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.7 }}>
              {left || <span />}{right || <span />}
            </div>
          );
        })()}

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: align.v, textAlign: align.t }}>
          {ctx !== 'thumb' && card.kind === 'cta' && magazine.logoUrl && (
            <img
              src={magazine.logoUrl}
              alt=""
              style={{
                height: ctx === 'canvas' ? 44 : 28,
                width: 'auto',
                objectFit: 'contain',
                marginBottom: ctx === 'canvas' ? 14 : 8,
                alignSelf: align.t === 'center' ? 'center' : align.t === 'right' ? 'flex-end' : 'flex-start',
              }}
            />
          )}
          <div style={{ fontFamily: 'var(--serif)', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.08, fontSize: titleSize, whiteSpace: 'pre-line', marginTop: align.v === 'flex-start' ? (ctx === 'thumb' ? 14 : 16) : 0 }}>
            {card.title}
          </div>
          {ctx !== 'thumb' && card.kind === 'body' && card.body && (
            <>
              <div style={{ height: 1, background: 'currentColor', opacity: 0.16, margin: `${ctx === 'canvas' ? 16 : 10}px 0` }} />
              <div style={{ fontSize: ctx === 'canvas' ? 15 : 11, lineHeight: 1.55, opacity: 0.78, whiteSpace: 'pre-line' }}>{card.body}</div>
            </>
          )}
          {ctx !== 'thumb' && card.kind === 'cta' && (() => {
            const tags = (card.hashtags || []).filter(Boolean);
            return (
              <>
                <div style={{ height: 1, background: 'currentColor', opacity: 0.18, margin: `${ctx === 'canvas' ? 16 : 10}px 0` }} />
                {tags.length > 0 && <div style={{ fontSize: ctx === 'canvas' ? 13 : 10, opacity: 0.7, lineHeight: 1.6 }}>{tags.join(' ')}</div>}
                {magazine.handle && !card.hideHandle && <div style={{ ...mono, fontSize: ctx === 'canvas' ? 11 : 9, opacity: 0.55, marginTop: 8 }}>{magazine.handle} ↗</div>}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
