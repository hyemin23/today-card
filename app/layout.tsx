import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'INK. — AI 카드뉴스 스튜디오',
  description:
    '주제를 입력하면 AI가 인스타그램 카드뉴스 5컷을 만들어요. 매거진 톤을 입혀 바로 올리세요.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {children}
      </body>
    </html>
  );
}
