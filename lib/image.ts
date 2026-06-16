/**
 * Topic-driven cover-image generation via Gemini's native image model.
 *
 * Two-stage: a text model first invents a visual CONCEPT for the topic, then
 * the image model renders it. One-stage "news photo" prompts kept producing
 * generic stock-photo lookalikes.
 *
 * Default look is VIVID FULL-COLOR, photorealistic, scroll-stopping ('trend')
 * — the high-CTR cover that performs on Instagram. A monochrome editorial
 * option stays available ('editorial'). Both: no text/logos, no real
 * identifiable individuals, darker lower negative space for the headline.
 *
 * Admin-only: gated by the admin session cookie, verified in the route.
 *
 * IMAGE MODEL POLICY (see design-system/design.md §8): card images are
 * generated ONLY by Gemini "Nano Banana 2" (NB2) = `gemini-3-pro-image-preview`.
 * No other image provider. Override via IMAGE_MODEL if your key exposes a
 * different NB2 id (or, temporarily, the older NB1 `gemini-2.5-flash-image`).
 */

const MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview';
const CONCEPT_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
const CHAT_URL =
  process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/* a different lens per call keeps a 5-card batch from looking same-y.
   color pool leans realistic + high-CTR; b&w pool keeps the witty metaphor look */
const ART_DIRECTIONS_COLOR = [
  'a real, in-the-moment documentary-style scene that captures the human stakes of the story — candid, cinematic, emotionally charged',
  'one bold hero subject shot like a premium editorial/product photo: dramatic directional light, rich color, shallow depth of field',
  'a believable real-world scene with dramatic scale or perspective that pulls the eye straight to the subject',
  'an unexpected but realistic juxtaposition of two real elements that instantly frames the topic',
  'a striking macro close-up of a real, tactile object central to the story — beautiful light, vivid color, fine texture',
];
const ART_DIRECTIONS_BW = [
  'a clever visual metaphor staged as a minimal still-life: one or two symbolic objects on a plain background',
  'a surreal twist on an everyday scene — something impossible yet instantly readable',
  'dramatic play with scale: something tiny made monumental, or something huge made pocket-sized',
  'an unexpected juxtaposition of two symbols that collide into the topic',
  'an extreme macro close-up of a symbolic object that reveals the story on second glance',
];

export type ImageStyle = 'editorial' | 'trend';

async function imagineConcept(title: string, category: string, apiKey: string, style: ImageStyle): Promise<string> {
  const color = style === 'trend';
  const directions = color ? ART_DIRECTIONS_COLOR : ART_DIRECTIONS_BW;
  const direction = directions[Math.floor(Math.random() * directions.length)];
  const persona = color
    ? 'You are an art director for a premium, high-engagement Korean news/trend Instagram cover.'
    : 'You are a witty editorial art director in the spirit of The Economist and New Yorker covers.';
  const aim = color
    ? 'invent ONE realistic, photographable scene that makes people stop scrolling — vivid, cinematic, with a clear hero subject and real emotional pull. It should look like an actual professional photograph, not an abstract illustration.'
    : 'invent ONE memorable visual concept that makes people stop scrolling. Smart and playful, never silly or random.';
  const colorRule = color
    ? 'must work as a vivid, photorealistic full-color image with lively (not muted) color'
    : 'must work in black-and-white';
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: CONCEPT_MODEL,
      messages: [
        {
          role: 'system',
          content: [
            persona,
            `Given a Korean news headline, ${aim}`,
            `Preferred device for this one: ${direction}.`,
            'The concept must be CLEARLY and SPECIFICALLY tied to the topic — a stranger should guess the subject from the image alone.',
            'Reply with 1–2 English sentences describing only the scene to photograph/illustrate.',
            `Constraints: no text or letters anywhere in the scene, no real identifiable public figures, ${colorRule}.`,
          ].join(' '),
        },
        { role: 'user', content: `헤드라인: ${title}\n카테고리: ${category}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`concept gen failed: ${res.status}`);
  const data = await res.json();
  const concept = String(data.choices?.[0]?.message?.content || '').trim();
  if (!concept || concept.length < 20) throw new Error('empty concept');
  return concept.slice(0, 600);
}

function buildPrompt(title: string, category: string, style: ImageStyle, concept?: string, customLook?: string): string {
  const scene = concept
    ? `Scene concept (follow it closely): ${concept}`
    : `A striking, eye-catching editorial magazine-cover image that clearly represents this Korean news topic: "${title}" (category: ${category}).`;
  // a benchmark-analyzed art direction beats the built-in looks
  const look = customLook
    ? `Render in this exact art direction (from a benchmark account analysis): ${customLook}`
    : style === 'trend'
    // default high-CTR look: a vivid, realistic full-color photograph — punchy
    // natural color, one clear subject, the premium viral-cover vibe
    ? 'Render as a vivid, photorealistic FULL-COLOR editorial photograph — like a real, professionally shot news/lifestyle image. Rich, saturated-yet-natural color, bright clean lighting with gentle contrast, one clear hero subject in crisp focus against a softly blurred background (shallow depth of field), high dynamic range. The composition must be scroll-stopping and emotionally engaging — the premium look of a top-performing Korean news/trend Instagram cover. Avoid washed-out, muted, gray, flat, or overly stylized grading; the colors should feel alive and the scene believable.'
    : 'Render as dramatic high-contrast BLACK AND WHITE editorial photography / photo-illustration, cinematic lighting, bold composition, magazine-cover energy that hooks instantly.';
  return [
    scene,
    look,
    'The image must clearly evoke the news topic — clever, not generic.',
    'Leave some darker negative space toward the lower area so overlaid white headline text stays readable.',
    'STRICT: no text, no letters, no words, no numbers, no logos, no watermarks; do not depict specific real, identifiable public figures.',
  ].join(' ');
}

export async function generateCardImage(
  title: string,
  category: string,
  style: ImageStyle = 'trend',
  customLook?: string
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not configured');

  // concept stage is best-effort — any failure falls back to the direct prompt
  let concept: string | undefined;
  try {
    concept = await imagineConcept(title, category, apiKey, customLook ? 'trend' : style);
  } catch {
    concept = undefined;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(title, category, style, concept, customLook) }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`image gen failed: ${res.status} ${msg.slice(0, 200)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p: any) => p?.inlineData?.data);
  if (!img) throw new Error('no image in response');

  const mime = img.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${img.inlineData.data}`;
}
