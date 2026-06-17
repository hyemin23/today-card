/**
 * 카드 → PNG/ZIP 내보내기 공용 로직.
 *
 * FlowClient(카드 기획)와 ExportStage(스튜디오 내보내기)가 각자 두고 있던
 * html-to-image 래스터화 + JSZip 패킹 + 다운로드 트리거의 단일 원본이다.
 * (/api 변경·라이브러리 업그레이드 시 한 곳만 고치면 된다)
 *
 * 클라이언트 전용(document·html-to-image·jszip은 브라우저에서만 동작).
 */

/** 카드 렌더 박스 크기(px). pixelRatio 2로 래스터화하면 폭 1080이 된다(540 → 1080). */
export interface RenderSize {
  width: number;
  height: number;
}

// 폰트 임베드 CSS는 모든 카드가 동일 → 페이지당 한 번만 계산해 모든 렌더에서 재사용.
// 모듈 단위라 /flow·/studio 가 같은 캐시를 공유한다(이전엔 화면별로 따로 계산).
let cachedFontCss: string | null = null;

/**
 * CardFace 렌더 노드를 PNG data URL로 래스터화한다(pixelRatio 2).
 * cacheBust는 쓰지 않는다 — '?t=' 가 붙으면 blob:/data: 사진 소스가 깨진다.
 */
export async function renderCardNode(node: HTMLElement, size: RenderSize): Promise<string> {
  const htmlToImage = await import('html-to-image');
  await document.fonts.ready; // 래스터화 전에 웹폰트 로드 보장
  if (cachedFontCss === null) cachedFontCss = await htmlToImage.getFontEmbedCSS(node);
  return htmlToImage.toPng(node, {
    pixelRatio: 2,
    width: size.width,
    height: size.height,
    fontEmbedCSS: cachedFontCss,
  });
}

/** URL(object URL 또는 data URL)을 파일로 내려받게 한다. */
export function saveUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * 이름이 붙은 PNG data URL들을 ZIP으로 묶어 내려받는다.
 * (각 카드 렌더링·진행 표시는 호출부가 담당하고, 패킹/다운로드만 여기서.)
 */
export async function downloadPngZip(
  files: { name: string; dataUrl: string }[],
  zipName: string
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.dataUrl.split(',')[1], { base64: true });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  saveUrl(url, zipName);
  // 동기 revoke는 일부 브라우저에서 다운로드가 시작되기 전에 끊어버린다 — 넉넉히 뒤에 해제
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
