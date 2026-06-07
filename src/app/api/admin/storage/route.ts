import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';
import { getPlanConfig } from '@/lib/plans';
import { startOfDayKST } from '@/lib/dailyBoundary';

export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 사용자별 스토리지 집계 — record_files 전체를 앱으로 끌어오지 않고 DB 에서 집계
  //   (파일 수만 단위 시 OOM 방지). RPC: get_storage_usage_by_user.
  const { data: usage } = await supabase.rpc('get_storage_usage_by_user');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, nickname, plan');

  // Aggregate per user
  const userMap = new Map<string, {
    email: string;
    nickname: string;
    plan: string;
    fileCount: number;
    totalBytes: number;
    limitMB: number;
    usagePercent: number;
    lastUpload: string | null;
  }>();

  for (const p of profiles || []) {
    const config = getPlanConfig(p.plan || 'free');
    userMap.set(p.id, {
      email: p.email || '',
      nickname: p.nickname || '',
      plan: p.plan || 'free',
      fileCount: 0,
      totalBytes: 0,
      limitMB: config.maxStorageMB,
      usagePercent: 0,
      lastUpload: null,
    });
  }

  let totalStorageBytes = 0;
  let totalFileCount = 0;

  // bigint 는 JSON 에서 문자열로 옴 → Number 변환.
  for (const u of (usage as { user_id: string; file_count: number | string; total_bytes: number | string; last_upload: string | null }[] | null) || []) {
    const fileCount = Number(u.file_count) || 0;
    const totalBytes = Number(u.total_bytes) || 0;
    const user = userMap.get(u.user_id);
    if (user) {
      user.fileCount = fileCount;
      user.totalBytes = totalBytes;
      user.lastUpload = u.last_upload;
    }
    // 탈퇴 유저(profile 없음) 파일도 전체 합계엔 포함 (기존 동작 유지).
    totalStorageBytes += totalBytes;
    totalFileCount += fileCount;
  }

  // Calculate usage percent
  for (const user of userMap.values()) {
    if (user.limitMB > 0) {
      user.usagePercent = Math.round((user.totalBytes / (user.limitMB * 1024 * 1024)) * 100);
    }
  }

  // Get today's upload count from activity logs — KST 자정 기준
  const today = startOfDayKST().toISOString();
  const { count: todayUploads } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'file.upload')
    .gte('created_at', today);

  // Sort by usage percent descending (heavy users first)
  const users = Array.from(userMap.values())
    .filter(u => u.fileCount > 0)
    .sort((a, b) => b.usagePercent - a.usagePercent);

  // Users over 80% usage
  const warningUsers = users.filter(u => u.usagePercent >= 80);

  return NextResponse.json({
    summary: {
      totalStorageMB: Math.round(totalStorageBytes / 1024 / 1024 * 10) / 10,
      totalFileCount,
      todayUploads: todayUploads || 0,
      usersWithFiles: users.length,
      warningCount: warningUsers.length,
    },
    users,
  });
}
