import { NextRequest, NextResponse } from 'next/server';
import { generateCardImage } from '@/lib/image';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/image  { title, category }   header: x-admin-key
// Admin-only: AI cover-image generation is gated server-side so regular users
// (and anyone hitting the endpoint directly) can never trigger paid usage.
export async function POST(req: NextRequest) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json({ error: '이미지 생성이 비활성화되어 있어요(관리자 키 미설정).' }, { status: 503 });
  }
  const provided = req.headers.get('x-admin-key') || '';
  if (provided !== adminKey) {
    return NextResponse.json({ error: '관리자만 이미지를 생성할 수 있어요.' }, { status: 403 });
  }

  let body: { title?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const title = (body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  try {
    const image = await generateCardImage(title, body.category || '뉴스');
    return NextResponse.json({ image });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'image generation failed' }, { status: 502 });
  }
}
