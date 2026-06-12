import Link from 'next/link';
import './landing.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import LandingFx from '@/components/LandingFx';
import HeroTopicForm from '@/components/HeroTopicForm';
import { TextRotate } from '@/components/ui/TextRotate';

const CATS = ['정치', '경제', '사회', '문화', 'IT·과학', '스포츠', '연예', '패션', '뷰티', '여행', '푸드', '라이프'];

export default function LandingPage() {
  return (
    <>
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <Nav />

      <main id="main" tabIndex={-1}>
      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero__grid">
            <div className="hero__copy">
              <div className="hero__eyebrow reveal">
                <span className="ln"></span>
                <span className="kicker">AI Card-news Studio · 모든 장르</span>
              </div>
              <h1>
                <span className="line"><span className="lift">주제만 입력하면,</span></span>
                <span className="line"><span className="lift"><span className="mark"><TextRotate
                  texts={['카드뉴스', '스토리', '콘텐츠']}
                  rotationInterval={2800}
                  staggerDuration={0.035}
                  splitBy="characters"
                /></span>가 완성돼요</span></span>
              </h1>
              <p className="hero__sub lead reveal">
                원하는 <b>주제를 입력</b>하거나 <b>태그를 선택</b>하면 관련 뉴스를 모아와요. 마음에 드는 기사를 고르면 AI가 5컷 카드뉴스를 뚝딱 만들어 드립니다.
              </p>

              <HeroTopicForm />

              <div className="heroTags reveal">
                <span className="lb">인기 주제</span>
                <Link className="htag" href="/studio?q=전기차">전기차</Link>
                <Link className="htag" href="/studio?q=생성형AI">생성형AI</Link>
                <Link className="htag" href="/studio?q=월드컵">월드컵</Link>
                <Link className="htag" href="/studio?q=제철음식">제철음식</Link>
                <Link className="htag" href="/studio?q=주말나들이">주말나들이</Link>
              </div>
              <div className="hero__note reveal"><span className="d"></span> 원활한 편집을 위해 PC(웹) 환경을 권장해요</div>
            </div>

            {/* card fan (3D) */}
            <div className="fan-stage" aria-hidden="true">
            <div className="fan" id="fan">
              <div className="cn c1">
                <div className="mock">
                  <div className="mock__top"><span className="mock__cat">Culture</span><span className="mock__num">03 / 05</span></div>
                  <div className="mock__title" style={{ fontSize: 21, marginTop: 18 }}>조용한 도시가<br />다시 붐비기<br />시작했다</div>
                  <div className="mock__rule"></div>
                  <p className="mock__body">늘어난 야간 보행 인구가 도심 상권의 회복을 이끌고 있다는 분석이다.</p>
                  <div style={{ marginTop: 'auto' }} className="mock__foot">출처 · 일간경제</div>
                </div>
              </div>
              <div className="cn cn--ink c2">
                <div className="mock">
                  <div className="mock__top"><span className="mock__brand">INK.</span><span className="mock__num">01 / 05</span></div>
                  <div className="mock__title" style={{ marginTop: 'auto' }}>올해 가장<br />주목받은<br /><span className="mark">한 장면</span></div>
                  <div className="mock__foot" style={{ marginTop: 16 }}>COVER · 2026</div>
                </div>
              </div>
              <div className="cn c3">
                <div className="mock">
                  <div className="mock__top"><span className="mock__cat">More</span><span className="mock__num">05 / 05</span></div>
                  <div className="mock__big" style={{ marginTop: 'auto' }}>팔로우하고<br />더 보기</div>
                  <div className="mock__rule"></div>
                  <p className="mock__hash">#카드뉴스 #오늘의이슈<br />#INK매거진</p>
                  <div className="mock__top" style={{ marginTop: 14 }}><span className="mock__brand" style={{ fontSize: 13 }}>@ink.daily</span><span className="mock__num">↗</span></div>
                </div>
              </div>
              <div className="fan__badge"><span>✦</span> 약 10–15초 자동 생성</div>
            </div>
            </div>
          </div>
        </div>

        {/* category marquee */}
        <div className="cats" aria-hidden="true">
          <div className="cats__track">
            {[...CATS, ...CATS].map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="section__head reveal">
            <span className="kicker">How it works</span>
            <h2>세 단계, 한 화면에서<br />끝나는 카드뉴스</h2>
            <p className="lead">페이지 이동 없이 한 작업공간에서 — 고르고, 다듬고, 내려받아요.</p>
          </div>
          <div className="steps">
            <div className="step reveal">
              <div className="step__n">01<small>TOPIC</small></div>
              <div className="step__b">
                <h3>주제·태그로 뉴스 모으기</h3>
                <p>원하는 주제를 입력하거나 추천 태그를 누르면 관련 뉴스를 실시간으로 모아와요. 마음에 드는 기사를 누르면 AI가 한국어 카드뉴스 5컷을 자동 생성합니다. 약 10–15초면 초안 완성.</p>
                <div className="meta">→ 주제 입력 · 태그 선택 · 크롤링 · AI 생성</div>
              </div>
              <div className="step__side">기사를 요약해 핵심만 담아요.</div>
            </div>
            <div className="step reveal">
              <div className="step__n">02<small>EDIT</small></div>
              <div className="step__b">
                <h3>사진 넣고 다듬기</h3>
                <p>5컷을 한 화면에서 넘기며 편집해요. ‘이미지 변경’으로 사진을 올리고 제목·글자색·크기·위치를 자유롭게. 매거진 설정은 옆 패널에서 바로 열려요.</p>
                <div className="meta">→ 인라인 편집 · 매거진 설정 패널</div>
              </div>
              <div className="step__side">저작권 보호를 위해 기사 사진은 자동으로 넣지 않아요.</div>
            </div>
            <div className="step reveal">
              <div className="step__n">03<small>SHIP</small></div>
              <div className="step__b">
                <h3>피드로 내보내기</h3>
                <p>인스타그램 캐러셀로 어떻게 보일지 미리 확인하고, 카드를 한 장씩 또는 전체 ZIP으로 받아요. 캡션·해시태그도 ‘전체 복사’로 그대로 올리면 끝.</p>
                <div className="meta">→ 캐러셀 미리보기 · PNG · ZIP · 캡션 복사</div>
              </div>
              <div className="step__side">1080 × 1080 — 인스타 정사각 규격.</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE TRIO */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="trio reveal" data-stagger>
            <div className="trio__c">
              <div className="ic" aria-hidden="true">✦</div>
              <h4>매거진처럼, 일관되게</h4>
              <p>한 번 정해둔 로고·색·톤이 모든 카드에 자동 적용돼요. 매번 디자인을 다시 잡을 필요가 없어요.</p>
            </div>
            <div className="trio__c">
              <div className="ic" aria-hidden="true">◷</div>
              <h4>10초면 초안 완성</h4>
              <p>기사를 고르는 순간 AI가 5컷 구성을 잡아줘요. 당신은 다듬기만 하면 됩니다.</p>
            </div>
            <div className="trio__c">
              <div className="ic" aria-hidden="true">⤓</div>
              <h4>올릴 준비까지 끝</h4>
              <p>고해상 PNG와 캡션·해시태그를 한 번에. 복사해서 그대로 인스타그램에 올리세요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* NOTES / RULES */}
      <section className="section notes">
        <div className="wrap">
          <div className="notes__grid">
            <div>
              <div className="section__head" style={{ marginBottom: 34 }}>
                <span className="kicker" style={{ color: 'rgba(255,255,255,.5)' }}>Good to know</span>
                <h2>알아두면 좋아요</h2>
              </div>
              <div className="rules" data-stagger>
                <div className="rule-row"><span className="ri">01</span><p>카드 내용은 <b>기사를 AI가 요약</b>해 만들어요. 원문은 <b>출처 링크</b>로 확인할 수 있어요.</p></div>
                <div className="rule-row"><span className="ri">02</span><p>매거진은 <b>내 브라우저에만 저장</b>돼요. 다른 사람에겐 보이지 않아요.</p></div>
                <div className="rule-row"><span className="ri">03</span><p>기사 출처(언론사)는 <b>캡션에 자동으로 표시</b>됩니다.</p></div>
                <div className="rule-row"><span className="ri">04</span><p><b>저작권 보호를 위해 기사 사진은 자동으로 넣지 않아요.</b> 사진은 직접 올려주세요.</p></div>
              </div>
            </div>
            <aside className="notes__aside">
              <div className="box">
                <h4>이용 규칙</h4>
                <p>· 1인당 하루 10회까지 생성할 수 있어요.</p>
                <p>· 생성한 카드는 개인 체험·비상업 용도로 사용해 주세요.</p>
                <p>· 직접 올린 이미지·기사 내용의 저작권은 원 저작권자에게 있어요.</p>
                <p style={{ marginBottom: 0, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.05em', marginTop: 18 }}>※ 본 서비스는 비상업 체험용입니다.</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="wrap">
          <span className="kicker reveal">Start now</span>
          <h2 className="reveal" style={{ marginTop: 18 }}>나만의 매거진,<br /><em>지금</em> 시작해보세요</h2>
          <p className="lead reveal">기사를 고르면 AI가 카드뉴스 5컷을 뚝딱. 이름·로고·색 입혀 완성하세요.</p>
          <div className="reveal" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn--dark btn--lg" href="/studio">지금 만들기 <span className="ar">→</span></Link>
            <Link className="btn btn--ghost btn--lg" href="/studio">스튜디오 열기</Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
      <LandingFx />
    </>
  );
}
