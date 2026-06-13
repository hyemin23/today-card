'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * 라이트/다크 테마 토글.
 * - next-themes 가 <html> 의 class 를 바꾸고 선택을 localStorage 에 저장한다.
 * - 현재 다크 토큰은 shadcn 기반 화면(admin·Dialog·인트로 등)에 적용된다.
 *   레거시 랜딩/스튜디오는 라이트 전용이라 토글해도 안전하게 그대로 유지된다.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드' : '다크 모드'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">테마 전환</span>
    </Button>
  );
}
