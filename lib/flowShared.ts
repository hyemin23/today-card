import type { Card, FlowCard, FlowRole } from '@/types/db';

/** 흐름 역할 → 렌더러 카드 종류. 클라이언트·서버 공용(순수 함수, env 미사용). */
export const roleToKind = (r: FlowRole): Card['kind'] => (r === 'hook' ? 'cover' : r === 'cta' ? 'cta' : 'body');

export const VALID_ROLES: FlowRole[] = ['hook', 'pain', 'step', 'result', 'cta'];

/**
 * role별 라벨·색·번호를 채우고 idx/step/total을 다시 매긴다.
 * 생성 직후(서버)와 편집 후(클라이언트) 모두 같은 규칙으로 쓰려고 분리했다.
 */
export function renumberDeck(cards: FlowCard[]): FlowCard[] {
  const stepTotal = cards.filter((c) => c.role === 'step').length;
  let s = 0;
  return cards.map((c, i) => {
    const kind = roleToKind(c.role);
    const base: FlowCard = {
      ...c,
      idx: i,
      kind,
      // 텍스트 색은 항상 kind 기준으로 재계산한다 — role 강등(예: cta→step) 시에도
      // 흰글자/흰배경 충돌이 생기지 않게(/flow엔 카드별 색 편집 UI가 없다).
      textColor: kind === 'body' ? '#111110' : '#ffffff',
      fontScale: c.fontScale || 1,
      align: c.align || '6',
      imageUrl: c.imageUrl ?? null,
    };
    if (c.role === 'step') {
      s += 1;
      // 단계가 1개뿐이면 'STEP 1 / 1'이 어색하므로 번호만(STEP n) 표기
      return { ...base, step: s, stepTotal, label: stepTotal <= 1 ? 'STEP' : `STEP ${s} / ${stepTotal}` };
    }
    if (c.role === 'cta') return { ...base, label: 'CTA', step: undefined, stepTotal: undefined };
    if (c.role === 'hook') return { ...base, label: undefined, step: undefined, stepTotal: undefined };
    return { ...base, label: '본문', step: undefined, stepTotal: undefined }; // pain / result
  });
}
