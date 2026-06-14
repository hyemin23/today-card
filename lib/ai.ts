import type { Article, Card, GenerateResult } from '@/types/db';

/** 인스타 캡션 길이 상한 — 사용자 지정(공백 포함 500자). 참고: 인스타 실제 한도는 2,200자. */
const MAX_CAPTION = 500;

/** 캡션이 상한을 넘으면 마지막 문장/줄 경계에서 깔끔히 자른다(단어 중간 끊김 방지). */
export function capCaption(text: string): string {
  const cp = [...(text || '')];
  if (cp.length <= MAX_CAPTION) return text;
  const cut = cp.slice(0, MAX_CAPTION).join('');
  const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), cut.lastIndexOf('\n'));
  return (end > MAX_CAPTION * 0.5 ? cut.slice(0, end + 1) : cut).trimEnd();
}

/**
 * Generate a 5-card news carousel from an article.
 * Uses the configured LLM when LLM_API_KEY is present; otherwise returns
 * a deterministic mock built from the article so the flow works offline.
 *
 * Output contract (validate with zod in production):
 *   { cards: Card[5], caption: string, hashtags: string[] }
 */
export async function generateCards(article: Article, body?: string, tone?: string): Promise<GenerateResult> {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    return mockGenerate(article);
  }

  const system = [
    ...(tone
      ? [`문체 지침(벤치마킹 스타일 — 다른 규칙과 충돌하지 않는 선에서 최우선 적용): ${tone}`]
      : []),
    '당신은 한국어 시사 카드뉴스 에디터입니다. 주어진 기사를 정보성 카드뉴스로 요약합니다.',
    '독자는 인스타그램 캐러셀을 빠르게 넘기며 강조된 부분만 읽습니다 — 강조와 후킹이 핵심입니다.',
    '반드시 cards 배열에 정확히 5개의 카드를 순서대로 담습니다:',
    '- 1번 kind="cover": 넘기고 싶게 만드는 후킹형 헤드라인 한 줄(title, 공백 포함 22자 이내). 질문·숫자·반전 중 하나를 활용하고, 넘기면 무엇을 알게 되는지 암시하세요. 기사 제목을 그대로 베끼지 말고 다시 쓰세요. body는 빈 문자열.',
    '- 2,3,4번 kind="body": 기사의 핵심을 서로 다른 3개 포인트로 나눠 요약. 각 카드는 정보성 콘텐츠여야 합니다.',
    '   · title = 한눈에 들어오는 소제목(공백 포함 14자 이내).',
    '   · body = 그 포인트를 설명하는 1~2문장(공백 포함 95자 이내). 본문의 구체적 사실·수치·인용을 담아 정보 가치를 높이세요.',
    '- 5번 kind="cta": 팔로우 유도 문구(title). body는 빈 문자열.',
    'kind 값은 반드시 "cover" | "body" | "cta" 중 하나만 사용합니다.',
    '강조 표기 규칙(중요): 핵심 구절은 ==이렇게== 감싸면 형광펜으로, 중요 수치·키워드는 **이렇게** 감싸면 굵게 표시됩니다.',
    '표기 형식 엄수: 형광펜은 단어 양쪽에 등호 정확히 2개(==단어==), 굵게는 별표 정확히 2개(**단어**). 등호·별표를 3개 이상 붙이거나 한쪽만 닫는 것 절대 금지. 표시할 단어가 없으면 마커를 쓰지 마세요.',
    '- cover title: 가장 궁금증을 일으키는 키워드 하나만 ==형광펜==.',
    '- 각 body 카드: body 안에서 가장 중요한 구절 1개를 ==형광펜==, 수치·고유명사 1~2개를 **굵게**. 과한 강조 금지(카드당 형광펜 1개, 굵게 최대 2개) — 다 강조하면 아무것도 강조되지 않습니다.',
    '- cta에는 강조 표기를 쓰지 않습니다.',
    'caption: 기사 전체를 읽기 좋게 요약한 인스타그램 캡션. 첫 문장은 전체를 압축한 요지, 이어서 핵심 포인트를 줄바꿈(\\n)으로 정리해 가독성을 높이세요. 공백 포함 500자를 절대 넘기지 마세요(권장 300~480자). 끝맺음을 문장 단위로 깔끔하게.',
    'hashtags: 빈 배열 []로 둡니다. 해시태그는 사용자가 직접 추가하므로 자동 생성하지 않습니다.',
    '규칙: 기사 본문에 근거한 사실만 사용. 과장·허위·본문 밖 사실 추가 금지. 수치·고유명사는 본문 그대로.',
    'JSON으로만 응답: {"cards":[{"kind","title","body"}], "caption":"...", "hashtags":[]}',
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

/**
 * Clean emphasis markers from model output so malformed runs
 * ("====황금비율==?====") never reach a card. Keeps valid bold/highlight pairs,
 * scrubs leftover runs of 2+ marker chars. Mirrors CardFace's tolerant parser.
 */
function sanitizeMarkers(text: string): string {
  if (!text || (!text.includes('**') && !text.includes('=='))) return text;
  const re = /(\*\*[^*\n]+?\*\*|==[^=\n]+?==)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out += text.slice(last, m.index).replace(/={2,}/g, '').replace(/\*{2,}/g, '') + m[0];
    last = re.lastIndex;
  }
  out += text.slice(last).replace(/={2,}/g, '').replace(/\*{2,}/g, '');
  return out;
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
      title: sanitizeMarkers(String(c?.title || '')),
      body: sanitizeMarkers(String(c?.body || '')),
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
  // 해시태그는 기본 없음 — 사용자가 직접 추가. LLM이 굳이 채워 보내도 무시하고 비운다.
  const hashtags: string[] = [];
  // seed the CTA card's own hashtags so they're shown + editable per-card
  const cta = cards.find((c) => c.kind === 'cta');
  if (cta && (!cta.hashtags || !cta.hashtags.length)) cta.hashtags = hashtags.slice(0, 4);
  return {
    cards,
    caption: capCaption(typeof parsed?.caption === 'string' && parsed.caption ? parsed.caption : article.summary),
    hashtags,
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
    caption: capCaption(`${s0}\n\n• ${s1}\n• 오늘의 이슈를 한눈에 정리했어요.\n\n출처 · ${article.source}`),
    hashtags: [],
  };
}
