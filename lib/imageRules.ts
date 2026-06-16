import { join } from 'path';
import { readDocBlocks } from './docBlock';

/**
 * 이미지(NB2) 프롬프트 규칙의 **단일 원본**을 design-system/design.md §8.5 에서 읽어온다.
 *
 * IMG-CONSTRAINTS(브랜드 안전 제약) / IMG-TREND(풀컬러 룩) / IMG-EDITORIAL(흑백 룩)
 * 세 블록이 실제 프롬프트 텍스트다. 코드에 사본을 두지 않으므로 문서와 어긋날 수 없고,
 * 캐시하지 않으므로 문서를 고치면 다음 생성부터 즉시 반영된다.
 *
 * 서버 전용(fs). lib/image.ts(서버)에서만 import. 프로덕션 번들 포함은
 * next.config.mjs 의 outputFileTracingIncludes('/api/image')로 보장한다.
 */
const DESIGN_PATH = join(process.cwd(), 'design-system', 'design.md');

export interface ImageRules {
  constraints: string;
  trend: string;
  editorial: string;
}

export async function loadImageRules(): Promise<ImageRules> {
  const b = await readDocBlocks(DESIGN_PATH, ['IMG-CONSTRAINTS', 'IMG-TREND', 'IMG-EDITORIAL']);
  return { constraints: b['IMG-CONSTRAINTS'], trend: b['IMG-TREND'], editorial: b['IMG-EDITORIAL'] };
}
