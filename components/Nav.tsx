import Link from 'next/link';
import NavToggle from './NavToggle';

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
          <a className="nav__link" href="#how">이용 방법</a>
        </nav>
        <div className="nav__right">
          <Link className="btn btn--dark btn--sm" href="/studio">시작하기</Link>
          <NavToggle />
        </div>
      </div>
    </header>
  );
}
