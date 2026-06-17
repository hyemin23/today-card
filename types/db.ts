export type CardKind = 'cover' | 'body' | 'cta';

/** cover art direction: monochrome editorial (default) vs full-color trend visual */
export type CoverStyle = 'editorial' | 'trend';

export interface Magazine {
  id: string;
  name: string;
  logoText: string;
  logoUrl?: string | null;
  coverStyle?: CoverStyle;
  /** 템플릿 헤드라인 글씨체 키(FONTS in studio/data.ts); '' 또는 미설정 = 기본 Pretendard */
  fontKey?: string;
  /** benchmark style profile (계정 분석 결과) — overrides tone/image direction when set */
  benchName?: string;
  benchSummary?: string;
  benchTone?: string;
  benchImagePrompt?: string;
  handle: string;
  ctaHeadline: string;
  ctaCopy: string;
  hashtags: string[];
  bgColor: string;
  accentColor: string;
  /** 드로어 배경색/포인트색 피커의 편집 가능한 스와치 팔레트(최대 5개). 없으면 기본 팔레트 사용 */
  bgSwatches?: string[];
  accentSwatches?: string[];
  /** AI 해시태그 자동 추천 — 기본 false(해시태그 없음). true면 생성 시 주제 해시태그 제안 */
  autoHashtags?: boolean;
  isDefault?: boolean;
}

export interface Article {
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  category: string;
  date: string;
  /** result-list thumbnail scraped from the source (not embedded in cards) */
  thumb?: string | null;
}

export interface Card {
  idx: number;
  kind: CardKind;
  title: string;
  body?: string;
  hashtags?: string[];
  imageUrl?: string | null;
  textColor: string;
  fontScale: number;
  /** 3×3 position grid index '0'–'8' (row-major; '6' = bottom-left, the default) */
  align: string;
  /** article context shown on the cover (category pill, source line) */
  category?: string;
  source?: string;
  /** per-card visibility toggles for template chrome (default shown) */
  hideNum?: boolean;
  hideLabel?: boolean;
  hideHandle?: boolean;
  /** cover only: hide the "밀어서 보기 →" swipe cue */
  hideSwipe?: boolean;
  /** headline font key (see FONTS in studio/data.ts); empty = default Pretendard */
  fontFamily?: string;
  /** optional meta-row label override (e.g. "STEP 1 / 4"); falls back to '본문'/'CTA' */
  label?: string;
}

export interface GenerateResult {
  cards: Card[];
  caption: string;
  hashtags: string[];
}

/* ── 자동 카드뉴스 흐름 (card-flow.md) — 가변 길이 덱 ─────────────────────
   기사 기반 5장 고정(generateCards)과 별개의 신규 흐름.
   입력 4개 → Hook → Pain → Steps(×N) → Result → CTA (총 N+4장). */

export type FlowRole = 'hook' | 'pain' | 'step' | 'result' | 'cta';

export interface FlowInput {
  /** 카드뉴스로 만들 주제 또는 기사 내용 */
  topic: string;
  /** 이 카드뉴스를 볼 사람 */
  target: string;
  /** 말투·태도 (기본: 현실적·직설적, 초보자도 따라하게) */
  tone: string;
  /** 보고 나서 하길 바라는 최종행동 (CTA가 향할 목표) */
  goal: string;
}

/** 렌더러(CardFace)가 그대로 그릴 수 있도록 Card를 확장한 흐름 카드 */
export interface FlowCard extends Card {
  role: FlowRole;
  /** step 카드일 때 단계 번호 / 총 단계 수 */
  step?: number;
  stepTotal?: number;
}

export interface FlowDeck {
  meta: FlowInput & { total: number };
  cards: FlowCard[];
}
