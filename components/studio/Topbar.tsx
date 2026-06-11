import Link from 'next/link';
import type { Magazine } from '@/types/db';

const STEPS = [
  { n: 1, label: '주제' },
  { n: 2, label: '편집' },
  { n: 3, label: '내보내기' },
];

export default function Topbar({
  stage,
  maxReached,
  onGo,
  magazine,
  onOpenDrawer,
}: {
  stage: number;
  maxReached: number;
  onGo: (n: number) => void;
  magazine: Magazine;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Link className="home" href="/" aria-label="홈으로 돌아가기"><span aria-hidden="true">←</span></Link>
        <span>INK<span style={{ color: 'var(--ink)' }}>.</span></span>
      </div>
      <div className="topbar__sep" aria-hidden="true" />

      <nav className="stepper" aria-label="제작 단계">
        <ol style={{ display: 'contents' }}>
          {STEPS.map((s, i) => {
            const locked = s.n > maxReached;
            return (
              <li key={s.n} style={{ display: 'contents' }}>
                <button
                  className={`stepc ${stage === s.n ? 'is-on' : ''} ${s.n < stage ? 'is-done' : ''}`}
                  aria-current={stage === s.n ? 'step' : undefined}
                  aria-disabled={locked}
                  disabled={locked}
                  aria-label={`${s.n}단계: ${s.label}${locked ? ' (잠김)' : ''}`}
                  onClick={() => !locked && onGo(s.n)}
                >
                  <span className="si" aria-hidden="true">{s.n}</span>
                  <span className="lbl">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span className="arr" aria-hidden="true">→</span>}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="topbar__right">
        <button className="magsel" onClick={onOpenDrawer} aria-haspopup="dialog" aria-label={`매거진 설정 — 현재 ${magazine.name}`}>
          <span className="sw" style={{ background: magazine.bgColor }} aria-hidden="true" />
          <span className="nm">{magazine.name}</span>
          <span className="ca" aria-hidden="true">▾</span>
        </button>
      </div>
    </header>
  );
}
