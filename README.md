# INK. — AI 카드뉴스 스튜디오 (Next.js + Supabase)

기사나 주제로 인스타그램 카드뉴스를 만드는 웹앱입니다. 두 갈래로 들어갈 수 있어요.

- **기사로 만들기** — 주제를 검색해 실제 뉴스를 모으고, 기사를 고르면 AI가 카드뉴스 **5컷**(표지·본문 3·CTA)을 써줍니다.
- **주제로 기획** — 주제·타깃·톤·최종행동만 넣으면 `Hook → Pain → Steps → Result → CTA` 흐름의 **가변 길이 덱(5~10장)** 구성표를 짜줍니다.

만든 카드는 템플릿(글씨체·색·표지 스타일)을 입혀 실시간으로 다듬고, PNG/ZIP·캡션으로 내보냅니다.

`Next.js 14 App Router + TypeScript`로 구현했고, 디자인 규칙의 단일 원본은 `design-system/` 폴더입니다.

---

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 키 없이도 동작 — 채우면 실데이터/AI로 전환
npm run dev                  # http://localhost:3000
```

> **뉴스 검색은 키 없이도 실데이터로 동작합니다.** `/api/search`가 Daum 뉴스 검색
> 페이지를 직접 가져와 파싱하므로 별도 API 키가 필요 없어요(막히면 Google News RSS →
> 목업으로 폴백). **카드 문구 생성**(`/api/generate`, `/api/flow`)은 `LLM_API_KEY`가
> 없으면 현실적인 **목업 카드**로 폴백하므로, 키가 없어도 전체 플로우(검색 → 생성 →
> 편집 → 내보내기)를 그대로 체험할 수 있습니다. 키를 채우면 실제 Gemini 생성으로 바뀝니다.

---

## 페이지

| 경로 | Nav 라벨 | 하는 일 |
|---|---|---|
| `/` | 홈 | 랜딩(히어로·3D 쇼케이스·이용 방법). 주제 입력 → `/studio?q=주제` |
| `/studio` | 기사로 만들기 | 기사 검색 → 5컷 카드 생성 → 편집 → 내보내기 (3단계) |
| `/flow` | 주제로 기획 | 브리프 4개 → 가변 5~10장 덱 구성표 → 미리보기·편집 → 내보내기 |
| `/admin` | (비노출) | 관리자 로그인. 이미지 생성·스타일 분석 같은 유료 호출의 게이트 |

---

## 구조

```
app/
  layout.tsx                # 루트 레이아웃 (globals.css·폰트·테마)
  globals.css landing.css   # 디자인 시스템 토큰·타이포·Nav·Footer·랜딩
  studio.css flow.css       # 스튜디오/카드 기획 전용 스타일
  page.tsx                  # 랜딩 (/)
  studio/page.tsx           # 스튜디오 (/studio) — Suspense + StudioClient
  flow/page.tsx             # 카드 기획 (/flow) — FlowClient
  admin/page.tsx            # 관리자 로그인 화면
  api/
    search/route.ts         # GET 뉴스 검색 (Daum → Google RSS → 목업)
    generate/route.ts       # POST 기사 → 5컷 카드 JSON (LLM + 레이트리밋, 목업 폴백)
    flow/route.ts           # POST 브리프 → 가변 길이 덱 구성표 (LLM, 목업 폴백)
    image/route.ts          # POST 카드 배경/표지 이미지 생성 (Gemini, 관리자 전용)
    style-analyze/route.ts  # POST 레퍼런스 스타일 분석 (Gemini 비전, 관리자 전용)
    admin/                  # login·logout·status (관리자 세션 쿠키)
components/
  Nav.tsx Footer.tsx LandingFx.tsx Showcase3D.tsx HeroTopicForm.tsx …
  studio/
    StudioClient.tsx        # 상태 오케스트레이터 (스테이지·템플릿·카드·비율)
    Topbar.tsx              # 스테퍼 + 템플릿 셀렉터
    TopicStage.tsx          # 주제 입력·태그·검색·결과
    EditorStage.tsx         # 레일 / 캔버스 / 인스펙터 (실시간 편집)
    ExportStage.tsx         # 캐러셀 미리보기 · ZIP · 개별 · 캡션 복사 · 비율 토글
    MagazineDrawer.tsx      # 우측 슬라이드 템플릿 설정(레퍼런스 스타일 포함)
    CardFace.tsx            # 카드 1장 렌더 (canvas/slide/thumb 공용)
    data.ts                 # 카테고리·태그·폰트·템플릿(MAGAZINES) 프리셋
  flow/
    FlowClient.tsx          # 브리프 입력 → 덱 생성 → 편집 → 내보내기, /studio 핸드오프
lib/
  news.ts                   # 뉴스 수집 (Daum 스크랩 → Google RSS → 목업, 키 불필요)
  ai.ts                     # 기사 → 5컷 카드 LLM 호출 + 정규화 (목업 폴백)
  flow.ts                   # 브리프 → 가변 길이 덱 LLM 호출 + 정규화 (목업 폴백)
  image.ts                  # Gemini 네이티브 이미지 모델 호출(컨셉→이미지 2단계)
  imageGen.ts               # /api/image 호출·결과 축소·스크림 글자색 보정 (공유)
  styleAnalyze.ts           # 레퍼런스 이미지 → StyleProfile (Gemini 비전)
  styleProfile.ts           # /api/style-analyze 클라이언트 래퍼 (studio·flow 공유)
  cardExport.ts             # 카드 → PNG 래스터화·ZIP 패킹·다운로드 (studio·flow 공유)
  auth.ts                   # 관리자 세션(ADMIN_KEY 기반 HMAC 쿠키)
  supabase/client.ts server.ts   # @supabase/ssr (env 없으면 null → 로컬 모드)
  flowShared.ts flowRules.ts imageRules.ts designTokens.ts docBlock.ts
types/db.ts
design-system/                  # 디자인 단일 원본(아래 참고)
supabase/migrations/0001_init.sql   # 스키마 + RLS
```

---

## 동작 흐름

### 기사로 만들기 (`/studio`)
1. **Stage 1 · 주제**: 주제/태그 → `뉴스 검색`(`GET /api/search`, Daum 실데이터) → 결과 그리드.
2. 기사 클릭 → 생성 오버레이 + `POST /api/generate` → **Stage 2 · 편집**으로 전환.
3. **편집**: 레일에서 카드 선택, 인스펙터로 제목·본문·글자색·크기·정렬·이미지를 **실시간** 수정. 페이지 번호·구분 라벨·핸들 등 템플릿 요소도 카드별로 표시/숨김 토글.
4. **Stage 3 · 내보내기**: 인스타 캐러셀 미리보기 + 개별/ZIP/캡션 복사. **비율 토글**(정사각 1:1 ↔ 세로 4:5).
5. **템플릿 설정**: 상단바 템플릿 → 우측 드로어(이름·로고·멘트·해시태그·색·레퍼런스 스타일). 저장 시 덱 전체에 반영.

### 주제로 기획 (`/flow`)
1. 브리프 **4개**(주제·타깃·톤·최종행동) 입력 → `POST /api/flow`.
2. `Hook → Pain → Steps(단계 수만큼) → Result → CTA` 흐름으로 **5~10장** 구성표 생성(단계는 최대 6개).
3. 구성표 화면에서 제목·본문을 직접 손보고 단계를 추가/삭제, 템플릿(글씨체·색·표지 스타일)을 골라요.
4. **그대로 내보내거나**(PNG/ZIP), 스튜디오로 넘겨(`/studio` 핸드오프) 같은 템플릿으로 정밀 편집할 수 있어요.

> **순서: 글이 먼저, 이미지는 그다음.** 구성표(텍스트)를 확정한 뒤에야 배경 이미지를 생성합니다(`design-system/card-flow.md` §4, `design.md` §8).

---

## 템플릿 & 레퍼런스 스타일

- **템플릿(`MAGAZINES`)**: 글씨체(`fontKey`) + 색(배경/포인트) + 표지 스타일(`coverStyle`)을 묶은
  프리셋 **5종**(잉크 / 임팩트 / 소프트 / 매거진 / 초록). `/studio`·`/flow` 양쪽에서 고르며,
  고르면 덱 전체에 일괄 적용됩니다. 정의는 `components/studio/data.ts`(폰트 목록 `FONTS`, 템플릿 `MAGAZINES`).
- **레퍼런스 스타일(관리자 전용)**: 벤치마킹할 인스타그램 카드뉴스 **스크린샷을 올리거나**(계정명으로
  자동 수집 시도, 베스트에포트) AI가 분석해 `StyleProfile`(말투·이미지 아트디렉션·대표색·레이아웃)을 뽑고,
  그 색·톤·이미지 방향을 카드에 입힙니다. `/api/style-analyze` → `lib/styleAnalyze.ts`·`styleProfile.ts`,
  비전 모델은 Gemini입니다.

---

## 이미지 생성

카드 배경/표지 이미지는 **Gemini 네이티브 이미지 모델만** 사용합니다(정책: `design-system/design.md` §8).

| | 모델 ID | 비용(대략) | 비고 |
|---|---|---|---|
| **NB1**(기본) | `gemini-2.5-flash-image` | ~$0.039/장 | 미설정 시 코드 기본값 |
| **NB2**(고품질) | `gemini-3-pro-image-preview` | ~$0.134/장 | `IMAGE_MODEL`로 전환 |

- 구현은 `lib/image.ts`(컨셉 텍스트 → 이미지의 2단계 호출), 호출부 공유 로직은 `lib/imageGen.ts`.
- 유료 호출이라 **관리자 전용**입니다 — `/api/image`가 관리자 세션 쿠키를 재검증하므로 일반 사용자나
  엔드포인트 직접 호출로는 트리거되지 않아요.

---

## 실데이터 / 키 연결

| 기능 | 파일 | 필요한 env |
|---|---|---|
| 뉴스 검색 | `lib/news.ts` | **없음**(Daum 스크랩 → Google RSS → 목업) |
| 카드 생성(기사 5컷) | `lib/ai.ts` | `LLM_API_KEY`(+ 선택 `LLM_MODEL`·`LLM_BASE_URL`) |
| 카드 기획(가변 덱) | `lib/flow.ts` | `LLM_API_KEY` |
| 이미지 생성 | `lib/image.ts`, `api/image` | `LLM_API_KEY`, `ADMIN_KEY` (+ 선택 `IMAGE_MODEL`) |
| 레퍼런스 스타일 분석 | `lib/styleAnalyze.ts`, `api/style-analyze` | `LLM_API_KEY`, `ADMIN_KEY` |
| 저장·인증·레이트리밋 | `lib/supabase/*`, `api/generate` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

> LLM 기본값은 Google Gemini(OpenAI 호환 엔드포인트, 기본 모델 `gemini-2.5-flash`). 키는
> [aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 무료 발급할 수 있어요.
> 자세한 변수는 `.env.example` 참고. **네이버 API 키는 더 이상 필요하지 않습니다.**

### Supabase 셋업 (선택 — 저장·레이트리밋이 필요할 때)
1. 프로젝트 생성 → SQL editor에 `supabase/migrations/0001_init.sql` 실행(스키마 + RLS).
2. 익명 로그인 사용 권장: 스튜디오 진입 시 익명 세션을 발급해 per-user 레이트리밋
   (`/api/generate` 하루 10회, 성공 시에만 차감)이 동작합니다. env가 없으면 레이트리밋 없이 로컬 모드로 동작.

---

## 디자인 노트

- **단일 원본은 `design-system/`** 폴더입니다. 사람·AI(문구/이미지)·코드가 모두 이 문서를 기준으로 삼아요.
  - `design.md` — 카드 디자인 규칙(색·구도·타이포·이미지 생성 §8 등)
  - `card-flow.md` — `Hook → … → CTA` 흐름과 덱 길이·프롬프트 규칙
  - `card-news-design-system.html` — 시각 스펙 시트
- **비율**: 기본 **4:5**(1080×1350), **1:1**(1080×1080) 선택 가능. 내보내기는 540px 렌더 → `pixelRatio 2`로 래스터화.
- **타이포**: 헤드라인 글씨체는 템플릿별 선택(`data.ts`의 `FONTS`). 본문 토큰·테마색은 `globals.css`.
- **모션·3D**: 랜딩 카드 팬 패럴럭스 + 스크롤 리빌(`LandingFx.tsx`, `Showcase3D.tsx`), 스튜디오 스테이지/드로어 전환. `prefers-reduced-motion` 존중.
- **저작권**: 기사 사진은 자동 삽입하지 않습니다(배경은 사용자 업로드 또는 생성 이미지). 뉴스는 제목·짧은 요약·원문 링크만 쓰며 출처는 항상 표기합니다.

---

*비상업 체험용. 직접 올린 이미지·기사 내용의 저작권은 원 저작권자에게 있습니다.*
