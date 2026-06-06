import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side admin 페이지 보호.
 *
 * 기존 (admin)/layout.tsx 는 client-side 검증 — useEffect 의 비동기 race 또는
 * 의도적 우회 가능. 이 middleware 는 server-side 에서 request 처리 전에 검사.
 *
 * 흐름:
 * 1. /admin/* 경로 진입 → middleware 실행
 * 2. Supabase session (cookie) 확인 → 없으면 / 로 redirect
 * 3. profiles.role 조회 (RLS — 자기 row 만 SELECT)
 * 4. 'admin' 아니면 / 로 redirect
 *
 * → role hijacking + chunk prefetch 우회 모두 차단.
 */
export async function middleware(request: NextRequest) {
  // /admin/* 외 경로는 통과
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 1) Session 검증
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2) Role 검증 (RLS — auth.uid() = id 라 자기 row 만 SELECT)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/admin/:path*'],
};
