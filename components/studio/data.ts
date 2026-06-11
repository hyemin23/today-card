import type { Magazine } from '@/types/db';

export const CATEGORIES = ['정치', '경제', '사회', '문화', 'IT·과학', '스포츠', '연예', '패션', '뷰티', '여행', '푸드', '라이프'];
export const KEYWORDS = ['기준금리', '전기차', '서울전시', '월드컵', '생성형AI', '제철음식', '주말나들이', 'K-팝', '물가'];
export const CRAWL_SOURCES = ['네이버뉴스', '일간경제', '테크리포트', '컬처위클리', '도시신문', '스포츠데일리', '위켄드'];

export const TEXT_COLORS = ['#ffffff', '#111110', '#e7d9b8', '#b8c6e7'];
export const BG_SWATCHES = ['#111110', '#ffffff', '#f6f4ef', '#1a2b22', '#2a2438'];
export const ACCENT_SWATCHES = ['#ffffff', '#111110', '#9a8456', '#7c8f6b'];

export const MAGAZINES: Magazine[] = [
  { id: 'ink', name: 'INK Daily', logoText: 'INK.', handle: '@ink.daily', ctaHeadline: '팔로우하고 더 보기', ctaCopy: '매일 한 편, 가볍게 읽는 오늘의 뉴스. 저장하고 친구에게 공유해요.', hashtags: ['#카드뉴스', '#오늘의이슈', '#INK매거진'], bgColor: '#111110', accentColor: '#ffffff', isDefault: true },
  { id: 'soso', name: '소소한 기록', logoText: 'soso', handle: '@soso.log', ctaHeadline: '팔로우하고 더 보기', ctaCopy: '', hashtags: ['#소소한기록'], bgColor: '#f6f4ef', accentColor: '#111110' },
  { id: 'green', name: '초록잡지', logoText: 'GREEN', handle: '@green.zine', ctaHeadline: '팔로우하고 더 보기', ctaCopy: '', hashtags: ['#초록잡지'], bgColor: '#1a2b22', accentColor: '#ffffff' },
];
