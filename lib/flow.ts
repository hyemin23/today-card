import type { FlowCard, FlowDeck, FlowInput, FlowRole } from '@/types/db';
import { DEFAULT_FLOW_TONE } from '@/components/studio/data';
import { renumberDeck, roleToKind, VALID_ROLES } from './flowShared';

/**
 * 자동 카드뉴스 흐름 (design-system/card-flow.md).
 *
 * 입력 4개(주제·타깃·톤·최종행동)로 가변 길이 덱을 만든다:
 *   Hook → Pain → Steps(내용에 맞게 N장) → Result → CTA  (총 = N + 4)
 *
 * 기사 기반 5장 고정(lib/ai.ts generateCards)과는 별개의 신규 경로.
 * LLM_API_KEY가 있으면 텍스트 모델(gemini-2.5-flash, OpenAI 호환)을 쓰고,
 * 없거나 실패하면 입력으로 구성한 결정적 mock 덱으로 폴백한다(오프라인 동작).
 *
 * ⚠️ 이미지는 만들지 않는다 — 이 함수는 "카드 구성표"(텍스트)만 만든다.
 *    이미지는 사람이 구성표를 승인한 뒤 NB2(lib/image.ts)로 생성한다.
 */

const MIN_STEPS = 1;
const MAX_STEPS = 6; // 총 10장 상한 (card-flow.md §3)

/** 잘못된 마커(====, **) 가 카드로 새지 않게 정리. CardFace 파서와 동일 철학. */
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

function coerceRole(raw: any, i: number, n: number): FlowRole {
  if (VALID_ROLES.includes(raw)) return raw;
  if (i === 0) return 'hook';
  if (i === n - 1) return 'cta';
  if (i === 1) return 'pain';
  return 'step';
}

function normalize(parsed: any, input: FlowInput): FlowDeck {
  const raw: any[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
  let cards: FlowCard[] = raw
    .map((c, i) => ({
      role: coerceRole(c?.role, i, raw.length),
      title: sanitizeMarkers(String(c?.title || '').trim()),
      body: sanitizeMarkers(String(c?.body || '').trim()),
      hashtags: Array.isArray(c?.hashtags) ? c.hashtags.map(String).filter(Boolean).slice(0, 5) : undefined,
    }))
    .filter((c) => c.title || c.body)
    // body 카드는 흰 배경 → 어두운 글자(#111110), cover/cta는 다크 → 흰 글자.
    // (renumberDeck 가 c.textColor || 기본값 으로 보존하므로 여기서 올바른 값으로 둔다)
    .map((c) => ({ idx: 0, kind: roleToKind(c.role), textColor: roleToKind(c.role) === 'body' ? '#111110' : '#ffffff', fontScale: 1, align: '6', imageUrl: null, ...c })) as FlowCard[];

  // 흐름 보정: 정확히 hook 1개로 시작, cta 1개로 끝나도록
  if (!cards.length || cards.length < 3) return mockDeck(input);
  cards[0].role = 'hook';
  cards[cards.length - 1].role = 'cta';
  // 중간에 hook/cta 가 섞였으면 본문 성격으로 강등
  for (let i = 1; i < cards.length - 1; i++) {
    if (cards[i].role === 'hook' || cards[i].role === 'cta') cards[i].role = 'step';
  }

  // cta 해시태그 시드
  const cta = cards[cards.length - 1];
  if (!cta.hashtags || !cta.hashtags.length) cta.hashtags = mockHashtags(input);

  cards = renumberDeck(cards);
  return { meta: { ...input, total: cards.length }, cards };
}

function mockHashtags(input: FlowInput): string[] {
  const key = (input.topic || '').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 10);
  return [key && `#${key}`, '#카드뉴스', '#오늘의팁', '#정보공유'].filter(Boolean) as string[];
}

/** 키 없음/실패 시: 입력으로 구성한 결정적 가변 덱(Hook+Pain+3 Steps+Result+CTA = 7장). */
export function mockDeck(input: FlowInput): FlowDeck {
  const topic = input.topic || '오늘의 주제';
  const goal = input.goal || '오늘 바로 시작하기';
  const target = input.target || '처음 시작하는 사람';
  const cards: FlowCard[] = [
    { idx: 0, role: 'hook', kind: 'cover', title: `${topic}\n어떻게 시작할까?`, body: '', imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' },
    { idx: 0, role: 'pain', kind: 'body', title: '막막한 건\n방법을 몰라서', body: `${target}이라면 한 번쯤 미뤄봤죠. 문제는 의지가 아니라 순서예요.`, imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 0, role: 'step', kind: 'body', title: '딱 하나만\n정하기', body: '오늘 할 행동을 한 가지로 좁혀요. 많으면 시작도 못 해요.', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 0, role: 'step', kind: 'body', title: '5분짜리로\n쪼개기', body: '부담 없는 크기로 줄여서 지금 바로 한 번 해봐요.', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 0, role: 'step', kind: 'body', title: '같은 시간에\n반복', body: '매일 같은 시간에 알람 1개. 익숙해질 때까지만.', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 0, role: 'result', kind: 'body', title: '일주일이면\n습관이 보여요', body: '작게 시작한 게 쌓여요. 그다음엔 양만 조금씩 늘리면 끝.', imageUrl: null, textColor: '#111110', fontScale: 1, align: '6' },
    { idx: 0, role: 'cta', kind: 'cta', title: `오늘 바로\n시작해요`, body: `${goal} — 지금 1분만 투자해 첫 발을 떼보세요.`, hashtags: mockHashtags(input), imageUrl: null, textColor: '#ffffff', fontScale: 1, align: '6' },
  ];
  const out = renumberDeck(cards);
  return { meta: { ...input, total: out.length }, cards: out };
}

function buildSystemPrompt(input: FlowInput): string {
  return [
    '너는 한국어 인스타그램 카드뉴스 기획자다. 입력으로 "카드 구성표"를 만든다. (이미지는 만들지 않는다.)',
    '흐름: Hook → Pain → Steps(내용에 맞게 N장) → Result → CTA.',
    '규칙:',
    '1) 카드 순서대로 role 을 붙인다: 첫 장 "hook", 그 다음 "pain", 중간 단계들 "step", 마지막 직전 "result", 마지막 "cta".',
    `2) Steps: 내용상 단계 수만큼 각각 다른 step 카드로 만든다(2개면 2장, 5개면 5장). 한 장에 여러 단계 압축 금지. step 은 ${MIN_STEPS}~${MAX_STEPS}개.`,
    '3) hook: 큰 제목 하나(title)만. body 는 빈 문자열 "".',
    '4) hook 을 제외한 모든 카드: title 과 body 둘 다 비어있지 않게 채운다.',
    `5) 총 장수 = step 수 + 4. 내용에 맞게 정한다(5~10장). 빈 단계로 억지로 늘리지 마라.`,
    '6) title: 2줄 이내, 어절 단위 줄바꿈은 \\n 으로. body: 1~2문장, 짧고 구체적으로.',
    `7) 톤: ${input.tone || DEFAULT_FLOW_TONE}. 추상적 조언("꾸준히","적당히") 금지 — 숫자·순서·도구명 등 따라할 행동으로.`,
    `8) 마지막 cta 는 최종행동("${input.goal}")을 지금 바로 하게 만든다. hashtags 3~5개(한글, #포함).`,
    '9) 핵심어 강조: 가장 중요한 구절 1개를 ==형광펜==, 수치·키워드는 **굵게**. 카드당 과하지 않게(형광펜 1, 굵게 최대 2). 마커는 정확히 2개씩(==단어==, **단어**).',
    'JSON으로만 응답한다: {"cards":[{"role","title","body","hashtags?"}]}',
  ].join('\n');
}

export async function composeDeck(input: FlowInput): Promise<FlowDeck> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return mockDeck(input);

  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const user = [
    `주제: ${input.topic}`,
    `타깃: ${input.target}`,
    `톤: ${input.tone || DEFAULT_FLOW_TONE}`,
    `최종행동: ${input.goal}`,
  ].join('\n');

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(input) },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
    return normalize(parsed, input);
  } catch {
    return mockDeck(input);
  }
}
