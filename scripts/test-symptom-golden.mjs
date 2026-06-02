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
  const parsed = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? '{}');
  return applyServerFallback(parsed);
}

// 서버 후처리(route.ts) 와 동일한 severity/likelihood fallback.
// raw OpenAI 응답이 두 필드 비우는 케이스 정규화 — false positive 방지.
function applyServerFallback(parsed) {
  if (!parsed || !Array.isArray(parsed.diseases)) return parsed;
  parsed.diseases = parsed.diseases.map(d => ({
    ...d,
    severity: ['긴급', '주의', '관찰'].includes(d?.severity) ? d.severity : '관찰',
    likelihood: ['높음', '중간', '낮음'].includes(d?.likelihood) ? d.likelihood : '낮음',
  }));
  return parsed;
}

// ── 3. 골든 케이스 60개 (16 + 20 + 12 + 12) ──
const CASES = {
  emergency: [
    // 감염성 (8) — 기존
    { sp: 'dog', label: '파보',              expect: ['파보', 'parvo'],                          sx: '생후 3개월 강아지가 피 섞인 설사를 하고 토하고 기운이 하나도 없어요' },
    { sp: 'dog', label: '디스템퍼',          expect: ['디스템퍼', 'distemper', '홍역'],          sx: '열이 나고 콧물·기침을 하다가 다리를 떨고 경련을 해요' },
    { sp: 'dog', label: 'GDV (위염전)',      expect: ['gdv', '위염전', '위확장', 'bloat', 'volvulus'], sx: '대형견인데 배가 부풀어 오르고 침을 흘리며 안절부절못해요' },
    { sp: 'cat', label: '범백',              expect: ['범백', 'panleukopenia'],                  sx: '새끼 고양이가 고열에 심한 구토를 하고 피설사하며 축 처져 있어요' },
    { sp: 'cat', label: 'FIP',               expect: ['복막염', 'fip', 'peritonitis'],           sx: '열이 며칠째 안 떨어지고 배가 빵빵하게 부르고 잘 안 먹어요' },
    { sp: 'cat', label: '요로폐색 (수컷)',   expect: ['요로', 'urolithiasis', 'blockage', '폐색', 'obstruct', '방광염', 'cystitis', 'fic', 'flutd'], sx: '수컷 고양이가 화장실에 자주 가지만 소변을 거의 못 보고 신음해요' },
    { sp: 'dog', label: '광견병/신경',       expect: ['광견병', 'rabies', '디스템퍼', 'distemper', '뇌염', 'encephalitis'], sx: '갑자기 사나워지고 침을 많이 흘리며 물을 잘 못 삼켜요' },
    { sp: 'cat', label: '비대성 심근증',     expect: ['심근증', 'cardiomyopathy', 'hcm', '혈전', 'thrombo', '심부전', 'heart failure'], sx: '갑자기 뒷다리가 차갑고 마비된 듯 끌고 다니며 호흡이 가빠요' },
    // 응급 추가 (8)
    { sp: 'dog', label: '혈변 (멜레나)',     expect: ['출혈', 'hemorrhag', 'melena', '위장관', 'gi', '궤양', 'ulcer'], sx: '검은 타르 같은 변을 보고 토물에 커피찌꺼기 같은 게 섞여 있어요' },
    { sp: 'cat', label: '호흡 곤란',         expect: ['호흡', 'respiratory', '폐부종', 'edema', '심부전', 'heart failure', '흉수', 'effusion', '천식', 'asthma'], sx: '입을 벌리고 헐떡거리며 가슴이 빠르게 들썩이고 잇몸이 푸르스름해요' },
    { sp: 'dog', label: '발작 (의식 저하)',  expect: ['발작', 'seizure', '경련', '간질', 'epilepsy', '뇌염', 'encephalitis'], sx: '갑자기 쓰러져서 사지가 빳빳해지고 입에서 거품이 나오며 의식이 없어요' },
    { sp: 'dog', label: '열사병',            expect: ['열사병', 'heatstroke', 'hyperthermia', '체온', 'fever'], sx: '여름 산책 후 헐떡거림이 심하고 잇몸이 빨갛고 침을 많이 흘리며 비틀거려요' },
    { sp: 'dog', label: '초콜릿 중독',       expect: ['중독', 'toxic', 'poison', '초콜릿', 'chocolate', 'theobromine'], sx: '큰 다크 초콜릿 한 판을 다 먹은 뒤 떨고 구토하며 심박이 빨라요' },
    { sp: 'cat', label: '급성 신부전',       expect: ['신부전', 'renal failure', 'aki', '신독성', 'kidney injury'], sx: '백합 잎을 씹었는데 그 뒤로 토하고 물도 안 마시고 소변을 거의 안 봐요' },
    { sp: 'dog', label: '아나필락시스',      expect: ['아나필락시스', 'anaphylaxis', '알레르기', 'allergy', '쇼크', 'shock'], sx: '벌에 쏘인 뒤 갑자기 얼굴이 부어오르고 두드러기가 나며 호흡이 가빠지고 침을 흘려요' },
    { sp: 'dog', label: '자궁축농증',        expect: ['자궁축농증', 'pyometra', '자궁', 'uterine'], sx: '중성화 안 한 7살 암컷인데 발정 한 달 뒤부터 음부에서 고름이 나오고 물을 많이 마셔요' },
  ],
  general: [
    // 기존 10
    { sp: 'dog', label: '외이염',            expect: ['외이염', 'otitis', '귀'],                 sx: '귀를 자주 긁고 머리를 흔들며 갈색 분비물이 나와요' },
    { sp: 'dog', label: '슬개골 탈구',       expect: ['슬개골', 'patella', 'luxation'],          sx: '소형견인데 뒷다리를 갑자기 들고 깡총거리며 걷다가 다시 정상으로 돌아와요' },
    { sp: 'dog', label: '아토피',            expect: ['아토피', 'atopic', '알레르기', 'allergy', '피부염', 'dermatitis'], sx: '발과 배 부분을 계속 핥고 긁어서 빨갛게 부었어요' },
    { sp: 'cat', label: '치주염',            expect: ['치주', 'periodont', '치은염', 'gingivitis', '구내염', 'stomatitis'], sx: '입냄새가 심해지고 잇몸이 빨갛게 부었으며 사료를 잘 못 씹어요' },
    { sp: 'dog', label: '췌장염',            expect: ['췌장', 'pancreatitis'],                   sx: '기름진 음식 먹은 다음 날부터 구토하고 배를 만지면 아파해요' },
    { sp: 'cat', label: '만성 신부전 (CKD)', expect: ['신부전', 'renal', 'kidney', 'ckd'],       sx: '10살 고양이가 물을 엄청 많이 마시고 소변량도 늘었고 체중이 빠져요' },
    { sp: 'dog', label: '백내장',            expect: ['백내장', 'cataract', '수정체'],           sx: '노령견인데 눈동자가 뿌옇게 흐려졌고 가구에 자주 부딪혀요' },
    { sp: 'cat', label: '갑상선 기능항진',   expect: ['갑상선', 'thyroid', 'hyperthyroid'],      sx: '나이 든 고양이가 잘 먹는데 살이 빠지고 활동량이 늘었어요' },
    { sp: 'dog', label: '쿠싱 (or 당뇨)',    expect: ['쿠싱', 'cushing', '부신', 'adrenal', '당뇨', 'diabetes', 'dm'], sx: '배가 볼록 처지고 털이 빠지며 물을 많이 마시고 헐떡거려요' },
    { sp: 'cat', label: '결막염',            expect: ['결막염', 'conjunctivitis', '눈물', '허피스', 'herpes'], sx: '눈물이 많이 나고 눈곱이 끼며 결막이 빨개요' },
    // 추가 (10) — 내분비 다증상 5케이스 포함
    { sp: 'dog', label: '비만',              expect: ['비만', 'obesity', '체중', 'overweight'], sx: '활동량 비해 사료를 많이 먹고 체중이 1년 사이 3kg 늘었어요' },
    { sp: 'cat', label: '변비',              expect: ['변비', 'constipation', '거대결장', 'megacolon'], sx: '며칠째 변을 못 보고 화장실에 앉아 힘만 주다가 나와요' },
    { sp: 'dog', label: '디스크 (IVDD)',     expect: ['디스크', 'ivdd', '추간판', 'intervertebral', '척수', 'spinal'], sx: '닥스훈트인데 갑자기 뒷다리에 힘이 빠지고 등을 만지면 비명을 질러요' },
    { sp: 'cat', label: '전정증후군',        expect: ['전정', 'vestibular', '평형', 'balance', '안진', 'nystagmus'], sx: '노령묘인데 머리를 한쪽으로 기울이고 빙글빙글 돌며 잘 못 걸어요' },
    { sp: 'dog', label: '곰팡이 피부염',     expect: ['곰팡이', 'fungal', 'malassezia', '진균', 'dermatophyt', '말라세지아', '피부염'], sx: '발가락 사이가 빨갛고 기름지며 효모 냄새가 나고 핥음이 심해요' },
    { sp: 'dog', label: '심장사상충',        expect: ['심장사상충', 'heartworm', 'dirofilaria'], sx: '예방약 안 먹였는데 산책할 때 기침하고 쉽게 지치며 가끔 실신해요' },
    { sp: 'cat', label: '림포마',            expect: ['림포마', 'lymphoma', '림프종', '종양', 'tumor', 'neoplas'], sx: '14살 고양이가 만성 구토 + 설사 + 체중 ↓ 가 두 달째이고 복부에서 덩어리가 만져져요' },
    // 내분비 다증상 케이스 (5) — C 변경 핵심 검증
    { sp: 'dog', label: '내분비 다증상 A',   expect: ['쿠싱', 'cushing', '당뇨', 'diabetes', '요붕증', 'diabetes insipidus', '갑상선', 'thyroid'], sx: '10살 강아지가 물을 비정상적으로 많이 마시고 오줌도 많이 누고 등쪽 털이 빠지며 헐떡거려요' },
    { sp: 'cat', label: '내분비 다증상 B',   expect: ['갑상선', 'thyroid', 'hyperthyroid', '당뇨', 'diabetes', '림포마', 'lymphoma', '신부전', 'ckd'], sx: '12살 고양이가 사료는 더 많이 먹는데 체중은 빠지고 행동이 더 활발해졌어요' },
    { sp: 'dog', label: '내분비 다증상 C',   expect: ['신부전', 'ckd', '갑상선', 'thyroid', 'hypothyroid', '림포마', 'lymphoma'], sx: '노령견이 만성적으로 물을 많이 마시고 체중이 줄고 식욕도 점점 떨어지며 무기력해요' },
  ],
  normal: [
    // 기존 6
    { sp: 'dog', label: '방귀',              sx: '가끔 방귀를 뀌어요' },
    { sp: 'cat', label: '헤어볼',            sx: '하루에 한 번 헤어볼을 토했어요' },
    { sp: 'dog', label: '가벼운 절뚝',       sx: '산책 후 발을 살짝 절뚝거려요' },
    { sp: 'cat', label: '경미한 긁힘',       sx: '발톱으로 긁어서 살짝 긁힌 자국이 있어요' },
    { sp: 'dog', label: '기지개',            sx: '아침에 일어나서 기지개를 쭉 켜요' },
    { sp: 'cat', label: '그루밍',            sx: '평소처럼 그루밍을 30분 정도 해요' },
    // 추가 (6)
    { sp: 'dog', label: '식후 트림',         sx: '밥 먹고 나서 한 번 트림을 했어요' },
    { sp: 'cat', label: '새벽 활동',         sx: '새벽 4시쯤 갑자기 뛰어다니다가 다시 자요' },
    { sp: 'dog', label: '정상 발정',         sx: '발정 기간인데 음부가 약간 부었어요' },
    { sp: 'cat', label: '가벼운 재채기',     sx: '먼지 많은 데서 한두 번 재채기했어요' },
    { sp: 'dog', label: '입맛 변화',         sx: '새 사료로 바꿔서 한두 끼 적게 먹었어요' },
    { sp: 'cat', label: '그루밍 빈도 ↑',     sx: '날씨 따뜻해진 뒤 그루밍 시간이 살짝 늘었어요' },
  ],
  edge: [
    // 기존 6
    { sp: 'dog', label: '이모지 섞임',       sx: '🤧🤧 콧물 나요 😢 어떡하죠?' },
    { sp: 'cat', label: '매우 짧음',         sx: '토함' },
    { sp: 'dog', label: '영문 혼용',         sx: '우리 강아지가 vomiting 하고 lethargy 있어요' },
    { sp: 'cat', label: '오타 + 반복',       sx: '우리 고양이가 게속 토하고있어요... 게속 ㅠㅠ 매시간 토함' },
    { sp: 'dog', label: '시간 단위 정보',    sx: '3일째 매일 새벽 2시쯤 토하고 낮엔 멀쩡해요' },
    { sp: 'cat', label: '복잡 다증상',       sx: '먹는 양 줄고 물은 많이 마시고 소변도 많이 보고 털이 푸석해지고 가끔 토하고 잘 안 움직여요' },
    // 추가 (6)
    { sp: 'dog', label: '매우 긴 입력',      sx: '강아지가 어제 저녁부터 갑자기 평소랑 다르게 행동하는데 식사를 평소보다 절반만 먹고 산책 갈 때 천천히 걷고 좋아하던 장난감도 안 물고 가만히 누워있고 부르면 고개만 들고 일어나지 않으며 물은 그냥 그대로 마시는 양인데 표정이 멍하고 호흡은 정상 같지만 평소보다 조금 빠른 것 같아요' },
    { sp: 'cat', label: '거의 빈 문자열',    sx: '...' },
    { sp: 'dog', label: '숫자 위주',         sx: '체온 39.8, 호흡 50/min, 심박 160, 식음 0' },
    { sp: 'cat', label: '부정문 (정상)',     sx: '특별히 다른 건 없어요. 토 안 함. 설사 안 함. 잘 먹고 잘 잠.' },
    { sp: 'dog', label: '다국어 혼합',       sx: 'My dog has been 기침하고 colsa 있어요 since yesterday' },
    { sp: 'cat', label: '시간 명시',         sx: '오후 3시부터 5시 사이에만 토하고 그 외엔 정상이에요' },
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
