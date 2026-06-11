import { Suspense } from 'react';
import StudioClient from '@/components/studio/StudioClient';
import '../studio.css';

export const metadata = { title: '스튜디오 — INK.' };

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioClient />
    </Suspense>
  );
}
