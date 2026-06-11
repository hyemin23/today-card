import { NextRequest, NextResponse } from 'next/server';
import { verifySession, ADMIN_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/status → { admin: boolean }
// Lets the client decide whether to show admin UI (the session cookie is
// httpOnly, so JS can't read it directly).
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return NextResponse.json({ admin: verifySession(token) });
}
