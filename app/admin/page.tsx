'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './admin.css';

export default function AdminPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/admin/status')
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.admin))
      .catch(() => setIsAdmin(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '로그인에 실패했어요.');
        return;
      }
      router.push('/studio');
    } catch {
      setError('네트워크 오류로 로그인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsAdmin(false);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-wrap">
      <div className="admin-card">
        <span className="brand">INK<span style={{ color: 'var(--ink)' }}>.</span></span>
        <span className="kicker">Admin</span>
        <h1>관리자 로그인</h1>
        <p className="sub">로그인하면 스튜디오 편집 화면에서 <b>AI 이미지 생성</b>이 열립니다. 일반 사용에는 필요하지 않아요.</p>

        {isAdmin ? (
          <>
            <div className="admin-status"><span className="dot" aria-hidden="true" /> 이미 로그인되어 있어요.</div>
            <div className="actions">
              <Link className="btn btn--dark" href="/studio">스튜디오로 가기 <span aria-hidden="true">→</span></Link>
              <button type="button" className="btn btn--ghost" onClick={onLogout} disabled={busy}>로그아웃</button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="admin-pw">관리자 비밀번호</label>
            <input
              id="admin-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              placeholder="비밀번호 입력"
            />
            {error && <p className="err" role="alert">{error}</p>}
            <div className="actions">
              <button type="submit" className="btn btn--dark" disabled={busy || !password}>
                {busy ? '확인 중…' : '로그인'}
              </button>
            </div>
          </form>
        )}

        <p className="back"><Link href="/">← 홈으로</Link></p>
      </div>
    </main>
  );
}
