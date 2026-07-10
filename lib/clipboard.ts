/** 클립보드 복사 — navigator.clipboard 실패 시(비보안 컨텍스트·권한 거부)
    execCommand 폴백까지 시도한다. 성공 여부를 반환. */
export async function copyText(txt: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    return legacyCopy(txt);
  }
}

function legacyCopy(txt: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
