# INK. — AI 카드뉴스 스튜디오 (Next.js + Supabase)

주제를 입력하면 관련 뉴스를 모아 AI가 인스타그램 카드뉴스 5컷을 만들고,
매거진(브랜드) 톤을 입혀 내보내는 웹앱. **랜딩 + 단일 스튜디오(3단계)** 2페이지 구조.

이 프로젝트는 디자인 프로토타입(`/` 루트의 `index.html`, `studio.html`)을
**Next.js 14 App Router + TypeScript**로 옮긴 실제 구현입니다.

---

## 빠른 시작

```bash
cd ink-next
npm install
cp .env.example .env.local   # 키 없이도 동작(목업) — 채우면 실데이터
npm run dev                  # http://localhost:3000
```

> **키가 없어도 그대로 돌아갑니다.** `/api/search`·`/api/generate`가 현실적인
> **목업 데이터**를 반환하므로 전체 플로우(주제 → 크롤링 → 생성 → 편집 → 내보내기)를
> 바로 체험할 수 있어요. 키를 채우면 실제 네이버 검색·LLM 생성으로 전환됩니다.

---

## 구조

```
ink-next/
  app/
    layout.tsx                # 루트 레이아웃 (globals.css, 폰트, js 클래스)
    globals.css               # 디자인 시스템 (토큰·타이포·Nav·Footer·버튼·칩) — 프로토타입에서 그대로 이식
    studio.css                # 스튜디오 전용 (상단바·스테퍼·스테이지·드로어·캐러셀)
    page.tsx                  # 랜딩 (/)
    studio/page.tsx           # 스튜디오 (/studio) — Suspense + StudioClient
    api/
      search/route.ts         # GET 네이버 뉴스 검색 (목업 폴백)
      generate/route.ts       # POST 기사 → 5컷 카드 JSON (LLM + 레이트리밋, 목업 폴백)
  components/
    Nav.tsx  Footer.tsx  LandingFx.tsx  HeroTopicForm.tsx
    studio/
      StudioClient.tsx        # 상태 오케스트레이터 (스테이지·매거진·카드)
      Topbar.tsx              # 스테퍼 + 매거진 셀렉터
      TopicStage.tsx          # 주제 입력·태그·크롤링·결과
      EditorStage.tsx         # 레일 / 캔버스 / 인스펙터 (실시간 편집)
      ExportStage.tsx         # 캐러셀 미리보기 · ZIP · 개별 · 캡션 복사
      MagazineDrawer.tsx      # 우측 슬라이드 매거진 설정
      GenOverlay.tsx          # AI 생성 오버레이
      CardFace.tsx            # 카드 1장 렌더 (canvas/slide/thumb 공용)
      data.ts                 # 카테고리·태그·매거진 프리셋
  lib/
    supabase/client.ts server.ts   # @supabase/ssr (env 없으면 null → 로컬 모드)
    naver.ts                  # 검색 래퍼 (목업 폴백)
    ai.ts                     # LLM 호출 + 출력 정규화 (목업 폴백)
  types/db.ts
  supabase/migrations/0001_init.sql   # 스키마 + RLS
```

---

## 동작 흐름

1. **랜딩**(`/`) 히어로에서 주제 입력 → `/studio?q=주제`로 이동.
2. **Stage 1 · 주제**: 주제/태그 → `뉴스 크롤링`(진행 애니메이션 + `GET /api/search`) → 결과 그리드.
3. 기사 클릭 → 생성 오버레이 + `POST /api/generate` → **Stage 2 · 편집**으로 전환.
4. **편집**: 레일에서 카드 선택, 인스펙터로 제목·글자색·크기·정렬을 **실시간** 수정, 이미지 업로드(미리보기 즉시 반영).
5. **Stage 3 · 내보내기**: 인스타 캐러셀 미리보기 + 개별/ZIP/캡션 복사.
6. **매거진 설정**: 상단바 매거진 pill → 우측 드로어(이름·로고·멘트·해시태그·색). 저장 시 모든 카드에 반영.

---

## 실데이터 연결

| 기능 | 파일 | 필요한 env |
|---|---|---|
| 뉴스 검색 | `lib/naver.ts` | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| 카드 생성 | `lib/ai.ts` | `LLM_API_KEY` (+ `LLM_MODEL`) — 기본 OpenAI 호환 |
| 저장·인증·레이트리밋 | `lib/supabase/*`, `api/generate` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

### Supabase 셋업
1. 프로젝트 생성 → SQL editor에 `supabase/migrations/0001_init.sql` 실행(스키마 + RLS).
2. Storage 버킷 2개 생성: `magazine-logos`, `card-images` (public read, owner write).
3. 익명 로그인 사용 권장: 첫 진입 시 `supabase.auth.signInAnonymously()` 호출(미들웨어 또는 클라이언트 마운트). 로그인 없이도 per-user 저장/레이트리밋 동작.

### 구현 완료 (프로토타입 대비 추가)
- **카드 → PNG 렌더 / ZIP**: `ExportStage`에서 `html-to-image`(pixelRatio 2 → 1080×1080) + `jszip`로 개별/전체 다운로드 동작.
- **익명 Auth 연결**: Supabase env가 있으면 스튜디오 진입 시 `signInAnonymously()` 자동 발급 → `/api/generate` 레이트리밋(하루 10회, 성공 시에만 차감) 동작.
- **생성 실패 폴백**: LLM 응답 파싱 실패·5컷 미만·네트워크 오류 모두 목업 카드로 폴백, 429는 사용자에게 안내.

### 남은 TODO (프로덕션)
- **매거진 CRUD**: `MagazineDrawer.onSave` → Supabase `magazines` upsert. 현재는 클라이언트 상태(로컬 모드).
- **작업 영속화**: `card_jobs`/`cards` insert, URL `?job=` 로 복원.
- **출력 검증**: `lib/ai.ts`의 수동 정규화를 zod 스키마 검증으로 교체.

---

## 디자인 노트
- **타이포**: Pretendard 단일(헤드라인 800), 라벨은 Space Mono. `globals.css`의 `@font-face`/`@import`로 로드 — 원하면 `next/font`로 최적화 가능.
- **모노톤 B&W**: 토큰은 `globals.css` `:root`. 매거진 배경/포인트색만 가변.
- **모션·3D**: 랜딩 카드 팬 마우스 패럴럭스 + 스크롤 리빌(`LandingFx.tsx`), 스튜디오 스테이지/드로어/오버레이 전환. `prefers-reduced-motion` 존중, 콘텐츠는 모션에 가려지지 않도록 transform 위주.
- **저작권**: 기사 사진은 자동 삽입하지 않음(사용자 업로드). 출처는 캡션에 표기.

---

*비상업 체험용. 직접 올린 이미지·기사 내용의 저작권은 원 저작권자에게 있습니다.*
