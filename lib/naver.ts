import type { Article } from '@/types/db';

const MOCK: Article[] = [
  { title: '조용하던 도심, 다시 붐비기 시작했다', summary: '늘어난 야간 보행 인구가 도심 상권의 회복을 이끌고 있다는 분석이 나온다. 골목 상권에도 온기가 돌고 있다.', source: '도시신문', category: '사회', date: '2026.06.04' },
  { title: '기준금리 동결… “하반기 인하 가능성 열어둬”', summary: '한국은행이 기준금리를 현 수준에서 동결했다. 물가 둔화 흐름과 경기 회복세를 함께 고려한 결정이라는 분석이 나온다.', source: '일간경제', category: '경제', date: '2026.06.04' },
  { title: '생성형 AI, 이제 ‘말’보다 ‘일’을 한다', summary: '단순 대화를 넘어 실제 업무를 대신 처리하는 에이전트형 AI가 빠르게 확산되고 있다. 기업들의 도입 경쟁도 치열해지는 모습이다.', source: '테크리포트', category: 'IT·과학', date: '2026.06.04' },
  { title: '미술관 밤 개장, 도심의 새로운 산책이 되다', summary: '야간 개장을 도입한 미술관에 발길이 이어지고 있다. 늦은 저녁 전시를 즐기는 ‘문화 산책’이 흐름으로 자리잡는 분위기다.', source: '컬처위클리', category: '문화', date: '2026.06.03' },
];

/**
 * Naver News search wrapper.
 * Falls back to MOCK data when API keys are not configured, so the
 * app works end-to-end without credentials during development.
 */
export async function searchNews(query: string): Promise<Article[]> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;

  if (!id || !secret) {
    // demo mode
    return MOCK;
  }

  const url = new URL('https://openapi.naver.com/v1/search/news.json');
  url.searchParams.set('query', query || '뉴스');
  url.searchParams.set('display', '12');
  url.searchParams.set('sort', 'date');

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': id,
      'X-Naver-Client-Secret': secret,
    },
    // news changes fast; no caching
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Naver search failed: ${res.status}`);
  const data = await res.json();

  const strip = (s: string) =>
    s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");

  // pubDate is KST — format in Asia/Seoul, not UTC (en-CA gives YYYY-MM-DD)
  const kst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

  return (data.items || []).map((it: any) => ({
    title: strip(it.title),
    summary: strip(it.description),
    source: hostOf(it.originallink || it.link),
    sourceUrl: it.originallink || it.link,
    category: '뉴스',
    date: it.pubDate ? kst.format(new Date(it.pubDate)).replace(/-/g, '.') : '',
  }));
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '뉴스';
  }
}
