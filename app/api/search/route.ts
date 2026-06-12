import { NextRequest, NextResponse } from 'next/server';
import { crawlNews } from '@/lib/news';

export const dynamic = 'force-dynamic';
export const maxDuration = 20; // must exceed crawler timeout budget (7s + 5s + parse)

// GET /api/search?q=기준금리&category=경제
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const category = req.nextUrl.searchParams.get('category') || undefined;
  try {
    const { items, mock } = await crawlNews(q, category);
    return NextResponse.json({ items, mock });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'search failed' }, { status: 502 });
  }
}
