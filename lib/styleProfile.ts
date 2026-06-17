import type { StyleProfile } from '@/lib/styleAnalyze';

/**
 * /api/style-analyze 호출 → StyleProfile (실패 시 메시지와 함께 throw).
 * 스튜디오(MagazineDrawer)와 /flow(카드 기획)가 공유하는 클라이언트 래퍼 —
 * 분석 자체는 서버에서 관리자 쿠키를 재검증한다(유료 비전).
 */
export async function fetchStyleProfile(
  payload: { username?: string; images?: string[] }
): Promise<StyleProfile> {
  const res = await fetch('/api/style-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || '분석에 실패했어요.');
  return data.profile as StyleProfile;
}
