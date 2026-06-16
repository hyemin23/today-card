import { readFile } from 'fs/promises';
import { join } from 'path';

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
const START = '<!-- FLOW-PROMPT:START';
const END = '<!-- FLOW-PROMPT:END';

export async function loadFlowPromptRules(): Promise<string> {
  const md = await readFile(RULES_PATH, 'utf8');
  const s = md.indexOf(START);
  const e = md.indexOf(END);
  if (s === -1 || e === -1 || e <= s) {
    throw new Error('card-flow.md 에서 FLOW-PROMPT 마커를 찾지 못했어요(§8 마커 확인).');
  }
  const afterStart = md.indexOf('-->', s);
  if (afterStart === -1 || afterStart > e) throw new Error('FLOW-PROMPT 시작 마커가 닫히지 않았어요.');
  // 마커 사이 본문에서 코드펜스(``` …)만 벗겨낸 순수 규칙 텍스트
  const block = md
    .slice(afterStart + 3, e)
    .trim()
    .replace(/^```[^\n]*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();
  if (!block) throw new Error('FLOW-PROMPT 블록이 비어 있어요.');
  return block;
}
