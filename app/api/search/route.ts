import { NextRequest, NextResponse } from 'next/server';
import { searchNews } from '@/lib/naver';

export const dynamic = 'force-dynamic';

// GET /api/search?q=기준금리
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  try {
    const items = await searchNews(q);
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'search failed' }, { status: 502 });
  }
}
