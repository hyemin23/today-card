'use client';

/** 런타임 크래시 시 영문 기본 화면 대신 — 복구(재시도) 가능한 한국어 에러 화면 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.14em', color: 'var(--ink-3)' }}>
        ERROR
      </span>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>문제가 생겼어요</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6 }}>
        일시적인 오류일 수 있어요. 다시 시도해 보고, 계속되면 새로고침해 주세요.
      </p>
      <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
        <button className="btn" type="button" onClick={reset}>↻ 다시 시도</button>
        <a className="btn btn--ghost" href="/">홈으로</a>
      </nav>
    </main>
  );
}
