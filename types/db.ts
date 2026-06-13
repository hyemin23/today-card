export type CardKind = 'cover' | 'body' | 'cta';

/** cover art direction: monochrome editorial (default) vs full-color trend visual */
export type CoverStyle = 'editorial' | 'trend';

export interface Magazine {
  id: string;
  name: string;
  logoText: string;
  logoUrl?: string | null;
  coverStyle?: CoverStyle;
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
}

export interface GenerateResult {
  cards: Card[];
  caption: string;
  hashtags: string[];
}
