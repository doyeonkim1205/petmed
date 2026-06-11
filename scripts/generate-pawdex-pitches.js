const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const outDir = path.join(root, 'docs', 'pitch-decks');
const tmpRoot = path.join(root, 'docs', '.pptx-build');

const NS = {
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function emu(inches) {
  return Math.round(inches * 914400);
}

function color(hex) {
  return hex.replace('#', '').toUpperCase();
}

function textRuns(text, size = 1800, bold = false, fill = '172033') {
  const lines = String(text).split('\n');
  return lines.map((line, idx) => `
    <a:p>
      <a:pPr marL="0" indent="0"/>
      <a:r>
        <a:rPr lang="ko-KR" sz="${size}"${bold ? ' b="1"' : ''}>
          <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
          <a:latin typeface="맑은 고딕"/>
          <a:ea typeface="맑은 고딕"/>
        </a:rPr>
        <a:t>${esc(line)}</a:t>
      </a:r>
      ${idx < lines.length - 1 ? '<a:br/>' : ''}
    </a:p>`).join('');
}

function bulletParagraphs(items, size = 1650, fill = '39465E') {
  return items.map((item) => `
    <a:p>
      <a:pPr marL="285750" indent="-171450">
        <a:buChar char="•"/>
      </a:pPr>
      <a:r>
        <a:rPr lang="ko-KR" sz="${size}">
          <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
          <a:latin typeface="맑은 고딕"/>
          <a:ea typeface="맑은 고딕"/>
        </a:rPr>
        <a:t>${esc(item)}</a:t>
      </a:r>
    </a:p>`).join('');
}

function shape(id, x, y, w, h, opts = {}) {
  const fill = opts.fill ? `<a:solidFill><a:srgbClr val="${color(opts.fill)}"/></a:solidFill>` : '<a:noFill/>';
  const line = opts.line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${color(opts.line)}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const radius = opts.radius ? 'roundRect' : 'rect';
  const body = opts.bullets ? bulletParagraphs(opts.bullets, opts.size || 1600, color(opts.textColor || '#34415A')) : textRuns(opts.text || '', opts.size || 1800, opts.bold, color(opts.textColor || '#172033'));
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="shape ${id}"/>
        <p:cNvSpPr txBox="1"/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
        <a:prstGeom prst="${radius}"><a:avLst/></a:prstGeom>
        ${fill}
        ${line}
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="square" lIns="91440" tIns="68580" rIns="91440" bIns="68580"/>
        <a:lstStyle/>
        ${body}
      </p:txBody>
    </p:sp>`;
}

function titleSlide(slide, idx) {
  let id = 2;
  const accent = slide.accent || '#177954';
  return `
    ${shape(id++, 0, 0, 13.333, 7.5, { fill: '#F4F7FB' })}
    ${shape(id++, 0, 0, 13.333, 1.0, { fill: accent })}
    ${shape(id++, 0.75, 0.35, 5.2, 0.35, { text: slide.kicker || 'PawDex Pitch', size: 1250, bold: true, textColor: '#FFFFFF' })}
    ${shape(id++, 0.75, 1.65, 11.0, 1.35, { text: slide.title, size: 3600, bold: true, textColor: '#172033' })}
    ${shape(id++, 0.78, 3.25, 9.8, 0.75, { text: slide.subtitle || '', size: 1750, textColor: '#516078' })}
    ${shape(id++, 0.78, 5.35, 3.0, 0.62, { fill: accent, radius: true, text: slide.cta || '제안 요약', size: 1450, bold: true, textColor: '#FFFFFF' })}
    ${shape(id++, 10.6, 5.15, 1.8, 1.8, { fill: '#FFFFFF', line: '#DDE4EE', radius: true, text: 'PawDex', size: 1700, bold: true, textColor: accent })}
  `;
}

function sectionSlide(slide) {
  let id = 2;
  return `
    ${shape(id++, 0, 0, 13.333, 7.5, { fill: '#FFFFFF' })}
    ${shape(id++, 0.55, 0.38, 7.4, 0.5, { text: slide.kicker || '', size: 1200, bold: true, textColor: slide.accent || '#2368D9' })}
    ${shape(id++, 0.55, 0.88, 10.9, 0.8, { text: slide.title, size: 2500, bold: true, textColor: '#172033' })}
    ${shape(id++, 0.55, 1.85, 12.2, 0.55, { text: slide.subtitle || '', size: 1350, textColor: '#657286' })}
    ${cards(slide.cards || [], 0.55, 2.65)}
    ${slide.note ? shape(id + 20, 0.65, 6.6, 12.0, 0.45, { text: slide.note, size: 1150, textColor: '#657286' }) : ''}
  `;
}

function cards(cardsData, x0, y0) {
  let id = 20;
  const count = cardsData.length;
  const cols = count <= 3 ? count : 3;
  const cardW = cols === 2 ? 5.85 : 3.85;
  const cardH = count > 3 ? 1.65 : 2.35;
  return cardsData.map((c, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = x0 + col * (cardW + 0.32);
    const y = y0 + row * (cardH + 0.28);
    return `
      ${shape(id++, x, y, cardW, cardH, { fill: c.fill || '#F6F8FB', line: c.line || '#DDE4EE', radius: true, text: c.title, size: 1550, bold: true, textColor: c.titleColor || '#172033' })}
      ${shape(id++, x + 0.05, y + 0.55, cardW - 0.1, cardH - 0.62, { bullets: c.items || [], size: c.size || 1200, textColor: c.textColor || '#39465E' })}
    `;
  }).join('');
}

function flowSlide(slide) {
  let id = 2;
  const steps = slide.steps || [];
  const stepW = 1.92;
  return `
    ${shape(id++, 0, 0, 13.333, 7.5, { fill: '#FFFFFF' })}
    ${shape(id++, 0.55, 0.38, 7.4, 0.5, { text: slide.kicker || '', size: 1200, bold: true, textColor: slide.accent || '#177954' })}
    ${shape(id++, 0.55, 0.88, 11.0, 0.8, { text: slide.title, size: 2500, bold: true, textColor: '#172033' })}
    ${shape(id++, 0.55, 1.82, 11.5, 0.6, { text: slide.subtitle || '', size: 1350, textColor: '#657286' })}
    ${steps.map((s, i) => {
      const x = 0.55 + i * (stepW + 0.22);
      return `
        ${shape(id++, x, 2.72, stepW, 2.35, { fill: '#F6F8FB', line: '#DDE4EE', radius: true, text: `${i + 1}. ${s.title}`, size: 1350, bold: true, textColor: '#172033' })}
        ${shape(id++, x + 0.03, 3.45, stepW - 0.06, 1.15, { text: s.text, size: 1120, textColor: '#39465E' })}
        ${i < steps.length - 1 ? shape(id++, x + stepW - 0.02, 3.48, 0.28, 0.3, { text: '→', size: 1550, bold: true, textColor: '#8A95A8' }) : ''}
      `;
    }).join('')}
    ${slide.note ? shape(id + 20, 0.65, 6.2, 12.0, 0.7, { fill: '#EFFAF4', line: '#BFE5D4', radius: true, text: slide.note, size: 1250, bold: true, textColor: '#177954' }) : ''}
  `;
}

function slideXml(slide, idx) {
  const content = slide.type === 'title'
    ? titleSlide(slide, idx)
    : slide.type === 'flow'
      ? flowSlide(slide)
      : sectionSlide(slide);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${content}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function presentationXml(slideCount) {
  const sldIds = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIds}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function presentationRels(slideCount) {
  const rels = [`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`];
  for (let i = 0; i < slideCount; i++) {
    rels.push(`<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
}

function contentTypes(slideCount) {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`;
}

const commonFiles = {
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PawDex</Application><PresentationFormat>16:9</PresentationFormat></Properties>`,
  'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>PawDex Pitch Deck</dc:title><dc:creator>PawDex</dc:creator><cp:lastModifiedBy>PawDex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-06-10T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-10T00:00:00Z</dcterms:modified></cp:coreProperties>`,
  'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
  'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${NS.a}" name="PawDex"><a:themeElements><a:clrScheme name="PawDex"><a:dk1><a:srgbClr val="172033"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="39465E"/></a:dk2><a:lt2><a:srgbClr val="F6F8FB"/></a:lt2><a:accent1><a:srgbClr val="2368D9"/></a:accent1><a:accent2><a:srgbClr val="177954"/></a:accent2><a:accent3><a:srgbClr val="B85F12"/></a:accent3><a:accent4><a:srgbClr val="08798D"/></a:accent4><a:accent5><a:srgbClr val="6553C7"/></a:accent5><a:accent6><a:srgbClr val="BD2F3A"/></a:accent6><a:hlink><a:srgbClr val="2368D9"/></a:hlink><a:folHlink><a:srgbClr val="6553C7"/></a:folHlink></a:clrScheme><a:fontScheme name="PawDex"><a:majorFont><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:majorFont><a:minorFont><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:minorFont></a:fontScheme><a:fmtScheme name="PawDex"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`,
};

const distributorSlides = [
  { type: 'title', accent: '#177954', kicker: 'PawDex × Royal Canin 총판 제안', title: '기록 기반 맞춤 사료 커머스', subtitle: '보호자 건강기록과 AI 분석을 구매 전환으로 연결해 로얄캐닌 판매와 정기배송을 키우는 구조', cta: '총판 미팅용' },
  { kicker: '시장 기회', title: '보호자는 “어떤 사료가 맞는지”를 계속 고민합니다', subtitle: '가격 경쟁력만으로는 반복 구매를 만들기 어렵고, 추천 근거가 있어야 정기배송으로 이어집니다.', cards: [
    { title: '선택 피로', items: ['라인업과 용량이 다양함', '나이·체중·증상별 판단이 어려움', '처방식/일반식 구분이 헷갈림'] },
    { title: '가격 민감도', items: ['사료는 반복 구매 품목', '최저가 체감이 크면 전환이 빠름', '정기배송 전환 여지가 큼'] },
    { title: '신뢰 부족', items: ['광고성 추천에 피로감', '우리 아이 기록과 연결된 근거 필요', '수의사 상담 권장 장치 필요'] },
  ] },
  { type: 'flow', kicker: '구매 전환 구조', title: 'PawDex의 추천은 쇼핑몰이 아니라 기록에서 출발합니다', subtitle: '기존 건강기록 데이터를 상품 카탈로그와 연결해 구매 이유를 만듭니다.', steps: [
    { title: '프로필', text: '종, 나이, 체중, 중성화, 품종, 생활단계' },
    { title: '기록', text: '증상, 진료, 복약, 검사결과, 체중 변화' },
    { title: 'AI 요약', text: '현재 상태와 영양 고려사항 정리' },
    { title: '상품 매칭', text: '로얄캐닌 카탈로그 태그 안에서 후보 추출' },
    { title: '구매', text: '최저가 구매 또는 정기배송 연결' },
    { title: '피드백', text: '기호성, 변 상태, 체중 변화를 다음 추천에 반영' },
  ], note: '핵심은 AI가 임의 상품을 만들지 않고, 등록된 로얄캐닌 상품 안에서만 추천하는 것입니다.' },
  { kicker: '총판이 얻는 가치', title: '단순 노출이 아니라 구매 이유와 반복 구매를 만듭니다', subtitle: 'PawDex는 사료 가격 경쟁력을 “맞춤 추천 + 정기배송”으로 전환하는 역할을 합니다.', cards: [
    { title: '전환율 상승', items: ['우리 아이 기준 추천 이유 제공', '추천 사료에서 바로 구매', '급여량/소진일 계산으로 구매 결정을 단축'] },
    { title: '반복 매출', items: ['사료는 정기배송과 궁합이 좋음', '소진 예상일 기반 알림', '배송 주기 변경/일시중지로 이탈 방지'] },
    { title: '데이터 기반 운영', items: ['추천 클릭률·구매율 확인', '품종/연령/상태별 수요 파악', '재고·프로모션 전략에 활용'] },
  ] },
  { kicker: '쇼핑 UX', title: '구매 화면은 “맞춤 추천 → 비교 → 정기배송”으로 설계합니다', subtitle: '가격만 보여주는 쇼핑몰보다, 보호자가 왜 이 상품을 골라야 하는지 이해하게 합니다.', cards: [
    { title: '맞춤 추천', items: ['1순위 추천 사료', '추천 근거 3가지', '주의/상담 필요 표시'] },
    { title: '상품 상세', items: ['용량/가격/단가 비교', '급여량 계산', '한 포대 예상 사용일'] },
    { title: '정기배송', items: ['2주/4주/6주 주기', '다음 결제일 확인', '일시중지/배송지 변경'] },
  ] },
  { kicker: '판매자 센터', title: '처음은 총판 1곳 전용 운영툴로 작게 시작합니다', subtitle: '오픈마켓 전체를 만들기보다 로얄캐닌 총판 운영에 필요한 기능부터 검증합니다.', cards: [
    { title: '상품 관리', items: ['상품/옵션/용량/가격', '재고/품절 상태', '추천 태그 관리'] },
    { title: '주문 처리', items: ['주문 목록', '배송 송장', '취소/환불 상태'] },
    { title: '정산', items: ['월별 매출', '할인/배송비/환불 반영', '정산 예정금'] },
  ] },
  { kicker: '법적 리스크 관리', title: 'AI 추천은 “진단/치료/처방”이 아니라 “영양 후보 추천”으로 제한합니다', subtitle: '신뢰를 만들되 과장 광고와 의료 행위처럼 보이는 표현은 피합니다.', cards: [
    { title: '금지 표현', items: ['AI가 진단했습니다', '이 사료로 치료됩니다', '수의사 처방 없이 먹이면 됩니다'] },
    { title: '권장 표현', items: ['기록 기반 사료 후보', '영양 관리에 참고', '질환/처방식은 수의사 상담 권장'] },
    { title: '운영 장치', items: ['일반식/기능성/상담권장 분리', '카탈로그 안에서만 추천', '추천 근거와 주의 문구 표시'] },
  ] },
  { kicker: '단계별 실행', title: '초기 목표는 “추천 판매”와 “정기배송” 검증입니다', subtitle: '병원 연계는 신뢰 보조 기능으로 붙이고, 커머스 매출 검증을 먼저 합니다.', cards: [
    { title: '1단계', items: ['로얄캐닌 카탈로그 구축', '구매자 쇼핑', '총판 전용 상품/주문 관리'] },
    { title: '2단계', items: ['AI 추천 엔진', '급여량/소진일 계산', '추천 로그 분석'] },
    { title: '3단계', items: ['정기배송 빌링', '정산 자동화', '병원 문서/추천 신뢰 보조'] },
  ] },
  { kicker: '제안', title: '총판과 PawDex가 같이 검증할 첫 KPI', subtitle: '처음부터 큰 범위를 잡기보다 4~6주 안에 구매 전환 지표를 확인합니다.', cards: [
    { title: '상품', items: ['대표 라인업 20~40개부터 시작', '용량/가격/재고 정확도 확보', '추천 태그 정리'] },
    { title: '전환', items: ['추천 클릭률', '상품 상세 전환율', '첫 구매율'] },
    { title: '반복', items: ['정기배송 신청률', '재구매 주기', '품절/배송 CS 비율'] },
  ], note: '총판의 가격 경쟁력과 PawDex의 기록 기반 추천이 만나야 단순 쇼핑몰과 다른 이유가 생깁니다.' },
];

const hospitalSlides = [
  { type: 'title', accent: '#08798D', kicker: 'PawDex 병원 관계자 제안', title: '보호자 앱으로 검사결과·예약·기록 공유를 연결합니다', subtitle: '병원은 문서 발송과 예약 관리를 줄이고, 보호자는 받은 서류를 잃어버리지 않고 응급 상황에도 바로 보여줄 수 있습니다.', cta: '병원 미팅용' },
  { kicker: '현재 불편', title: '검사결과를 메일로 보내면 보호자도 병원도 다시 찾기 어렵습니다', subtitle: '메일, 카톡, 종이 서류는 반려동물별 기록으로 남지 않아 재문의와 재발송이 반복됩니다.', cards: [
    { title: '보호자 문제', items: ['메일함에서 파일 재검색', '다른 병원 방문 시 설명 반복', '검사결과와 진료기록이 분리됨'] },
    { title: '병원 문제', items: ['재발송 문의 증가', '예약 목적 파악 어려움', '초진/재진 문진 시간이 길어짐'] },
    { title: 'PawDex 해결', items: ['앱 문서함 수신', '반려동물 기록 연결', 'QR/링크로 응급 공유'] },
  ] },
  { type: 'flow', kicker: '문서 전송 UX', title: '병원에서 보낸 서류는 보호자 앱 문서함에 자동 정리됩니다', subtitle: '원본은 문서함에 저장하고, 필요한 건강기록에 연결하는 구조입니다.', steps: [
    { title: '병원 업로드', text: '검사결과, 진단서, 소견서, 처방 안내' },
    { title: '보호자 알림', text: 'A병원에서 새 문서 도착' },
    { title: '문서함 저장', text: '병원별/날짜별 원본 보관' },
    { title: '기록 연결', text: '새 진료기록 또는 기존 기록에 연결' },
    { title: '열람/공유', text: '앱에서 확인, QR/링크/PDF 내보내기' },
    { title: '재방문 활용', text: '담당 수의사가 이전 기록을 빠르게 파악' },
  ], note: '보호자 첨부파일과 병원 발송 문서는 분리해서 보여주므로 기록 화면이 복잡해지지 않습니다.' },
  { kicker: '병원찾기 개편', title: '제휴 병원은 지도에서 기능형 홍보가 가능합니다', subtitle: '단순 광고가 아니라 PawDex에서 실제로 예약·문서수신·기록공유가 가능한 병원으로 표시됩니다.', cards: [
    { title: '지도 표시', items: ['제휴 병원 마커/배지', '리스트 우선 노출', '전문 진료/소개 표시'] },
    { title: '하단 패널', items: ['예약 요청', '기록 공유', '받은 문서', '전화/길찾기'] },
    { title: '보호자 신뢰', items: ['앱으로 문서 받는 병원', '기록 공유 가능한 병원', '재방문 편의가 높은 병원'] },
  ] },
  { kicker: '예약 기능', title: '처음 예약은 간단한 “요청/확정”부터 시작합니다', subtitle: 'EMR 전체를 대체하지 않고, 보호자가 구조화된 예약 요청을 보내는 범위부터 검증합니다.', cards: [
    { title: '보호자 입력', items: ['날짜/시간 희망', '진료 목적', '담당 수의사 선택', '기록 공유 여부'] },
    { title: '병원 처리', items: ['요청 확인', '확정/변경/취소', '보호자 알림 발송'] },
    { title: '확장 가능', items: ['의사별 슬롯', '재진 리마인드', '수술/검진 예약 분리'] },
  ] },
  { kicker: '비계약 병원 대응', title: '계약 병원이 아니어도 보호자가 기록을 보여줄 수 있어야 합니다', subtitle: '이 기능이 있어야 PawDex는 병원 영업 전에도 보호자에게 실사용 가치가 생깁니다.', cards: [
    { title: '계약 병원', items: ['병원 웹에서 문서 발송', '보호자 동의 기록 열람', '예약/담당 수의사 관리'] },
    { title: '비계약 병원', items: ['보호자 QR/임시 링크', 'PDF 내보내기', '최근 기록만 제한 공유'] },
    { title: '보안 원칙', items: ['24시간 만료', '공유 철회', '열람 로그', '보호자 동의 기반'] },
  ] },
  { kicker: '병원이 얻는 가치', title: '업무 부담은 줄이고, 보호자 접점은 늘립니다', subtitle: '병원 입장에서는 문서 발송/예약/홍보가 하나의 채널로 정리됩니다.', cards: [
    { title: 'CS 감소', items: ['검사결과 재발송 감소', '주의사항 반복 설명 감소', '예약 목적 사전 파악'] },
    { title: '재방문 강화', items: ['다음 예약 알림', '담당 수의사 기반 관리', '병원 문서함에 병원명 지속 노출'] },
    { title: '홍보 효과', items: ['제휴 병원 배지', '지도/리스트 우선 노출', '전문 진료와 이벤트 표시'] },
  ] },
  { kicker: '도입 방식', title: 'A 병원 1곳과 깊게 검증하는 것이 가장 빠릅니다', subtitle: '처음부터 여러 병원을 붙이면 교육, CS, 권한 관리가 커집니다. 한 병원에서 실제 흐름을 완성해야 합니다.', cards: [
    { title: '1단계', items: ['병원 계정 생성', '문서 업로드/전송', '보호자 앱 수신'] },
    { title: '2단계', items: ['예약 요청/확정', '기록 공유 동의', '문서함/기록 연결'] },
    { title: '3단계', items: ['담당 수의사', '리마인드', '병원 소개/홍보 영역'] },
  ] },
  { kicker: '제안', title: '병원 MVP에서 확인할 KPI', subtitle: '도입 여부는 기능 수보다 병원 업무가 실제로 줄어드는지로 판단해야 합니다.', cards: [
    { title: '문서', items: ['앱 발송 건수', '보호자 열람률', '재발송 문의 감소'] },
    { title: '예약', items: ['예약 요청 건수', '확정까지 걸린 시간', '노쇼/변경률'] },
    { title: '보호자', items: ['문서함 재방문', '기록 공유 사용률', '병원 재방문 연결'] },
  ], note: 'PawDex 병원 기능은 EMR 대체가 아니라 보호자와 병원 사이의 문서·예약·기록 공유 채널입니다.' },
];

function makeDeck(name, slides) {
  const buildDir = path.join(tmpRoot, name);
  rm(buildDir);
  ensureDir(buildDir);
  for (const [relPath, content] of Object.entries(commonFiles)) {
    const file = path.join(buildDir, relPath);
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, content, 'utf8');
  }
  fs.writeFileSync(path.join(buildDir, '[Content_Types].xml'), contentTypes(slides.length), 'utf8');
  ensureDir(path.join(buildDir, 'ppt', 'slides'));
  ensureDir(path.join(buildDir, 'ppt', 'slides', '_rels'));
  ensureDir(path.join(buildDir, 'ppt', '_rels'));
  fs.writeFileSync(path.join(buildDir, 'ppt', 'presentation.xml'), presentationXml(slides.length), 'utf8');
  fs.writeFileSync(path.join(buildDir, 'ppt', '_rels', 'presentation.xml.rels'), presentationRels(slides.length), 'utf8');
  slides.forEach((slide, i) => {
    const n = i + 1;
    fs.writeFileSync(path.join(buildDir, 'ppt', 'slides', `slide${n}.xml`), slideXml(slide, n), 'utf8');
    fs.writeFileSync(path.join(buildDir, 'ppt', 'slides', '_rels', `slide${n}.xml.rels`), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`, 'utf8');
  });

  ensureDir(outDir);
  const outFile = path.join(outDir, `${name}.pptx`);
  const zipFile = path.join(outDir, `${name}.zip`);
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
  const ps = `
    Add-Type -AssemblyName System.IO.Compression;
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    $src = '${buildDir}';
    $dest = '${zipFile}';
    if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Force }
    $zip = [System.IO.Compression.ZipFile]::Open($dest, [System.IO.Compression.ZipArchiveMode]::Create);
    try {
      Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($src.Length + 1).Replace([char]92, '/');
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null;
      }
    } finally {
      $zip.Dispose();
    }
  `;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  fs.renameSync(zipFile, outFile);
  return outFile;
}

const distributor = makeDeck('pawdex-royalcanin-distributor-pitch', distributorSlides);
const hospital = makeDeck('pawdex-hospital-partner-pitch', hospitalSlides);
console.log(`created: ${distributor}`);
console.log(`created: ${hospital}`);
