import type { Article, Card, GenerateResult } from '@/types/db';

/**
 * Generate a 5-card news carousel from an article.
 * Uses the configured LLM when LLM_API_KEY is present; otherwise returns
 * a deterministic mock built from the article so the flow works offline.
 *
 * Output contract (validate with zod in production):
 *   { cards: Card[5], caption: string, hashtags: string[] }
 */
export async function generateCards(article: Article, body?: string): Promise<GenerateResult> {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    return mockGenerate(article);
  }

  const system = [
    '당신은 한국어 시사 카드뉴스 에디터입니다. 주어진 기사를 정보성 카드뉴스로 요약합니다.',
    '반드시 cards 배열에 정확히 5개의 카드를 순서대로 담습니다:',
    '- 1번 kind="cover": 호기심을 자극하는 표지 헤드라인 한 줄(title). body는 빈 문자열.',
    '- 2,3,4번 kind="body": 기사의 핵심을 서로 다른 3개 포인트로 나눠 요약. 각 카드는 정보성 콘텐츠여야 합니다.',
    '   · title = 한눈에 들어오는 소제목(공백 포함 14자 이내).',
    '   · body = 그 포인트를 설명하는 1~2문장(공백 포함 95자 이내). 본문의 구체적 사실·수치·인용을 담아 정보 가치를 높이세요.',
    '- 5번 kind="cta": 팔로우 유도 문구(title). body는 빈 문자열.',
    'kind 값은 반드시 "cover" | "body" | "cta" 중 하나만 사용합니다.',
    'caption: 기사 전체를 읽기 좋게 요약한 인스타그램 캡션. 첫 문장은 전체를 압축한 요지, 이어서 핵심 포인트를 줄바꿈(\\n)으로 정리해 가독성을 높이세요. 200~400자 정도로 충분히 길어도 됩니다.',
    'hashtags: 주제와 직접 관련된 한글 해시태그 5~8개.',
    '규칙: 기사 본문에 근거한 사실만 사용. 과장·허위·본문 밖 사실 추가 금지. 수치·고유명사는 본문 그대로.',
    'JSON으로만 응답: {"cards":[{"kind","title","body"}], "caption":"...", "hashtags":["#태그", ...]}',
  ].join('\n');

  const source = (body && body.length > 120 ? body : article.summary).slice(0, 3000);
  const user = `제목: ${article.title}\n출처: ${article.source} / 카테고리: ${article.category}\n본문:\n${source}`;

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
  const sentences = article.summary.split(/(?<=[.!?다])\s+/).filter(Boolean);
  const s0 = sentences[0] || article.summary;
  const s1 = sentences[1] || article.summary;
  const cards: Card[] = [
    { idx: 0, kind: 'cover', title: article.title, imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' },
    { idx: 1, kind: 'body', title: '무슨 일이', body: s0, imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 2, kind: 'body', title: '핵심 내용', body: s1, imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 3, kind: 'body', title: '왜 중요한가', body: '이 사안은 앞으로의 흐름에 영향을 줄 수 있어 눈여겨볼 필요가 있습니다.', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 4, kind: 'cta', title: '팔로우하고 더 보기', hashtags: ['#카드뉴스', '#오늘의이슈', '#INK매거진'], imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' },
  ];
  return {
    cards,
    caption: `${s0}\n\n• ${s1}\n• 오늘의 이슈를 한눈에 정리했어요.\n\n출처 · ${article.source}`,
    hashtags: ['#카드뉴스', '#오늘의이슈', '#INK매거진', '#뉴스요약'],
  };
}
