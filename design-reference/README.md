# Handoff: INK. — AI 카드뉴스 스튜디오 (Next.js + Supabase)

> 네이버 뉴스 기사를 골라 AI가 인스타그램용 카드뉴스 5컷을 자동 생성하고, 매거진(브랜드) 단위로 로고·색·해시태그를 입혀 다운로드하는 웹 서비스.

---

## 1. Overview

INK.은 **모든 장르(정치·경제·사회·문화·IT·스포츠·연예·패션·뷰티·여행·푸드·라이프)** 의 뉴스를
카드뉴스로 만드는 도구입니다. 사용자는 ①매거진(브랜드)을 한 번 설정하고 → ②기사를 검색·선택하면
→ ③AI가 5컷(표지 / 본문×3 / CTA)을 생성 → ④이미지·문구를 다듬고 → ⑤개별·ZIP·캡션으로 내보냅니다.

핵심 화면 흐름:

```
/                  랜딩 (히어로로 주제 입력 → 스튜디오로 딥링크)
  → /studio         단일 작업공간 — 한 화면에서 3단계 전환(페이지 이동 없음)
      Stage 1 주제   — 주제 입력/태그 선택 → 크롤링 → 기사 선택 → AI 생성
      Stage 2 편집   — 5컷 레일 / 캔버스 / 인스펙터
      Stage 3 내보내기 — 인스타 캐러셀 미리보기 · 개별/ZIP · 캡션 복사
      매거진 설정   — 우측 슬라이드 드로어(언제든 열림)
```

---

## 2. About the Design Files

이 번들의 `.html` / `.css` 파일은 **디자인 레퍼런스(프로토타입)** 입니다 — 의도한 룩앤필과 동작을
보여주는 정적 목업이며, **그대로 배포할 프로덕션 코드가 아닙니다.**

작업 목표는 이 HTML 디자인을 **Next.js(App Router) + Supabase 환경에서 재현**하는 것입니다.
마크업/스타일 구조와 디자인 토큰은 `assets/styles.css`에 정리돼 있으니, Tailwind로 옮기든 CSS
Modules로 그대로 쓰든 **값(색·타이포·간격)을 정확히 보존**해 주세요.

- **Fidelity: High (hifi).** 색·폰트·간격·인터랙션이 최종안에 가깝습니다. 픽셀에 충실하게 재현하세요.

---

## 3. 권장 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 14+ (App Router, TypeScript)** | 서버 컴포넌트 + Route Handlers |
| 스타일 | **Tailwind CSS** (토큰 매핑) 또는 제공된 `styles.css` 직접 사용 | §8 토큰 표 참조 |
| DB / Auth / Storage | **Supabase** (Postgres + RLS + Storage + Auth) | 익명 로그인 권장 |
| 폰트 | `next/font` — **Pretendard**(단일 타이포스, self-host) + **Space Mono**(마이크로 라벨) | §8 참조 |
| 뉴스 수집 | **네이버 검색 API**(news) — 서버 라우트에서만 호출 | 키 노출 금지 |
| AI 생성 | LLM(OpenAI/Claude 등) — 서버 라우트에서 호출, JSON 구조 응답 | §6 프롬프트 계약 |
| ZIP | 클라이언트 `jszip` 또는 서버 라우트 | 카드 PNG는 `html-to-image`/`satori`로 렌더 |

> **저장 정책:** 레퍼런스 서비스는 매거진을 *브라우저(localStorage)* 에만 저장합니다.
> Supabase로 옮길 때는 **익명 Auth + per-user RLS** 로 매거진/작업을 서버에 저장하되,
> 로그인 없이도 쓰도록 익명 세션을 자동 발급하는 방식을 권장합니다. (둘 중 택1 — §5 참조)

---

## 4. App Router 폴더 구조 (제안)

> 레퍼런스는 단일 스튜디오(클라이언트 state로 3단계 전환)입니다. Next.js에서는 (A) 단일 `/studio` 라우트 + 클라이언트 상태, 또는 (B) 공유 레이아웃 아래 세그먼트로 구현 가능. 작업(job)은 URL `?job=` 또는 서버 저장.

```
app/
  layout.tsx                 # 폰트, 글로벌 토큰
  page.tsx                   # 랜딩 (/)
  studio/
    page.tsx                 # 단일 작업공간 — 상단바 + 스테퍼 + 3스테이지 + 매거진 드로어
  api/
    search/route.ts          # GET 네이버 뉴스 검색 (서버 전용 키)
    generate/route.ts        # POST 기사 → 5컷 카드 JSON (LLM + 레이트리밋)
    render/route.ts          # (옵션) 카드 → PNG 렌더 / ZIP

components/
  nav.tsx  footer.tsx
  card-mock.tsx              # 인스타 정사각 카드(표지/본문/CTA variant)
  magazine-form.tsx  swatch-picker.tsx  logo-uploader.tsx
  article-card.tsx  category-tabs.tsx  keyword-chips.tsx
  editor/ rail.tsx  canvas.tsx  inspector.tsx
  export/ card-grid.tsx  caption-panel.tsx  zip-cta.tsx

lib/
  supabase/ client.ts  server.ts   # @supabase/ssr
  naver.ts                          # 검색 API 래퍼
  ai.ts                             # LLM 호출 + 스키마 검증(zod)
  ratelimit.ts                      # 1인 하루 10회

types/ db.ts                        # supabase gen types
```

---

## 5. Supabase 데이터 모델

### 5.1 SQL 스키마

```sql
-- 매거진(브랜드 프리셋) ----------------------------------------------------
create table magazines (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  name         text not null,                 -- "INK Daily"
  logo_text    text,                          -- 1번 카드 로고 텍스트 "INK."
  logo_url     text,                          -- 마지막 카드 로고 이미지 (storage)
  handle       text,                          -- "@ink.daily"
  cta_headline text default '팔로우하고 더 보기',
  cta_copy     text,
  hashtags     text[] default '{}',           -- ["#카드뉴스", ...]
  bg_color     text default '#111110',        -- 배경색
  accent_color text default '#ffffff',        -- 포인트색
  is_default   boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 카드뉴스 생성 작업(기사 1건 = 작업 1건) ---------------------------------
create table card_jobs (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users(id) on delete cascade,
  magazine_id   uuid references magazines(id) on delete set null,
  category      text,                          -- "사회"
  source        text,                          -- 언론사 "도시신문"
  source_url    text,
  article_title text not null,
  article_summary text,
  status        text default 'draft',          -- generating|draft|ready
  created_at    timestamptz default now()
);

-- 카드 5컷 (작업당 보통 5행) ----------------------------------------------
create table cards (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references card_jobs(id) on delete cascade,
  idx         int  not null,                   -- 0..4
  kind        text not null,                   -- cover|body|cta
  title       text,
  body        text,
  hashtags    text[],                          -- CTA 카드용
  image_url   text,                            -- 사용자가 올린 사진 (storage)
  text_color  text default '#ffffff',
  font_scale  numeric default 1.0,             -- 0.6 ~ 1.6
  align       text default 'bottom-left',      -- 3x3 위치
  created_at  timestamptz default now(),
  unique (job_id, idx)
);

-- 하루 생성 횟수 제한용 로그 ---------------------------------------------
create table generation_log (
  id        bigserial primary key,
  owner     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index on generation_log (owner, created_at);
```

### 5.2 RLS (소유자만 접근)

```sql
alter table magazines      enable row level security;
alter table card_jobs      enable row level security;
alter table cards          enable row level security;
alter table generation_log enable row level security;

create policy "own magazines" on magazines
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own jobs" on card_jobs
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own cards" on cards
  for all using (
    exists (select 1 from card_jobs j where j.id = cards.job_id and j.owner = auth.uid())
  );
create policy "own gen log" on generation_log
  for all using (owner = auth.uid()) with check (owner = auth.uid());
```

### 5.3 Storage 버킷

| 버킷 | 용도 | 접근 |
|---|---|---|
| `magazine-logos` | 마지막 카드 로고 이미지 | public read, owner write |
| `card-images`    | 각 카드 배경 사진(사용자 업로드) | public read, owner write |

> 경로 규칙: `card-images/{owner}/{jobId}/{cardIdx}.png` → RLS `storage.foldername(name)[1] = auth.uid()`.

### 5.4 익명 Auth + 레이트리밋

- 첫 방문 시 `supabase.auth.signInAnonymously()` 로 세션 발급 → 로그인 없이 매거진/작업 저장.
- 생성 직전 `generation_log` 에서 `count(*) where owner=uid and created_at > now()-interval '1 day'` 확인 → **10 이상이면 429**.

> **대안(서버리스 최소 구성):** Supabase 없이 매거진은 `localStorage`에만 저장하고, 작업/카드도
> 클라이언트 상태로만 다뤄도 됩니다. 이 경우 §5는 건너뛰고 §6(생성)·§7(렌더)만 구현하세요.

---

## 6. AI 생성 & 뉴스 검색 (서버 라우트)

### 6.1 `GET /api/search?q=&category=`
- 네이버 뉴스 검색 API 호출(서버 전용 `NAVER_CLIENT_ID/SECRET`).
- 반환: `{ items: [{ title, summary, source, sourceUrl, date }] }` — **제목·요약문만** 사용. 기사 전문 크롤링 금지.

### 6.2 `POST /api/generate`
- body: `{ articleTitle, articleSummary, source, category, magazineId }`
- 레이트리밋 통과 후 LLM 호출. **출력 JSON 계약(zod 검증):**

```jsonc
{
  "cards": [
    { "kind": "cover", "title": "조용하던 도심, 다시 붐비기 시작했다" },
    { "kind": "body",  "title": "늘어난 야간 보행 인구", "body": "밤 시간대 도심을 걷는 사람이 늘며…" },
    { "kind": "body",  "title": "골목 상권에 도는 온기", "body": "…" },
    { "kind": "body",  "title": "전문가가 보는 회복세", "body": "…" },
    { "kind": "cta",   "title": "팔로우하고 더 보기" }
  ],
  "caption": "조용하던 도심이 다시 붐비기 시작했습니다 …",
  "hashtags": ["#카드뉴스", "#오늘의이슈", "#도심", "#상권회복"]
}
```

- 시스템 프롬프트 핵심: *한국어, 매거진 톤, 표지=후킹 헤드라인, 본문=한 문장 요지, 과장/허위 금지,
  제목·요약문 범위 밖 사실 추가 금지.* 생성 후 `cards`/`card_jobs` insert, `generation_log` insert.
- **사진은 자동 삽입하지 않음** (`image_url`은 null로 시작 — 저작권 보호).

### 6.3 환경변수 (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # 서버 라우트 전용
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
LLM_API_KEY=
```

---

## 7. 카드 → 이미지 렌더 (1080×1080)

- 화면의 `card-mock` 컴포넌트를 **1080×1080 정사각**으로 렌더해 PNG로 저장.
- 권장: `satori` + `resvg`(서버, 폰트 임베드) 또는 `html-to-image`(클라이언트).
- 개별 다운로드 = 카드 1장 PNG / 전체 = `jszip`로 5장 묶어 `INK-{magazine}-{MMDD}.zip`.
- 캡션·해시태그 "전체 복사" = `navigator.clipboard.writeText(caption + '\n\n' + hashtags.join(' ') + '\n\n출처 · ' + source)`.

---

## 8. 디자인 토큰 (`assets/styles.css` 기준)

### 컬러 (모노톤 B&W)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--ink`    | `#111110` | 기본 텍스트 · 다크 배경 · 버튼 |
| `--ink-2`  | `#4a4945` | 보조 텍스트 |
| `--ink-3`  | `#8c8a83` | 메타 · 플레이스홀더 |
| `--line`   | `#e4e1d9` | 헤어라인 보더 |
| `--line-2` | `#d4d0c6` | 인풋/칩 보더 |
| `--paper`  | `#ffffff` | 기본 배경 |
| `--wash`   | `#f6f4ef` | 섹션/호버 배경 (살짝 웜) |
| `--wash-2` | `#efece4` | 보조 배경 |

매거진 프리셋 배경색 예: `#111110`(ink) · `#ffffff` · `#f6f4ef` · `#1a2b22`(green) · `#2a2438`(plum) · `#ede6da`(sand).

### 타이포그래피
| 역할 | 폰트 | 특징 |
|---|---|---|
| Display / 헤드라인 | **Pretendard** (한 개 타이포스로 통일) | `font-weight:800`, `letter-spacing:-.035~-.045em`, `line-height:1.0~1.08` |
| 본문 / UI | **Pretendard** (variable, self-host) | 400–600, 13–18px |
| 라벨 / 메타 / 카테고리 | **Space Mono** | `font-size:10–11.5px`, `letter-spacing:.1–.22em`, `text-transform:uppercase` |

스케일: 히어로 `clamp(38px,5vw,62px)` · 섹션 H2 `clamp(30px,4vw,46px)` · 카드 표지 제목 44px / 본문 카드 15–16px.

### 기타
- radius `--radius: 4px` (칩·버튼은 `100px` pill)
- 그림자 `--shadow-card: 0 1px 2px rgba(17,17,16,.04), 0 12px 30px -18px rgba(17,17,16,.22)`
- 이징 `cubic-bezier(.22,.61,.36,1)`, transition 0.15–0.25s
- 컨테이너 max-width 1180px(본문) / 1340px(와이드)
- 카드 = `aspect-ratio:1/1`, 1px 헤어라인 보더, 다크 variant는 `--ink` 배경

---

## 9. 화면별 사양

### 9.1 랜딩 `/` — `index.html`
- **Nav (sticky, blur):** 로고 `INK.` + "Card News Studio" 캡션 / 홈·스튜디오·이용 방법 / EN · 시작하기. 모든 CTA는 `/studio`로 이동.
- **Hero:** 좌측 카피(키커 → H1 "주제만 입력하면, 카드뉴스가 완성돼요" → 리드 → **주제 입력 pill + 뉴스 모으기 버튼**(랜딩에서 바로 시작, 입력값을 `sessionStorage.ink_topic`+`?q=`로 스튜디오에 전달) + 인기 주제 칩 → PC 권장 노트), 우측 **카드 3장 팬(fan)** — 표지(ink)·본문·CTA가 -8°/-1°/7° 겹침 + `translateZ` 깊이, 마우스 패럴럭스 + "약 10–15초 자동 생성" 배지.
- **카테고리 마퀴:** 12개 장르가 좌로 흐르는 세리프 텍스트 띠(상·하 헤어라인).
- **How it works:** **3단계**(01 주제 → 02 편집 → 03 내보내기), 스튜디오 스테이지와 1:1 매칭. `숫자 + 설명 + 우측 보조문`, 행마다 호버 시 `--wash`.
- **Feature trio:** 1px 그리드 3칸(일관성·속도·내보내기).
- **Notes(다크):** `--ink` 배경, 좌 4개 규칙 / 우 "이용 규칙" 박스.
- **CTA 밴드 → Footer.**
- 스크롤 리빌(IntersectionObserver, `.reveal → .in`).

### 9.2 스튜디오 `/studio` — `studio.html` (+ `assets/studio.css`, `assets/studio.js`)
**한 페이지 = 상단바 + 스테퍼 + 3개 스테이지(pane) + 매거진 드로어.** 스테이지는 `.stage-pane.is-active` 토글로 전환(페이지 이동 없음). 스테퍼는 진행에 따라 잠금 해제(`maxReached`), 지난 단계는 클릭해 돌아갈 수 있음.

- **상단바(persistent):** 좌 `← 홈` + `INK.` / 중앙 **스테퍼**(① 주제 → ② 편집 → ③ 내보내기, 현재=pill·완료=채운 원·미도달=잠금) / 우 **매거진 셀렉터 pill**(스와치+이름+▾ → 드로어 오픈).

- **Stage 1 · 주제:** 중앙 정렬 헤드 + **토픽 컴포저 카드** — 큰 입력 pill(`주제를 직접 입력`)+`뉴스 크롤링` 버튼, **선택된 태그 칩**(제거 가능, ink 채움), **태그 피커**(카테고리 12장르 토글 + 추천 `#` 태그 토글). 입력값은 랜딩에서 프릴. `뉴스 크롤링` → **크롤링 애니메이션**(스피너 + "‘{주제}’ 관련 기사를 모으는 중…" + 진행 바 + 소스 칩 순차 점등 `.hit` + 수집 건수) → **결과 그리드(2열)**. 기사 클릭 → **생성 오버레이**(블러 + 카드 시머 + "AI가 카드뉴스를 만들고 있어요" 단계 메시지) → 스테이지 2로 전환 + 고른 기사 제목/카테고리/출처가 표지 카드에 주입.
  - 실제 구현: 크롤링 = `GET /api/search`, 생성 = `POST /api/generate`(§6).
- **Stage 2 · 편집:** **3컬럼**(128 / 1fr / 320). 좌 레일=5컷 썸네일(01 표지·02–04 본문·05 CTA, 선택 시 ink 링) + 카드 추가. 중앙 캔버스=1:1, 이미지 슬롯(빗금 + "이미지를 올려주세요 · 저작권 보호") + 그라데이션 + 카테고리/번호 + 제목 + 출처, 상단 "AI가 5컷 생성" 펄스 + 줌, 하단 이전/다음. 우 인스펙터=이미지 변경/리셋 · 제목 textarea · 글자색 스와치 · 크기 슬라이더 · 3×3 정렬 그리드 · "문구 다시 생성" · 풋터(← 주제 / 완성·내보내기 →).
- **Stage 3 · 내보내기:** **2컬럼**. 좌=완료 키커 + 헤드 + **인스타그램 캐러셀 미리보기**(폰 프레임 안 5컷 슬라이드, ‹/› 네비 + 인디케이터 도트 + n/5 카운트 + 캡션 라인) — "Instagram 피드" 목적 직결. 우=다크 **ZIP 박스** + **개별 받기**(01–05 PNG) + **캡션·해시태그 패널**(전체 복사 = clipboard) + 출처 노트 + (← 편집 / 새 카드뉴스).
- **매거진 드로어(우측 슬라이드 + 스크림):** 상단바 매거진 pill로 오픈, ESC/스크림/✕로 닫힘. 폼 4섹션(①매거진 선택 라디오카드 ②이름·로고 ③멘트·해시태그 ④색 스와치) + 풋터(저장 → pill 이름·색 갱신 후 닫힘, "브라우저에만 보관" 노트). Next.js에서는 `magazines` CRUD에 연결.

---

## 10. 인터랙션 · 상태 · 모션

- **칩/스와치/탭:** 단일 선택 토글(활성 1개). 카테고리·정렬·미리보기 탭·위치 그리드 동일 패턴.
- **생성 로딩:** `/api/generate` 호출 동안 편집 화면 진입 → 스켈레톤/펄스 → 완료 시 5컷 채움(약 10–15초).
- **이미지 업로드:** 드롭/클릭 → Supabase Storage 업로드 → `cards.image_url` 갱신 → 캔버스 즉시 반영.
- **레이트리밋:** 하루 10회 초과 시 토스트/모달 안내(429).
- **반응형:** 편집 화면은 ≤860px에서 레일=가로 스크롤, 인스펙터=하단. 그리드는 2열→1열.
- **저장:** 매거진 변경은 디바운스 자동 저장 또는 "저장하기"; "방금 저장됨" 표시.

### 모션 · 3D (Next.js 구현 가이드)
- 라이브러리: **Framer Motion** 권장(레퍼런스 HTML은 IntersectionObserver + CSS로 구현 — 값만 옮기면 됨).
- **랜딩 히어로 3D:** 카드 3장이 `perspective:1400px` 무대 안에서 `translateZ`로 깊이를 가짐. 마우스 위치에 따라 `fan`을 `rotateY(±14°)·rotateX(±12°)` → 카드가 시차(parallax)로 따라옴. `framer-motion`의 `useMotionValue`+`useTransform`으로 대체. hover/모션 미지원·`reduced-motion` 시 비활성.
- **헤드라인:** 줄 단위 클립 리빌(`translateY(115%)→0`), 스태거 등장.
- **스크롤 등장:** 섹션·카드 그리드 stagger(IntersectionObserver / `whileInView`).
- **중요 — 콘텐츠는 절대 모션에 가려지지 않게:** 등장 애니메이션은 **transform 위주**로, 보이는 상태를 기본값으로 둘 것. 안전망으로 reduced-motion·관찰자 미동작 시 즉시 표시(레퍼런스의 `.js` 게이트 + 타임아웃 폴백 참고).
- 모션 0.15–0.25s(마이크로) / 0.5–0.85s(등장), 이징 `cubic-bezier(.22,.61,.36,1)`.

---

## 11. Assets / Files

번들에 포함된 디자인 레퍼런스:

| 파일 | 화면 |
|---|---|
| `assets/styles.css` | 공유 디자인 시스템(토큰·타이포·Nav·Footer·버튼·칩·카드) |
| `index.html` | 랜딩 |
| `studio.html` | 단일 작업공간 (3 스테이지 + 매거진 드로어) |
| `assets/studio.css` | 스튜디오 전용 스타일(상단바·스테퍼·스테이지·드로어·캐러셀) |
| `assets/studio.js` | 스튜디오 컨트롤러(스테이지 전환·태그·크롤링·생성·캐러셀·드로어) |

- 아이콘은 모두 **유니코드 글리프**(⤓ ↺ ↻ ✦ ◷ ⤒ ✓ ⧉ 등) — 코드베이스의 아이콘 세트(lucide 등)로 치환 권장.
- 이미지 자산 없음(저작권 정책상 사진은 사용자 업로드). 카드 배경은 사용자 업로드 전까지 플레이스홀더.
- 폰트: **Pretendard**(self-host, `next/font/local`) + **Space Mono**(`next/font/google`). 세리프는 쓰지 않음 — 한 개 타이포스로 통일.

---

## 12. 구현 순서 (제안)

1. `next/font` + 토큰(Tailwind config 또는 globals.css) + 글로벌 셸.
2. 랜딩 `/` 정적 구현(주제 입력 → `/studio?q=` 딥링크).
3. Supabase 프로젝트 + 스키마/RLS/버킷 + 익명 Auth + `lib/supabase`.
4. `/studio` 셸 — 상단바 + 스테퍼 + 3 스테이지 전환 + 매거진 드로어(↔ `magazines` CRUD).
5. Stage 1: `/api/search`(네이버) 크롤링 → 결과 그리드.
6. Stage 1→2: `/api/generate`(LLM + 레이트리밋) → 생성 오버레이 → 편집.
7. Stage 3: 렌더/ZIP/캡션 복사 + 캐러셀 미리보기.
8. 반응형 · 빈/에러/로딩 상태 · 접근성 마무리.

---

*문의/디자인 의도 확인이 필요하면 각 `.html`을 브라우저로 열어 실제 인터랙션(호버·탭·선택)을 확인하세요.*
