'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ThemeToggle from '@/components/ThemeToggle';

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
    <main className="relative flex min-h-screen items-center justify-center bg-secondary p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm rounded-2xl shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="font-sans text-[22px] font-extrabold tracking-tighter text-foreground">
              INK.
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Admin
            </span>
          </div>
          <CardTitle className="mt-1 text-2xl font-extrabold tracking-tight">
            관리자 로그인
          </CardTitle>
          <CardDescription className="leading-relaxed">
            로그인하면{' '}
            <b className="font-semibold text-foreground">
              실제 AI 카드 문구·이미지 생성
            </b>
            이 열립니다. 로그인 없이는 예시 문구로 동작하는 체험 모드예요.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isAdmin ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-secondary px-3.5 py-3 text-sm text-muted-foreground">
                <span
                  className="size-2 rounded-full bg-green-600"
                  aria-hidden="true"
                />
                이미 로그인되어 있어요.
              </div>
              <div className="space-y-2.5">
                <Button asChild className="w-full">
                  <Link href="/studio">
                    스튜디오로 가기 <span aria-hidden="true">→</span>
                  </Link>
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                    >
                      로그아웃
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>로그아웃할까요?</DialogTitle>
                      <DialogDescription>
                        다시 AI 이미지 생성을 사용하려면 관리자 비밀번호로 다시
                        로그인해야 해요.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">취소</Button>
                      </DialogClose>
                      <Button onClick={onLogout} disabled={busy}>
                        {busy ? '로그아웃 중…' : '로그아웃'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-pw">관리자 비밀번호</Label>
                <Input
                  id="admin-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="비밀번호 입력"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !password}
              >
                {busy ? '확인 중…' : '로그인'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← 홈으로
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
