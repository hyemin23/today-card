import { load } from 'cheerio';
import type { Article } from '@/types/db';

/**
 * Keyless news collection by directly fetching & scraping public search pages —
 * no API key required.
 *
 *   1. Daum 뉴스 검색 (primary)  — title, direct article URL, real summary,
 *      thumbnail, press name, date in a single request. Kakao's search does not
 *      bot-block server-side fetches the way Naver does.
 *   2. Google News RSS (fallback) — title / source / date when Daum is unreachable.
 *   3. MOCK (last resort)         — so the app never dead-ends offline.
 *
 * Only headlines, short snippets and links back to the source are used — never
 * full article bodies — to stay within fair-use for a personal aggregator.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const COMMON_HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Strip leading photo-credit / DB-ban noise Daum snippets often start with. */
function cleanSummary(s: string): string {
  return tidy(
    s
      .replace(/^\s*\[[^\]]*?(제공|금지|연합뉴스|뉴시스)[^\]]*\]\s*/g, '')
      .replace(/^\s*\([^)]*?(사진|제공|=)[^)]*\)\s*/g, '')
      .replace(/ⓒ[^()]*?(?=\s|\(|$)/g, '')
  );
}

/** Best-effort press name from a Korean wire byline embedded in the snippet. */
function pressFromByline(s: string): string {
  const m =
    s.match(/\([가-힣]{1,6}=\s*([가-힣A-Za-z0-9·]{2,10})\)/) ||
    s.match(/ⓒ[^=]{0,12}=\s*([가-힣A-Za-z0-9]{2,10})/) ||
    s.match(/\[([가-힣A-Za-z0-9]{2,10})\s*[가-힣]{0,4}\s*기자\]/) ||
    s.match(/[=ㅡ·]\s*([가-힣]{2,8}(?:일보|신문|뉴스|경제|투데이|미디어|타임스|데일리|방송))/);
  return m ? m[1] : '';
}

/** "2시간 전" · "16시간 전" · "3일 전" · "2026.06.10" → YYYY.MM.DD (KST). */
function normalizeDate(raw: string): string {
  const now = Date.now();
  const rel = raw.match(/(\d+)\s*(분|시간|일|주|개월)\s*전/);
  let ms = now;
  if (rel) {
    const n = Number(rel[1]);
    const unit = { 분: 6e4, 시간: 36e5, 일: 864e5, 주: 6048e5, 개월: 2592e6 }[rel[2]] || 0;
    ms = now - n * unit;
  } else {
    const abs = raw.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
    if (abs) return `${abs[1]}.${abs[2].padStart(2, '0')}.${abs[3].padStart(2, '0')}`;
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(ms)).replace(/-/g, '.');
}

async function crawlDaum(query: string, category?: string): Promise<Article[]> {
  const url = `https://search.daum.net/search?w=news&q=${encodeURIComponent(query)}&DA=PGD`;
  const html = await fetchText(url, 7000);
  const $ = load(html);
  const out: Article[] = [];

  $('.c-item-content').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('.tit-g a').first();
    const title = tidy($a.text());
    const sourceUrl = $a.attr('href') || '';
    if (!title || !sourceUrl) return;

    const summary = cleanSummary($el.find('.conts-desc').first().text());

    // press name is inconsistently present in Daum markup — try a labelled
    // node, then recover from the byline, then fall back to a generic label.
    // (sourceUrl always points to the real article, so attribution is preserved.)
    let press = '';
    $el.find('.item-writer .txt_info, .txt_info').each((_, t) => {
      const tx = tidy($(t).text());
      if (!press && tx && !/전$|^\d{4}\.|^\d{1,2}:\d{2}/.test(tx)) press = tx;
    });
    if (!press) press = pressFromByline($el.find('.conts-desc').first().text());

    out.push({
      title,
      summary,
      source: press || '뉴스',
      sourceUrl,
      category: category || '뉴스',
      date: normalizeDate(tidy($el.find('.gem-subinfo .txt_info').first().text())),
      thumb: $el.find('img[data-original-src]').attr('data-original-src') || null,
    });
  });

  return out;
}

async function crawlGoogleNews(query: string, category?: string): Promise<Article[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  // budget: 7s (Daum) + 5s (Google) + parse stays under the route's 20s maxDuration,
  // so crawlNews always reaches its MOCK fallback even if both sources hang
  const xml = await fetchText(url, 5000);
  const $ = load(xml, { xmlMode: true });
  const out: Article[] = [];

  $('item').each((_, el) => {
    const $el = $(el);
    const rawTitle = tidy($el.find('title').first().text());
    if (!rawTitle) return;
    const source = tidy($el.find('source').first().text());
    // Google appends " - 출처" to titles — strip by string op (source may contain
    // regex metacharacters, so never interpolate it into a RegExp)
    const suffix = ` - ${source}`;
    const title = source && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length).trim() : rawTitle;
    out.push({
      title,
      summary: '',
      source: source || '뉴스',
      sourceUrl: $el.find('link').first().text() || '',
      category: category || '뉴스',
      date: normalizeDate(tidy($el.find('pubDate').first().text())),
      thumb: null,
    });
  });

  return out;
}

const MOCK: Article[] = [
  { title: '조용하던 도심, 다시 붐비기 시작했다', summary: '늘어난 야간 보행 인구가 도심 상권의 회복을 이끌고 있다는 분석이 나온다. 골목 상권에도 온기가 돌고 있다.', source: '도시신문', category: '사회', date: '2026.06.04' },
  { title: '기준금리 동결… “하반기 인하 가능성 열어둬”', summary: '한국은행이 기준금리를 현 수준에서 동결했다. 물가 둔화 흐름과 경기 회복세를 함께 고려한 결정이라는 분석이 나온다.', source: '일간경제', category: '경제', date: '2026.06.04' },
  { title: '생성형 AI, 이제 ‘말’보다 ‘일’을 한다', summary: '단순 대화를 넘어 실제 업무를 대신 처리하는 에이전트형 AI가 빠르게 확산되고 있다. 기업들의 도입 경쟁도 치열해지는 모습이다.', source: '테크리포트', category: 'IT·과학', date: '2026.06.04' },
  { title: '미술관 밤 개장, 도심의 새로운 산책이 되다', summary: '야간 개장을 도입한 미술관에 발길이 이어지고 있다. 늦은 저녁 전시를 즐기는 ‘문화 산책’이 흐름으로 자리잡는 분위기다.', source: '컬처위클리', category: '문화', date: '2026.06.03' },
];

/**
 * Collect news for a topic. Tries Daum → Google News → mock, in order.
 * Always resolves (never throws) so the UI can render something.
 */
export async function crawlNews(query: string, category?: string): Promise<Article[]> {
  const q = query.trim() || '오늘 뉴스';

  try {
    const daum = await crawlDaum(q, category);
    if (daum.length) return daum;
  } catch {
    /* fall through */
  }

  try {
    const google = await crawlGoogleNews(q, category);
    if (google.length) return google;
  } catch {
    /* fall through */
  }

  return MOCK;
}

/**
 * Fetch an article page and extract its main body text, so the card generator
 * can summarize the *whole* article (not just the 2-sentence search snippet).
 * Returns '' on any failure — caller falls back to the snippet.
 * Only the text is used, and it's summarized (not republished), with the source
 * always attributed.
 */
export async function fetchArticleBody(url?: string): Promise<string> {
  if (!url || !/^https?:\/\//.test(url)) return '';
  try {
    const html = await fetchText(url, 7000);
    const $ = load(html);
    $('script, style, figcaption, .link_figure, .reporter_area').remove();

    const containers = ['.article_view', '[data-cy="articleBody"]', '.news_view', '#harmonyContainer', '#articleBody', 'article'];
    let text = '';
    for (const sel of containers) {
      const node = $(sel).first();
      if (!node.length) continue;
      const parts: string[] = [];
      node.find('p, [dmcf-ptype="general"]').each((_, p) => {
        const t = tidy($(p).text());
        if (t.length > 15) parts.push(t);
      });
      const joined = parts.join('\n');
      if (joined.length > text.length) text = joined;
      if (text.length > 400) break;
    }
    // fallback: any reasonably long <p> on the page
    if (text.length < 200) {
      const parts: string[] = [];
      $('p').each((_, p) => { const t = tidy($(p).text()); if (t.length > 25) parts.push(t); });
      if (parts.join('\n').length > text.length) text = parts.join('\n');
    }
    // last resort: og:description
    if (text.length < 80) text = tidy($('meta[property="og:description"]').attr('content') || '');

    return text.slice(0, 3000);
  } catch {
    return '';
  }
}
