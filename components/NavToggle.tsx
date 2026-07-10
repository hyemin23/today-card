'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/** Mobile menu button (≤860px) — toggles the dropdown panel below the header. */
export default function NavToggle() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on ESC and return focus to the toggle.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        className="nav__toggle btn btn--ghost btn--sm"
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={open}
        aria-controls="nav-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>
      <nav
        id="nav-menu"
        className={open ? 'nav__menu is-open' : 'nav__menu'}
        aria-label="모바일"
      >
        <Link className="nav__menu-link" href="/" onClick={close}>홈</Link>
        <Link className="nav__menu-link" href="/studio" onClick={close}>기사로 만들기</Link>
        <Link className="nav__menu-link" href="/flow" onClick={close}>주제로 기획</Link>
        <a className="nav__menu-link" href="/#how" onClick={close}>이용 방법</a>
      </nav>
    </>
  );
}
