/**
 * 카드 렌더 디자인 토큰의 **단일 원본** (design.md §1.4·§3.1·§9.1 의 수치).
 *
 * CardFace.tsx 가 이 값을 import 해서 쓴다 — 코드 곳곳에 흩어진 매직넘버 없이 여기 한 곳만 고치면
 * 미리보기·내보내기·스튜디오·/flow 가 모두 같이 바뀐다(클라이언트 컴포넌트라 design.md 를
 * 런타임에 읽을 수 없어, 문서 대신 이 파일이 토큰의 진실의 원본이다. design.md §3.1 은 여길 가리킴).
 *
 * 폰트 목록·스와치(색 후보)는 components/studio/data.ts 가 단일 원본.
 */
export const TOKENS = {
  /** 제목 기본 크기(px) — 컨텍스트별 (design.md §3.1) */
  title: { canvas: 42, slideCover: 25, slideCta: 23, slideBody: 21, thumb: 11 },
  /** 4:5 세로 확대 배수 (thumb 제외) */
  sizeBump45: 1.4,
  /** 헤드라인 스타일 */
  headline: { weight: 800, boldWeight: 900, letterSpacing: '-.035em', lineHeight: 1.16 },
  /** 본문 */
  body: { canvas: 15, slide: 11, lineHeight: 1.6, opacity: 0.85 },
  /** 카드 안쪽 여백(px) — 세이프존 */
  pad: { canvas: 40, slide: 22, thumb: 12 },
  /** 위치 기본값 — 3×3 그리드 index 6 = 왼쪽 아래 */
  defaultAlignIndex: 6,
  /** 오토핏 최소 축소 배수(과축소 방지) */
  autofitMin: 0.4,
  /** 사진 위 스크림(글자 가독성용 어두운 그라데이션) (design.md §1.4) */
  scrim: 'linear-gradient(to top,rgba(17,17,16,.82),rgba(17,17,16,.2) 48%,rgba(17,17,16,.55))',
  /** 기본 색 (스와치 후보는 data.ts) (design.md §9.1) */
  color: { ink: '#111110', paper: '#ffffff', white: '#ffffff' },
} as const;
