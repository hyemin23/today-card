import { join } from 'path';
import { readDocBlocks } from './docBlock';

/**
 * 카드뉴스 생성 규칙의 **단일 원본**을 design-system/card-flow.md 에서 읽어온다.
 *
 * §8 의 `<!-- FLOW-PROMPT:START -->` ~ `<!-- FLOW-PROMPT:END -->` 사이 블록이
 * 실제 LLM 시스템 프롬프트다. 코드에 사본을 두지 않으므로 문서와 절대 어긋나지 않고,
 * 캐시하지 않으므로 문서를 고치면 다음 생성부터 즉시 반영된다(문서 = 진실의 원본).
 *
 * 서버 전용(fs). lib/flow.ts(서버)에서만 import 한다.
 * 프로덕션 번들 포함은 next.config.mjs 의 outputFileTracingIncludes 로 보장한다.
 */
const RULES_PATH = join(process.cwd(), 'design-system', 'card-flow.md');

export async function loadFlowPromptRules(): Promise<string> {
  const blocks = await readDocBlocks(RULES_PATH, ['FLOW-PROMPT']);
  return blocks['FLOW-PROMPT'];
}
