import { NextRequest, NextResponse } from 'next/server';
import { fetchAccountImages, dataUrlToRaw, analyzeStyle } from '@/lib/styleAnalyze';
import { verifySession, ADMIN_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/style-analyze  { username?: string } 또는 { images?: string[] (dataURL) }
// Admin-only (paid vision usage), same gate as /api/image.
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_KEY) {
    return NextResponse.json({ error: '스타일 분석이 비활성화되어 있어요(관리자 미설정).' }, { status: 503 });
  }
  if (!verifySession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: '관리자만 스타일을 분석할 수 있어요. /admin에서 로그인하세요.' }, { status: 403 });
  }

  let body: { username?: string; images?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const uploaded = (body.images || []).map(dataUrlToRaw).filter(Boolean).slice(0, 4) as NonNullable<
    ReturnType<typeof dataUrlToRaw>
  >[];
  const username = (body.username || '').trim();

  try {
    let images = uploaded;
    if (images.length === 0) {
      if (!username) return NextResponse.json({ error: '계정명 또는 스크린샷이 필요해요.' }, { status: 400 });
      try {
        images = await fetchAccountImages(username);
      } catch {
        // mirror access is best-effort — the client offers screenshot upload as the fallback
        return NextResponse.json(
          { error: '계정 게시물을 자동으로 가져오지 못했어요. 게시물 스크린샷을 직접 올려주세요.', needUpload: true },
          { status: 422 }
        );
      }
    }
    const profile = await analyzeStyle(images, username || undefined);
    return NextResponse.json({ profile });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'style analysis failed' }, { status: 502 });
  }
}
