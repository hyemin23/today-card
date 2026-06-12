/**
 * Benchmark-account style analysis.
 *
 * Collects a few card/cover images from a public Instagram account (via a
 * mirror, best-effort) or takes user-uploaded screenshots, then has Gemini
 * vision distill a reusable "style profile": headline tone, image art
 * direction, colors and which cover layout fits.
 *
 * Mirror scraping is inherently fragile — callers must treat fetchAccountImages
 * failure as a normal outcome and fall back to screenshot upload.
 *
 * Admin-only: gated by the admin session cookie, verified in the route.
 */

const VISION_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface StyleProfile {
  name: string;
  summary: string;
  /** Korean guidance for headline/copy tone, fed into the card-writing prompt */
  tone: string;
  /** English art direction for the image model */
  imagePrompt: string;
  layout: 'editorial' | 'trend';
  bgColor: string;
  accentColor: string;
}

interface RawImage {
  data: string; // base64 (no data: prefix)
  mime: string;
}

/** Best-effort: pull up to `max` post images for a public account via a mirror. */
export async function fetchAccountImages(username: string, max = 4): Promise<RawImage[]> {
  const clean = username.replace(/^@/, '').replace(/[^\w.]/g, '');
  if (!clean) throw new Error('invalid username');
  const res = await fetch(`https://imginn.com/${encodeURIComponent(clean)}/`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`mirror fetch failed: ${res.status}`);
  const html = await res.text();
  const urls = [...html.matchAll(/src="(https:\/\/s\d+\.imginn\.com[^"]+)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    // the avatar lives under the t51.82787-19 namespace — skip it
    .filter((u) => !u.includes('-19/'));
  const unique = [...new Set(urls)].slice(0, max);
  if (unique.length === 0) throw new Error('no post images found');

  const images: RawImage[] = [];
  for (const u of unique) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5_000) continue; // placeholder/error blobs
      images.push({ data: buf.toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg' });
    } catch {
      /* skip this image */
    }
  }
  if (images.length === 0) throw new Error('image download failed');
  return images;
}

export function dataUrlToRaw(dataUrl: string): RawImage | null {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  return m ? { mime: m[1], data: m[2] } : null;
}

/** Distill a style profile from 1–4 reference card/cover images. */
export async function analyzeStyle(images: RawImage[], accountName?: string): Promise<StyleProfile> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not configured');

  const prompt = [
    '당신은 SNS 카드뉴스 아트디렉터입니다. 첨부된 이미지들은 한 인스타그램 계정의 카드뉴스/표지 샘플입니다.',
    '이 계정의 디자인·카피 스타일을 분석해, 같은 느낌의 카드뉴스를 만들기 위한 "스타일 프로필"을 JSON으로만 응답하세요:',
    '{',
    ' "name": 짧은 스타일 이름(한국어, 12자 이내),',
    ' "summary": 스타일 한 줄 요약(한국어, 40자 이내),',
    ' "tone": 헤드라인·본문 카피의 말투/후킹 방식 지침(한국어 2~3문장 — 어미, 호흡, 후킹 장치, 강조 습관),',
    ' "imagePrompt": 배경 이미지 아트디렉션(영어 1~2문장 — 사진/일러스트 여부, 색감 그레이딩, 조명, 무드),',
    ' "layout": "trend"(사진 풀블리드+하단 헤드라인형) 또는 "editorial"(타이포 중심 매거진형) 중 더 가까운 것,',
    ' "bgColor": 대표 배경색 HEX, "accentColor": 강조/포인트색 HEX',
    '}',
    '실제 보이는 것에 근거해 구체적으로. 추측성 일반론 금지.',
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt + (accountName ? `\n계정명: ${accountName}` : '') },
          ...images.slice(0, 4).map((img) => ({ inlineData: { mimeType: img.mime, data: img.data } })),
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`style analysis failed: ${res.status} ${msg.slice(0, 160)}`);
  }
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
  const parsed = JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));

  const hex = (v: unknown, fallback: string) =>
    typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : fallback;
  return {
    name: String(parsed.name || accountName || '벤치마킹 스타일').slice(0, 20),
    summary: String(parsed.summary || '').slice(0, 80),
    tone: String(parsed.tone || '').slice(0, 600),
    imagePrompt: String(parsed.imagePrompt || '').slice(0, 600),
    layout: parsed.layout === 'editorial' ? 'editorial' : 'trend',
    bgColor: hex(parsed.bgColor, '#111110'),
    accentColor: hex(parsed.accentColor, '#ffffff'),
  };
}
