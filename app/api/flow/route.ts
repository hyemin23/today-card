import { NextRequest, NextResponse } from 'next/server';
import { composeDeck } from '@/lib/flow';
import type { FlowInput } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // LLM

// POST /api/flow  body: { topic, target, tone, goal }
// 가변 길이 카드 구성표(텍스트)를 만든다. 이미지는 생성하지 않는다.
export async function POST(req: NextRequest) {
  let input: Partial<FlowInput> & { styleTone?: string };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof input?.topic !== 'string' || !input.topic.trim()) {
    return NextResponse.json({ error: '주제(topic)를 입력해 주세요.' }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  const safe: FlowInput = {
    topic: input.topic.slice(0, 1500).trim(),
    target: str(input.target).slice(0, 300).trim(),
    tone: str(input.tone).slice(0, 300).trim(),
    goal: str(input.goal).slice(0, 300).trim(),
  };
  // 벤치마킹 스타일(선택) — 분석된 말투 지침을 텍스트 생성에 덧입힌다.
  const styleTone = str(input.styleTone).slice(0, 800).trim();

  try {
    const deck = await composeDeck(safe, styleTone ? { styleTone } : undefined);
    return NextResponse.json(deck);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'compose failed' }, { status: 502 });
  }
}
