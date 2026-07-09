import { NextRequest, NextResponse } from 'next/server';
import { generateCards } from '@/lib/ai';
import { fetchArticleBody } from '@/lib/news';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { verifySession, ADMIN_COOKIE } from '@/lib/auth';
import type { Article } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // article body fetch + LLM

const DAILY_LIMIT = 10;

// POST /api/generate  body: Article
// Admin-only (paid LLM usage): gated by the admin session cookie, same as
// /api/image and /api/style-analyze — so anyone hitting the endpoint directly
// (or a non-logged-in visitor) can never trigger paid card generation.
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_KEY) {
    return NextResponse.json({ error: '카드 생성이 비활성화되어 있어요(관리자 미설정).' }, { status: 503 });
  }
  if (!verifySession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: '관리자만 카드를 생성할 수 있어요. /admin에서 로그인하세요.' }, { status: 403 });
  }

  let article: Article & { styleTone?: string; autoHashtags?: boolean };
  try {
    article = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!article?.title) {
    return NextResponse.json({ error: 'article.title required' }, { status: 400 });
  }
  const tone = typeof article.styleTone === 'string' ? article.styleTone.slice(0, 600) : '';
  const autoHashtags = article.autoHashtags === true;

  // --- rate limit (only when Supabase is configured; client signs in anonymously on mount) ---
  const supa = await getServerSupabase();
  const svc = getServiceSupabase();
  let owner: string | null = null;
  if (supa && svc) {
    const { data: { user } } = await supa.auth.getUser();
    if (user) {
      owner = user.id;
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await svc
        .from('generation_log')
        .select('id', { count: 'exact', head: true })
        .eq('owner', user.id)
        .gt('created_at', since);
      if ((count ?? 0) >= DAILY_LIMIT) {
        return NextResponse.json(
          { error: '하루 생성 횟수(10회)를 초과했어요. 내일 다시 시도해 주세요.' },
          { status: 429 }
        );
      }
    }
  }

  try {
    // pull the full article body so cards/caption summarize the whole piece,
    // not just the 2-sentence search snippet (falls back to snippet on failure)
    const body = await fetchArticleBody(article.sourceUrl);
    const result = await generateCards(article, body, tone, autoHashtags);
    // log after success so failed generations don't burn quota
    if (owner && svc) await svc.from('generation_log').insert({ owner });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'generation failed' }, { status: 502 });
  }
}
