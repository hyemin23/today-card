import FlowClient from '@/components/flow/FlowClient';
import '../flow.css';

export const metadata = { title: '주제로 기획 — INK.', description: '주제·타깃·톤·최종행동만 넣으면 Hook→Pain→Steps→Result→CTA 카드 구성표가 나와요. 스타일은 스튜디오에서 다듬어요.' };

export default function FlowPage() {
  return <FlowClient />;
}
