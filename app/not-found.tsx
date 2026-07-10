import Link from 'next/link';

/** 잘못된 URL 진입 시 영문 기본 404 대신 — 주요 화면으로 안내하는 막다른 길 방지 페이지 */
export default function NotFound() {
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
        404 · NOT FOUND
      </span>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>페이지를 찾을 수 없어요</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6 }}>
        주소가 바뀌었거나 잘못 입력됐을 수 있어요.
      </p>
      <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
        <Link className="btn" href="/">홈으로</Link>
        <Link className="btn btn--ghost" href="/studio">기사로 만들기</Link>
        <Link className="btn btn--ghost" href="/flow">주제로 기획</Link>
      </nav>
    </main>
  );
}
