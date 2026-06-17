/**
 * 카드 배경 이미지 생성(NB2) 공용 로직.
 *
 * FlowClient(카드 기획)와 EditorStage(스튜디오 편집)가 각자 두고 있던
 * 이미지 프롬프트 구성 + /api/image 호출 + 결과 축소 + 스크림 글자색 보정의
 * 단일 원본이다. 두 화면의 차이(카테고리·스타일·벤치 프롬프트 출처)는 호출부가
 * 파라미터로 넘긴다.
 *
 * 이미지 생성은 서버(/api/image)에서 관리자 쿠키를 재검증한다 — 여기선 호출만.
 */

import { resizeDataUrl } from '@/components/studio/imageFile';
import { stripEmphasis } from '@/components/studio/CardFace';
import type { Card } from '@/types/db';

export interface CardImageParams {
  /** 이미지 모델 프롬프트(제목). buildImagePrompt로 만든 값 권장. */
  title: string;
  /** 주제/카테고리 힌트 */
  category: string;
  /** 'trend'(풀컬러) | 'editorial'(흑백) */
  style: string;
  /** 벤치마킹 아트디렉션(매거진 benchImagePrompt). 없으면 '' */
  imageStyle?: string;
}

/**
 * 카드 제목·본문을 이미지 모델 프롬프트 한 줄로 만든다.
 * 강조 마커(**, ==)를 벗기고 본문은 90자까지 접어 넣는다.
 */
export function buildImagePrompt(title: string, body?: string): string {
  const t = stripEmphasis(title || '').replace(/\n/g, ' ').trim();
  const b = body ? stripEmphasis(body).replace(/\n/g, ' ').trim() : '';
  return b ? `${t} — ${b.slice(0, 90)}` : t;
}

/**
 * POST /api/image (NB2) → 축소된 data URL.
 * 메가바이트 PNG가 그대로 state/sessionStorage에 들어가지 않도록 resizeDataUrl로 줄인다.
 * 실패 시 throw(호출부가 사용자에게 안내).
 */
export async function generateCardImage(params: CardImageParams): Promise<string> {
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      category: params.category,
      style: params.style,
      imageStyle: params.imageStyle || '',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || '이미지 생성 실패');
  return resizeDataUrl(data.image);
}

/**
 * 사진을 깐 흰 배경 본문 카드는 스크림으로 어두워지므로 기본 잉크색(#111110) 글자를
 * 흰색으로 뒤집는다. Card·FlowCard 공용(FlowCard extends Card).
 */
export function imagePatch<T extends Card>(c: T, imageUrl: string): Partial<T> {
  return (c.kind === 'body' && c.textColor === '#111110'
    ? { imageUrl, textColor: '#ffffff' }
    : { imageUrl }) as Partial<T>;
}
