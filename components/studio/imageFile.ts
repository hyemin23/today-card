/**
 * Read an image file into a downscaled data: URL.
 * data: URLs survive sessionStorage persistence and html-to-image export —
 * unlike blob: URLs, which die on revoke/reload and broke PNG rendering.
 */
interface ResizeOpts {
  maxEdge?: number;
  mime?: string;
  quality?: number;
}

async function drawScaled(src: string, opts: ResizeOpts): Promise<string> {
  const { maxEdge = 1440, mime = 'image/jpeg', quality = 0.86 } = opts;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('canvas unavailable');
  cx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(mime, quality);
}

export async function fileToDataUrl(file: File, opts: ResizeOpts = {}): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    return await drawScaled(url, opts);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Re-encode an existing data: URL smaller (JPEG by default). AI-generated
 * images arrive as megabyte-scale PNG base64 — five of those would blow the
 * sessionStorage quota and stall the editor, so they get squeezed on arrival.
 */
export async function resizeDataUrl(src: string, opts: ResizeOpts = {}): Promise<string> {
  return drawScaled(src, { maxEdge: 1080, ...opts });
}
