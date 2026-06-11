/**
 * Topic-driven cover-image generation via Gemini's native image model.
 * Produces a striking, HOOKING magazine-cover image that clearly evokes the
 * article's subject — high-contrast black-and-white so it stays on-brand
 * (B&W editorial) and layers cleanly under the cover card's dark gradient.
 * Avoids text/logos and specific real identifiable individuals.
 *
 * Admin-only: gated by the admin session cookie, verified in the route.
 */

const MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';

function buildPrompt(title: string, category: string): string {
  return [
    `A striking, eye-catching editorial magazine-cover image that clearly represents this Korean news topic: "${title}" (category: ${category}).`,
    'Dramatic high-contrast BLACK AND WHITE, bold cinematic composition with a strong central subject or scene that visually evokes the topic, photojournalistic / editorial style, magazine-cover energy that immediately hooks the viewer.',
    'The subject must clearly relate to the topic — avoid generic abstract patterns.',
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
