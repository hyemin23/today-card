import { readFile } from 'fs/promises';

/**
 * 마크다운 문서에서 `<!-- NAME:START -->` ~ `<!-- NAME:END -->` 사이 블록을 뽑는다.
 * 코드펜스(``` …)는 벗겨 순수 텍스트만 돌려준다.
 *
 * 디자인 문서(design.md / card-flow.md)를 생성 규칙의 '단일 원본'으로 쓰기 위한 공용 추출기.
 * 서버 전용(fs). 캐시하지 않으므로 문서를 고치면 다음 호출부터 즉시 반영된다.
 */
export function extractBlock(md: string, name: string): string {
  const start = `<!-- ${name}:START`;
  const end = `<!-- ${name}:END`;
  const s = md.indexOf(start);
  const e = md.indexOf(end);
  if (s === -1 || e === -1 || e <= s) throw new Error(`마커 ${name} 를 찾지 못했어요(START/END 확인).`);
  const afterStart = md.indexOf('-->', s);
  if (afterStart === -1 || afterStart > e) throw new Error(`마커 ${name} 의 시작 주석이 닫히지 않았어요.`);
  const block = md
    .slice(afterStart + 3, e)
    .trim()
    .replace(/^```[^\n]*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();
  if (!block) throw new Error(`블록 ${name} 가 비어 있어요.`);
  return block;
}

/** 파일을 한 번 읽어 여러 블록을 추출한다. */
export async function readDocBlocks(absPath: string, names: string[]): Promise<Record<string, string>> {
  const md = await readFile(absPath, 'utf8');
  const out: Record<string, string> = {};
  for (const n of names) out[n] = extractBlock(md, n);
  return out;
}
