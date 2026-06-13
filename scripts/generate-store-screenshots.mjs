import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join(process.cwd(), 'docs', 'store-screenshots');
const W = 1080;
const H = 1920;

const COLORS = {
  navy: '#16324f',
  ink: '#14213d',
  muted: '#64748b',
  line: '#dbe5ef',
  white: '#ffffff',
  teal: '#0f766e',
  green: '#10b981',
  blue: '#2563eb',
  sky: '#0ea5e9',
  indigo: '#4f46e5',
  rose: '#f43f5e',
  amber: '#f59e0b',
};

const screenshots = [
  {
    file: '01-home-dashboard.png',
    badge: 'PawDex 홈',
    title: ['반려동물 건강을', '한눈에 확인'],
    subtitle: '오늘의 기록, 복약, 건강 흐름을 첫 화면에서 바로 확인하세요.',
    accent: COLORS.teal,
    screen: homeScreen,
  },
  {
    file: '02-ai-symptom-analysis.png',
    badge: 'AI 증상 분석',
    title: ['증상을 적으면', 'AI가 먼저 정리'],
    subtitle: '나이, 품종, 증상 시간을 함께 보고 병원 상담 전 체크 포인트를 제공합니다.',
    accent: COLORS.blue,
    screen: symptomScreen,
  },
  {
    file: '03-photo-analysis.png',
    badge: '사진 분석',
    title: ['사진으로 상태를', '빠르게 점검'],
    subtitle: '피부, 눈, 상처처럼 말로 설명하기 어려운 상태도 이미지로 기록하세요.',
    accent: COLORS.sky,
    screen: photoScreen,
  },
  {
    file: '04-paper-search.png',
    badge: '논문 검색',
    title: ['질병명으로', '근거 논문 검색'],
    subtitle: 'PubMed 기반 검색으로 관련 연구와 핵심 내용을 쉽게 확인합니다.',
    accent: COLORS.indigo,
    screen: paperScreen,
  },
  {
    file: '05-health-records.png',
    badge: '건강기록',
    title: ['진료·검사·복약을', '한곳에 기록'],
    subtitle: '병원 방문, 검사 결과, 접종, 메모를 반려동물별로 정리하세요.',
    accent: COLORS.green,
    screen: recordsScreen,
  },
  {
    file: '06-calendar-reminders.png',
    badge: '캘린더',
    title: ['일정과 알림을', '놓치지 않게'],
    subtitle: '접종, 재진, 투약 일정을 캘린더와 푸시 알림으로 관리합니다.',
    accent: '#14b8a6',
    screen: calendarScreen,
  },
  {
    file: '07-medication-expenses.png',
    badge: '복약·진료비',
    title: ['복약 체크와', '진료비 관리까지'],
    subtitle: '오늘 먹인 약과 병원비를 함께 기록해 관리 부담을 줄입니다.',
    accent: COLORS.amber,
    screen: medsExpenseScreen,
  },
  {
    file: '08-saved-history.png',
    badge: '저장함',
    title: ['분석과 논문을', '다시 확인'],
    subtitle: 'AI 분석 결과와 저장한 논문을 모아 필요할 때 바로 꺼내보세요.',
    accent: COLORS.rose,
    screen: savedScreen,
  },
];

await fs.mkdir(OUT_DIR, { recursive: true });

for (const shot of screenshots) {
  const svg = renderShot(shot);
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, shot.file));
  console.log(`created ${path.join('docs', 'store-screenshots', shot.file)}`);
}

function renderShot(shot) {
  const phone = phoneFrame(shot.screen(shot.accent), shot.accent);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fbff"/>
      <stop offset="0.56" stop-color="#edf7f4"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shot.accent}"/>
      <stop offset="1" stop-color="${mix(shot.accent, '#ffffff', 0.28)}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="954" cy="178" r="118" fill="${shot.accent}" opacity="0.08"/>
  <circle cx="112" cy="364" r="84" fill="${shot.accent}" opacity="0.09"/>
  <g font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif">
    <rect x="70" y="78" width="${textWidth(shot.badge)}" height="52" rx="26" fill="${shot.accent}" opacity="0.12"/>
    <text x="96" y="113" font-size="24" font-weight="800" fill="${shot.accent}">${esc(shot.badge)}</text>
    ${textLines(shot.title, 70, 214, 72, 78, COLORS.ink, 900)}
    ${paragraph(shot.subtitle, 72, 382, 936, 32, COLORS.muted, 28, 2)}
    ${phone}
  </g>
</svg>`;
}

function phoneFrame(content, accent) {
  return `
  <g transform="translate(122 486)" filter="url(#shadow)">
    <rect width="836" height="1330" rx="82" fill="#0f172a"/>
    <rect x="24" y="24" width="788" height="1282" rx="62" fill="#f7fafc"/>
    <rect x="342" y="44" width="152" height="28" rx="14" fill="#0f172a"/>
    <g transform="translate(54 92)">
      <rect width="728" height="1178" rx="38" fill="#f8fafc"/>
      <rect width="728" height="104" rx="38" fill="#ffffff"/>
      <text x="34" y="64" font-size="26" font-weight="900" fill="${COLORS.ink}">PawDex</text>
      <circle cx="668" cy="52" r="24" fill="${accent}" opacity="0.14"/>
      <path d="M661 52h14M668 45v14" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      ${content}
      ${bottomNav(accent)}
    </g>
  </g>`;
}

function homeScreen(accent) {
  return `
  <g transform="translate(24 130)">
    <rect width="680" height="170" rx="30" fill="${accent}"/>
    <text x="34" y="58" font-size="28" font-weight="900" fill="#fff">오늘의 건강 브리핑</text>
    <text x="34" y="106" font-size="22" fill="#dff7f2">체중 안정 · 복약 예정 1건</text>
    <rect x="474" y="42" width="144" height="72" rx="36" fill="#fff" opacity="0.18"/>
  </g>
  ${metricCards(170)}
  ${menuGrid(446, [
    ['증상 분석', COLORS.blue], ['사진 분석', COLORS.sky], ['논문 검색', COLORS.indigo], ['저장함', '#1e40af'],
    ['기록장', COLORS.green], ['캘린더', '#14b8a6'], ['건강 통계', '#059669'], ['진료비', '#0891b2'],
  ])}`;
}

function symptomScreen(accent) {
  return `
  <g transform="translate(24 136)">
    <rect width="680" height="470" rx="30" fill="#ffffff" stroke="${COLORS.line}"/>
    <text x="34" y="62" font-size="28" font-weight="900" fill="${COLORS.ink}">증상 입력</text>
    ${input(34, 94, 612, 78, '강아지가 밤부터 기침을 해요')}
    ${input(34, 188, 294, 70, '증상 시간: 어제 밤')}
    ${input(352, 188, 294, 70, '나이: 6살')}
    <rect x="34" y="292" width="612" height="116" rx="24" fill="${accent}" opacity="0.10"/>
    <text x="64" y="338" font-size="23" font-weight="900" fill="${accent}">AI 체크 포인트</text>
    <text x="64" y="376" font-size="20" fill="${COLORS.muted}">호흡, 식욕, 활동량 변화 확인</text>
  </g>
  ${resultCards(640, accent, ['응급 신호 확인', '병원 상담 질문 정리', '관련 질환 후보 보기'])}`;
}

function photoScreen(accent) {
  return `
  <g transform="translate(24 136)">
    <rect width="680" height="420" rx="30" fill="#ffffff" stroke="${COLORS.line}"/>
    <rect x="44" y="52" width="592" height="242" rx="28" fill="${accent}" opacity="0.12"/>
    <circle cx="340" cy="168" r="72" fill="${accent}" opacity="0.22"/>
    <path d="M286 188l38-44 36 34 26-28 54 62H286z" fill="${accent}" opacity="0.55"/>
    <text x="64" y="354" font-size="27" font-weight="900" fill="${COLORS.ink}">사진을 추가해 분석</text>
    <text x="64" y="388" font-size="20" fill="${COLORS.muted}">피부, 눈, 상처 부위를 기록</text>
  </g>
  ${resultCards(600, accent, ['이미지 특징 요약', '관찰해야 할 변화', '기록으로 바로 저장'])}`;
}

function paperScreen(accent) {
  return `
  <g transform="translate(24 136)">
    <rect width="680" height="96" rx="28" fill="#ffffff" stroke="${COLORS.line}"/>
    <text x="34" y="60" font-size="24" font-weight="800" fill="${COLORS.ink}">슬개골 탈구</text>
    <circle cx="614" cy="48" r="26" fill="${accent}" opacity="0.16"/>
    <path d="M606 48h16M614 40v16" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
  </g>
  ${paperCard(270, accent, 'Canine patellar luxation review', '증상, 진단, 치료 옵션 요약')}
  ${paperCard(442, accent, 'Small breed orthopedic disease', '소형견 정형 질환 연구')}
  ${paperCard(614, accent, 'Postoperative outcomes', '수술 후 회복 지표 비교')}`;
}

function recordsScreen(accent) {
  return `
  ${petHeader(134, accent)}
  ${recordRow(330, accent, '진료 기록', '6월 12일 · 기침 상담')}
  ${recordRow(456, '#14b8a6', '검사 결과', '혈액검사 PDF 첨부')}
  ${recordRow(582, COLORS.indigo, '접종 기록', '종합백신 다음 일정 등록')}
  ${recordRow(708, COLORS.amber, '메모', '식욕 정상, 산책 30분')}`;
}

function calendarScreen(accent) {
  const days = Array.from({ length: 35 }, (_, i) => {
    const active = [8, 14, 22, 29].includes(i);
    const x = 34 + (i % 7) * 88;
    const y = 246 + Math.floor(i / 7) * 76;
    return `<rect x="${x}" y="${y}" width="58" height="58" rx="18" fill="${active ? accent : '#fff'}" stroke="${active ? accent : COLORS.line}"/>
    <text x="${x + 29}" y="${y + 38}" text-anchor="middle" font-size="20" font-weight="800" fill="${active ? '#fff' : COLORS.muted}">${i + 1}</text>`;
  }).join('');
  return `
  <text x="58" y="182" font-size="30" font-weight="900" fill="${COLORS.ink}">2026년 6월</text>
  <g>${days}</g>
  ${recordRow(690, accent, '오늘 20:00', '심장사상충 약 복용')}
  ${recordRow(816, COLORS.green, '6월 18일', '동물병원 재진 예약')}`;
}

function medsExpenseScreen(accent) {
  return `
  <g transform="translate(24 136)">
    <rect width="680" height="292" rx="30" fill="#ffffff" stroke="${COLORS.line}"/>
    <text x="34" y="62" font-size="28" font-weight="900" fill="${COLORS.ink}">오늘의 복약</text>
    ${checkRow(112, '심장사상충 예방약', true)}
    ${checkRow(188, '피부 영양제', false)}
    <rect x="34" y="230" width="612" height="38" rx="19" fill="#f1f5f9"/>
    <rect x="34" y="230" width="408" height="38" rx="19" fill="${accent}"/>
  </g>
  <g transform="translate(24 482)">
    <rect width="680" height="290" rx="30" fill="#ffffff" stroke="${COLORS.line}"/>
    <text x="34" y="62" font-size="28" font-weight="900" fill="${COLORS.ink}">이번 달 진료비</text>
    <text x="34" y="130" font-size="48" font-weight="900" fill="${accent}">128,000원</text>
    ${expenseBar(180, '진료', 340, COLORS.sky)}
    ${expenseBar(226, '약', 210, COLORS.green)}
  </g>`;
}

function savedScreen(accent) {
  return `
  ${savedCard(150, accent, 'AI 분석 결과', '기침 증상 분석 · 6월 12일')}
  ${savedCard(308, COLORS.indigo, '저장한 논문', 'Canine cough differential diagnosis')}
  ${savedCard(466, COLORS.green, '건강 기록', '진료 메모와 검사 결과 연결')}
  <g transform="translate(24 668)">
    <rect width="680" height="188" rx="30" fill="${accent}" opacity="0.10"/>
    <text x="34" y="66" font-size="27" font-weight="900" fill="${COLORS.ink}">필요할 때 바로 다시 보기</text>
    <text x="34" y="112" font-size="21" fill="${COLORS.muted}">분석, 논문, 기록을 반려동물별로 저장</text>
  </g>`;
}

function metricCards(y) {
  return `
  <g transform="translate(24 ${y + 170})">
    ${smallCard(0, 0, '체중', '4.8kg', COLORS.green)}
    ${smallCard(352, 0, '복약', '1건 예정', COLORS.amber)}
  </g>`;
}

function smallCard(x, y, label, value, color) {
  return `<g transform="translate(${x} ${y})">
    <rect width="328" height="132" rx="28" fill="#ffffff" stroke="${COLORS.line}"/>
    <text x="28" y="48" font-size="20" fill="${COLORS.muted}">${label}</text>
    <text x="28" y="94" font-size="34" font-weight="900" fill="${color}">${value}</text>
  </g>`;
}

function menuGrid(y, items) {
  return `<g transform="translate(24 ${y})">${items.map(([label, color], i) => {
    const x = (i % 4) * 170;
    const yy = Math.floor(i / 4) * 150;
    return `<g transform="translate(${x} ${yy})">
      <rect x="31" width="94" height="94" rx="28" fill="${color}" opacity="0.13"/>
      <circle cx="78" cy="47" r="22" fill="${color}" opacity="0.5"/>
      <text x="78" y="130" text-anchor="middle" font-size="19" font-weight="800" fill="${COLORS.ink}">${label}</text>
    </g>`;
  }).join('')}</g>`;
}

function resultCards(y, accent, labels) {
  return `<g transform="translate(24 ${y})">${labels.map((label, i) => `
    <g transform="translate(0 ${i * 112})">
      <rect width="680" height="88" rx="24" fill="#ffffff" stroke="${COLORS.line}"/>
      <circle cx="50" cy="44" r="20" fill="${accent}" opacity="0.16"/>
      <path d="M41 45l8 8 18-22" stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="92" y="54" font-size="23" font-weight="800" fill="${COLORS.ink}">${label}</text>
    </g>`).join('')}</g>`;
}

function input(x, y, w, h, label) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#f8fafc" stroke="${COLORS.line}"/>
  <text x="${x + 24}" y="${y + 47}" font-size="20" fill="${COLORS.muted}">${esc(label)}</text>`;
}

function paperCard(y, accent, title, desc) {
  return `<g transform="translate(24 ${y})">
    <rect width="680" height="132" rx="28" fill="#ffffff" stroke="${COLORS.line}"/>
    <rect x="34" y="34" width="64" height="64" rx="20" fill="${accent}" opacity="0.14"/>
    <text x="124" y="56" font-size="22" font-weight="900" fill="${COLORS.ink}">${esc(title)}</text>
    <text x="124" y="94" font-size="19" fill="${COLORS.muted}">${esc(desc)}</text>
  </g>`;
}

function petHeader(y, accent) {
  return `<g transform="translate(24 ${y})">
    <rect width="680" height="148" rx="30" fill="#ffffff" stroke="${COLORS.line}"/>
    <circle cx="78" cy="74" r="42" fill="${accent}" opacity="0.18"/>
    <text x="144" y="66" font-size="30" font-weight="900" fill="${COLORS.ink}">초코</text>
    <text x="144" y="104" font-size="20" fill="${COLORS.muted}">말티즈 · 6살 · 4.8kg</text>
  </g>`;
}

function recordRow(y, color, title, desc) {
  return `<g transform="translate(24 ${y})">
    <rect width="680" height="96" rx="26" fill="#ffffff" stroke="${COLORS.line}"/>
    <rect x="28" y="24" width="48" height="48" rx="16" fill="${color}" opacity="0.15"/>
    <text x="104" y="44" font-size="22" font-weight="900" fill="${COLORS.ink}">${esc(title)}</text>
    <text x="104" y="74" font-size="18" fill="${COLORS.muted}">${esc(desc)}</text>
  </g>`;
}

function checkRow(y, label, checked) {
  return `<g transform="translate(34 ${y})">
    <rect width="612" height="54" rx="18" fill="#f8fafc"/>
    <circle cx="28" cy="27" r="16" fill="${checked ? COLORS.green : '#fff'}" stroke="${checked ? COLORS.green : COLORS.line}" stroke-width="4"/>
    ${checked ? '<path d="M20 27l6 6 12-16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
    <text x="62" y="36" font-size="20" font-weight="800" fill="${COLORS.ink}">${esc(label)}</text>
  </g>`;
}

function expenseBar(y, label, width, color) {
  return `<text x="34" y="${y + 23}" font-size="18" fill="${COLORS.muted}">${label}</text>
  <rect x="100" y="${y}" width="500" height="28" rx="14" fill="#f1f5f9"/>
  <rect x="100" y="${y}" width="${width}" height="28" rx="14" fill="${color}"/>`;
}

function savedCard(y, color, title, desc) {
  return `<g transform="translate(24 ${y})">
    <rect width="680" height="118" rx="28" fill="#ffffff" stroke="${COLORS.line}"/>
    <rect x="30" y="30" width="58" height="58" rx="18" fill="${color}" opacity="0.15"/>
    <text x="116" y="52" font-size="23" font-weight="900" fill="${COLORS.ink}">${esc(title)}</text>
    <text x="116" y="88" font-size="19" fill="${COLORS.muted}">${esc(desc)}</text>
  </g>`;
}

function bottomNav(accent) {
  const items = [['홈', accent], ['검색', COLORS.blue], ['기록', COLORS.green], ['병원', COLORS.rose], ['MY', COLORS.amber]];
  return `<g transform="translate(0 1078)">
    <rect width="728" height="100" fill="#ffffff"/>
    <line x1="0" y1="0" x2="728" y2="0" stroke="${COLORS.line}"/>
    ${items.map(([label, color], i) => {
      const x = 72 + i * 146;
      return `<g transform="translate(${x} 20)">
        <circle cx="0" cy="0" r="18" fill="${color}" opacity="${i === 0 ? '1' : '0.18'}"/>
        <text x="0" y="54" text-anchor="middle" font-size="16" font-weight="900" fill="${i === 0 ? accent : COLORS.muted}">${label}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function textLines(lines, x, y, size, gap, fill, weight) {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * gap}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(line)}</text>`).join('');
}

function paragraph(text, x, y, maxWidth, size, fill, lineHeight, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length * size * 0.56 > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" font-size="${size}" font-weight="600" fill="${fill}">${esc(line)}</text>`).join('');
}

function textWidth(text) {
  return Math.max(170, text.length * 28 + 52);
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function mix(a, b, amount) {
  const ca = hex(a);
  const cb = hex(b);
  const cc = ca.map((v, i) => Math.round(v * (1 - amount) + cb[i] * amount));
  return `#${cc.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hex(value) {
  const clean = value.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}
