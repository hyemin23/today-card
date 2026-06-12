/**
 * Topic-driven cover-image generation via Gemini's native image model.
 *
 * Two-stage: a text model first invents a witty visual CONCEPT for the topic
 * (visual metaphor / surreal twist / unexpected scale — The Economist-cover
 * energy), then the image model renders that concept. One-stage "editorial
 * news photo" prompts kept producing generic stock-photo lookalikes.
 *
 * Stays on-brand: high-contrast black-and-white, no text/logos, no real
 * identifiable individuals, darker lower negative space for the headline.
 *
 * Admin-only: gated by the admin session cookie, verified in the route.
 */

const MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';
const CONCEPT_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
const CHAT_URL =
  process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/* a different lens per call keeps a 5-card batch from looking same-y */
const ART_DIRECTIONS = [
  'a clever visual metaphor staged as a minimal still-life: one or two symbolic objects on a plain background',
  'a surreal twist on an everyday scene — something impossible yet instantly readable',
  'dramatic play with scale: something tiny made monumental, or something huge made pocket-sized',
  'an unexpected juxtaposition of two symbols that collide into the topic',
  'an extreme macro close-up of a symbolic object that reveals the story on second glance',
];

async function imagineConcept(title: string, category: string, apiKey: string): Promise<string> {
  const direction = ART_DIRECTIONS[Math.floor(Math.random() * ART_DIRECTIONS.length)];
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: CONCEPT_MODEL,
      messages: [
        {
          role: 'system',
          content: [
            'You are a witty editorial art director in the spirit of The Economist and New Yorker covers.',
            'Given a Korean news headline, invent ONE memorable visual concept that makes people stop scrolling.',
            `Preferred device for this one: ${direction}.`,
            'The concept must be CLEARLY and SPECIFICALLY tied to the topic — a stranger should guess the subject from the image alone. Smart and playful, never silly or random.',
            'Reply with 1–2 English sentences describing only the scene to photograph/illustrate.',
            'Constraints: no text or letters anywhere in the scene, no real identifiable public figures, must work in black-and-white.',
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

function buildPrompt(title: string, category: string, concept?: string): string {
  const scene = concept
    ? `Scene concept (follow it closely): ${concept}`
    : `A striking, eye-catching editorial magazine-cover image that clearly represents this Korean news topic: "${title}" (category: ${category}).`;
  return [
    scene,
    'Render as dramatic high-contrast BLACK AND WHITE editorial photography / photo-illustration, cinematic lighting, bold composition, magazine-cover energy that hooks instantly.',
    'The image must clearly evoke the news topic — clever, not generic.',
    'Leave some darker negative space toward the lower area so overlaid white headline text stays readable.',
    'STRICT: no text, no letters, no words, no numbers, no logos, no watermarks; do not depict specific real, identifiable public figures.',
  ].join(' ');
}

export async function generateCardImage(
  title: string,
  category: string
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not configured');

  // concept stage is best-effort — any failure falls back to the direct prompt
  let concept: string | undefined;
  try {
    concept = await imagineConcept(title, category, apiKey);
  } catch {
    concept = undefined;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(title, category, concept) }] }],
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
