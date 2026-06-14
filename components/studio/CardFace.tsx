'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Card, Magazine } from '@/types/db';
import { FONT_CSS } from './data';

type Ctx = 'canvas' | 'slide' | 'thumb';

/* ---------- inline emphasis: **굵게** and ==형광펜== ----------
   Carousel readers skim — the generator (and the editor toolbar) mark the
   key phrase per card so it pops without reading the full text.

   The parser is deliberately tolerant: it matches valid **x** / ==x== pairs
   and SCRUBS any leftover runs of 2+ marker chars from the plain text, so a
   malformed AI output like "====황금비율==?====" can never leak literal '='
   onto a card. */

const EMPH_RE = /(\*\*[^*\n]+?\*\*|==[^=\n]+?==)/g;

type EmphPart = { type: 'plain' | 'bold' | 'hl'; text: string };

function splitEmphasis(text: string): EmphPart[] {
  const parts: EmphPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  EMPH_RE.lastIndex = 0;
  while ((m = EMPH_RE.exec(text))) {
    if (m.index > last) parts.push({ type: 'plain', text: text.slice(last, m.index) });
    parts.push(m[0].startsWith('**')
      ? { type: 'bold', text: m[0].slice(2, -2) }
      : { type: 'hl', text: m[0].slice(2, -2) });
    last = EMPH_RE.lastIndex;
  }
  if (last < text.length) parts.push({ type: 'plain', text: text.slice(last) });
  // scrub stray marker runs (2+) that aren't part of a matched pair
  for (const p of parts) if (p.type === 'plain') p.text = p.text.replace(/={2,}/g, '').replace(/\*{2,}/g, '');
  return parts;
}

/** Canonical clean string — used by the editor's "정리" button and AI output sanitize. */
export function cleanMarkers(text: string): string {
  if (!text || (!text.includes('**') && !text.includes('=='))) return text;
  return splitEmphasis(text)
    .map((p) => (p.type === 'bold' ? `**${p.text}**` : p.type === 'hl' ? `==${p.text}==` : p.text))
    .join('');
}

/** Plain text for aria-labels / thumbnails — markers and strays removed. */
export function stripEmphasis(text: string): string {
  if (!text) return text;
  return splitEmphasis(text).map((p) => p.text).join('');
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}

function renderEmphasis(text: string, accent: string, surfaceLight: boolean): ReactNode {
  if (!text || (!text.includes('**') && !text.includes('=='))) return text;
  // the accent must contrast with the card surface; same-side accents fall back to ink/white
  const hlBg = isLight(accent) === surfaceLight ? (surfaceLight ? '#111110' : '#ffffff') : accent;
  const hlStyle: CSSProperties = {
    background: hlBg,
    color: isLight(hlBg) ? '#111110' : '#ffffff',
    padding: '0 0.14em',
    margin: '0 0.02em',
    borderRadius: 3,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
  return splitEmphasis(text).map((p, i) => {
    if (p.type === 'bold') return <b key={i} style={{ fontWeight: 900 }}>{p.text}</b>;
    if (p.type === 'hl') return <mark key={i} style={hlStyle}>{p.text}</mark>;
    return <span key={i}>{p.text}</span>;
  });
}

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
  /* 'trend' cover layout (benchmark: full-bleed visual, letterspaced watermark
     top-right, outlined category pill sitting right above the headline) */
  const trendCover = ctx !== 'thumb' && card.kind === 'cover' && magazine.coverStyle === 'trend';
  // cards with the dark scrim (dark kinds or any photo) read as dark surfaces
  const surfaceLight = !dark && !card.imageUrl;
  const em = (text: string) => renderEmphasis(text, magazine.accentColor, surfaceLight);
  // chosen headline font (falls back to Pretendard); handwriting needs a touch more line-height
  const headlineFont = FONT_CSS[card.fontFamily || ''] || FONT_CSS[''];

  const vOrigin = align.v === 'flex-start' ? 'top' : align.v === 'flex-end' ? 'bottom' : 'center';
  const hOrigin = align.t === 'left' ? 'left' : align.t === 'right' ? 'right' : 'center';

  // AUTO-FIT: a long headline/body (or a big font-size) must never be clipped by the
  // card's overflow:hidden in the 1080×1080 export. Measure the text block's natural
  // height vs the available area and shrink it (transform only — no reflow) so it always
  // fits. Re-runs once webfonts settle, since their metrics change the line count.
  const areaRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ctx === 'thumb') return;
    const area = areaRef.current;
    const block = fitRef.current;
    if (!area || !block) return;
    const apply = () => {
      block.style.transform = 'none';
      const avail = area.clientHeight;
      const natural = block.scrollHeight;
      const s = natural > avail && natural > 0 ? Math.max(0.4, avail / natural) : 1;
      block.style.transform = s < 1 ? `scale(${s})` : 'none';
    };
    apply();
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) apply(); });
    return () => { alive = false; };
  }, [card.title, card.body, (card.hashtags || []).join(' '), card.fontFamily, card.fontScale, card.category, card.hideNum, card.hideLabel, card.hideHandle, card.hideSwipe, ctx, magazine.handle, magazine.logoUrl, magazine.coverStyle]);

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
      {(dark || card.imageUrl) && (
        /* the scrim also covers body cards once they carry an image — without it
           text of either color drowns in the photo */
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(17,17,16,.82),rgba(17,17,16,.2) 48%,rgba(17,17,16,.55))' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, padding: pad, display: 'flex', flexDirection: 'column' }}>
        {trendCover ? (
          /* watermark-style brand mark, page number optional */
          <div style={{ ...mono, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: ctx === 'slide' ? 8.5 : 11, letterSpacing: '.32em', textTransform: 'uppercase', opacity: 0.55 }}>
            <span>{card.hideNum ? '' : num}</span>
            <span>{magazine.logoText || magazine.name}</span>
          </div>
        ) : ctx !== 'thumb' && (() => {
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

        <div ref={areaRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: align.v }}>
          <div ref={fitRef} style={{ display: 'flex', flexDirection: 'column', textAlign: align.t, transformOrigin: `${hOrigin} ${vOrigin}`, willChange: 'transform' }}>
          {trendCover && card.category && (
            <span
              style={{
                ...mono,
                alignSelf: align.t === 'center' ? 'center' : align.t === 'right' ? 'flex-end' : 'flex-start',
                fontSize: ctx === 'canvas' ? 12 : 9.5,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                border: '1.5px solid rgba(255,255,255,.85)',
                background: 'rgba(17,17,16,.35)',
                borderRadius: 100,
                padding: ctx === 'canvas' ? '6px 14px' : '4px 11px',
                marginBottom: ctx === 'canvas' ? 14 : 9,
              }}
            >
              {card.category}
            </span>
          )}
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
          <div style={{ fontFamily: headlineFont, fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.16, fontSize: titleSize, whiteSpace: 'pre-line', marginTop: align.v === 'flex-start' ? (ctx === 'thumb' ? 14 : 16) : 0 }}>
            {ctx === 'thumb' ? stripEmphasis(card.title) : em(card.title)}
          </div>
          {ctx !== 'thumb' && card.kind === 'body' && card.body && (
            <>
              <div style={{ height: 1, background: 'currentColor', opacity: 0.16, margin: `${ctx === 'canvas' ? 16 : 10}px 0` }} />
              <div style={{ fontSize: ctx === 'canvas' ? 15 : 11, lineHeight: 1.6, opacity: 0.85, whiteSpace: 'pre-line' }}>{em(card.body)}</div>
            </>
          )}
          {ctx !== 'thumb' && card.kind === 'cta' && (() => {
            const tags = (card.hashtags || []).filter(Boolean);
            return (
              <>
                {card.body && (
                  /* CTA 카피도 헤드라인처럼 글씨체·글자 크기 슬라이더에 반응 (줄바꿈은 pre-line) */
                  <div style={{ fontFamily: headlineFont, fontSize: Math.round((ctx === 'canvas' ? 14 : 10.5) * card.fontScale), lineHeight: 1.6, opacity: 0.8, whiteSpace: 'pre-line', marginTop: ctx === 'canvas' ? 12 : 8 }}>{em(card.body)}</div>
                )}
                <div style={{ height: 1, background: 'currentColor', opacity: 0.18, margin: `${ctx === 'canvas' ? 16 : 10}px 0` }} />
                {tags.length > 0 && <div style={{ fontSize: ctx === 'canvas' ? 13 : 10, opacity: 0.7, lineHeight: 1.6 }}>{tags.join(' ')}</div>}
                {magazine.handle && !card.hideHandle && <div style={{ ...mono, fontSize: ctx === 'canvas' ? 11 : 9, opacity: 0.55, marginTop: 8 }}>{magazine.handle} ↗</div>}
              </>
            );
          })()}
          </div>
        </div>
        {/* swipe cue — covers that hint "more inside" get swiped more (toggleable) */}
        {ctx !== 'thumb' && card.kind === 'cover' && !card.hideSwipe && (
          <div style={{ ...mono, fontSize: ctx === 'canvas' ? 11 : 9, letterSpacing: '.1em', opacity: 0.75, textAlign: 'right', marginTop: ctx === 'canvas' ? 14 : 8 }}>
            밀어서 보기 →
          </div>
        )}
      </div>
    </div>
  );
}
