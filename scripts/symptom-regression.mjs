// 증상 분석 회귀 테스트 — 치명 바이러스가 감별로 나오는지 + 정상 케이스 과진단 안 하는지.
// 실제 route.ts 의 system 프롬프트를 추출하고, redFlags.json 을 공유해 route 와 동일하게
// user message 를 구성한 뒤 OpenAI 를 호출한다. (프롬프트 변경 때마다 재실행 → 신뢰성 보증)
// 실행: node scripts/symptom-regression.mjs   (OPENAI_API_KEY 는 .env.production 에서 읽음)
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();

// 1) key (.env.production, 끝 \n 등 정리)
const env = readFileSync(`${ROOT}/.env.production`, 'utf8');
const kl = env.split(/\r?\n/).find((l) => /^\s*OPENAI_API_KEY=/.test(l));
const KEY = kl.replace(/^\s*OPENAI_API_KEY=/, '').replace(/^["']|["']$/g, '').replace(/\\[rn]/g, '').replace(/\s+/g, '');

// 2) system 프롬프트 추출 (현재 route.ts 기준)
const route = readFileSync(`${ROOT}/src/app/api/symptom-analysis/route.ts`, 'utf8');
const sIdx = route.indexOf('당신은 한국 수의학');
const systemTpl = route.slice(sIdx, route.indexOf('`', sIdx)).replace(/\$\{isRefinement[\s\S]*?\}/g, '');

// 3) redFlags.json 공유 + route 와 동일한 매처
const RED_FLAGS = JSON.parse(readFileSync(`${ROOT}/src/data/redFlags.json`, 'utf8'));
function matchRedFlags(species, text) {
  const t = (text || '').replace(/\s+/g, '');
  return RED_FLAGS.filter((rf) => (rf.species === 'any' || rf.species === species) &&
    rf.all.every((g) => g.some((kw) => t.includes(kw)))).map((rf) => rf.hint);
}

async function analyze(species, sx) {
  const petLabel = species === 'cat' ? '고양이' : '강아지';
  const system = systemTpl.replaceAll('${petLabel}', petLabel);
  const hints = matchRedFlags(species, sx);
  const rfBlock = hints.length
    ? `\n\n[이 증상에서 반드시 감별 후보에 포함할 주요 질환 — 누락 금지]\n${hints.map((h) => `- ${h}`).join('\n')}\n→ 위 질환을 diseases 배열에 반드시 포함하되, action/설명에 "확진은 병원 검사 필요"를 명시하라. (사진이 아닌 증상 기반이므로 감별로 제시하는 것은 적절)`
    : '';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 1500, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `우리 ${petLabel}가 이런 증상을 보입니다: "${sx}"${rfBlock}` },
      ],
    }),
  });
  if (!res.ok) return { _err: `${res.status}: ${(await res.text()).slice(0, 150)}` };
  return JSON.parse((await res.json()).choices?.[0]?.message?.content ?? '{}');
}

// 4) 케이스: 치명(target 나와야) + 정상(과진단 안 돼야)
const DEADLY = [
  { sp: 'dog', t: '파보',      exp: ['파보', 'parvo'],                 sx: '생후 3개월 강아지가 피 섞인 설사를 하고 토하고 기운이 하나도 없어요' },
  { sp: 'dog', t: '디스템퍼',  exp: ['디스템퍼', 'distemper', '홍역'], sx: '열이 나고 콧물·기침을 하다가 다리를 떨고 경련을 해요' },
  { sp: 'cat', t: '범백',      exp: ['범백', 'panleukopenia'],         sx: '새끼 고양이가 고열에 심한 구토를 하고 피설사하며 축 처져 있어요' },
  { sp: 'cat', t: 'FIP',       exp: ['복막염', 'fip', 'peritonitis'],  sx: '열이 며칠째 안 떨어지고 배가 빵빵하게 부르고 잘 안 먹어요' },
  { sp: 'dog', t: '광견병/신경',exp: ['광견병', 'rabies', '디스템퍼', 'distemper'], sx: '갑자기 사나워지고 침을 많이 흘리며 물을 잘 못 삼켜요' },
  { sp: 'cat', t: '허피스',    exp: ['허피스', 'herpes', '칼리시', 'calici', '클라미디아', 'chlam'], sx: '눈물이 나고 눈곱이 많이 끼며 눈이 부었어요' },
];
const NORMAL = [
  { sp: 'dog', t: '방귀(정상)',   sx: '가끔 방귀를 뀌어요' },
  { sp: 'cat', t: '헤어볼(정상)', sx: '하루에 한 번 헤어볼을 토했어요' },
  { sp: 'dog', t: '가벼운 절뚝',  sx: '산책 후 발을 살짝 절뚝거려요' },
  { sp: 'cat', t: '경미한 긁힘',  sx: '발톱으로 긁어서 살짝 긁힌 자국이 있어요' },
];

const fmt = (r) => (r.diseases || []).map((d) => `${d.name_ko}${d.name_en ? `(${d.name_en})` : ''}[${d.severity}/${d.likelihood}]`);

console.log('=== 치명 바이러스 (target 나와야 ✅) ===');
let pass = 0;
for (const c of DEADLY) {
  const r = await analyze(c.sp, c.sx);
  if (r._err) { console.log(`\n■ ${c.t} ERR ${r._err}`); continue; }
  const dz = fmt(r);
  const blob = dz.join(' ').toLowerCase();
  const hit = c.exp.some((e) => blob.includes(e.toLowerCase()));
  if (hit) pass++;
  console.log(`\n${hit ? '✅' : '❌'} [${c.sp}] ${c.t}  concern=${r.concern_level}`);
  console.log(`   ${dz.join(' / ') || '(없음)'}`);
}
console.log(`\n치명 통과: ${pass}/${DEADLY.length}`);

console.log('\n=== 정상 케이스 (high 아니어야 + 과진단 X) ===');
for (const c of NORMAL) {
  const r = await analyze(c.sp, c.sx);
  if (r._err) { console.log(`\n■ ${c.t} ERR ${r._err}`); continue; }
  const ok = r.concern_level !== 'high';
  console.log(`\n${ok ? '✅' : '⚠️'} [${c.sp}] ${c.t}  concern=${r.concern_level}`);
  console.log(`   ${fmt(r).join(' / ') || '(없음)'}`);
}
