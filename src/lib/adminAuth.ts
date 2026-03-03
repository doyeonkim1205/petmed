import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify that the request is from an authenticated admin user.
 * Returns 404 (not 403) to hide admin endpoints from non-admins.
 */
export async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: NextResponse.json({ error: 'Not Found' }, { status: 404 }) };
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: 'Not Found' }, { status: 404 }) };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Not Found' }, { status: 404 }) };
  }

  return { user, error: null };
}
