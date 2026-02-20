import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify Supabase access token from Authorization header.
 * Returns the user if valid, or a 401 NextResponse if not.
 */
export async function verifyAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 }) };
  }

  return { user, error: null };
}
