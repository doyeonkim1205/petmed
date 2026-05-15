import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/apiAuth';
import { getPlanConfig, getEffectivePlan } from '@/lib/plans';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = getEffectivePlan(profile?.plan);
  const config = getPlanConfig(plan);

  const { data: files } = await supabaseAdmin
    .from('record_files')
    .select('file_size')
    .eq('user_id', userId);

  const usedBytes = (files || []).reduce((sum, f) => sum + (f.file_size || 0), 0);
  const usedMB = Math.round(usedBytes / 1024 / 1024 * 10) / 10;
  const limitMB = config.maxStorageMB;
  const fileCount = files?.length || 0;

  return NextResponse.json({
    plan,
    usedBytes,
    usedMB,
    limitMB,
    fileCount,
    canUpload: limitMB === 0 || usedMB < limitMB,
  });
}
