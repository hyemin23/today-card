import FlowClient from '@/components/flow/FlowClient';
import '../flow.css';

export const metadata = { title: '카드 기획 — INK.', description: '주제·타깃·톤·최종행동만 넣으면 Hook→Pain→Steps→Result→CTA 카드 구성표가 나와요. 기획부터 잡고 이미지는 그다음.' };

export default function FlowPage() {
  return <FlowClient />;
}
