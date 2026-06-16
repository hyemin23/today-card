import Link from 'next/link';
import NavToggle from './NavToggle';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav__inner">
        <Link className="brand" href="/">
          INK<span className="dot">.</span>
          <small>Card News Studio</small>
        </Link>
        <nav className="nav__links" aria-label="주요">
          <Link className="nav__link is-active" href="/" aria-current="page">홈</Link>
          <Link className="nav__link" href="/studio">스튜디오</Link>
          <Link className="nav__link" href="/flow">자동 흐름</Link>
          <a className="nav__link" href="#how">이용 방법</a>
        </nav>
        <div className="nav__right">
          <ThemeToggle />
          <Button asChild variant="ink" size="pillSm">
            <Link href="/studio" data-magnetic>시작하기</Link>
          </Button>
          <NavToggle />
        </div>
      </div>
    </header>
  );
}
