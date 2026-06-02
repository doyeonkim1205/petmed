#!/usr/bin/env node
// 증상 분석 골든 케이스 회귀 테스트 — 30개 케이스를 OpenAI 직접 호출로 검증.
//
// 매트릭스:
//   - 응급 (치명/긴급): 8개 — 예상 disease 키워드 매칭 + concern_level=high
//   - 일반 진료: 10개 — 예상 disease 1개 이상 매칭
//   - 정상 (과진단 방지): 6개 — concern_level !== 'high'
//   - 엣지 (이모지/짧음/오타): 6개 — 에러 없이 의미 있는 응답
//
// 순차 실행 + 1초 딜레이 (OpenAI rate limit 회피).
// search_cache 우회: OpenAI 직접 호출.
// 결과: 카테고리별 통과율 + 실패 케이스 상세.
//
// 사용:  node scripts/test-symptom-golden.mjs

import fs from 'node:fs';

// ── 1. OpenAI key (.env.preview.local 우선 — vercel env pull 결과) ──
function readKey() {
  for (const path of ['.env.preview.local', '.env.production', '.env.local']) {
    try {
      const env = fs.readFileSync(path, 'utf8');
      const line = env.split(/\r?\n/).find(l => /^\s*OPENAI_API_KEY=/.test(l));
      if (line) return line
        .replace(/^\s*OPENAI_API_KEY=/, '')
        .replace(/^["']|["']$/g, '')
        .replace(/\\[rn]/g, '')   // vercel env pull 결과의 리터럴 \n / \r 제거
        .replace(/\s+/g, '');     // 진짜 whitespace 도 모두 제거
    } catch {}
  }
  return null;
}
const KEY = readKey();
if (!KEY) {
  console.error('OPENAI_API_KEY 가 .env.production 또는 .env.local 에 없습니다.');
  process.exit(1);
}

// ── 2. route.ts 에서 system prompt 추출 + redFlags ──
const ROUTE = fs.readFileSync('src/app/api/symptom-analysis/route.ts', 'utf8');
const sIdx = ROUTE.indexOf('당신은 한국 수의학');
const SYSTEM_TPL = ROUTE.slice(sIdx, ROUTE.indexOf('`', sIdx)).replace(/\$\{isRefinement[\s\S]*?\}/g, '');

const RED_FLAGS = JSON.parse(fs.readFileSync('src/data/redFlags.json', 'utf8'));
function matchRedFlags(species, text) {
  const t = (text || '').replace(/\s+/g, '');
  return RED_FLAGS
    .filter(rf => (rf.species === 'any' || rf.species === species) &&
                  rf.all.every(g => g.some(kw => t.includes(kw))))
    .map(rf => rf.hint);
}

async function analyze(species, sx) {
  const petLabel = species === 'cat' ? '고양이' : '강아지';
  const system = SYSTEM_TPL.replaceAll('${petLabel}', petLabel);
  const hints = matchRedFlags(species, sx);
  const rfBlock = hints.length
    ? `\n\n[이 증상에서 반드시 감별 후보에 포함할 주요 질환 — 누락 금지]\n${hints.map(h => `- ${h}`).join('\n')}\n→ 위 질환을 diseases 배열에 반드시 포함하되, action/설명에 "확진은 병원 검사 필요"를 명시하라.`
    : '';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `우리 ${petLabel}가 이런 증상을 보입니다: "${sx}"${rfBlock}` },
      ],
    }),
  });
  if (!res.ok) return { _err: `${res.status}: ${(await res.text()).slice(0, 200)}` };
  return JSON.parse((await res.json()).choices?.[0]?.message?.content ?? '{}');
}

// ── 3. 골든 케이스 30개 (8 + 10 + 6 + 6) ──
const CASES = {
  emergency: [
    { sp: 'dog', label: '파보',              expect: ['파보', 'parvo'],                          sx: '생후 3개월 강아지가 피 섞인 설사를 하고 토하고 기운이 하나도 없어요' },
    { sp: 'dog', label: '디스템퍼',          expect: ['디스템퍼', 'distemper', '홍역'],          sx: '열이 나고 콧물·기침을 하다가 다리를 떨고 경련을 해요' },
    { sp: 'dog', label: 'GDV (위염전)',      expect: ['gdv', '위염전', '위확장', 'bloat', 'volvulus'], sx: '대형견인데 배가 부풀어 오르고 침을 흘리며 안절부절못해요' },
    { sp: 'cat', label: '범백',              expect: ['범백', 'panleukopenia'],                  sx: '새끼 고양이가 고열에 심한 구토를 하고 피설사하며 축 처져 있어요' },
    { sp: 'cat', label: 'FIP',               expect: ['복막염', 'fip', 'peritonitis'],           sx: '열이 며칠째 안 떨어지고 배가 빵빵하게 부르고 잘 안 먹어요' },
    { sp: 'cat', label: '요로폐색 (수컷)',   expect: ['요로', 'urolithiasis', 'blockage', '폐색', 'obstruct'], sx: '수컷 고양이가 화장실에 자주 가지만 소변을 거의 못 보고 신음해요' },
    { sp: 'dog', label: '광견병/신경',       expect: ['광견병', 'rabies', '디스템퍼', 'distemper', '뇌염', 'encephalitis'], sx: '갑자기 사나워지고 침을 많이 흘리며 물을 잘 못 삼켜요' },
    { sp: 'cat', label: '비대성 심근증',     expect: ['심근증', 'cardiomyopathy', 'hcm', '혈전', 'thrombo'], sx: '갑자기 뒷다리가 차갑고 마비된 듯 끌고 다니며 호흡이 가빠요' },
  ],
  general: [
    { sp: 'dog', label: '외이염',            expect: ['외이염', 'otitis', '귀'],                 sx: '귀를 자주 긁고 머리를 흔들며 갈색 분비물이 나와요' },
    { sp: 'dog', label: '슬개골 탈구',       expect: ['슬개골', 'patella', 'luxation'],          sx: '소형견인데 뒷다리를 갑자기 들고 깡총거리며 걷다가 다시 정상으로 돌아와요' },
    { sp: 'dog', label: '아토피',            expect: ['아토피', 'atopic', '알레르기', 'allergy'], sx: '발과 배 부분을 계속 핥고 긁어서 빨갛게 부었어요' },
    { sp: 'cat', label: '치주염',            expect: ['치주', 'periodont', '치은염', 'gingivitis', '구내염', 'stomatitis'], sx: '입냄새가 심해지고 잇몸이 빨갛게 부었으며 사료를 잘 못 씹어요' },
    { sp: 'dog', label: '췌장염',            expect: ['췌장', 'pancreatitis'],                   sx: '기름진 음식 먹은 다음 날부터 구토하고 배를 만지면 아파해요' },
    { sp: 'cat', label: '신부전',            expect: ['신부전', 'renal', 'kidney', 'ckd'],       sx: '10살 고양이가 물을 엄청 많이 마시고 소변량도 늘었고 체중이 빠져요' },
    { sp: 'dog', label: '백내장',            expect: ['백내장', 'cataract', '수정체'],           sx: '노령견인데 눈동자가 뿌옇게 흐려졌고 가구에 자주 부딪혀요' },
    { sp: 'cat', label: '갑상선 기능항진',   expect: ['갑상선', 'thyroid', 'hyperthyroid'],      sx: '나이 든 고양이가 잘 먹는데 살이 빠지고 활동량이 늘었어요' },
    { sp: 'dog', label: '쿠싱',              expect: ['쿠싱', 'cushing', '부신', 'adrenal'],     sx: '배가 볼록 처지고 털이 빠지며 물을 많이 마시고 헐떡거려요' },
    { sp: 'cat', label: '결막염',            expect: ['결막염', 'conjunctivitis', '눈물', '허피스', 'herpes'], sx: '눈물이 많이 나고 눈곱이 끼며 결막이 빨개요' },
  ],
  normal: [
    { sp: 'dog', label: '방귀',              sx: '가끔 방귀를 뀌어요' },
    { sp: 'cat', label: '헤어볼',            sx: '하루에 한 번 헤어볼을 토했어요' },
    { sp: 'dog', label: '가벼운 절뚝',       sx: '산책 후 발을 살짝 절뚝거려요' },
    { sp: 'cat', label: '경미한 긁힘',       sx: '발톱으로 긁어서 살짝 긁힌 자국이 있어요' },
    { sp: 'dog', label: '기지개',            sx: '아침에 일어나서 기지개를 쭉 켜요' },
    { sp: 'cat', label: '그루밍',            sx: '평소처럼 그루밍을 30분 정도 해요' },
  ],
  edge: [
    { sp: 'dog', label: '이모지 섞임',       sx: '🤧🤧 콧물 나요 😢 어떡하죠?' },
    { sp: 'cat', label: '매우 짧음',         sx: '토함' },
    { sp: 'dog', label: '영문 혼용',         sx: '우리 강아지가 vomiting 하고 lethargy 있어요' },
    { sp: 'cat', label: '오타 + 반복',       sx: '우리 고양이가 게속 토하고있어요... 게속 ㅠㅠ 매시간 토함' },
    { sp: 'dog', label: '시간 단위 정보',    sx: '3일째 매일 새벽 2시쯤 토하고 낮엔 멀쩡해요' },
    { sp: 'cat', label: '복잡 다증상',       sx: '먹는 양 줄고 물은 많이 마시고 소변도 많이 보고 털이 푸석해지고 가끔 토하고 잘 안 움직여요' },
  ],
};

// ── 4. 실행 + 1초 딜레이 (rate limit 회피) ──
const fmt = r => (r.diseases || []).map(d => `${d.name_ko}${d.name_en ? `(${d.name_en})` : ''}[${d.severity}/${d.likelihood}]`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = { emergency: [], general: [], normal: [], edge: [] };

console.log(`\n=== 🚨 응급 (${CASES.emergency.length}건) — 예상 disease 매칭 + concern=high ===`);
for (const c of CASES.emergency) {
  const r = await analyze(c.sp, c.sx);
  if (r._err) {
    results.emergency.push({ label: c.label, pass: false, reason: 'API err: ' + r._err });
    console.log(`  ❌ ${c.label}: ${r._err}`);
  } else {
    const dz = fmt(r);
    const blob = dz.join(' ').toLowerCase();
    const diseaseHit = c.expect.some(e => blob.includes(e.toLowerCase()));
    const concernHigh = r.concern_level === 'high';
    const pass = diseaseHit && concernHigh;
    results.emergency.push({ label: c.label, pass, diseaseHit, concernHigh, dz });
    console.log(`  ${pass ? '✅' : '❌'} [${c.sp}] ${c.label}  disease=${diseaseHit ? 'HIT' : 'MISS'} concern=${r.concern_level}`);
    if (!pass) console.log(`     dz=${dz.join(' / ') || '(없음)'}`);
  }
  await sleep(1000);
}

console.log(`\n=== 🏥 일반 진료 (${CASES.general.length}건) — 예상 disease 매칭 ===`);
for (const c of CASES.general) {
  const r = await analyze(c.sp, c.sx);
  if (r._err) {
    results.general.push({ label: c.label, pass: false, reason: 'API err: ' + r._err });
    console.log(`  ❌ ${c.label}: ${r._err}`);
  } else {
    const dz = fmt(r);
    const blob = dz.join(' ').toLowerCase();
    const pass = c.expect.some(e => blob.includes(e.toLowerCase()));
    results.general.push({ label: c.label, pass, dz });
    console.log(`  ${pass ? '✅' : '❌'} [${c.sp}] ${c.label}  concern=${r.concern_level}`);
    if (!pass) console.log(`     dz=${dz.join(' / ') || '(없음)'}`);
  }
  await sleep(1000);
}

console.log(`\n=== 😊 정상 (${CASES.normal.length}건) — concern !== high ===`);
for (const c of CASES.normal) {
  const r = await analyze(c.sp, c.sx);
  if (r._err) {
    results.normal.push({ label: c.label, pass: false, reason: 'API err: ' + r._err });
    console.log(`  ❌ ${c.label}: ${r._err}`);
  } else {
    const pass = r.concern_level !== 'high';
    results.normal.push({ label: c.label, pass, concern: r.concern_level });
    console.log(`  ${pass ? '✅' : '⚠️'} [${c.sp}] ${c.label}  concern=${r.concern_level}`);
  }
  await sleep(1000);
}

console.log(`\n=== 🧪 엣지 (${CASES.edge.length}건) — 에러 없이 응답 ===`);
for (const c of CASES.edge) {
  const r = await analyze(c.sp, c.sx);
  const pass = !r._err && Array.isArray(r.diseases);
  results.edge.push({ label: c.label, pass, dz: pass ? fmt(r) : null, err: r._err });
  console.log(`  ${pass ? '✅' : '❌'} [${c.sp}] ${c.label}  ${pass ? `concern=${r.concern_level} dz=${fmt(r).length}건` : 'FAIL'}`);
  await sleep(1000);
}

// ── 5. 통계 ──
const total = Object.values(results).flat();
const passed = total.filter(r => r.pass).length;
console.log('\n' + '='.repeat(60));
console.log(`최종 결과: ${passed}/${total.length} 통과 (${Math.round(passed / total.length * 100)}%)`);
console.log('카테고리별:');
for (const [cat, list] of Object.entries(results)) {
  const p = list.filter(r => r.pass).length;
  console.log(`  ${cat.padEnd(12)} ${p}/${list.length} (${Math.round(p / list.length * 100)}%)`);
}

const failures = total.filter(r => !r.pass);
if (failures.length) {
  console.log('\n실패 케이스:');
  for (const f of failures) {
    console.log(`  - ${f.label}: ${f.reason || JSON.stringify({dz: f.dz, concern: f.concern, err: f.err})}`);
  }
}
