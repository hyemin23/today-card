import { NextRequest, NextResponse } from 'next/server';
import { generateCards } from '@/lib/ai';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import type { Article } from '@/types/db';

export const dynamic = 'force-dynamic';

const DAILY_LIMIT = 10;

// POST /api/generate  body: Article
export async function POST(req: NextRequest) {
  let article: Article;
  try {
    article = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!article?.title) {
    return NextResponse.json({ error: 'article.title required' }, { status: 400 });
  }

  // --- rate limit (only when Supabase is configured; client signs in anonymously on mount) ---
  const supa = getServerSupabase();
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
    const result = await generateCards(article);
    // log after success so failed generations don't burn quota
    if (owner && svc) await svc.from('generation_log').insert({ owner });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'generation failed' }, { status: 502 });
  }
}
