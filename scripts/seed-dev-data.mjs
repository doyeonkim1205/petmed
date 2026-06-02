#!/usr/bin/env node
// dev DB 에 더미 사용자 + 펫 + 기록 일괄 시드.
//
// 멱등성: 매번 실행 시 기존 @pawdex-test.local 사용자 + 그 데이터 청소 후 새로 INSERT.
// 안전: PROD URL/key 절대 차단. service_role 키는 Management API 로 fetch (출력 0).
//
// 사용:  node scripts/seed-dev-data.mjs

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── 1. 안전 가드 ──
const DEV_DB_REF = 'lzmmiksdvioidcldrnvh';
const PROD_DB_REF = 'ylbxtzwbwbnlmfxqgmoz';
const SUPABASE_URL = `https://${DEV_DB_REF}.supabase.co`;

if (SUPABASE_URL.includes(PROD_DB_REF)) {
  console.error('🚨 PROD URL 감지! abort.');
  process.exit(1);
}

// ── 2. Management API access token (.env.local) ──
const envFile = fs.readFileSync('.env.local', 'utf8');
const ACCESS_TOKEN = envFile.match(/^SUPABASE_ACCESS_TOKEN\s*=\s*['"]?([^'"\r\n]+)['"]?/m)?.[1];
if (!ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN 이 .env.local 에 없습니다.');
  process.exit(1);
}

// ── 3. Service role 키 fetch (출력 X) ──
async function fetchServiceKey() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${DEV_DB_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  const keys = await r.json();
  const svc = keys.find(k => k.name === 'service_role')?.api_key;
  if (!svc) throw new Error('service_role 키 fetch 실패');
  return svc;
}
const SERVICE_KEY = await fetchServiceKey();
// 이 시점부터 SERVICE_KEY 변수만 사용. console.log 절대 X.

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 4. 더미 정의 ──
const USERS = [
  { email: 'dummy1@pawdex-test.local', password: 'test1234!', plan: 'free', nickname: '테스트1' },
  { email: 'dummy2@pawdex-test.local', password: 'test1234!', plan: 'free', nickname: '테스트2' },
  { email: 'dummy3@pawdex-test.local', password: 'test1234!', plan: 'free', nickname: '테스트3' },
  { email: 'dummy4@pawdex-test.local', password: 'test1234!', plan: 'plus', nickname: 'Plus유저1' },
  { email: 'dummy5@pawdex-test.local', password: 'test1234!', plan: 'plus', nickname: 'Plus유저2' },
];

// Free: 펫 2마리 한도. Plus: 무제한 → 4마리.
const PETS_BY_PLAN = {
  free: [
    { name: '뽀삐', type: 'dog',  breed: '시바견',           birth_date: '2020-03-15', sex: 'male',   neutered: true,  weight: 8.5 },
    { name: '나비', type: 'cat',  breed: '코리안 쇼트헤어',  birth_date: '2022-07-20', sex: 'female', neutered: true,  weight: 4.2 },
  ],
  plus: [
    { name: '초코', type: 'dog',  breed: '말티즈',           birth_date: '2018-05-10', sex: 'male',   neutered: true,  weight: 4.1 },
    { name: '루시', type: 'dog',  breed: '골든 리트리버',    birth_date: '2024-11-03', sex: 'female', neutered: false, weight: 12.8 },
    { name: '치즈', type: 'cat',  breed: '러시안 블루',      birth_date: '2021-01-15', sex: 'male',   neutered: true,  weight: 5.5 },
    { name: '베리', type: 'cat',  breed: '먼치킨',           birth_date: '2023-09-05', sex: 'female', neutered: true,  weight: 3.2 },
  ],
};

// 진료 / 입퇴원 / 일상 골고루 — Free 는 펫당 ~7개 (총 ~14, 한도 15 안 넘게)
const RECORD_TEMPLATES = [
  { record_type: 'visit',           title: '예방접종 1차',     description: 'DHPPL 종합백신 1차 접종.',                 daysAgo: 90,  cost: 35000,   hospital_name: '서울동물병원' },
  { record_type: 'visit',           title: '심장사상충 예방',  description: '월 1회 약 처방. 컨디션 양호.',              daysAgo: 30,  cost: 18000,   hospital_name: '서울동물병원' },
  { record_type: 'visit',           title: '구토 진료',        description: '아침에 두 번 구토. 식사 시간 조정 권유.',   daysAgo: 14,  cost: 45000,   hospital_name: '강남펫클리닉' },
  { record_type: 'visit',           title: '건강검진',         description: '혈액검사 + 초음파. 결과 양호.',             daysAgo: 60,  cost: 150000,  hospital_name: '서울동물병원' },
  { record_type: 'visit',           title: '외이염',           description: '귀 청소 + 약 처방. 일주일 후 재진 권유.',   daysAgo: 7,   cost: 22000,   hospital_name: '강남펫클리닉' },
  { record_type: 'hospitalization', title: '슬개골 탈구 수술', description: '3일 입원. 후방관절 정복술. 경과 양호.',     daysAgo: 180, cost: 1200000, hospital_name: '서울동물병원', discharge_date: 177 },
  { record_type: 'daily',           title: '일상 기록',        description: '오늘 산책 30분. 컨디션 좋음.',              daysAgo: 1,   sub_kind: 'walk' },
];

// ── 5. Cleanup: 기존 @pawdex-test.local 사용자 + 데이터 ──
console.log('[1/3] 기존 더미 청소');
const { data: listed } = await sb.auth.admin.listUsers();
const oldTestUsers = listed.users.filter(u => u.email?.endsWith('@pawdex-test.local'));
console.log(`  기존 더미 ${oldTestUsers.length}명 발견`);

for (const u of oldTestUsers) {
  const uid = u.id;
  // 자식 테이블 (FK CASCADE 없음) 명시 삭제
  await sb.from('medication_checks').delete().eq('user_id', uid);
  await sb.from('medications').delete().eq('user_id', uid);
  await sb.from('record_files').delete().eq('user_id', uid);
  await sb.from('health_records').delete().eq('user_id', uid);
  await sb.from('pets').delete().eq('user_id', uid);
  await sb.from('saved_papers').delete().eq('user_id', uid);
  await sb.from('saved_analyses').delete().eq('user_id', uid);
  await sb.from('search_logs').delete().eq('user_id', uid);
  await sb.from('active_sessions').delete().eq('user_id', uid);
  await sb.from('push_subscriptions').delete().eq('user_id', uid);
  await sb.from('subscriptions').delete().eq('user_id', uid);
  await sb.from('payment_history').delete().eq('user_id', uid);
  await sb.from('activity_logs').delete().eq('user_id', uid);
  await sb.from('profiles').delete().eq('id', uid);
  // weight_logs, recent_hospitals, subscription_events 는 auth CASCADE 로 자동 정리
  await sb.auth.admin.deleteUser(uid);
}
// search_cache 전체 비움 (회귀 테스트 깨끗하게)
await sb.from('search_cache').delete().gte('created_at', '1970-01-01');
console.log('  ✓ cleanup 완료');

// ── 6. 사용자 + 펫 + 기록 생성 ──
console.log('[2/3] 사용자/펫/기록 생성');
const summary = [];
for (const u of USERS) {
  const { data: created, error } = await sb.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { nickname: u.nickname },
  });
  if (error) {
    console.error(`  ✗ ${u.email} 생성 실패:`, error.message);
    continue;
  }
  const uid = created.user.id;

  // profile (plan 강제 — auth trigger 가 default 'free' 로 만든 게 있을 수 있음)
  const { error: profErr } = await sb.from('profiles').upsert({
    id: uid,
    email: u.email,
    nickname: u.nickname,
    plan: u.plan,
    role: 'user',
    is_push_enabled: false,
  }, { onConflict: 'id' });
  if (profErr) {
    console.error(`  ✗ ${u.email} profile 실패:`, profErr.message);
  }

  // 펫 생성
  const petsToAdd = PETS_BY_PLAN[u.plan];
  const createdPets = [];
  for (const p of petsToAdd) {
    const { data: pet, error: petErr } = await sb.from('pets').insert({
      user_id: uid,
      name: p.name, type: p.type, breed: p.breed,
      birth_date: p.birth_date, sex: p.sex, neutered: p.neutered, weight: p.weight,
    }).select().single();
    if (petErr) {
      console.error(`  ✗ ${u.email} ${p.name} pet 실패:`, petErr.message);
      continue;
    }
    createdPets.push(pet);
  }

  // 기록 생성 — free: 펫당 7개 (총 14, 한도 15 OK) / plus: 펫당 7개 (총 28)
  let recordCount = 0;
  for (const pet of createdPets) {
    for (const tmpl of RECORD_TEMPLATES) {
      const visitDate = new Date();
      visitDate.setDate(visitDate.getDate() - tmpl.daysAgo);
      const payload = {
        user_id: uid,
        pet_id: pet.id,
        record_type: tmpl.record_type,
        title: tmpl.title,
        description: tmpl.description,
        visit_date: visitDate.toISOString().slice(0, 10),
      };
      if (tmpl.cost !== undefined) payload.cost = tmpl.cost;
      if (tmpl.hospital_name) payload.hospital_name = tmpl.hospital_name;
      if (tmpl.discharge_date !== undefined) {
        const d = new Date();
        d.setDate(d.getDate() - tmpl.discharge_date);
        payload.discharge_date = d.toISOString().slice(0, 10);
      }
      if (tmpl.sub_kind) {
        payload.sub_entries = [{ sub_kind: tmpl.sub_kind, memo: tmpl.description }];
      }
      const { error: recErr } = await sb.from('health_records').insert(payload);
      if (recErr) {
        if (recErr.message.includes('RECORD_LIMIT_REACHED')) {
          break;  // 다음 펫으로
        }
        console.error(`  ✗ ${u.email} 기록 실패:`, recErr.message);
      } else {
        recordCount++;
      }
    }
  }

  summary.push({ email: u.email, plan: u.plan, pets: createdPets.length, records: recordCount });
  console.log(`  ✓ ${u.email} (${u.plan}): 펫 ${createdPets.length}, 기록 ${recordCount}`);
}

// ── 7. 요약 ──
console.log('\n[3/3] 완료');
console.table(summary);
console.log('\n로그인 정보 — 모든 사용자 비밀번호: test1234!');
console.log('  Preview URL: https://test.pawdex.store');
