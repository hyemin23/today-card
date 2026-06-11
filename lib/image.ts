/**
 * Editorial cover-image generation via Gemini's native image model.
 * Deliberately produces an ABSTRACT, monochrome, magazine-style background —
 * never a literal depiction of the news event or real people — so it stays
 * on-brand (B&W editorial) and never fabricates a misleading "news photo".
 *
 * Admin-only: callers must pass the shared admin key, verified in the route.
 */

const MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';

function buildPrompt(title: string, category: string): string {
  return [
    'A minimal, abstract black-and-white editorial magazine cover background.',
    `Mood/theme inspired by this Korean news topic: "${title}" (category: ${category}).`,
    'Monochrome, high-contrast, fine film grain, subtle geometric or textural composition.',
    'Photographic-art / fine-art aesthetic, square composition, lots of negative space.',
    'STRICT: no text, no letters, no words, no numbers, no logos, no watermarks,',
    'no recognizable real people, no faces, no literal depiction of a real event.',
  ].join(' ');
}

export async function generateCardImage(
  title: string,
  category: string
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(title, category) }] }],
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
