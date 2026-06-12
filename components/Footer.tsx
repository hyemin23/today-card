import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="footer__brand">
            <div className="brand">
              INK<span className="dot">.</span>
            </div>
            <p>모든 장르의 뉴스를 카드뉴스로. AI가 초안을 짜고, 당신이 매거진을 완성합니다.</p>
          </div>
          <div className="footer__cols">
            <div className="footer__col">
              <h5>Make</h5>
              <Link href="/studio">주제·태그 크롤링</Link>
              <Link href="/studio">카드 편집</Link>
              <Link href="/studio">내보내기</Link>
              <Link href="/studio">매거진 설정</Link>
            </div>
            <div className="footer__col">
              <h5>About</h5>
              <a href="/#how">이용 방법</a>
              <a href="/#rules">이용 규칙</a>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span className="mono">© 2026 INK. STUDIO</span>
          <span className="mono">MADE FOR CREATORS</span>
        </div>
      </div>
    </footer>
  );
}
