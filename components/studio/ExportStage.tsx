'use client';

import { useEffect, useRef, useState } from 'react';
import type { Card, Magazine } from '@/types/db';
import CardFace from './CardFace';

const RENDER_SIZE = 540; // rendered at 540×540, exported at pixelRatio 2 → 1080×1080

function fileBase(magazine: Magazine) {
  // "INK Daily" → INK-DAILY (prototype: INK-DAILY-0604.ZIP); Korean-only names fall back to the handle
  const latin = (s: string) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).join('-').toUpperCase();
  const slug = latin(magazine.name) || latin(magazine.handle.replace('@', '')) || 'INK-CARDS';
  const d = new Date();
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${slug}-${mmdd}`;
}

function saveUrl(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

export default function ExportStage({
  cards,
  magazine,
  caption,
  hashtags,
  source,
  onGo,
}: {
  cards: Card[];
  magazine: Magazine;
  caption: string;
  hashtags: string[];
  source: string;
  onGo: (n: number) => void;
}) {
  const [cur, setCur] = useState(0);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // 'zip' | 'png-{i}'
  const [status, setStatus] = useState('');
  const renderRef = useRef<HTMLDivElement>(null);
  const n = cards.length;
  const kindLabel = (k: Card['kind']) => (k === 'cover' ? '표지' : k === 'cta' ? 'CTA' : '본문');

  // new generation → start the preview from the cover again
  useEffect(() => { setCur(0); }, [cards]);

  function slide(dir: number) {
    setCur((c) => (c + dir + n) % n);
  }

  function onCarouselKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); slide(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); slide(1); }
  }

  function copyCaption() {
    const txt = `${caption}\n\n${hashtags.join(' ')}\n\n출처 · ${source}`;
    navigator.clipboard?.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function renderCard(i: number): Promise<string> {
    const node = renderRef.current?.children[i] as HTMLElement | undefined;
    if (!node) throw new Error('render node missing');
    const { toPng } = await import('html-to-image');
    return toPng(node, { pixelRatio: 2, width: RENDER_SIZE, height: RENDER_SIZE, cacheBust: true });
  }

  // aria-disabled + a guard (not the `disabled` attribute) so the clicked
  // button keeps keyboard focus while the download runs
  async function downloadOne(i: number) {
    if (busy) return;
    setBusy(`png-${i}`);
    setStatus(`${i + 1}번 카드를 만드는 중…`);
    try {
      saveUrl(await renderCard(i), `${fileBase(magazine)}-0${i + 1}.png`);
      setStatus(`${i + 1}번 카드 PNG를 저장했어요`);
    } catch {
      setStatus('카드 렌더에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadZip() {
    if (busy) return;
    setBusy('zip');
    setStatus('전체 ZIP을 만드는 중…');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (let i = 0; i < n; i++) {
        const dataUrl = await renderCard(i);
        zip.file(`${fileBase(magazine)}-0${i + 1}.png`, dataUrl.split(',')[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      saveUrl(url, `${fileBase(magazine)}.zip`);
      URL.revokeObjectURL(url);
      setStatus(`카드 ${n}장을 ZIP으로 저장했어요`);
    } catch {
      setStatus('ZIP 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="export">
      <h1 className="sr-only">3단계 · 내보내기</h1>
      <div className="export__l">
        <span className="done"><span className="o" aria-hidden="true">✓</span> Ready to post</span>
        <h2 id="export-head">피드에 올릴 준비가 됐어요</h2>
        <p>인스타그램 캐러셀로 어떻게 보일지 미리 확인하고, 카드와 캡션을 받아 그대로 올리세요.</p>

        <div className="phone">
          <div className="phone__bar"><span className="av" aria-hidden="true" /><span className="h">{magazine.handle.replace('@', '')}</span><span className="more" aria-hidden="true">⋯</span></div>
          <div
            className="carousel"
            role="group"
            aria-roledescription="캐러셀"
            aria-label="카드뉴스 미리보기"
            tabIndex={0}
            onKeyDown={onCarouselKey}
          >
            <div className="carousel__track" style={{ transform: `translateX(${-cur * 100}%)` }}>
              {cards.map((c, i) => (
                <div className="cslide" key={i} style={{ position: 'relative' }} role="group" aria-roledescription="슬라이드" aria-label={`${i + 1} / ${n} · ${kindLabel(c.kind)}`} aria-hidden={i !== cur}>
                  <CardFace card={c} magazine={magazine} ctx="slide" />
                </div>
              ))}
            </div>
            <span className="carousel__count" aria-live="polite">{cur + 1}/{n}</span>
            <button className="carousel__nav prev" aria-label="이전 슬라이드" onClick={() => slide(-1)}>‹</button>
            <button className="carousel__nav next" aria-label="다음 슬라이드" onClick={() => slide(1)}>›</button>
          </div>
          <div className="dots" aria-hidden="true">
            {cards.map((_, i) => <i key={i} className={i === cur ? 'on' : ''} />)}
          </div>
          <div className="phone__cap"><b>{magazine.handle.replace('@', '')}</b> {caption.slice(0, 40)}…</div>
        </div>
      </div>

      <div className="export__r">
        <div className="zip">
          <h3>전체 한 번에 받기</h3>
          <p>{n}장의 카드를 ZIP 한 파일로 내려받아요.</p>
          <button className="btn btn--lg" onClick={downloadZip} aria-disabled={busy !== null} aria-busy={busy === 'zip'}>
            {busy === 'zip' ? '◌ 만드는 중…' : '⤓ 전체 ZIP 다운로드'}
          </button>
          <div className="meta"><span>{fileBase(magazine)}.ZIP</span><span>{n} PNG · 1080 × 1080</span></div>
        </div>
        <div className="panel">
          <div className="panel__h"><h3>카드 개별 받기</h3><span className="tag">1080 × 1080</span></div>
          <div className="panel__b">
            <div className="dlrow">
              {cards.map((c, i) => (
                <button className="minib" key={i} onClick={() => downloadOne(i)} aria-disabled={busy !== null} aria-busy={busy === `png-${i}`} aria-label={`${i + 1}번 ${kindLabel(c.kind)} 카드 PNG 다운로드`}>
                  {busy === `png-${i}` ? '◌' : <>0{i + 1} <span aria-hidden="true">⤓</span></>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel__h"><h3>캡션 · 해시태그</h3><button className="copy" onClick={copyCaption}>{copied ? '✓ 복사됨' : '⧉ 전체 복사'}</button></div>
          <div className="panel__b">
            <p className="cap">{caption}</p>
            <div className="hashbox">{hashtags.map((h, i) => (i < 4 ? <b key={i}>{h} </b> : <span key={i}>{h} </span>))}</div>
            <p className="src-note">출처 · {source} — 기사 제목·요약문을 바탕으로 제작. 사진은 직접 업로드한 이미지입니다.</p>
            <span className="sr-only" role="status" aria-live="polite">{copied ? '캡션을 복사했습니다' : ''}</span>
          </div>
        </div>
        <span className="sr-only" role="status" aria-live="polite">{status}</span>
        <div className="dlrow">
          <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => onGo(2)}>← 편집으로</button>
          <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => onGo(1)}>새 카드뉴스</button>
        </div>
      </div>

      {/* offscreen 540×540 render targets for PNG/ZIP export (pixelRatio 2 → 1080×1080) */}
      <div ref={renderRef} aria-hidden style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }}>
        {cards.map((c, i) => (
          <div key={i} className="canvas" style={{ width: RENDER_SIZE, maxWidth: RENDER_SIZE, height: RENDER_SIZE }}>
            <CardFace card={c} magazine={magazine} ctx="canvas" hint={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
