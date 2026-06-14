import type { Metadata } from 'next';
import './globals.css';
import './a11y.css';
import './tailwind.css';
import IntroSplash from '@/components/IntroSplash';
import { ThemeProvider } from '@/components/theme-provider';

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
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            // Add `.js` so reveal elements start hidden, but guarantee they can never stay
            // hidden: this library-independent timer un-hides everything even if the React
            // reveal driver (LandingFx) fails to hydrate (chunk error, client exception).
            __html:
              "document.documentElement.classList.add('js');" +
              "setTimeout(function(){document.querySelectorAll('.reveal,[data-stagger],.lift').forEach(function(e){e.classList.add('in')})},2400);",
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <IntroSplash />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
