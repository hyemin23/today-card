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
        <Link className="home" href="/" title="홈으로">←</Link>
        INK<span style={{ color: 'var(--ink)' }}>.</span>
      </div>
      <div className="topbar__sep" />

      <nav className="stepper">
        {STEPS.map((s, i) => (
          <span key={s.n} style={{ display: 'contents' }}>
            <button
              className={`stepc ${stage === s.n ? 'is-on' : ''} ${s.n < stage ? 'is-done' : ''}`}
              aria-disabled={s.n > maxReached}
              onClick={() => s.n <= maxReached && onGo(s.n)}
            >
              <span className="si">{s.n}</span>
              <span className="lbl">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="arr">→</span>}
          </span>
        ))}
      </nav>

      <div className="topbar__right">
        <button className="magsel" onClick={onOpenDrawer}>
          <span className="sw" style={{ background: magazine.bgColor }} />
          <span className="nm">{magazine.name}</span>
          <span className="ca">▾</span>
        </button>
      </div>
    </header>
  );
}
