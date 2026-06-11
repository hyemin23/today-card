'use client';

/** Mobile menu button (≤860px) — static placeholder, mirroring the prototype. */
export default function NavToggle() {
  return (
    <button
      className="nav__toggle btn btn--ghost btn--sm"
      aria-label="menu"
      onClick={() => alert('메뉴 — 홈 / 스튜디오 / 이용 방법')}
    >
      ☰
    </button>
  );
}
