import { NextRequest, NextResponse } from 'next/server';
import { generateCards, mockGenerate } from '@/lib/ai';
import { fetchArticleBody } from '@/lib/news';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { verifySession, ADMIN_COOKIE } from '@/lib/auth';
import type { Article } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // article body fetch + LLM

const DAILY_LIMIT = 10;

// POST /api/generate  body: Article
// 유료 LLM 생성은 관리자 세션에서만. 비관리자는 403 대신 결정적 목업(비용 0)을
// 받아 전체 플로우를 체험할 수 있다 — 응답에 mock:true 를 실어 클라이언트가
// "체험 모드"임을 안내한다. (ADMIN_KEY 미설정 배포도 자연히 체험 모드로 동작)
export async function POST(req: NextRequest) {
  const isAdmin = !!process.env.ADMIN_KEY && verifySession(req.cookies.get(ADMIN_COOKIE)?.value);

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

  // 체험 모드: LLM을 태우지 않는 목업 — 본문 크롤링도 생략해 즉시 응답
  if (!isAdmin) {
    return NextResponse.json({ ...mockGenerate(article, autoHashtags), mock: true });
  }

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
