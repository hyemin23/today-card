import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, sessionToken, ADMIN_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/admin/login  { password }
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_KEY) {
    return NextResponse.json({ error: '관리자 기능이 비활성화되어 있어요.' }, { status: 503 });
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!checkPassword(body.password || '')) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
