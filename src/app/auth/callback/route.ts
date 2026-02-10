import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if profile exists, if not create one
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!existingProfile) {
        const metadata = data.user.user_metadata;
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email ?? '',
          nickname:
            metadata?.full_name ||
            metadata?.name ||
            metadata?.nickname ||
            data.user.email?.split('@')[0] ||
            '사용자',
          avatar_url: metadata?.avatar_url || metadata?.picture || null,
        });
      }
    }
  }

  return NextResponse.redirect(new URL('/profile', request.url));
}
