import type { Article, Card, GenerateResult } from '@/types/db';

/**
 * Generate a 5-card news carousel from an article.
 * Uses the configured LLM when LLM_API_KEY is present; otherwise returns
 * a deterministic mock built from the article so the flow works offline.
 *
 * Output contract (validate with zod in production):
 *   { cards: Card[5], caption: string, hashtags: string[] }
 */
export async function generateCards(article: Article): Promise<GenerateResult> {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    return mockGenerate(article);
  }

  const system = [
    '당신은 한국어 카드뉴스 에디터입니다.',
    '주어진 기사 제목·요약문만으로 인스타그램 카드뉴스를 만듭니다.',
    '반드시 cards 배열에 정확히 5개의 카드를 순서대로 담습니다:',
    '- 1번: kind="cover" — 후킹되는 표지 헤드라인 한 줄(title). body 없음.',
    '- 2,3,4번: kind="body" — 핵심 요지 한 문장씩. title(소제목) + body(한두 문장).',
    '- 5번: kind="cta" — 팔로우 유도 문구(title). body 없음.',
    'kind 값은 반드시 "cover" | "body" | "cta" 중 하나만 사용합니다.',
    '과장·허위 금지. 제목·요약문 범위를 벗어난 사실을 추가하지 마세요.',
    'JSON으로만 응답: {"cards":[{"kind","title","body"}], "caption":"인스타 캡션 한 문단", "hashtags":["#태그", ...]}',
  ].join('\n');

  const user = `제목: ${article.title}\n요약: ${article.summary}\n출처: ${article.source}\n카테고리: ${article.category}`;

  // OpenAI-compatible Chat Completions. Defaults to Google Gemini's compat
  // endpoint; override LLM_BASE_URL/LLM_MODEL for any other provider.
  // Any failure (HTTP, malformed JSON, missing fields) falls back to the mock
  // so the user never hits a dead end.
  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
    return normalize(parsed, article);
  } catch {
    return mockGenerate(article);
  }
}

function normalize(parsed: any, article: Article): GenerateResult {
  const raw: any[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const cards: Card[] = raw.slice(0, 5).map((c, i) => {
    const kind = c?.kind === 'cover' || c?.kind === 'cta' || c?.kind === 'body'
      ? c.kind
      : i === 0 ? 'cover' : i === 4 ? 'cta' : 'body';
    return {
      idx: i,
      kind,
      title: String(c?.title || ''),
      body: String(c?.body || ''),
      imageUrl: null,
      // body cards render on white — dark text (mirrors mockGenerate)
      textColor: kind === 'body' ? '#111110' : '#ffffff',
      fontScale: 1,
      align: '6', // bottom-left on the 3×3 grid
    };
  });
  // contract is exactly 5 cards (cover + body×3 + cta) — pad short responses with the mock
  if (cards.length < 5) {
    const fill = mockGenerate(article).cards;
    while (cards.length < 5) cards.push({ ...fill[cards.length], idx: cards.length });
    cards[0] = { ...cards[0], kind: 'cover' };
    cards[4] = { ...cards[4], kind: 'cta' };
  }
  return {
    cards,
    caption: typeof parsed?.caption === 'string' && parsed.caption ? parsed.caption : article.summary,
    hashtags: Array.isArray(parsed?.hashtags) && parsed.hashtags.length
      ? parsed.hashtags.map(String)
      : ['#카드뉴스', '#오늘의이슈'],
  };
}

function mockGenerate(article: Article): GenerateResult {
  const cards: Card[] = [
    { idx: 0, kind: 'cover', title: article.title, imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' },
    { idx: 1, kind: 'body', title: '핵심 한 줄', body: article.summary.split('. ')[0] || article.summary, imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 2, kind: 'body', title: '무슨 일이', body: article.summary, imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 3, kind: 'body', title: '왜 중요한가', body: '전문가들은 이 흐름이 이어질 것으로 본다.', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 4, kind: 'cta', title: '팔로우하고 더 보기', hashtags: ['#카드뉴스', '#오늘의이슈', '#INK매거진'], imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' },
  ];
  return {
    cards,
    caption: `${article.summary} 오늘의 한 장면, INK.에서 정리했어요. ✦`,
    hashtags: ['#카드뉴스', '#오늘의이슈', '#INK매거진', '#뉴스요약'],
  };
}
