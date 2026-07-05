/**
 * 검사 수치(Lab) — analyte 카탈로그 + 검사 템플릿 (코드 상수, DB 아님).
 *
 * 핵심 원칙:
 *  - 하나의 analyte 는 하나의 `key`. 여러 템플릿에 속해도 key 는 하나 → 저장/추이 dedup.
 *  - 입력폼은 열린 템플릿들의 analyte 를 key 기준 union 으로 렌더(중복 입력칸 방지).
 *  - defaultUnit 은 "미리 채워주는 기본값"일 뿐, 사용자가 결과지 기준으로 수정 가능.
 *  - valueType: 'numeric'(숫자·추이 가능) / 'semi_quantitative'(+·++·Trace 등) / 'text'(있음/없음 등).
 *  - graphable: 추이 그래프 후보 여부(대개 numeric=true). 실제 그래프는 value_numeric 존재 + 같은 단위 기준.
 *  - ⚠️ 정상/위험/악화 판단은 앱이 하지 않는다. 참고범위는 사용자가 입력한 값만 표시.
 *  - ⚠️ 항목명·기본단위는 수의학 레퍼런스로 검수 필요(콘텐츠 정확도).
 */

export type LabTemplateKey =
  | 'cbc'
  | 'liver'
  | 'kidney'
  | 'urine'
  | 'electrolyte'
  | 'endocrine'
  | 'pancreas_gi'
  | 'cardiac'
  | 'inflammation'
  | 'custom';

export type LabValueType = 'numeric' | 'semi_quantitative' | 'text';

export interface LabTemplate {
  key: LabTemplateKey;
  labelKo: string;
  labelEn: string;
  emoji: string;
  /** 입력폼 기본 노출(true) vs "추가 검사"로 접힘(false). custom 은 항상 맨 끝. */
  defaultOpen: boolean;
}

export interface LabAnalyte {
  key: string;
  labelKo: string;
  labelEn: string;
  defaultUnit: string;
  templates: LabTemplateKey[];
  valueType: LabValueType;
  graphable: boolean;
  aliases?: string[];
}

// 기본 노출 5개(cbc·liver·kidney·urine·electrolyte) + 접힘 4개(endocrine·pancreas_gi·cardiac·inflammation) + 직접추가.
export const LAB_TEMPLATES: LabTemplate[] = [
  { key: 'cbc',                 labelKo: '혈액검사',      labelEn: 'CBC',              emoji: '🩸', defaultOpen: true },
  { key: 'liver',               labelKo: '간 수치',        labelEn: 'Liver',            emoji: '🫀', defaultOpen: true },
  { key: 'kidney',              labelKo: '신장 수치',      labelEn: 'Kidney',           emoji: '🫘', defaultOpen: true },
  { key: 'urine',               labelKo: '소변검사',       labelEn: 'Urinalysis',       emoji: '💧', defaultOpen: true },
  { key: 'electrolyte',         labelKo: '전해질',         labelEn: 'Electrolytes',     emoji: '🧂', defaultOpen: true },
  { key: 'endocrine',           labelKo: '혈당·호르몬',    labelEn: 'Endocrine',        emoji: '🍬', defaultOpen: false },
  { key: 'pancreas_gi',         labelKo: '췌장·소화기',    labelEn: 'Pancreas/GI',      emoji: '🥞', defaultOpen: false },
  { key: 'cardiac',             labelKo: '심장 지표',      labelEn: 'Cardiac',          emoji: '❤️', defaultOpen: false },
  { key: 'inflammation',        labelKo: '염증 수치',      labelEn: 'Inflammation',     emoji: '🔥', defaultOpen: false },
  { key: 'custom',              labelKo: '직접 추가',      labelEn: 'Custom',           emoji: '➕', defaultOpen: false },
];

const N: LabValueType = 'numeric';
const SQ: LabValueType = 'semi_quantitative';
const TXT: LabValueType = 'text';

// ⚠️ 기본단위는 검수 대상(랩마다 다를 수 있음). 사용자가 수정 가능하도록 defaultUnit 은 어디까지나 기본값.
export const LAB_ANALYTES: LabAnalyte[] = [
  // ── A. 혈액검사 CBC ──
  { key: 'WBC',   labelKo: '백혈구',        labelEn: 'WBC',        defaultUnit: 'K/µL', templates: ['cbc', 'inflammation'], valueType: N, graphable: true, aliases: ['White Blood Cell'] },
  { key: 'NEU',   labelKo: '호중구',        labelEn: 'NEU',        defaultUnit: 'K/µL', templates: ['cbc', 'inflammation'], valueType: N, graphable: true, aliases: ['Neutrophil', 'Neutrophils', 'SEG'] },
  { key: 'LYM',   labelKo: '림프구',        labelEn: 'LYM',        defaultUnit: 'K/µL', templates: ['cbc'], valueType: N, graphable: true, aliases: ['Lymphocyte', 'Lymphocytes'] },
  { key: 'MONO',  labelKo: '단핵구',        labelEn: 'MONO',       defaultUnit: 'K/µL', templates: ['cbc'], valueType: N, graphable: true, aliases: ['Monocyte', 'Monocytes'] },
  { key: 'EOS',   labelKo: '호산구',        labelEn: 'EOS',        defaultUnit: 'K/µL', templates: ['cbc'], valueType: N, graphable: true, aliases: ['Eosinophil', 'Eosinophils'] },
  { key: 'RBC',   labelKo: '적혈구',        labelEn: 'RBC',        defaultUnit: 'M/µL', templates: ['cbc'], valueType: N, graphable: true, aliases: ['Red Blood Cell'] },
  { key: 'HGB',   labelKo: '혈색소',        labelEn: 'HGB',        defaultUnit: 'g/dL', templates: ['cbc'], valueType: N, graphable: true, aliases: ['Hemoglobin', 'HB'] },
  { key: 'HCT',   labelKo: '적혈구용적률',  labelEn: 'HCT / PCV',  defaultUnit: '%',    templates: ['cbc'], valueType: N, graphable: true, aliases: ['Hematocrit', 'PCV'] },
  { key: 'MCV',   labelKo: '평균적혈구용적', labelEn: 'MCV',       defaultUnit: 'fL',   templates: ['cbc'], valueType: N, graphable: true },
  { key: 'MCHC',  labelKo: '평균혈색소농도', labelEn: 'MCHC',      defaultUnit: 'g/dL', templates: ['cbc'], valueType: N, graphable: true },
  { key: 'PLT',   labelKo: '혈소판',        labelEn: 'PLT',        defaultUnit: 'K/µL', templates: ['cbc'], valueType: N, graphable: true, aliases: ['Platelet', 'Platelets'] },

  // ── B. 간 수치 ──
  { key: 'ALT',   labelKo: 'ALT',      labelEn: 'ALT',            defaultUnit: 'U/L',    templates: ['liver'], valueType: N, graphable: true, aliases: ['GPT', 'SGPT'] },
  { key: 'AST',   labelKo: 'AST',      labelEn: 'AST',            defaultUnit: 'U/L',    templates: ['liver'], valueType: N, graphable: true, aliases: ['GOT', 'SGOT'] },
  { key: 'ALP',   labelKo: 'ALP',      labelEn: 'ALP',            defaultUnit: 'U/L',    templates: ['liver'], valueType: N, graphable: true, aliases: ['ALKP'] },
  { key: 'GGT',   labelKo: 'GGT',      labelEn: 'GGT',            defaultUnit: 'U/L',    templates: ['liver'], valueType: N, graphable: true },
  { key: 'TBIL',  labelKo: '총 빌리루빈',  labelEn: 'Total Bilirubin', defaultUnit: 'mg/dL',  templates: ['liver'], valueType: N, graphable: true, aliases: ['Bilirubin', 'T-BIL', 'TBil'] },
  { key: 'ALB',   labelKo: '알부민',    labelEn: 'Albumin',        defaultUnit: 'g/dL',   templates: ['liver'], valueType: N, graphable: true },
  { key: 'TP',    labelKo: '총단백',    labelEn: 'Total Protein',  defaultUnit: 'g/dL',   templates: ['liver'], valueType: N, graphable: true, aliases: ['TPROT'] },
  { key: 'GLOB',  labelKo: '글로불린',  labelEn: 'Globulin',       defaultUnit: 'g/dL',   templates: ['liver'], valueType: N, graphable: true },
  { key: 'CHOL',  labelKo: '콜레스테롤', labelEn: 'Cholesterol',   defaultUnit: 'mg/dL',  templates: ['liver'], valueType: N, graphable: true },
  { key: 'BA',    labelKo: '담즙산',    labelEn: 'Bile Acid',      defaultUnit: 'µmol/L', templates: ['liver'], valueType: N, graphable: true },

  // ── C. 신장 수치 ── (전해질과 겹치는 항목은 templates 에 둘 다)
  { key: 'BUN',   labelKo: '요소질소',   labelEn: 'BUN',          defaultUnit: 'mg/dL',  templates: ['kidney'], valueType: N, graphable: true, aliases: ['Urea', 'Blood Urea Nitrogen', 'UREA'] },
  { key: 'CREA',  labelKo: '크레아티닌', labelEn: 'CREA',          defaultUnit: 'mg/dL',  templates: ['kidney'], valueType: N, graphable: true, aliases: ['Creatinine', 'Cr', 'CREAT', 'CRE'] },
  { key: 'SDMA',  labelKo: 'SDMA',      labelEn: 'SDMA',          defaultUnit: 'µg/dL',  templates: ['kidney'], valueType: N, graphable: true },
  { key: 'PHOS',  labelKo: '인',        labelEn: 'Phos',          defaultUnit: 'mg/dL',  templates: ['kidney', 'electrolyte'], valueType: N, graphable: true, aliases: ['Phosphorus', 'P', 'PHOSPHATE'] },
  { key: 'CA',    labelKo: '칼슘',      labelEn: 'Ca',            defaultUnit: 'mg/dL',  templates: ['kidney', 'electrolyte'], valueType: N, graphable: true, aliases: ['Calcium'] },
  { key: 'K',     labelKo: '칼륨',      labelEn: 'K',             defaultUnit: 'mEq/L',  templates: ['kidney', 'electrolyte'], valueType: N, graphable: true, aliases: ['Potassium'] },
  { key: 'NA',    labelKo: '나트륨',    labelEn: 'Na',            defaultUnit: 'mEq/L',  templates: ['kidney', 'electrolyte'], valueType: N, graphable: true, aliases: ['Sodium'] },
  { key: 'CL',    labelKo: '염소',      labelEn: 'Cl',            defaultUnit: 'mEq/L',  templates: ['kidney', 'electrolyte'], valueType: N, graphable: true, aliases: ['Chloride'] },
  { key: 'USG',   labelKo: '요비중',    labelEn: 'USG',           defaultUnit: '',       templates: ['kidney', 'urine'], valueType: N, graphable: true, aliases: ['Specific Gravity', 'SG'] },
  { key: 'UPC',   labelKo: '요단백/크레아티닌비', labelEn: 'UPC', defaultUnit: '',       templates: ['kidney', 'urine'], valueType: N, graphable: true, aliases: ['UPCR', 'Protein/Creatinine'] },
  { key: 'BP',    labelKo: '혈압',      labelEn: 'BP',            defaultUnit: 'mmHg',  templates: ['kidney', 'cardiac'], valueType: N, graphable: true, aliases: ['Blood Pressure', 'SBP'] },

  // ── D. 소변검사 ── (USG·UPC 는 위에서 공유)
  { key: 'URINE_PH',      labelKo: 'pH',       labelEn: 'pH',        defaultUnit: '',   templates: ['urine'], valueType: N,   graphable: true },
  { key: 'URINE_PROTEIN', labelKo: '요단백',   labelEn: 'Protein',   defaultUnit: '',   templates: ['urine'], valueType: SQ,  graphable: false },
  { key: 'URINE_GLU',     labelKo: '요당',     labelEn: 'Glucose',   defaultUnit: '',   templates: ['urine'], valueType: SQ,  graphable: false },
  { key: 'URINE_KET',     labelKo: '케톤',     labelEn: 'Ketone',    defaultUnit: '',   templates: ['urine'], valueType: SQ,  graphable: false },
  { key: 'URINE_BLD',     labelKo: '잠혈',     labelEn: 'Blood',     defaultUnit: '',   templates: ['urine'], valueType: SQ,  graphable: false },
  { key: 'URINE_BIL',     labelKo: '빌리루빈(뇨)', labelEn: 'Bilirubin', defaultUnit: '', templates: ['urine'], valueType: SQ, graphable: false },
  { key: 'URINE_WBC',     labelKo: '백혈구(뇨)',  labelEn: 'WBC (urine)', defaultUnit: '/HPF', templates: ['urine'], valueType: N, graphable: false },
  { key: 'URINE_RBC',     labelKo: '적혈구(뇨)',  labelEn: 'RBC (urine)', defaultUnit: '/HPF', templates: ['urine'], valueType: N, graphable: false },
  { key: 'URINE_CRYSTAL', labelKo: '결정',     labelEn: 'Crystal',   defaultUnit: '',   templates: ['urine'], valueType: TXT, graphable: false },
  { key: 'URINE_BACT',    labelKo: '세균',     labelEn: 'Bacteria',  defaultUnit: '',   templates: ['urine'], valueType: TXT, graphable: false },
  { key: 'URINE_CAST',    labelKo: '원주',     labelEn: 'Casts',     defaultUnit: '/LPF', templates: ['urine'], valueType: N, graphable: false },
  { key: 'URINE_EPI',     labelKo: '상피세포',  labelEn: 'Epithelial', defaultUnit: '/HPF', templates: ['urine'], valueType: N, graphable: false },

  // ── E. 전해질 ── (Na·K·Cl·Ca·Phos 는 신장과 공유)
  { key: 'MG',    labelKo: '마그네슘',   labelEn: 'Mg',            defaultUnit: 'mg/dL', templates: ['electrolyte'], valueType: N, graphable: true, aliases: ['Magnesium'] },
  { key: 'TCO2',  labelKo: '중탄산염',   labelEn: 'TCO2',          defaultUnit: 'mEq/L', templates: ['electrolyte'], valueType: N, graphable: true, aliases: ['HCO3', 'Bicarbonate'] },

  // ── F. 췌장·소화기 ──
  { key: 'AMYL',  labelKo: '아밀라아제',  labelEn: 'Amylase',       defaultUnit: 'U/L',  templates: ['pancreas_gi'], valueType: N, graphable: true, aliases: ['AMY'] },
  { key: 'LIP',   labelKo: '리파아제',    labelEn: 'Lipase',        defaultUnit: 'U/L',  templates: ['pancreas_gi'], valueType: N, graphable: true, aliases: ['LIPA'] },
  // ⚠️ amylase/lipase·fPL/cPL 은 췌장염 "판정"이 아니라 결과지 수치 기록용. 라벨을 진단처럼 쓰지 않는다(MSD: 아밀/리파제는 췌장염 민감도·특이도 한계).
  { key: 'FPL',   labelKo: 'Spec fPL',    labelEn: 'Spec fPL',      defaultUnit: 'µg/L', templates: ['pancreas_gi'], valueType: N, graphable: true, aliases: ['fPL', 'Spec fPL'] },
  { key: 'CPL',   labelKo: 'Spec cPL',    labelEn: 'Spec cPL',      defaultUnit: 'µg/L', templates: ['pancreas_gi'], valueType: N, graphable: true, aliases: ['cPL', 'Spec cPL'] },
  { key: 'TLI',   labelKo: 'TLI',        labelEn: 'TLI',           defaultUnit: 'µg/L', templates: ['pancreas_gi'], valueType: N, graphable: true },
  { key: 'COB',   labelKo: 'B12',         labelEn: 'Cobalamin',     defaultUnit: 'ng/L', templates: ['pancreas_gi'], valueType: N, graphable: true, aliases: ['B12', 'Vitamin B12'] },
  { key: 'FOL',   labelKo: '엽산',        labelEn: 'Folate',        defaultUnit: 'µg/L', templates: ['pancreas_gi'], valueType: N, graphable: true },

  // ── G. 당·호르몬 ──
  { key: 'GLU',   labelKo: '혈당',        labelEn: 'Glucose',       defaultUnit: 'mg/dL',   templates: ['endocrine'], valueType: N, graphable: true, aliases: ['GLUC', 'Blood Glucose'] },
  { key: 'FRUC',  labelKo: '프럭토사민',   labelEn: 'Fructosamine',  defaultUnit: 'µmol/L',  templates: ['endocrine'], valueType: N, graphable: true },
  { key: 'T4',    labelKo: '총 T4',        labelEn: 'Total T4',      defaultUnit: 'µg/dL',   templates: ['endocrine'], valueType: N, graphable: true, aliases: ['T4', 'TT4'] },
  { key: 'FT4',   labelKo: '유리 T4',      labelEn: 'Free T4',       defaultUnit: 'ng/dL',   templates: ['endocrine'], valueType: N, graphable: true, aliases: ['fT4'] },
  { key: 'TSH',   labelKo: 'TSH',         labelEn: 'TSH',           defaultUnit: 'ng/mL',   templates: ['endocrine'], valueType: N, graphable: true },
  { key: 'CORT',  labelKo: '코르티솔',     labelEn: 'Cortisol',      defaultUnit: 'µg/dL',   templates: ['endocrine'], valueType: N, graphable: true },

  // ── H. 심장·염증 지표 ── (WBC·NEU·BP 는 위에서 공유)
  { key: 'NTPROBNP', labelKo: 'NT-proBNP', labelEn: 'NT-proBNP',    defaultUnit: 'pmol/L', templates: ['cardiac'], valueType: N, graphable: true, aliases: ['proBNP'] },
  { key: 'TROPI',    labelKo: '트로포닌 I',  labelEn: 'Troponin I',  defaultUnit: 'ng/mL',  templates: ['cardiac'], valueType: N, graphable: true, aliases: ['cTnI'] },
  { key: 'HR',       labelKo: '심박수',     labelEn: 'Heart Rate',   defaultUnit: 'bpm',    templates: ['cardiac'], valueType: N, graphable: true },
  { key: 'CRP',      labelKo: 'CRP',       labelEn: 'CRP',          defaultUnit: 'mg/L',   templates: ['inflammation'], valueType: N, graphable: true },
  { key: 'SAA',      labelKo: 'SAA',       labelEn: 'SAA',          defaultUnit: 'µg/mL',  templates: ['inflammation'], valueType: N, graphable: true },
  { key: 'FIB',      labelKo: '피브리노겐',  labelEn: 'Fibrinogen',   defaultUnit: 'mg/dL',  templates: ['inflammation'], valueType: N, graphable: true },
];

const ANALYTE_BY_KEY: Record<string, LabAnalyte> = Object.fromEntries(LAB_ANALYTES.map((a) => [a.key, a]));

export function getAnalyte(key: string): LabAnalyte | undefined {
  return ANALYTE_BY_KEY[key];
}

/** 표시 라벨 — 영어 로케일은 영문만, 그 외엔 "영어 (한글)"(영/한 같으면 하나만). */
export function analyteDisplay(a: { labelEn: string; labelKo: string }, locale?: string): string {
  if (locale === 'en') return a.labelEn;
  return a.labelEn === a.labelKo ? a.labelEn : `${a.labelEn} (${a.labelKo})`;
}

/** 템플릿(카테고리) 라벨 — 로케일별. */
export function templateLabel(t: { labelKo: string; labelEn: string }, locale?: string): string {
  return locale === 'en' ? t.labelEn : t.labelKo;
}

/**
 * 열린 템플릿들에 속한 analyte 를 key 기준 union(dedup)으로 반환 — 입력폼 렌더용.
 * 카탈로그 정의 순서를 유지해 화면 순서가 안정적.
 */
export function analytesForTemplates(openKeys: LabTemplateKey[]): LabAnalyte[] {
  const open = new Set(openKeys);
  const seen = new Set<string>();
  const out: LabAnalyte[] = [];
  for (const a of LAB_ANALYTES) {
    if (seen.has(a.key)) continue;
    if (a.templates.some((t) => open.has(t))) {
      seen.add(a.key);
      out.push(a);
    }
  }
  return out;
}

/** value_raw 문자열 → 그래프용 숫자. 깔끔히 숫자로 안 떨어지면(<0.1, Negative 등) null → 비그래프. */
export function parseNumeric(raw: string): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  // '<0.1', '>100' 처럼 부등호가 붙은 값은 추이 왜곡 방지로 비그래프 처리.
  if (/[<>]/.test(raw)) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
