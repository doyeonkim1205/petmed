import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';
import { evaluateQuota, parseIncomingBytes } from '@/lib/storageQuota';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/storage-usage?incoming=<bytes>
//   사용량 = Storage 실제 저장 바이트(압축 후, RPC storage_used_bytes). record_files/lab_test_files
//   의 file_size 는 과거 원본 크기가 들어가 있어 기준으로 쓰지 않음.
//   incoming = 이번에 올릴 파일들(압축 후) 합계 → canUpload = used + incoming ≤ limit.
//   집계 실패 시 503 — 클라이언트는 업로드를 막는다(fail-closed).
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const incomingBytes = parseIncomingBytes(request.nextUrl.searchParams.get('incoming'));
  if (incomingBytes === null) {
    return NextResponse.json({ error: 'invalid incoming' }, { status: 400 });
  }

  const [{ data: profile, error: profileError }, { data: used, error: usedError }, files, labFiles] = await Promise.all([
    supabaseAdmin.from('profiles').select('plan').eq('id', userId).single(),
    supabaseAdmin.rpc('storage_used_bytes', { p_user_id: userId }),
    supabaseAdmin.from('record_files').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('lab_test_files').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (profileError || usedError || used === null || used === undefined) {
    Sentry.captureMessage('storage-usage aggregation failed', {
      level: 'error',
      tags: { feature: 'storage', action: 'usage' },
      extra: { userId, profileError: profileError?.message, usedError: usedError?.message },
    });
    return NextResponse.json({ error: 'usage unavailable' }, { status: 503 });
  }

  const plan = getEffectivePlan(profile?.plan);
  const config = getPlanConfig(plan);
  const quota = evaluateQuota(Number(used), incomingBytes, config.maxStorageMB);

  return NextResponse.json({
    plan,
    ...quota,
    fileCount: (files.count ?? 0) + (labFiles.count ?? 0),
  });
}
