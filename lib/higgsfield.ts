/**
 * Higgsfield Cloud API 이미지 생성 (대체 제공자).
 *
 * 정책(design-system/design.md §8): 기본 제공자는 Gemini다. 이 모듈은
 * IMAGE_PROVIDER=higgsfield 또는 요청의 provider='higgsfield'로 명시했을 때만 호출된다.
 *
 * REST 계약 (https://docs.higgsfield.ai):
 *   POST https://platform.higgsfield.ai/{model}              → { request_id }
 *   GET  https://platform.higgsfield.ai/requests/{id}/status → { status, images:[{url}] }
 *   인증: Authorization: Key {HF_API_KEY}:{HF_API_SECRET}
 * 비동기 잡이라 완료까지 폴링한다. 완료되면 이미지를 내려받아 base64 data URL로
 * 변환해 반환한다 — Gemini 경로와 반환 형태를 맞춰 호출부(lib/image.ts, lib/imageGen.ts)가
 * 제공자를 구분할 필요 없게 한다.
 */

const BASE_URL = 'https://platform.higgsfield.ai';
// soul/standard 기준 aspect_ratio는 4:5를 지원하지 않아, 카드 비율(4:5)에 가장 가까운 3:4로 근사한다.
const MODEL = process.env.HF_IMAGE_MODEL || 'higgsfield-ai/soul/standard';
const ASPECT_RATIO = process.env.HF_ASPECT_RATIO || '3:4';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 50_000;

function authHeader(): string {
  const key = process.env.HF_API_KEY;
  const secret = process.env.HF_API_SECRET;
  if (!key || !secret) throw new Error('HF_API_KEY/HF_API_SECRET not configured');
  return `Key ${key}:${secret}`;
}

export async function generateImageViaHiggsfield(prompt: string): Promise<string> {
  const auth = authHeader();

  const submitRes = await fetch(`${BASE_URL}/${MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ prompt, aspect_ratio: ASPECT_RATIO }),
  });
  if (!submitRes.ok) {
    const msg = await submitRes.text().catch(() => '');
    throw new Error(`higgsfield submit failed: ${submitRes.status} ${msg.slice(0, 200)}`);
  }
  const submitData = await submitRes.json();
  const requestId = submitData.request_id || submitData.id;
  if (!requestId) throw new Error('higgsfield: no request_id in response');

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const statusRes = await fetch(`${BASE_URL}/requests/${requestId}/status`, {
      headers: { Authorization: auth },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();

    if (statusData.status === 'completed') {
      const imageUrl = statusData.images?.[0]?.url || statusData.image?.url;
      if (!imageUrl) throw new Error('higgsfield: completed but no image url in response');
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error('higgsfield: failed to download generated image');
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mime = imgRes.headers.get('content-type') || 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    }
    if (statusData.status === 'failed' || statusData.status === 'nsfw') {
      throw new Error(`higgsfield generation ${statusData.status}`);
    }
  }
  throw new Error('higgsfield: generation timed out');
}
