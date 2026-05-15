import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { verifyAdmin } from '@/lib/adminAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { id: userId } = await params;

  try {
    // Verify user exists
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Delete in FK-safe order (same as delete-account route)
    await supabaseAdmin.from('subscription_events').delete().eq('user_id', userId);
    await supabaseAdmin.from('payment_history').delete().eq('user_id', userId);
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('medication_checks').delete().eq('user_id', userId);
    await supabaseAdmin.from('medications').delete().eq('user_id', userId);
    await supabaseAdmin.from('record_files').delete().eq('user_id', userId);
    await supabaseAdmin.from('health_records').delete().eq('user_id', userId);
    await supabaseAdmin.from('weight_logs').delete().eq('user_id', userId);
    await supabaseAdmin.from('pets').delete().eq('user_id', userId);
    await supabaseAdmin.from('saved_analyses').delete().eq('user_id', userId);
    await supabaseAdmin.from('saved_papers').delete().eq('user_id', userId);
    await supabaseAdmin.from('search_logs').delete().eq('user_id', userId);
    await supabaseAdmin.from('active_sessions').delete().eq('user_id', userId);
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('recent_hospitals').delete().eq('user_id', userId);
    // activity_logs 는 감사 추적용으로 보존 (profile 삭제로 비식별화).
    // UI 에선 "탈퇴 유저 (uuid8)" 로 표시됨.
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Delete storage files — 파일 경로는 {userId}/{recordId}/{fileName} 3 레벨이라
    // list(userId) 는 recordId 폴더만 반환. 실제 파일까지 닿으려면 각 폴더를
    // 한 번 더 내려가서 나열한 뒤 전부 remove 에 넘겨야 함.
    try {
      const { data: recordFolders } = await supabaseAdmin.storage.from('medical-files').list(userId);
      if (recordFolders && recordFolders.length > 0) {
        const allFilePaths: string[] = [];
        for (const folder of recordFolders) {
          const { data: files } = await supabaseAdmin.storage
            .from('medical-files')
            .list(`${userId}/${folder.name}`);
          if (files) {
            for (const file of files) {
              allFilePaths.push(`${userId}/${folder.name}/${file.name}`);
            }
          }
        }
        if (allFilePaths.length > 0) {
          await supabaseAdmin.storage.from('medical-files').remove(allFilePaths);
        }
      }
    } catch { /* best-effort */ }

    // Delete auth user
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true, message: `${profile.email} 계정이 삭제되었습니다.` });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'admin', action: 'delete-user' },
      extra: { targetUserId: userId },
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : '삭제에 실패했습니다.' }, { status: 500 });
  }
}
