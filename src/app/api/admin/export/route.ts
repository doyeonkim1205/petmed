import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/adminAuth';

/**
 * 관리자 CSV export — users / payments / search_logs.
 *   각 목록 페이지의 필터를 그대로 받아 "필터된 결과" 를 CSV 로 내려준다.
 *
 * 안전장치:
 *   - CSV 인젝션 방지: =,+,-,@ 등으로 시작하는 셀은 앞에 ' 붙여 수식 실행 차단.
 *   - 모든 셀 따옴표 감싸기 + 내부 " 이스케이프 (콤마/줄바꿈/따옴표 안전).
 *   - UTF-8 BOM 선두 추가 → 엑셀에서 한글 깨짐 방지.
 *   - row cap (MAX_ROWS) — 초과 시 마지막에 안내 행 추가 (silent truncation 금지).
 */
const MAX_ROWS = 50000;

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // 수식 인젝션 가드 — 위험 선두 문자면 ' 접두
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n');
}

function csvResponse(filename: string, csv: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

const SANITIZE = /[%,()\\*"]/g;

export async function GET(request: Request) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 프로필 email/nickname 일괄 조회 헬퍼
  const fetchProfiles = async (userIds: string[]) => {
    const map = new Map<string, { email: string; nickname: string | null }>();
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return map;
    const { data } = await supabase.from('profiles').select('id, email, nickname').in('id', ids);
    for (const p of data || []) map.set(p.id, { email: p.email, nickname: p.nickname });
    return map;
  };

  // ── users ──
  if (type === 'users') {
    const search = (searchParams.get('search') || '').replace(SANITIZE, '').trim();
    const plan = searchParams.get('plan') || '';
    let q = supabase.from('profiles').select('email, nickname, plan, role, created_at');
    if (search) q = q.or(`email.ilike.%${search}%,nickname.ilike.%${search}%`);
    if (plan) q = q.eq('plan', plan);
    const { data } = await q.order('created_at', { ascending: false }).limit(MAX_ROWS + 1);
    const rows = (data || []).slice(0, MAX_ROWS);
    const body = rows.map((u) => [u.email, u.nickname, u.plan, u.role, u.created_at]);
    if ((data || []).length > MAX_ROWS) body.push([`(${MAX_ROWS}행 초과로 잘림)`, '', '', '', '']);
    return csvResponse(`users_${today}.csv`, toCsv(['이메일', '닉네임', '플랜', '역할', '가입일'], body));
  }

  // ── payments ──
  if (type === 'payments') {
    const status = searchParams.get('status') || '';
    let q = supabase.from('payment_history').select('user_id, amount, status, toss_order_id, receipt_url, created_at');
    if (status) q = q.eq('status', status);
    const { data } = await q.order('created_at', { ascending: false }).limit(MAX_ROWS + 1);
    const rows = (data || []).slice(0, MAX_ROWS);
    const pmap = await fetchProfiles(rows.map((r) => r.user_id));
    const body = rows.map((p) => [
      pmap.get(p.user_id)?.email ?? '',
      p.amount,
      p.status,
      p.toss_order_id,
      p.receipt_url,
      p.created_at,
    ]);
    if ((data || []).length > MAX_ROWS) body.push([`(${MAX_ROWS}행 초과로 잘림)`, '', '', '', '', '']);
    return csvResponse(`payments_${today}.csv`, toCsv(['이메일', '금액', '상태', '주문ID', '영수증', '결제일'], body));
  }

  // ── search_logs ──
  if (type === 'search_logs') {
    const stype = searchParams.get('searchType') || 'all';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const userSearch = searchParams.get('userId') || '';

    let resolvedUserId = '';
    if (userSearch) {
      if (userSearch.includes('@')) {
        const { data: prof } = await supabase
          .from('profiles').select('id').ilike('email', `%${userSearch.replace(SANITIZE, '')}%`).limit(1).maybeSingle();
        if (prof) resolvedUserId = prof.id;
        else return csvResponse(`search_logs_${today}.csv`, toCsv(['일시', '이메일', '종류', '반려동물', '검색어'], []));
      } else {
        resolvedUserId = userSearch;
      }
    }

    let q = supabase.from('search_logs').select('user_id, query, pet_type, kind, created_at');
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', `${to}T23:59:59`);
    if (resolvedUserId) q = q.eq('user_id', resolvedUserId);
    if (stype === 'disease') q = q.eq('kind', 'disease');
    else if (stype === 'symptom') q = q.in('kind', ['symptom', 'symptom_refine']);
    else if (stype === 'symptom_photo') q = q.eq('kind', 'symptom_photo');

    const { data } = await q.order('created_at', { ascending: false }).limit(MAX_ROWS + 1);
    const rows = (data || []).slice(0, MAX_ROWS);
    const pmap = await fetchProfiles(rows.map((r) => r.user_id));
    const body = rows.map((s) => [
      s.created_at,
      s.user_id ? (pmap.get(s.user_id)?.email ?? '') : '',
      s.kind,
      s.pet_type,
      s.query,
    ]);
    if ((data || []).length > MAX_ROWS) body.push([`(${MAX_ROWS}행 초과로 잘림)`, '', '', '', '']);
    return csvResponse(`search_logs_${today}.csv`, toCsv(['일시', '이메일', '종류', '반려동물', '검색어'], body));
  }

  return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
}
