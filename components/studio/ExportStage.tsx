'use client';

import { useEffect, useRef, useState } from 'react';
import type { Card, Magazine } from '@/types/db';
import CardFace from './CardFace';
import { renderCardNode, downloadPngZip, saveUrl } from '@/lib/cardExport';
import './export-fixes.css';

const RENDER_SIZE = 540; // rendered at 540×540, exported at pixelRatio 2 → 1080×1080

function fileBase(magazine: Magazine) {
  // "INK Daily" → INK-DAILY (prototype: INK-DAILY-0604.ZIP); Korean-only names fall back to the handle
  const latin = (s: string) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).join('-').toUpperCase();
  const slug = latin(magazine.name) || latin(magazine.handle.replace('@', '')) || 'INK-CARDS';
  const d = new Date();
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${slug}-${mmdd}`;
}

export default function ExportStage({
  cards,
  magazine,
  caption,
  hashtags,
  source,
  onGo,
  ratio,
  setRatio,
}: {
  cards: Card[];
  magazine: Magazine;
  caption: string;
  hashtags: string[];
  source: string;
  onGo: (n: number) => void;
  ratio: '1:1' | '4:5';
  setRatio: (r: '1:1' | '4:5') => void;
}) {
  const [cur, setCur] = useState(0);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // 'zip' | 'png-{i}' | 'share'
  const [status, setStatus] = useState('');
  const [statusErr, setStatusErr] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const renderRef = useRef<HTMLDivElement>(null);
  const swipeX = useRef<number | null>(null);
  const n = cards.length;
  // 4:5 세로(1080×1350)는 RENDER_SIZE를 세로로 늘려 렌더 → pixelRatio 2로 1080폭 유지
  const renderH = ratio === '4:5' ? Math.round((RENDER_SIZE * 5) / 4) : RENDER_SIZE;
  const dimLabel = `1080 × ${ratio === '4:5' ? 1350 : 1080}`;
  const kindLabel = (k: Card['kind']) => (k === 'cover' ? '표지' : k === 'cta' ? 'CTA' : '본문');

  // new generation → start the preview from the cover again
  useEffect(() => { setCur(0); }, [cards]);

  // feature-detect Web Share (with files) after mount → no hydration mismatch
  useEffect(() => {
    try {
      const probe = new File([new Blob()], 'probe.png', { type: 'image/png' });
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShare(false);
    }
  }, []);

  function report(msg: string, isErr = false) {
    setStatus(msg);
    setStatusErr(isErr);
  }

  function slide(dir: number) {
    setCur((c) => (c + dir + n) % n);
  }

  function onCarouselKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); slide(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); slide(1); }
  }

  // touch swipe on the track (touch-action: pan-y keeps vertical scroll working;
  // the browser fires pointercancel when it takes over for a vertical pan)
  function onTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeX.current = e.clientX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }

  function onTrackPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (swipeX.current === null) return;
    const dx = e.clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) >= 40) slide(dx < 0 ? 1 : -1);
  }

  function onTrackPointerCancel() {
    swipeX.current = null;
  }

  function legacyCopy(txt: string): boolean {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function copyCaption() {
    // 해시태그가 없으면(기본값) 빈 줄을 만들지 않는다
    const tags = hashtags.filter(Boolean).join(' ');
    const txt = [caption, tags, `출처 · ${source}`].filter(Boolean).join('\n\n');
    let ok = false;
    try {
      await navigator.clipboard.writeText(txt);
      ok = true;
    } catch {
      ok = legacyCopy(txt);
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      report('복사에 실패했어요. 캡션을 길게 눌러 직접 복사해주세요', true);
    }
  }

  async function renderCard(i: number): Promise<string> {
    const node = renderRef.current?.children[i] as HTMLElement | undefined;
    if (!node) throw new Error('render node missing');
    return renderCardNode(node, { width: RENDER_SIZE, height: renderH });
  }

  // aria-disabled + a guard (not the `disabled` attribute) so the clicked
  // button keeps keyboard focus while the download runs
  async function downloadOne(i: number) {
    if (busy) return;
    setBusy(`png-${i}`);
    report(`${i + 1}번 카드를 만드는 중…`);
    try {
      saveUrl(await renderCard(i), `${fileBase(magazine)}-0${i + 1}.png`);
      report(`${i + 1}번 카드 PNG를 저장했어요`);
    } catch {
      report('카드 렌더에 실패했어요. 잠시 후 다시 시도해 주세요.', true);
    } finally {
      setBusy(null);
    }
  }

  async function downloadZip() {
    if (busy) return;
    setBusy('zip');
    report('전체 ZIP을 만드는 중…');
    try {
      const base = fileBase(magazine);
      const files: { name: string; dataUrl: string }[] = [];
      for (let i = 0; i < n; i++) {
        report(`${i + 1}/${n}장 렌더 중…`);
        files.push({ name: `${base}-0${i + 1}.png`, dataUrl: await renderCard(i) });
      }
      report('ZIP 압축 중…');
      await downloadPngZip(files, `${base}.zip`);
      report(`카드 ${n}장을 ZIP으로 저장했어요`);
    } catch {
      report('ZIP 생성에 실패했어요. 잠시 후 다시 시도해 주세요.', true);
    } finally {
      setBusy(null);
    }
  }

  async function shareCards() {
    if (busy) return;
    setBusy('share');
    report('공유할 이미지를 만드는 중…');
    try {
      const files: File[] = [];
      for (let i = 0; i < n; i++) {
        report(`${i + 1}/${n}장 렌더 중…`);
        const dataUrl = await renderCard(i);
        const blob = await (await fetch(dataUrl)).blob();
        files.push(new File([blob], `${fileBase(magazine)}-0${i + 1}.png`, { type: 'image/png' }));
      }
      if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) {
        throw new Error('files not shareable');
      }
      await navigator.share({ files, title: `${magazine.name} 카드뉴스` });
      report(`카드 ${n}장을 공유했어요`);
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') report(''); // user closed the share sheet
      else report('공유에 실패했어요. 아래 ZIP 다운로드를 이용해 주세요.', true);
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
            <div
              className="carousel__track"
              style={{ transform: `translateX(${-cur * 100}%)` }}
              onPointerDown={onTrackPointerDown}
              onPointerUp={onTrackPointerUp}
              onPointerCancel={onTrackPointerCancel}
            >
              {cards.map((c, i) => (
                <div className="cslide" key={i} style={{ position: 'relative' }} role="group" aria-roledescription="슬라이드" aria-label={`${i + 1} / ${n} · ${kindLabel(c.kind)}`} aria-hidden={i !== cur}>
                  <CardFace card={c} magazine={magazine} ctx="slide" ratio={ratio} total={n} />
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
        <div className="ratiosel" role="group" aria-label="이미지 비율">
          <span className="ratiosel__lb">비율</span>
          <button type="button" className={ratio === '1:1' ? 'on' : ''} aria-pressed={ratio === '1:1'} onClick={() => setRatio('1:1')}>정사각 1:1</button>
          <button type="button" className={ratio === '4:5' ? 'on' : ''} aria-pressed={ratio === '4:5'} onClick={() => setRatio('4:5')}>세로 4:5</button>
        </div>
        <div className="zip">
          <h3>전체 한 번에 받기</h3>
          <p>{canShare ? `${n}장의 카드를 바로 공유하거나 ZIP으로 내려받아요.` : `${n}장의 카드를 ZIP 한 파일로 내려받아요.`}</p>
          {canShare && (
            <button className="btn btn--lg" onClick={shareCards} aria-disabled={busy !== null} aria-busy={busy === 'share'}>
              {busy === 'share' ? '◌ 만드는 중…' : '↗ 이미지로 공유'}
            </button>
          )}
          <button
            className={`btn btn--lg${canShare ? ' zip__alt' : ''}`}
            onClick={downloadZip}
            aria-disabled={busy !== null}
            aria-busy={busy === 'zip'}
          >
            {busy === 'zip' ? '◌ 만드는 중…' : '⤓ 전체 ZIP 다운로드'}
          </button>
          <p className="zip__hint">ZIP은 압축 해제 후 사진 앱에 저장해야 해요</p>
          <div className="meta"><span>{fileBase(magazine)}.ZIP</span><span>{n} PNG · {dimLabel}</span></div>
        </div>
        <div className="panel">
          <div className="panel__h"><h3>카드 개별 받기</h3><span className="tag">{dimLabel}</span></div>
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
        {/* visible status line (kept mounted so aria-live announcements fire) */}
        <p className={`export-status${statusErr ? ' export-status--err' : ''}`} role="status" aria-live="polite">
          {status}
        </p>
        <div className="dlrow">
          <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => onGo(2)}>← 편집으로</button>
          <button className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => onGo(1)}>새 카드뉴스</button>
        </div>
      </div>

      {/* offscreen 540×540 render targets for PNG/ZIP export (pixelRatio 2 → 1080×1080) */}
      <div ref={renderRef} aria-hidden style={{ position: 'fixed', left: -9999, top: 0, pointerEvents: 'none' }}>
        {cards.map((c, i) => (
          <div key={i} className="canvas" style={{ width: RENDER_SIZE, maxWidth: RENDER_SIZE, height: renderH }}>
            <CardFace card={c} magazine={magazine} ctx="canvas" hint={false} ratio={ratio} total={n} />
          </div>
        ))}
      </div>
    </div>
  );
}
