import { NextRequest, NextResponse } from 'next/server';
import { generateCardImage } from '@/lib/image';
import { verifySession, ADMIN_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/image  { title, category }
// Admin-only: gated by the httpOnly admin session cookie (set at /admin login)
// so regular users — and anyone hitting the endpoint directly — can never
// trigger paid usage.
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_KEY) {
    return NextResponse.json({ error: '이미지 생성이 비활성화되어 있어요(관리자 미설정).' }, { status: 503 });
  }
  if (!verifySession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: '관리자만 이미지를 생성할 수 있어요. /admin에서 로그인하세요.' }, { status: 403 });
  }

  let body: { title?: string; category?: string; style?: string; imageStyle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const title = (body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const style = body.style === 'trend' ? 'trend' : 'editorial';
  const customLook = typeof body.imageStyle === 'string' ? body.imageStyle.slice(0, 600).trim() : '';

  try {
    const image = await generateCardImage(title, body.category || '뉴스', style, customLook || undefined);
    return NextResponse.json({ image });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'image generation failed' }, { status: 502 });
  }
}
