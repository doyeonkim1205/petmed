# PawDex i18n 문자열 인벤토리

> PawDex 코드베이스의 한국어 하드코딩 문자열을 14개 도메인으로 나눠 read-only 추출한 인벤토리입니다.
> next-intl 도입을 위한 사전 조사 자료이며, 이 문서 자체는 코드 변경을 포함하지 않습니다.
> 분류 4종: **UI** / **AI 프롬프트** / **법적 문서** / **개발자 내부**
> 우선순위: **P0**(핵심 사용자 경로) / **P1**(보조 UI·에러) / **P2**(저빈도·플레이스홀더) / **제외**(개발자 내부)

---

## 1. 요약표 (도메인 × 분류)

| 도메인 | UI | AI 프롬프트 | 법적 문서 | 개발자 내부 | P0 건수 | 합계 |
|---|---:|---:|---:|---:|---:|---:|
| auth-onboarding (인증·온보딩) | 51 | 0 | 2 | 1 | 15 | 54 |
| home (홈) | 36 | 0 | 0 | 9 | 24 | 45 |
| records-core (기록 핵심) | 195 | 0 | 0 | 0 | 30 | 195 |
| records-modules (기록 모듈) | 145 | 0 | 0 | 0 | 15 | 145 |
| record-components (기록 컴포넌트) | 82 | 0 | 0 | 0 | 12 | 82 |
| pets (반려동물) | 20 | 24 | 0 | 5 | 29 | 49 |
| search-ui (검색·분석 UI) | 64 | 8 | 4 | 0 | 33 | 76 |
| ai-data-lib (AI 데이터/라이브러리) | 225 | 106 | 0 | 6 | 36 | 337 |
| ai-api (AI API 라우트) | 14 | 15 | 0 | 0 | 10 | 29 |
| profile-payment (프로필·결제) | 102 | 8 | 4 | 0 | 68 | 114 |
| map (지도) | 22 | 0 | 0 | 0 | 18 | 22 |
| legal (법적 문서) | 4 | 0 | 9 | 0 | 4 | 13 |
| shared-ui (공통 UI) | 37 | 0 | 0 | 0 | 15 | 37 |
| infra-internal (인프라·관리자) | 127 | 18 | 0 | 0 | 13 | 145 |
| **전체 합계** | **1124** | **179** | **21** | **21** | **322** | **1343** |

> 비고: "개발자 내부" 컬럼은 items 배열에 명시적으로 분류된 항목 기준입니다. 각 도메인 `internal_summary` 에 집계된 주석/로그(번역 제외)는 본문 §5 에 도메인별로 별도 요약했습니다.
> **[보정 2026-06-17]** 일부 항목 재분류(사용자 노출 분석/검색 에러·토스트 AI프롬프트→UI, ai-api petLabel 강아지/고양이 UI→AI어휘, vetTerms/diseaseMap 번역필요 O→제외). 분류 컨벤션은 §6 "확정 키 규칙" 기준이 우선이며, 위 도메인별 집계 수치는 보정 전 추출값(근사)입니다.

---

## 2. P0 우선 인벤토리 (가장 중요)

> 첫 진입·핵심 경로에서 사용자에게 즉시 노출되는 문자열. 번역 1순위.

### 2-1. auth-onboarding

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/components/Onboarding.tsx:217 | PawDex는 이브의 치료 경험에서 시작됐어요 | UI | onboarding | 노출O | O | P0 | onboarding.slide1.title | - | 브랜드 스토리 |
| src/components/Onboarding.tsx:218 | 10살 이브가 치료를 받던 시간, 믿을 수 있는 정보와 꾸준한 기록이 꼭 필요했습니다. | UI | onboarding | 노출O | O | P0 | onboarding.slide1.description | - | |
| src/components/Onboarding.tsx:224 | 증상이나 사진으로 AI 분석을 받아보세요 | UI | onboarding | 노출O | O | P0 | onboarding.slide2.title | - | |
| src/components/Onboarding.tsx:225 | 직접 입력하신 증상은 물론, 사진 한 장만으로도 의심 증상과 맞춤 행동 가이드를 알려드려요. | UI | onboarding | 노출O | O | P0 | onboarding.slide2.description | - | |
| src/components/Onboarding.tsx:231 | 핵심만 빠르게, 원문까지 투명하게 | UI | onboarding | 노출O | O | P0 | onboarding.slide3.title | - | |
| src/components/Onboarding.tsx:232 | 관련 논문을 번역·요약해 쉽게 이해하고, 필요하면 원문으로 직접 확인할 수 있어요. | UI | onboarding | 노출O | O | P0 | onboarding.slide3.description | - | |
| src/components/Onboarding.tsx:238 | 오늘의 상태가 내일의 힌트가 되도록 | UI | onboarding | 노출O | O | P0 | onboarding.slide4.title | - | |
| src/components/Onboarding.tsx:239 | 증상·진료 기록을 남기면 캘린더에 반영되어 일정 관리가 쉬워집니다. | UI | onboarding | 노출O | O | P0 | onboarding.slide4.description | - | |
| src/components/Onboarding.tsx:245 | 급한 순간, 덜 헤매도록 | UI | onboarding | 노출O | O | P0 | onboarding.slide5.title | - | |
| src/components/Onboarding.tsx:246 | 지도에서 24시 병원을 빠르게 찾고, 바로 이동할 수 있게 연결해요. | UI | onboarding | 노출O | O | P0 | onboarding.slide5.description | - | |
| src/components/Onboarding.tsx:404 | 시작하기 | UI | onboarding | 노출O | O | P0 | common.start | - | |
| src/app/(auth)/login/page.tsx:114 | 반려동물 건강 케어, | UI | auth | 노출O | O | P0 | login.subtitle1 | - | |
| src/app/(auth)/login/page.tsx:115 | 더 똑똑하게 | UI | auth | 노출O | O | P0 | login.subtitle2 | - | |
| src/app/(auth)/login/page.tsx:135 | 카카오로 시작하기 | UI | auth | 노출O | O | P0 | auth.kakaoSignIn | - | |
| src/app/(auth)/login/page.tsx:148 | Google로 시작하기 | UI | auth | 노출O | X | P0 | auth.googleSignIn | - | 브랜드명 'Google' 유지 |
| src/app/(auth)/login/page.tsx:193 | 로그인 | UI | auth | 노출O | O | P0 | common.signIn | - | |

> 법적: 동일 도메인의 `legal.terms.title`(이용약관), `legal.privacy.title`(개인정보처리방침)도 P0 — §4 참조.

### 2-2. home

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(main)/page.tsx:89 | 건강 기록 | UI | home | 노출O | O | P0 | home.healthRecordSection | - | |
| src/app/(main)/page.tsx:94 | AI 케어 | UI | home | 노출O | O | P0 | home.aiCareSection | - | |
| src/components/home/HealthBriefing.tsx:59 | 소중한 가족을 등록해주세요 | UI | home | 노출O | O | P0 | home.welcomeTitle | - | |
| src/components/home/HealthBriefing.tsx:60 | PawDex 와 함께해요 | UI | home | 노출O | O | P0 | home.welcomeSubtitle | - | |
| src/components/home/HealthBriefing.tsx:100 | 첫 기록을 남겨볼까요? | UI | home | 노출O | O | P0 | home.firstRecordCta | - | |
| src/components/home/HealthBriefing.tsx:196 | 의 소중한 생일을 축하해요 | UI | home | 노출O | O | P0 | home.birthdayGreeting | - | 동적 문자열(이름 결합) |
| src/components/home/HealthBriefing.tsx:235 | 일째 기록이 없어요 — 오늘 {pet.name}는 어땠나요? | UI | home | 노출O | O | P0 | home.noRecordPrompt | - | 변수 보간 |
| src/components/home/HealthBriefing.tsx:244 | 오늘 기록 완료 | UI | home | 노출O | O | P0 | home.recordCompletedToday | - | |
| src/components/home/HealthBriefing.tsx:253 | 마지막 기록 {daysSinceLastRecord}일 전 | UI | home | 노출O | O | P0 | home.lastRecordDaysAgo | - | 복수형 주의 |
| src/components/home/HealthBriefing.tsx:256 | 아직 기록 없음 | UI | home | 노출O | O | P0 | common.noRecordsYet | - | |
| src/components/home/HealthBriefing.tsx:279 | 예약 {dLabel} · {formatShortDate(...)} | UI | home | 노출O | O | P0 | home.appointmentWithDDay | - | 날짜 포맷 |
| src/components/home/HomeBanner.tsx:27 | 오늘의 기록이, 내일의 건강 힌트가 되도록 | UI | home | 노출O | O | P0 | home.bannerPlusTitle | - | |
| src/components/home/HomeBanner.tsx:28 | 진료·증상·일상을 한 곳에 | UI | home | 노출O | O | P0 | home.bannerPlusSubtitle | - | |
| src/components/home/HomeBanner.tsx:35 | AI가 기록을 함께 읽어드려요 | UI | home | 노출O | O | P0 | home.bannerAiTitle | - | |
| src/components/home/HomeBanner.tsx:36 | 우리 아이 건강 기록을 바탕으로 증상을 분석해요 | UI | home | 노출O | O | P0 | home.bannerAiSubtitle | - | |
| src/components/home/HomeMedicationWidget.tsx:114 | 오늘의 약 | UI | home | 노출O | O | P0 | home.medicationTitle | - | |
| src/components/home/HomeMedicationWidget.tsx:101 | 오늘 약을 모두 챙겼어요 | UI | home | 노출O | O | P0 | home.allMedsChecked | - | |
| src/components/home/HomePreventiveWidget.tsx:79 | 예방 관리 | UI | home | 노출O | O | P0 | home.preventiveTitle | - | 다수 도메인 반복 |
| src/components/TrialBanner.tsx:46 | Plus 기능 무료 체험 중 | UI | home | 노출O | O | P0 | home.trialBannerTitle | - | |
| src/components/TrialBanner.tsx:57 | 모든 Plus 기능을 무료로 써보세요! 2026. 05. 13 에 종료돼요 ({days}일 남음) | UI | home | 노출O | O | P0 | home.trialBannerMessage | - | 날짜 하드코딩+복수형 |

### 2-3. records-core

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(main)/records/page.tsx:219 | 기록 | UI | records | 노출O | O | P0 | record.tab.records | - | |
| src/app/(main)/records/page.tsx:220 | 캘린더 | UI | records | 노출O | O | P0 | record.tab.calendar | - | |
| src/app/(main)/records/page.tsx:328 | 반려동물을 등록해주세요 | UI | records | 노출O | O | P0 | record.noPets.title | - | |
| src/app/(main)/records/page.tsx:329 | 건강 기록을 시작하려면 먼저 반려동물을 등록해야 합니다. | UI | records | 노출O | O | P0 | record.noPets.message | - | |
| src/app/(main)/records/add/page.tsx:29 | 증상 기록 | UI | records | 노출O | O | P0 | record.type.symptom | 중복(2곳) | add + [id] |
| src/app/(main)/records/add/page.tsx:30 | 일상 기록 | UI | records | 노출O | O | P0 | record.type.daily | 중복(3곳) | |
| src/app/(main)/records/add/page.tsx:31 | 진료 기록 | UI | records | 노출O | O | P0 | record.type.visit | 중복(2곳) | |
| src/app/(main)/records/add/page.tsx:32 | 입퇴원 | UI | records | 노출O | O | P0 | record.type.hospitalization | 중복(다수) | |
| src/app/(main)/records/add/page.tsx:674 | 기록 추가 | UI | records | 노출O | O | P0 | record.add.title | - | |
| src/app/(main)/records/add/page.tsx:712 | 기본 정보 | UI | records | 노출O | O | P0 | record.section.basicInfo | 중복(2곳) | |
| src/app/(main)/records/add/page.tsx:718 | 반려동물 | UI | records | 노출O | O | P0 | common.pet | 중복(2곳) | |
| src/app/(main)/records/add/page.tsx:877 | 진료 정보 | UI | records | 노출O | O | P0 | record.section.visitInfo | 중복(2곳) | |
| src/app/(main)/records/add/page.tsx:1024 | 투약 정보 | UI | records | 노출O | O | P0 | record.section.medicationInfo | 중복(다수) | |
| src/app/(main)/records/add/page.tsx:1226 | 저장 | UI | records | 노출O | O | P0 | common.save | 중복(다수) | |
| src/app/(main)/records/[id]/page.tsx:40 | 입퇴원 기록 | UI | records | 노출O | O | P0 | record.type.hospitalization | - | |
| src/app/(main)/records/[id]/page.tsx:42 | 일상 | UI | records | 노출O | O | P0 | record.type.daily.short | - | |
| src/app/(main)/records/[id]/page.tsx:184 | 기록 상세 | UI | records | 노출O | O | P0 | record.detail.title | - | |
| src/app/(main)/records/[id]/edit/page.tsx:619 | 기록 수정 | UI | records | 노출O | O | P0 | record.edit.title | - | |

> 그 외 record.type.* / record.section.* P0 항목은 add·[id]·edit 3개 파일에 중복 출현(§3 참조).

### 2-4. records-modules

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(main)/records/meds/page.tsx | 복약 관리 | UI | meds | 노출O | O | P0 | meds.title | - | |
| src/app/(main)/records/meds/page.tsx | 투약 알림 | UI | meds | 노출O | O | P0 | meds.alarmToggle | - | |
| src/app/(main)/records/meds/page.tsx | 투약 알림을 받을까요? | UI | meds | 노출O | O | P0 | meds.pushPromptTitle | - | 푸시 권한 프롬프트 |
| src/app/(main)/records/meds/page.tsx | 설정한 시간에 투약 알림을 보내드려요! 알림을 허용하면 바로 적용돼요 | UI | meds | 노출O | O | P0 | meds.pushPromptMessage | - | |
| src/app/(main)/records/preventive/page.tsx | 예방 관리 | UI | preventive | 노출O | O | P0 | preventive.title | - | |
| src/app/(main)/records/preventive/page.tsx | 예방 알림 | UI | preventive | 노출O | O | P0 | preventive.alarmToggle | - | |
| src/app/(main)/records/preventive/page.tsx | 예방 알림을 받을까요? | UI | preventive | 노출O | O | P0 | preventive.pushPromptTitle | - | |
| src/app/(main)/records/preventive/page.tsx | 예정일에 맞춰 예방 알림을 보내드려요! 알림을 허용하면 바로 적용돼요 | UI | preventive | 노출O | O | P0 | preventive.pushPromptMessage | - | |
| src/app/(main)/records/expenses/page.tsx | 지출 관리 | UI | expenses | 노출O | O | P0 | expenses.title | - | |
| src/app/(main)/records/stats/page.tsx | 건강 통계 | UI | stats | 노출O | O | P0 | stats.title | - | |

### 2-5. record-components (기록 컴포넌트)

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/components/records/ExcretionTracker.tsx:243 | 취소 | UI | common | 노출O | O | P0 | common.cancel | 중복(다수) | |
| src/components/records/ExcretionTracker.tsx:245 | 저장 | UI | common | 노출O | O | P0 | common.save | 중복(다수) | |
| src/components/records/ExcretionTracker.tsx:292 | 삭제 | UI | common | 노출O | O | P0 | common.delete | 중복(다수) | |
| src/components/records/MetricTracker.tsx:392 | 저장 | UI | common | 노출O | O | P0 | common.save | 중복(5곳) | |
| src/components/records/MetricTracker.tsx:393 | 취소 | UI | common | 노출O | O | P0 | common.cancel | 중복(3곳) | |
| src/components/records/MetricTracker.tsx:504 | 삭제 | UI | common | 노출O | O | P0 | common.delete | 중복(2곳) | |

> record-components P0 12건은 대부분 `common.save / common.cancel / common.delete` 공통 액션 버튼의 반복 출현입니다.

### 2-6. pets

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/components/pets/PetFormFields.tsx:41 | 💡 정보를 자세히 입력할수록 AI 증상 분석이 더 정확해져요 | UI | pets | 노출O | O | P0 | pets.hint.detailedInfo | - | |
| src/components/pets/PetFormFields.tsx:47 | 이름 | UI | pets | 노출O | O | P0 | pets.name | - | |
| src/components/pets/PetFormFields.tsx:63 | 강아지 | UI | pets | 노출O | O | P0 | pets.type.dog | 중복(다수) | UI 전용 — AI는 ai.vocab.petType.* 별도 |
| src/components/pets/PetFormFields.tsx:72 | 고양이 | UI | pets | 노출O | O | P0 | pets.type.cat | 중복(다수) | UI 전용 — AI는 ai.vocab.petType.* 별도 |
| src/components/pets/PetFormFields.tsx:89 | 생년월일 (선택) | UI | pets | 노출O | O | P0 | pets.birthDate | - | |
| src/components/pets/PetFormFields.tsx:103 | 성별 (선택) | UI | pets | 노출O | O | P0 | pets.sex | - | |
| src/components/pets/PetFormFields.tsx:126 | 중성화 여부 (선택) | UI | pets | 노출O | O | P0 | pets.neutered | - | |
| src/components/pets/PetFormFields.tsx:151 | 체중 (선택) | UI | pets | 노출O | O | P0 | pets.weight | - | |
| src/components/pets/PetFormFields.tsx:169 | kg | UI | pets | 노출O | X | P0 | common.unit.kg | - | 단위 기호(국제표준) |
| src/components/pets/PetFormFields.tsx:188 | 만성질환 (선택, 쉼표로 구분) | UI | pets | 노출O | O | P0 | pets.chronicConditions | - | |
| src/lib/petForm.ts:69 | 이름을 입력해주세요 | UI | pets | 노출O | O | P0 | pets.validation.nameRequired | - | |
| src/lib/petForm.ts:72 | 체중은 양수로 입력해주세요 (예: 4.2) | UI | pets | 노출O | O | P0 | pets.validation.weightPositive | - | |
| src/lib/petForm.ts:81 | 생년월일은 오늘 이전 날짜로 입력해주세요 | UI | pets | 노출O | O | P0 | pets.validation.birthDatePast | - | |
| src/lib/petContext.ts:213 | [환자 정보] | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.patientInfo | - | AI 프롬프트 |
| src/lib/petContext.ts:217 | 강아지 / 고양이 | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | ai.vocab.petType.dog/cat | 중복 | AI 어휘 — UI `pets.type.*` 와 분리. buildPrompt(locale) |
| src/lib/petContext.ts:222 | 출생 | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.born | - | |
| src/lib/petContext.ts:228 | 중성화 완료 | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.neutered | - | |
| src/lib/petContext.ts:229 | 중성화 안 함 | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.notNeutered | - | |
| src/lib/petContext.ts:243 | [최근 3개월 진료] | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.recentVisits | - | |
| src/lib/petContext.ts:254 | [최근 음수·식사·수분 보충 참고 기록] / [최근 음수·식사 참고 기록] | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.intakeSummary(WithFluid) | - | 조건 분기 |
| src/lib/petContext.ts:285 | [최근 14일 대소변 참고 기록] | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.excretionSummary | - | |
| src/lib/petContext.ts:298 | ※ 제공되지 않은 기록은 ... 증상으로 추정하지 마세요. | AI 프롬프트 | pets | 노출X(응답O) | O | P0 | pets.context.missingDataNotice | - | 프롬프트 가드레일 |

> 라벨 전용 프롬프트 조각(`- 이름: `, `- 나이: ` 등 6건)은 needs_translation=X(포맷 라벨)로 P0이나 번역 불필요.

### 2-7. search-ui

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(main)/search/page.tsx:79 | 검색어 확인 중... | UI | search | 노출O | O | P0 | search.validation.checking | - | |
| src/app/(main)/search/page.tsx:80 | 논문 검색 중... | UI | search | 노출O | O | P0 | search.paper.loading | - | |
| src/app/(main)/search/page.tsx:81 | 논문 정보 가져오는 중... | UI | search | 노출O | O | P0 | search.paper.fetching | - | |
| src/app/(main)/search/page.tsx:82 | AI가 논문을 분석하고 있습니다... | UI | search | 노출O | O | P0 | search.paper.analyzing | - | |
| src/app/(main)/search/page.tsx:706 | 증상 분석 | UI | search | 노출O | O | P0 | search.tab.symptom | - | |
| src/app/(main)/search/page.tsx:719 | 논문 검색 | UI | search | 노출O | O | P0 | search.tab.paper | - | |
| src/app/(main)/search/page.tsx:801 | 증상을 검색하세요 / 질병·키워드를 검색하세요 | UI | search | 노출O | O | P0 | search.placeholder.symptom/disease | - | |
| src/app/(main)/search/page.tsx:896 | AI가 증상을 분석하고 있습니다... | UI | search | 노출O | O | P0 | search.symptom.analyzing | - | |
| src/app/(main)/search/page.tsx:1083 | 이런 증상이면 즉시 병원으로 | UI | search | 노출O | O | P0 | search.symptom.urgentGoToHospital | - | |
| src/app/(main)/search/page.tsx:1084 | 이런 증상이면 24시간 내 병원으로 | UI | search | 노출O | O | P0 | search.symptom.within24hours | - | |
| src/app/(main)/search/page.tsx:1230 | AI 분석은 사진 한 장의 시각 정보만으로 추정한 가능성이며 확진이 아니에요 | 법적 문서 | search | 노출O | O | P0 | legal.aiMedicalDisclaimer | 중복(2곳) | 면책 |
| src/app/(main)/search/photo/page.tsx:295 | 사진 분석 | UI | search | 노출O | O | P0 | search.photo.title | - | |
| src/app/(main)/search/photo/page.tsx:338 | 먼저 반려동물을 등록해 주세요 | UI | search | 노출O | O | P0 | search.photo.registerPetsFirst | - | |
| src/app/(main)/search/photo/page.tsx:382 | 증상 부위 | UI | search | 노출O | O | P0 | search.photo.category | - | |
| src/app/(main)/search/photo/page.tsx:405 | 증상 사진 첨부 | UI | search | 노출O | O | P0 | search.photo.upload | - | |
| src/app/(main)/search/photo/page.tsx:448 | 직접 촬영하기 | UI | search | 노출O | O | P0 | search.photo.takePhoto | - | |
| src/app/(main)/search/photo/page.tsx:457 | 갤러리에서 불러오기 | UI | search | 노출O | O | P0 | search.photo.selectFromGallery | - | |
| src/app/(main)/search/photo/page.tsx:488 | 증상 상세 내용 | UI | search | 노출O | O | P0 | search.photo.description | - | |
| src/app/(main)/search/photo/page.tsx:505 | AI 분석 결과는 참고용입니다! 정확한 진단은 동물병원을 방문해 주세요 | 법적 문서 | search | 노출O | O | P0 | legal.aiAnalysisDisclaimer | - | 면책 |
| src/app/(main)/search/photo/page.tsx:523 | AI가 분석 중이에요... / 사진 분석하기 | UI | search | 노출O | O | P0 | search.photo.analyzing/analyze | - | |
| src/app/(main)/search/photo/page.tsx:720 | 증상이 지속되거나 악화되면 반드시 동물병원에서 진료를 받아주세요 | 법적 문서 | search | 노출O | O | P0 | legal.consultVeterinarian | - | 면책 |
| src/hooks/usePubMedSearch.ts:114 | 오늘의 검색 횟수(...)를 모두 사용했습니다. 밤 12시(자정)에 초기화됩니다. | UI | search | 노출O | O | P0 | search.limit.dailyQuotaExhausted | - | 변수 보간 |
| src/hooks/usePubMedSearch.ts:167 | 논문 검색에 실패했습니다. 네트워크 연결을 확인해주세요. | UI | search | 노출O | O | P0 | search.error.networkFailed | 중복(2곳) | |
| src/hooks/usePubMedSearch.ts:234 | 반려동물 질병이나 증상과 관련된 검색어를 입력해주세요. | UI | search | 노출O | O | P0 | search.error.invalidQuery | - | |
| src/app/(main)/search/page.tsx:480 | 증상 분석에 실패했습니다. 네트워크 연결을 확인해주세요. | UI | analysis | 노출O | O | P0 | analysis.error.networkFailed | 중복(2곳) | 증상분석 에러 → analysis.error.* |
| src/components/PaperSection.tsx:130 | 논문 요약 | UI | search | 노출O | O | P0 | search.paper.summary | - | |
| src/components/PaperSection.tsx:144 | PubMed 연결에 실패했습니다. | UI | search | 노출O | O | P0 | search.error.pubmedFailed | - | |

### 2-8. ai-data-lib

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/lib/vetTerms.ts | 고양이 특발성 방광염 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.felineCystitis | - | |
| src/lib/vetTerms.ts | 만성 신부전 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.chronicKidneyDisease | - | |
| src/lib/vetTerms.ts | 당뇨병 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.diabetes | - | |
| src/lib/vetTerms.ts | 슬개골 탈구 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.patellarLuxation | - | |
| src/lib/vetTerms.ts | 심장사상충 감염 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.heartwormDisease | - | |
| src/lib/vetTerms.ts | 파보바이러스 감염 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.parvovirusInfection | - | |
| src/lib/vetTerms.ts | 위확장-염전증후군 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.gdv | - | |
| src/lib/vetTerms.ts | 아나필락시스 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.anaphylaxis | - | |
| src/lib/vetTerms.ts | 열사병 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.heatStroke | - | |
| src/lib/vetTerms.ts | 급성 신부전 | AI 프롬프트 | vetTerms | 노출X(응답O) | X | 제외 | vetTerms.acuteKidneyInjury | - | |
| src/data/diseaseMap.ts | 만성 신부전 / 급성 신부전 / 당뇨병 / 슬개골 탈구 | AI 프롬프트 | disease | 노출X(응답O) | X | 제외 | disease.* | 중복(vetTerms와) | EN normalize 바이패스(name_en 사용) → 번역 제외 |
| src/data/redFlags.json | 어린·미접종 강아지의 혈변+구토/설사는 파보바이러스 장염...반드시 감별에 포함 | AI 프롬프트 | redFlags | 노출X(응답O) | O | P0 | redFlags.parvo | - | 위험신호 가드 |
| src/data/redFlags.json | 발열·호흡기/소화기 증상 + 신경증상은 디스템퍼...감별에 포함 | AI 프롬프트 | redFlags | 노출X(응답O) | O | P0 | redFlags.distemper | - | |
| src/data/redFlags.json | 어린·미접종 고양이의 고열+구토/설사는 범백혈구감소증...감별에 포함 | AI 프롬프트 | redFlags | 노출X(응답O) | O | P0 | redFlags.panleukopenia | - | |
| src/data/redFlags.json | 고양이의 지속 발열 + 복부 팽만/복수/황달은 전염성 복막염(FIP)...감별에 포함 | AI 프롬프트 | redFlags | 노출X(응답O) | O | P0 | redFlags.fip | - | |
| src/data/redFlags.json | 침흘림 + 삼킴곤란/마비/행동변화는 광견병·디스템퍼...감별에 포함 | AI 프롬프트 | redFlags | 노출X(응답O) | O | P0 | redFlags.neuroRabies | - | |
| src/data/redFlags.json | 고양이의 눈물·눈곱·결막 증상은 허피스바이러스(FHV-1)...반드시 포함 | AI 프롬프트 | redFlags | 노출X(응답O) | O | P0 | redFlags.felineOcularUri | - | |

> **[보정 2026-06-17]** `vetTerms`(KO 보정맵 30개)·`diseaseMap`은 **영어 번역 제외** — EN 모드는 normalize 레이어가 KO 보정을 스킵하고 `name_en`(표준 영문명)을 그대로 사용. 번역이 아니라 `normalizeVetTerm(term, locale)` 분기 작업.
> 단 `redFlags`(응급/감별 가드레일)는 **영어 프롬프트에 주입되는 텍스트**라 영문 프롬프트 세트가 별도로 필요(의학 검수 필수). → 번역필요 O 유지.

### 2-9. ai-api

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/api/symptom-analysis/route.ts:111 | 고양이 | AI 프롬프트 | analysis | 노출X(응답O) | O | P0 | ai.vocab.petType.cat | 중복 | 프롬프트 petLabel 구성 — buildPrompt(locale) |
| src/app/api/symptom-analysis/route.ts:111 | 강아지 | AI 프롬프트 | analysis | 노출X(응답O) | O | P0 | ai.vocab.petType.dog | 중복 | 프롬프트 petLabel 구성 — buildPrompt(locale) |
| src/app/api/symptom-analysis/route.ts:113 | 우리 ${petLabel}가 | UI | analysis | 노출O | O | P0 | record.petPatientLabel | - | 동적 보간 |
| src/app/api/symptom-analysis/route.ts:173 | 당신은 한국 수의학 임상 경험 15년 이상의 보드 인증 수의사입니다. | AI 프롬프트 | analysis | 노출X(응답O) | X | P0 | analysis.systemPromptRoleVet | - | 시스템 프롬프트(한국어 모델 분기) |
| src/app/api/symptom-analysis/route.ts:174 | ${petLabel} 보호자가 설명한 증상을 진료실에서처럼 신중하게 분석합니다. | AI 프롬프트 | analysis | 노출X(응답O) | X | P0 | analysis.systemPromptContext | - | |
| src/app/api/symptom-analysis/route.ts:176 | [책임감과 윤리 — 분석의 기본 자세] | AI 프롬프트 | analysis | 노출X(응답O) | X | P0 | analysis.systemPromptEthics | - | |
| src/app/api/symptom-analysis/route.ts:177 | 보호자는 당신의 분석을 믿고 진료 여부·시점을 결정합니다. | AI 프롬프트 | analysis | 노출X(응답O) | X | P0 | analysis.systemPromptTrust | - | |
| src/app/api/analyze-papers/route.ts:54 | 너는 수의학 논문 분석 전문가야. ...반드시 아래 JSON 형식으로만 응답해. | AI 프롬프트 | analysis | 노출X(응답O) | X | P0 | analysis.paperAnalysisSystemPrompt | - | |
| src/app/api/disease-description/route.ts:84 | 너는 수의학 질병 설명 전문가야. ${petLabel} 보호자가 이해할 수 있도록 간결하게 설명해. | AI 프롬프트 | analysis | 노출X(응답O) | X | P0 | analysis.diseaseDescriptionSystemPrompt | - | |

> AI 시스템 프롬프트는 needs_translation=X(현 한국어 유지)로 표기됐으나, 다국어 응답을 원하면 **locale별 프롬프트 분기**가 필요(§요약 2 참조).

### 2-10. profile-payment

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(main)/profile/page.tsx:70 | 닉네임 변경 | UI | profile | 노출O | O | P0 | profile.nickname.title | - | |
| src/app/(main)/profile/page.tsx:85 | 취소 | UI | profile | 노출O | O | P0 | common.cancel | 중복(6곳) | |
| src/app/(main)/profile/page.tsx:91 | 저장 | UI | profile | 노출O | O | P0 | common.save | 중복(3곳) | |
| src/app/(main)/profile/page.tsx:274 | 나의 반려동물 | UI | profile | 노출O | O | P0 | pet.myPets.title | 중복(2곳) | |
| src/app/(main)/profile/page.tsx:359 | 삭제 | UI | profile | 노출O | O | P0 | common.delete | - | |
| src/app/(main)/profile/page.tsx:646 | 확인 | UI | profile | 노출O | O | P0 | common.confirm | 중복(3곳) | |
| src/app/(main)/profile/page.tsx:661 | 닫기 | UI | profile | 노출O | O | P0 | common.close | - | |
| src/app/(main)/profile/page.tsx:789 | 앱 설정 | UI | profile | 노출O | O | P0 | profile.settings.title | - | |
| src/app/(main)/profile/page.tsx:1219 | 프로필 | UI | profile | 노출O | X | P0 | common.profile | - | 영어 'Profile' 동음 유지 가능 |
| src/app/(main)/profile/page.tsx:1261 | 나의 반려동물 | UI | profile | 노출O | O | P0 | pet.myPets | 중복 | |
| src/app/(main)/profile/page.tsx:1285 | 알림 설정 | UI | profile | 노출O | O | P0 | profile.notification.settings | - | |
| src/app/(main)/profile/page.tsx:1296 | 앱 설정 | UI | profile | 노출O | O | P0 | profile.appSettings | - | |
| src/app/(main)/profile/page.tsx:1310 | 구독/결제 관리 | UI | payment | 노출O | O | P0 | payment.subscriptionManagement | 중복(다수) | |
| src/app/(main)/profile/page.tsx:1339 | 로그아웃 | UI | profile | 노출O | O | P0 | common.logout | - | |
| src/app/(main)/profile/saved/page.tsx:93 | 내 보관함 | UI | profile | 노출O | O | P0 | profile.savedAnalyses.title | - | |
| src/app/(main)/profile/subscription/page.tsx:254 | 구독/결제 관리 | UI | payment | 노출O | O | P0 | payment.subscriptionManagement.header | - | |
| src/app/(main)/profile/subscription/page.tsx:262 | 3주 무료 체험 중이에요 | UI | payment | 노출O | O | P0 | payment.trial.active | - | 노출 텍스트(UI 보정) |
| src/app/(main)/profile/subscription/page.tsx:263 | 모든 Plus 기능을 자유롭게 이용하세요 | UI | payment | 노출O | O | P0 | payment.trial.desc | - | |
| src/app/(main)/profile/subscription/page.tsx:265 | 무료 체험 종료 | UI | payment | 노출O | O | P0 | payment.trial.endLabel | - | |
| src/app/(main)/profile/subscription/page.tsx:303 | 결제 옵션 | UI | payment | 노출O | O | P0 | payment.paymentOptions | - | |
| src/app/(main)/profile/subscription/page.tsx:309 | 월간 정기 결제 | UI | payment | 노출O | O | P0 | payment.plan.monthlyRecurring | - | |
| src/app/(main)/profile/subscription/page.tsx:367 | 구독 정보 | UI | payment | 노출O | O | P0 | payment.subscriptionInfo | - | |
| src/app/(main)/profile/subscription/page.tsx:450 | 주요 기능 비교 | UI | payment | 노출O | O | P0 | payment.planComparison.title | - | |
| src/app/(main)/payment/PaymentClient.tsx:119 | 결제 정보 | UI | payment | 노출O | O | P0 | payment.info | - | |
| src/app/(main)/payment/billing-auth/BillingAuthClient.tsx:77 | 자동 갱신 등록 | UI | payment | 노출O | O | P0 | payment.billing.registerTitle | - | |
| src/app/(main)/payment/billing-auth/BillingAuthClient.tsx:128 | 카드 등록하고 시작하기 | UI | payment | 노출O | O | P0 | payment.billing.startButton | - | |

> profile-payment P0 68건은 위 핵심 외에 `common.*` 공통 버튼(취소/저장/확인/닫기) 반복이 다수. 결제 plan/billing 라벨은 통화·날짜 포맷 영향(§요약 5).

### 2-11. map

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(main)/map/page.tsx:103 | 카카오맵 API 키가 설정되지 않았습니다. | UI | map.errors | 노출O | O | P0 | map.error.noApiKey | - | |
| src/app/(main)/map/page.tsx:115 | 지도 로딩이 너무 오래 걸립니다. 네트워크를 확인해 주세요. | UI | map.errors | 노출O | O | P0 | map.error.slowNetwork | - | |
| src/app/(main)/map/page.tsx:130 | 지도를 불러오지 못했어요. 잠시 후 다시 시도해주세요. | UI | map.errors | 노출O | O | P0 | map.error.loadFailed | - | |
| src/app/(main)/map/page.tsx:163 | 지도 SDK 로드에 실패했습니다. 네트워크를 확인해 주세요. | UI | map.errors | 노출O | O | P0 | map.error.sdkLoadFailed | - | |
| src/app/(main)/map/page.tsx:437 | 전체 | UI | map.filters | 노출O | O | P0 | common.all | 중복 | |
| src/app/(main)/map/page.tsx:438 | 24시 병원 | UI | map.filters | 노출O | O | P0 | map.filter.24h | - | |
| src/app/(main)/map/page.tsx:439 | 일반 병원 | UI | map.filters | 노출O | O | P0 | map.filter.normal | - | |
| src/app/(main)/map/page.tsx:459 | 지도를 불러오지 못했어요 | UI | map.errors | 노출O | O | P0 | map.error.title | - | |
| src/app/(main)/map/page.tsx:478 | 지도 로딩 중... | UI | map.loading | 노출O | O | P0 | map.loading.title | - | |
| src/app/(main)/map/page.tsx:499 | 병원명 또는 지역 검색 | UI | map.search | 노출O | O | P0 | map.search.placeholder | - | |
| src/app/(main)/map/page.tsx:552 | 위치 권한이 차단돼 있어요. ...새로고침해주세요. | UI | map.permissions | 노출O | O | P0 | map.permission.deniedNotice | - | 위치권한 |
| src/app/(main)/map/page.tsx:572 | 이 지역 검색 | UI | map.search | 노출O | O | P0 | map.search.researchArea | - | |
| src/app/(main)/map/page.tsx:468 | 다시 시도 | UI | common | 노출O | O | P0 | common.retry | 중복 | |
| src/app/(main)/map/page.tsx:613 | 전화하기 | UI | map.hospital | 노출O | O | P0 | map.action.call | - | |
| src/app/(main)/map/page.tsx:622 | 길찾기 | UI | map.hospital | 노출O | O | P0 | map.action.directions | - | |
| src/app/(main)/map/page.tsx:630 | 상세 | UI | map.hospital | 노출O | O | P0 | map.action.details | - | |
| src/app/(main)/map/page.tsx:263 | 동물병원 | UI | map.search | 노출O | O | P0 | map.search.keyword | - | |

### 2-12. legal (P0 항목)

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(legal)/terms/page.tsx | 이용약관 | 법적 문서 | legal | 노출O | O | P0 | legal.terms.title | - | 제목 |
| src/app/(legal)/privacy/page.tsx | 개인정보처리방침 | 법적 문서 | legal | 노출O | O | P0 | legal.privacy.title | - | 제목 |
| src/app/(legal)/policies/page.tsx | 약관 및 정책 | 법적 문서 | legal | 노출O | O | P0 | legal.policies.title | - | 허브 제목 |
| src/app/(legal)/policies/page.tsx | 이용약관, 개인정보처리방침, 환불 정책, 위치기반서비스 이용약관, 사업자 정보 | 법적 문서 | legal | 노출O | O | P0 | legal.policies.menu | - | 메뉴 라벨 |

> 본문 블록(약관/개인정보/환불/위치약관)은 §4 별도.

### 2-13. shared-ui

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/components/ui/DatePicker.tsx:41 | 날짜 선택 | UI | shared-ui | 노출O | O | P0 | common.selectDate | - | |
| src/components/ConfirmModal.tsx:28 | 취소 | UI | shared-ui | 노출O | O | P0 | common.cancel | 중복 | |
| src/components/layout/Footer.tsx:20 | 검색 | UI | shared-ui | 노출O | O | P0 | nav.search | - | 하단탭 |
| src/components/layout/Footer.tsx:21 | 기록장 | UI | shared-ui | 노출O | O | P0 | nav.records | - | 하단탭 |
| src/components/layout/Footer.tsx:22 | 홈 | UI | shared-ui | 노출O | O | P0 | nav.home | - | 하단탭 |
| src/components/layout/Footer.tsx:23 | 병원 찾기 | UI | shared-ui | 노출O | O | P0 | nav.hospitals | - | 하단탭 |
| src/components/layout/Footer.tsx:24 | 마이페이지 | UI | shared-ui | 노출O | O | P0 | nav.profile | - | 하단탭 |
| src/app/global-error.tsx:30 | 앗, 문제가 발생했어요! | UI | shared-ui | 노출O | O | P0 | error.title | 중복(2곳) | |
| src/app/global-error.tsx:31 | 일시적인 오류일 수 있어요. ...앱을 재실행해주세요. | UI | shared-ui | 노출O | O | P0 | error.message | 중복(2곳) | |
| src/app/global-error.tsx:49 | 다시 시도 | UI | shared-ui | 노출O | O | P0 | common.retry | 중복(3곳) | |
| src/app/(main)/error.tsx:31 | 앗, 잠시 문제가 발생했어요! | UI | shared-ui | 노출O | O | P0 | error.titleMain | - | |
| src/app/(main)/error.tsx:32 | 데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. | UI | shared-ui | 노출O | O | P0 | error.messageMain | - | |
| src/app/(main)/error.tsx:49 | 홈으로 이동 | UI | shared-ui | 노출O | O | P0 | common.goHome | - | |
| src/app/(legal)/error.tsx:30 | 앗, 문제가 발생했어요! | UI | shared-ui | 노출O | O | P0 | error.title | 중복 | |

### 2-14. infra-internal (사용자 노출되는 P0 한정)

| 파일 경로 | 문자열 원문 | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/api/cron/push-notifications/route.ts:559 | 📢 Plus 구독 기간 만료 안내 | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.subscription.expiredTitle | - | 푸시 본문 |
| src/app/api/cron/push-notifications/route.ts:559 | 3일 후 무료 플랜으로 전환됩니다. ...구독 설정을 변경해 주세요. | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.subscription.expiredBody | - | |
| src/app/api/cron/push-notifications/route.ts:571 | 🔄 정기 결제 예정 안내 | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.subscription.recurringTitle | - | |
| src/app/api/cron/push-notifications/route.ts:568 | 3일 후 Plus 구독료가 자동 결제됩니다. | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.subscription.recurringBody | - | |
| src/app/api/cron/push-notifications/route.ts:579 | ✨ Plus 이용 기간 종료 임박 | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.subscription.expiringTitle | - | |
| src/app/api/cron/push-notifications/route.ts:580 | 3일 후 이용 기간이 만료됩니다. ...구독을 갱신해 주세요. | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.subscription.expiringBody | - | |
| src/app/api/cron/auto-billing/route.ts:208 | 🚫 정기 구독 자동 종료 | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.billing.failedTitle | - | |
| src/app/api/cron/auto-billing/route.ts:208 | 결제가 여러 번 거절되어 무료 플랜으로 전환되었습니다. ... | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.billing.failedBody | - | |
| src/app/api/cron/auto-billing/route.ts:238 | 💳 정기 결제 승인 실패 | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.billing.retryTitle | - | |
| src/app/api/cron/auto-billing/route.ts:239 | 카드 거절 등의 사유로 결제가 승인되지 않았습니다. | AI 프롬프트 | push | 노출O(푸시) | O | P0 | push.billing.retryBody | - | |
| src/app/(admin)/admin/dashboard/page.tsx:98 | 대시보드 | UI(관리자) | admin | 노출O(관리자) | O | P0 | admin.sidebar.dashboard | - | 관리자 전용 |

> 푸시 본문은 **서버 cron**에서 생성되므로 사용자 locale을 DB(profiles)에서 읽어 분기해야 함(§요약 2·5). admin.sidebar.* 의 다른 P0 항목(활동 로그/사용자 관리/구독/에러/검색 로그/저장소/알림 발송)은 관리자 전용으로 §3·§5 참조.

---

## 3. P1 인벤토리

> 보조 화면·에러·플레이스홀더·설정. P0 완료 후 진행. 분량이 많아 도메인별 대표 항목으로 정리(원문 다수 항목은 prefix로 묶음).

| 파일 경로 | 문자열 원문(대표) | 분류 | 기능 도메인 | 사용자 노출 | 번역 필요 | 우선순위 | 추천 i18n key | 중복 여부 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| src/app/(auth)/login/page.tsx:57 | 다른 기기에서 로그인하여 이 기기는 자동 로그아웃됐어요. 다시 로그인해주세요. | UI | auth | 노출O | O | P1 | auth.sessionEvicted | - | 세션 축출 |
| src/app/auth/callback/page.tsx:19~80 | 로그인이 취소되었습니다. / 로그인 오류: {errorParam} / 로그인 처리 시간이 초과... / 로그인 처리 중... | UI | auth | 노출O | O | P1 | auth.loginCancelled / loginError / timeout / processingLogin | - | OAuth 콜백 |
| src/components/IosInstallPrompt.tsx:87~182 | PawDex를 앱처럼 사용해 보세요 / 홈 화면에 추가 / Safari 의 공유 버튼을 탭하세요 ... | UI | install | 노출O | O | P1 | install.* | 중복(android와) | 설치 안내 |
| src/components/InAppBrowserHint.tsx, AndroidInAppBrowserHint.tsx | Safari/Chrome 에서 열어주세요 / 주소 복사하기 / 복사됨! ... | UI | browser | 노출O | O | P1 | browser.* | 중복(다수) | 인앱브라우저 우회 |
| src/components/home/HealthTip.tsx:29 | 오늘의 건강 팁 | UI | home | 노출O | O | P1 | home.dailyTipTitle | - | |
| src/components/UpdateToast.tsx:169~176 | 새 버전이 준비됐어요 / 지금 적용 / 적용 중... | UI | home | 노출O | O | P1 | app.newVersionReady / applyNow / applying | - | SW 업데이트 |
| src/components/NetworkStatusBanner.tsx:92~95 | 오프라인 상태입니다. ... / 네트워크가 복구되었습니다! | UI | home | 노출O | O | P1 | app.offlineMessage / networkRecovered | - | |
| src/app/(main)/records/page.tsx (필터·삭제·빈상태) | 전체/증상/진료/입퇴원/일상, 개 선택됨, 개의 기록을 삭제할까요?, 아직 기록이 없습니다. ... | UI | records | 노출O | O | P1 | record.filter.* / record.delete* / record.empty.* | 중복 | 변수 보간 다수 |
| src/app/(main)/records/add/page.tsx (폼 라벨·검증) | 증상명/입원 사유/진료 사유, 체중 (kg), 발생일, 병원명, 비용 (원), 약 추가, 투약 빈도 ... | UI | records | 노출O | O | P1 | record.* / med.* | 중복(edit과) | 필드 라벨 |
| src/app/(main)/records/add/page.tsx (알림 업셀) | Plus 플랜을 이용하면 잊기 쉬운 일정을 알림으로 챙길 수 있어요. ... | UI | records | 노출O | O | P1 | record.medication.alarmUpgrade* | 중복(meds·edit) | 표현 미세 차이 |
| src/app/(main)/records/timeline/page.tsx:33~202 | 1주/1개월/3개월, 타임라인, 이 기간에 기록이 없어요 ... | UI | records | 노출O | O | P1 | record.timeline.* | - | |
| src/app/(main)/records/meds/page.tsx | 복용 중/종료, 약 수정/추가, 종료일이 시작일보다 빠를 수 없어요, '{{name}}' 삭제할까요? ... | UI | meds | 노출O | O | P1 | meds.* | 중복(common) | ICU 변수 템플릿 |
| src/app/(main)/records/preventive/page.tsx | 심장사상충/외부기생충/..., → 다음 예정일 {{date}} 로 자동 계산, '{{category}}' 삭제할까요? ... | UI | preventive | 노출O | O | P1 | preventive.* | - | 변수 보간 |
| src/app/(main)/records/expenses/page.tsx | 병원·의료/사료/간식..., {{period}} 총 지출, 금액(원) ... | UI | expenses | 노출O | O | P1 | expenses.* | - | 통화 포맷 |
| src/app/(main)/records/stats/page.tsx | 표시 지표 설정, {{petName}} 체중, 체중 변화, 최저/최고 ... | UI | stats | 노출O | O | P1 | stats.* | - | 변수 보간 |
| src/components/records/FileUploader.tsx | 여기를 눌러 사진이나 파일을 올려주세요, JPG, PNG, PDF 만 가능, 최대 ${maxFiles}개 ... | UI | fileUploader | 노출O | O | P1 | fileUploader.* | - | 변수 보간 |
| src/components/records/MetricTracker.tsx | 오늘 ${meta.label}, 권장 대비 ${todayPct}%, 1회 정량, % 로 입력 ... | UI | metric | 노출O | O | P1 | metric.* | - | 변수+퍼센트 |
| src/components/records/ExcretionTracker.tsx | 오늘 ${KIND_LABEL[kind]}, 회, 상태, 날짜, 시간 ... | UI | excretion | 노출O | O | P1 | excretion.* | - | |
| src/components/records/CalendarView.tsx | 입원/기록/투약 중/예약/퇴원 | UI | calendar | 노출O | O | P1 | calendar.* | - | 요일은 P2 |
| src/components/pets/PetFormFields.tsx | 품종 (선택), 모름/수컷/암컷, 했어요/안 했어요, 예: 4.2, 예: 신부전, 관절염 | UI | pets | 노출O | O | P1 | pets.* | - | 플레이스홀더 |
| src/lib/petContext.ts (음수/식사/배변 요약) | 음수: 최근 14일 중 ...평균 ${w.avg}ml/일, 수액: ..., - 대변: 14일간 ${...}회 ... | AI 프롬프트 | pets | 노출X(응답O) | O | P1 | pets.context.* | - | 변수+단위 |
| src/app/(main)/search/page.tsx, photo/page.tsx (보조) | 우리 아이 건강, 빈틈없이 케어하기 / 사진으로 분석하기 / 사진 분석 무료 체험을 모두 사용했어요. ... | UI | search | 노출O | O | P1 | subscription.upgrade.* / search.photo.* | 중복 | |
| src/lib/timeline.ts | 입퇴원/증상/진료/일상/예방/약/대변/소변/식사/음수/수액/체중/지출 + 단위 결합 | UI | timeline | 노출O | O | P1 | timeline.* | - | 토큰 연결식(어순 위험) |
| src/lib/healthMetrics.ts | 음수량/식사량/수액, 오늘 마신 물 (ml), 권장 약 ~ml ... | UI | metrics | 노출O | O | P1 | metrics.* | - | 단위 |
| src/lib/preventiveCare.ts | 심장사상충/외부기생충/내부구충/종합백신/광견병/건강검진 (라벨) | UI | preventive | 노출O | O | P1 | preventive.*.label | - | 제품명은 P2/번역X |
| src/services/fileUpload.ts | JPG, PNG, WebP, PDF 파일만 업로드 가능합니다. / PDF 는 5MB 이하만 ... | UI | fileUpload | 노출O | O | P1 | fileUpload.* | 중복(컴포넌트) | |
| src/services/openai.ts | 질병 설명 생성 실패 / AI 분석 실패: | UI | analysis | 노출O | O | P1 | analysis.error.* | 중복(api) | 노출 에러(UI 보정) → analysis.error.* |
| src/app/api/symptom-analysis*/route.ts (에러/한도) | 요청이 너무 많습니다. ..., 증상 입력은 최대 ${n}자까지..., 사진 증상 분석은 Plus 플랜에서만... | UI | analysis | 노출O | O | P1 | common.rateLimitError / record.symptomLengthLimit / plan.* | 중복 | 변수 보간 |
| src/app/(main)/profile/page.tsx (알림·반려동물·탈퇴) | 알림 설정, 푸시 알림, 반려동물 등록 한도(...)에 도달했습니다., 정말 탈퇴하시겠어요? ... | UI | profile | 노출O | O | P1 | profile.* / pet.* | 중복 | |
| src/app/(main)/profile/subscription/page.tsx (결제 상세) | 월간 단건 결제, 다음 결제일, 자동 결제가 보류 중이에요, 예상 환불 금액 : {...}원 ... | UI | payment | 노출O | O | P1 | payment.* | - | 통화·날짜·할인율 |
| src/app/(main)/profile/subscription/page.tsx:527 | 카드사에 따라 반영에 3~10영업일 소요됩니다. | 법적 문서 | payment.refund | 노출O | O | P1 | legal.refund.timeline | - | |
| src/app/(main)/payment/**/*.tsx | 결제 위젯 로딩 중..., 결제 진행 중..., 토스 결제창을 확인해 주세요, 자동 결제 안내 ... | UI | payment | 노출O | O | P1 | payment.* | - | 토스 결제 흐름 |
| src/app/(main)/map/page.tsx (보조) | 지도 초기화에 실패했습니다., 카카오맵 SDK를 준비하고 있어요, 평소보다 시간이 걸리네요 ... | UI | map | 노출O | O | P1 | map.* | - | |
| src/components/ui/*, shared (보조) | 이전 달/다음 달, 오전/오후, 로딩 중, 알림 권한이 꺼져있어요, Chrome 으로 전환 ... | UI | shared-ui | 노출O | O | P1 | common.* / notification.* | 중복 | |
| src/app/(admin)/admin/**/*.tsx | 총 회원/오늘 검색/총 수익..., 환불 실패, 삭제에 실패했습니다., 결제 실패 큐 ... | UI(관리자) | admin | 노출O(관리자) | O | P1 | admin.* | 중복 | 관리자 전용(번역 후순위) |
| src/lib/apiAuth.ts, api/**/route.ts | 인증이 필요합니다., 유효하지 않은 세션입니다., 서버 오류가 발생했습니다. ... | UI | validation/error | 노출O | O | P1 | validation.* / error.* | 중복(다수) | API 공통 에러 |
| src/app/api/cron/push-notifications/route.ts:131 | 💉 오늘의 건강 일정 / 챙겨주세요 | AI 프롬프트 | push | 노출O(푸시) | O | P1 | push.preventive.* | - | 예방 알림 |

---

## 4. 법적 문서 (block translation 권장)

> 법적 문서 본문은 조항 단위로 분절하지 말고 **문서 단위 block translation**(법률 검수 포함)을 권장합니다. 시행일·연락처·사업자 정보는 로케일과 무관하게 유지.

| 문서 | 파일 | 섹션 헤딩 목록 | 시행일 | 분류 | 우선순위 | 번역 방식 | 추천 key |
|---|---|---|---|---|---|---|---|
| 이용약관 | src/app/(legal)/terms/page.tsx | 제1조 목적 ~ 제15조 분쟁 해결 (목적, 정의, 약관의 효력 및 변경, 서비스의 제공, 서비스의 변경 및 중단, 회원가입, 회원 탈퇴, 회원의 의무, 서비스 제공자의 의무, AI 분석 서비스, 면책조항, 유료 서비스, 자동 결제, 청약철회 및 환불, 구독 해지, 분쟁 해결) | 2026-06-03 | 법적 문서 | P0 | **block translation 권장** | legal.terms.content |
| 개인정보처리방침 | src/app/(legal)/privacy/page.tsx | 1. 처리 목적 ~ 13. 방침 변경 (처리 목적, 수집 항목, 보유 기간, 제3자 제공, 위탁, Google 데이터 처리, 사진 증상 분석, 파기 절차, 정보주체 권리, 침해사고 대응, 보호책임자, 안전성 확보, 방침 변경) | 2026-06-03 | 법적 문서 | P0 | **block translation 권장** | legal.privacy.content |
| 환불 정책 | src/app/(legal)/refund/page.tsx | 1. 개요 ~ 8. 연락처 (개요, 월간 구독 환불, 자동 갱신 안내, 연간 구독 환불, 서비스 이용 기준, 환불 방법, 환불 불가 사유, 구독 해지/자동 갱신 해제, 연락처) | 2026-04-13 | 법적 문서 | P1 | **block translation 권장** | legal.refund.content |
| 위치기반서비스 이용약관 | src/app/(legal)/location-terms/page.tsx | 제1조 목적 ~ 제7조 연락처 (목적, 위치정보 수집 목적, 저장 및 보유, 제3자 제공, 위치 권한 철회, 법적 근거, 연락처) | 2026-02-24 | 법적 문서 | P1 | **block translation 권장** | legal.locationTerms.content |
| 사업자 정보 | src/app/(legal)/business/page.tsx | 상호명, 대표자, 사업자등록번호, 주소, 이메일, 전화번호 (라벨) | - | 법적 문서 | P1 | 헤더 라벨만 번역(값 유지) | legal.business.title (제목 needs_translation=X) |
| 약관 및 정책 (허브) | src/app/(legal)/policies/page.tsx | 약관 및 정책 / 5개 정책 링크 라벨 | - | 법적 문서 | P0 | 라벨 번역 | legal.policies.title, legal.policies.menu |

---

## 5. 개발자 내부 (번역 제외)

> 분류 = 개발자 내부 → 우선순위 "제외". console.log, Sentry 태그, DB 스키마 참조, 코드 주석, 키워드 매칭 데이터 등. 개별 나열 생략, 도메인별 요약만.

| 도메인 | 내부 문자열 요약 | 대략 건수 |
|---|---|---|
| auth-onboarding | AuthContext.tsx 의 console.error, logActivity, Sentry.captureException 의 한국어 주석/로그 (예: 'Error fetching profile:', 인증 초기화 에러 로깅). 개발자 로그인 토글도 내부. | ~11 |
| home | console.log/주석/에러 처리: 'privacy mode ... 표시 X', 'sw-applying', 'sw-toast-silent-until', 'sw-apply-retry', '[UpdateToast] cache clear failed:', Sentry feature/action 태그, sessionStorage 키. | 9 |
| records-core / records-modules / record-components | 내부 문자열 없음(모든 한국어가 UI로 분류). | 0 |
| pets | petForm.ts(1)·petContext.ts(4) 주석: input max 우회 검증, visit/hospitalization 필터링 이유, description 길이 cap 로직, 컨텍스트 빌더 헤더, 대소변 신호 분석 설명. | 5 |
| search-ui | 내부 문자열 없음(훅 파일들 디버그 로그 미발견). | 0 |
| ai-data-lib | redFlags.json 의 증상 키워드 매칭용 토큰(혈변, 피설사, 피섞, 피가섞, 출혈성설사, 피똥 등) — red flag 탐지 로직 내부 데이터, 비노출. | 6 |
| ai-api | Sentry 태그('symptom-analysis', 'vision-api', 'vision-json-parse-fail' 등), DB 스키마 참조('search_logs', 'activity_logs', 'search_cache', 'profiles'), INSERT 실패 로깅. | ~5 |
| profile-payment | console.log(영문), Sentry feature/action 태그, Toss API fallback·billing retry·trial 날짜 계산 주석. 사용자 노출 에러는 모두 한국어로 별도 래핑됨. | ~25 |
| map | 한글 주석/코드 설명: auth.ts(5, 인증 어댑터·OAuth·idToken·에러), env.ts(3, Capacitor 플랫폼 감지), push.ts(3, FCM 등록/해제·포그라운드), location.ts(3, 위치 어댑터·권한), androidIntents.ts(3, Android 인텐트·TWA/웹 컨텍스트). | ~17 |
| legal | 내부 문자열 없음. | 0 |
| shared-ui | 내부 문자열 없음(순수 UI 컴포넌트). | 0 |
| infra-internal | activityLog 라벨 맵(39), sanitize 입력경계 마커(2), cron 로그 메시지(20), 기타(2). activity_logs action 표시용·시스템 디버깅 용도. | ~63 |

> 참고: 관리자(admin) 화면 문자열은 분류상 UI(노출O, 관리자 한정)이지만 일반 사용자에게는 보이지 않으므로 **번역 후순위(P1/P2)**. 다국어 운영 정책상 한국어 유지도 가능.

---

## 6. 키 네이밍 규칙 초안

### ✅ 확정 키 규칙 (2026-06-17 보정)

next-intl 도입 전 확정된 컨벤션:

1. **`common.dog` / `common.cat` 사용 금지.**
2. **UI 반려동물 타입** = `pets.type.dog` / `pets.type.cat` (next-intl messages).
3. **AI 프롬프트 내부 어휘** = `ai.vocab.petType.dog` / `ai.vocab.petType.cat` (UI와 분리, 검수 주체 다름).
4. **사용자 노출 AI 에러/토스트** = `analysis.error.*` / `analysis.toast.*` (증상·사진 분석 도메인). 논문 검색 에러는 `search.error.*`.
5. **진짜 모델 시스템 프롬프트는 next-intl messages에 넣지 않음** → `buildPrompt(locale)` 함수로 코드와 함께 관리 (번역 카탈로그 제외).
6. **`vetTerms` KO 보정맵 + `diseaseMap` = 영어 번역 제외** (EN 모드는 `normalizeVetTerm(term, locale)` 이 보정 스킵 → `name_en` 사용).
7. **`redFlags`/응급 가드레일만** 영어 프롬프트 세트 필요 (의학 검수).
8. **푸시 locale 분기**는 `profiles.preferred_language` 컬럼이 필요한 **별도 DB/백엔드 작업** (번역과 분리).
9. **`medication.*` 미사용 → `meds.*` 로 통일** (단 record-add 화면의 투약 섹션은 `record.medication.*` 유지 — 별개 네임스페이스).

### 발견된 도메인 prefix

| prefix | 의미 | 예시 키 |
|---|---|---|
| `common` | 범용 버튼·라벨·단위(전 도메인 공유) | common.save, common.cancel, common.delete, common.confirm, common.close, common.retry, common.loading, common.today, common.unit.kg |
| `nav` | 하단탭/내비게이션 | nav.home, nav.search, nav.records, nav.hospitals, nav.profile |
| `auth` | 인증/로그인/세션 | auth.kakaoSignIn, auth.googleSignIn, auth.sessionEvicted, auth.processingLogin |
| `onboarding` | 온보딩 슬라이드 | onboarding.slide1.title, onboarding.slide1.description |
| `login` | 로그인 화면 카피 | login.subtitle1, login.subtitle2 |
| `install` / `browser` | PWA 설치·인앱브라우저 안내 | install.addToHome, browser.openInChrome |
| `home` / `app` | 홈 화면 섹션·배너·위젯 / 앱 상태 | home.welcomeTitle, home.bannerAiTitle, app.offlineMessage |
| `record` | 건강 기록(타입·섹션·필드·검증·삭제·드래프트) | record.type.symptom, record.section.basicInfo, record.medication.add, record.validation.* |
| `meds` / `preventive` / `expenses` / `stats` | 기록 모듈별 | meds.title, preventive.alarmToggle, expenses.title, stats.weightChange |
| `excretion` / `metric` / `calendar` / `color` / `fileUploader` | 기록 컴포넌트별 (`medication.*` 미사용 → `meds.*`) | excretion.kind.poop, metric.serving.label, calendar.discharge |
| `pets` | 반려동물 폼·검증 + `pets.context.*`(AI 프롬프트) | pets.name, pets.type.dog, pets.validation.nameRequired, pets.context.patientInfo |
| `search` | 검색·증상/사진 분석 UI | search.tab.symptom, search.photo.analyze, search.symptom.urgentGoToHospital |
| `analysis` | (UI 노출) 분석 에러·토스트·한도 | analysis.error.networkFailed, analysis.toast.*, analysis.limitReached |
| `ai.vocab` | AI 프롬프트 내부 어휘 (UI와 분리) | ai.vocab.petType.dog, ai.vocab.petType.cat |
| (messages 제외) | 실제 모델 시스템 프롬프트 | `buildPrompt(locale)` 함수 관리 — next-intl messages 아님 |
| `vetTerms` / `disease` | AI 참조 데이터 (KO 보정맵·매핑) — **영어 번역 제외**(normalize 바이패스, name_en 사용) | (번역 대상 아님) |
| `redFlags` | AI 응급/감별 가드레일 — 영어 프롬프트 세트 필요(의학 검수) | redFlags.parvo, redFlags.fip |
| `metrics` / `timeline` / `healthTips` / `mock` | 라이브러리 데이터 | metrics.water.label, timeline.symptom, healthTips.toxicFoods |
| `plan` / `payment` / `subscription` | 플랜·결제·구독·청구·업셀 | plan.free.name, payment.subscriptionManagement, subscription.upgrade.title |
| `map` | 지도(에러·필터·검색·권한·병원) | map.error.loadFailed, map.filter.24h, map.action.call |
| `legal` | 약관·정책·면책 | legal.terms.title, legal.aiMedicalDisclaimer, legal.refund.content |
| `push` | 서버 cron 푸시 알림 | push.subscription.expiredTitle, push.billing.retryBody |
| `error` / `validation` | 공통 에러·검증(API 포함) | error.serverError, validation.authRequired |
| `admin` | 관리자 콘솔 | admin.dashboard.totalUsers, admin.sidebar.dashboard |
| `notification` | 알림 권한 안내 | notification.permissionDenied, notification.switchToChrome |

### 규칙 설명

1. **계층 구조**: `<domain>.<subgroup>.<key>` 형태. 도메인은 화면/기능 단위, subgroup 은 섹션·타입 단위(예: `record.type.symptom`, `record.section.basicInfo`).
2. **공통화 우선**: 여러 도메인에서 동일 원문(저장/취소/삭제/확인/닫기/다시 시도/로딩/오늘/어제/전체 등)은 도메인 키를 만들지 말고 `common.*` 하나로 통합. 중복 표기 "중복(N곳)" 항목이 1차 통합 후보.
3. **AI 프롬프트 분리** (확정): 실제 모델 시스템 프롬프트는 **next-intl messages에 넣지 않고** `buildPrompt(locale)` 로 코드 관리. 프롬프트 내부 어휘는 `ai.vocab.*`(예: `ai.vocab.petType.dog/cat`), 컨텍스트는 `pets.context.*`. UI와 원문이 같아도(강아지/고양이) **별도 키**(`pets.type.*` ≠ `ai.vocab.petType.*` — 검수 주체 다름). 사용자에게 노출되는 분석 에러/토스트는 messages 대상이며 `analysis.error.*` / `analysis.toast.*`. `vetTerms`/`disease`는 번역 제외(normalize 바이패스), `redFlags` 만 영어 프롬프트 세트.
4. **단위/기호 제외**: kg, ml, %, ~, 원, · 등은 번역 대상 아님(needs_translation=X). 키는 부여하되 값은 로케일 공통 또는 ICU number/unit 포맷으로 대체 검토.
5. **변수 보간**: `{name}`, `${maxFiles}`, `{{date}}` 등은 ICU MessageFormat 으로 통일(`{count, plural, ...}`, `{date, date, medium}`). 현재 코드의 문자열 연결식(timeline.ts 의 토큰 결합, "마지막 기록 N일 전")은 어순이 깨지므로 **완성형 메시지 1키**로 재작성.
6. **법적/푸시**: `legal.*.content` 는 block, `push.*` 는 서버 locale 분기 전제.
7. **네이밍 컨벤션**: camelCase 키 세그먼트, 점(.) 구분. 변형(짧은 라벨·대체 표현)은 `.short`, `.alt`, `.v2`, `.fallback` 접미로 구분(예: `record.type.daily.short`).

---

## 요약

### 1) P0 번역 대상 목록 (화면/도메인별 핵심)

- **온보딩 5슬라이드**(title/description 10건) + 시작하기 — 첫 진입 카피, 브랜드 스토리.
- **로그인**: 서브타이틀 2건, 카카오/Google 시작 버튼, 로그인.
- **하단 내비**(nav.*): 홈/검색/기록장/병원 찾기/마이페이지 — 전 화면 노출.
- **홈**: 환영/첫 기록 CTA/생일/마지막 기록/예약 D-Day/배너(Plus·AI)/오늘의 약/예방 관리/체험 배너.
- **기록**: 탭(기록·캘린더), 기록 타입(증상/일상/진료/입퇴원), 섹션 헤딩(기본/진료/투약 정보), 기록 추가·수정·상세 제목, 반려동물 미등록 안내, 저장.
- **기록 모듈**: 복약 관리/예방 관리/지출 관리/건강 통계 제목 + 투약·예방 알림 토글 및 푸시 권한 프롬프트.
- **반려동물 등록 폼**: 이름/종(강아지·고양이)/생년월일/성별/중성화/체중/만성질환 + 3개 검증 메시지.
- **검색·분석**: 탭(증상 분석·논문 검색), 검색 플레이스홀더, 분석 로딩, 응급/24시간 안내, 사진 분석 전체 플로우(촬영·갤러리·상세·분석).
- **결제/구독**: 구독·결제 관리, 결제 옵션/정기 결제, 구독 정보, 기능 비교, 결제 정보, 자동 갱신 등록·카드 등록 시작.
- **지도**: 로딩/에러/필터(24시·일반)/검색 플레이스홀더/위치 권한/전화·길찾기·상세.
- **공통 에러 화면**: 앗 문제가 발생했어요 / 다시 시도 / 홈으로 이동.
- **법적 제목**: 이용약관·개인정보처리방침·약관 및 정책 허브.
- **AI 응답 영향(P0)**: pets.context 환자정보 헤더·종·중성화·진료요약·누락데이터 가드, vetTerms/diseaseMap/redFlags 핵심 질병·감별 가드, 결제/구독 만료·재결제 푸시 본문.

### 2) AI 프롬프트 분기 필요 파일 목록 (locale 분기 대상)

- **src/app/api/symptom-analysis/route.ts** — 시스템 프롬프트(보드 인증 수의사 role, 컨텍스트, 책임/윤리, 신뢰), JSON 스키마 라벨, 종(고양이/강아지)·`우리 ${petLabel}가` 동적 라벨, 한도/에러 메시지.
- **src/app/api/symptom-analysis-image/route.ts** — 비전 분석 프롬프트, 부위 카테고리(피부/눈/외상/입·치아/귀/대소변·구토), 분석 에러·관찰 안내 문구.
- **src/app/api/analyze-papers/route.ts** — 논문 분석 시스템 프롬프트(JSON 출력 강제), 논문 포맷 라벨, 종.
- **src/app/api/disease-description/route.ts** — 질병 설명 시스템/유저 프롬프트, 종.
- **src/app/api/validate-and-translate/route.ts** — 검색어 검증·번역 프롬프트, 종.
- **src/lib/petContext.ts** — `pets.context.*` 전체(환자정보·진료요약·음수/식사/수액·대소변·누락데이터 주의). AI 입력 컨텍스트이므로 응답 언어와 일치 분기 필요.
- **src/lib/vetTerms.ts / src/data/diseaseMap.ts / src/data/redFlags.json** — 질병 표준 용어·매핑·위험신호 가드. 응답 언어에 맞춰 용어 세트 분기(의학 검수 필수).
- **src/app/api/cron/push-notifications/route.ts / auto-billing/route.ts** — 푸시 제목/본문(예방·구독 만료·재결제 등). 서버에서 사용자 locale(profiles)을 읽어 분기.
- **src/services/openai.ts** — 질병 설명/AI 분석 실패 메시지.

> 핵심: AI 프롬프트는 "한국어 유지(needs_translation=X)"로 표기됐지만, **다국어 응답을 내려면 프롬프트와 참조 데이터를 응답 locale에 맞춰 분기**해야 함. 단순 UI 번역과 별개 트랙.

### 3) 법적 문서 번역 대상 (목록 + 분량 감)

- **이용약관** (15개 조항, 시행일 2026-06-03) — 분량 大. block translation + 법률 검수.
- **개인정보처리방침** (13개 항, 2026-06-03) — 분량 大. 국가별 개인정보법 차이로 단순 번역 불가, 현지화 검토.
- **환불 정책** (8개 항, 2026-04-13) — 분량 中. 결제 정책·전자상거래법 의존.
- **위치기반서비스 이용약관** (7개 조항, 2026-02-24) — 분량 中. 위치정보법은 국내 특화 — 해외 출시 시 조항 자체 재검토 필요.
- **사업자 정보** — 라벨만 번역, 값(사업자번호·주소 등)은 유지.
- 모두 `legal.*.content` 단일 블록 키. 면책 문구(legal.aiMedicalDisclaimer / aiAnalysisDisclaimer / consultVeterinarian)는 UI에 인라인이라 P0로 별도 번역.

### 4) 번역 제외해도 되는 내부 문구 목록 (분류/도메인 요약)

- **개발자 내부(제외)**: console.log/error, Sentry feature/action 태그, DB 스키마명(search_logs·activity_logs·profiles 등), 코드 주석(인증 어댑터·Capacitor·FCM·위치·Android 인텐트·Toss fallback), redFlags 키워드 매칭 토큰, activityLog 라벨 맵, sanitize 경계 마커, cron 로그. (auth-onboarding ~11, home 9, pets 5, ai-api ~5, profile-payment ~25, map ~17, infra-internal ~63, ai-data-lib 6).
- **단위/기호(needs_translation=X)**: kg, ml, %, ~, 원, ·, (, ), 0, D-Day 등.
- **브랜드/제품명(번역X)**: Google, PawDex, 토스, 예방약 제품명(하트가드 플러스·넥스가드·프론트라인·브라벡토·레볼루션·드론탈 등), mock 병원명/주소(서울 강남구 등 시드 데이터), Probiotics 등.
- **관리자 콘솔(admin.\*)**: 일반 사용자 비노출 — 다국어 운영 정책에 따라 한국어 유지 가능(번역 후순위).

### 5) next-intl 도입 전 확인해야 할 리스크 (실전 함정)

1. **라우팅**: App Router + next-intl 의 `[locale]` 세그먼트 도입 시 기존 `(auth)/(main)/(legal)/(admin)` 그룹 구조와 충돌·전 경로 재작성 위험. 미들웨어 locale 감지와 기존 `auth/callback` 리다이렉트 경로 영향.
2. **OAuth 콜백**: 카카오/Google redirect URI 가 고정 등록되어 있어 `/{locale}/auth/callback` 으로 바뀌면 콘솔 등록 URI 전부 수정 필요. 콜백 내 상대경로 리다이렉트도 locale prefix 유실 주의.
3. **푸시 알림**: 본문은 서버 cron(push-notifications·auto-billing)에서 생성 → 클라 i18n 미적용. 사용자 locale 을 **DB(profiles)에 저장**하고 서버에서 메시지 분기해야 함. FCM/웹푸시 모두 해당.
4. **결제(토스)**: 결제창·영수증·상품명이 토스 측 표기와 혼재. 통화는 KRW 고정(원) → 다국어라도 통화는 분기 안 할 수 있음. 결제 진행 중 페이지 이탈 경고·성공/실패 라우팅이 locale prefix 영향.
5. **쿠키 locale**: next-intl 쿠키(`NEXT_LOCALE`)와 기존 자동로그인/세션 쿠키, Supabase 세션의 상호작용. 앱(Capacitor/TWA) WebView 에서 쿠키 persistence 확인.
6. **SSR 깜박임(FOUC)**: 서버 locale 과 클라 hydration 불일치 시 한국어→타언어 깜박임. 정적 생성 페이지/캐시(search_cache)와 locale 분기 충돌 주의.
7. **동적 문자열/문자열 연결**: timeline.ts 토큰 결합("약 N회 · 대변 M회"), "마지막 기록 N일 전", "우리 ${petLabel}가" 등 어순 의존 결합문 → ICU 완성형 메시지로 재작성 필요(영어 등 어순 다름).
8. **복수형/날짜/통화 포맷**: "{days}일 남음", "개 선택됨", "N편", "3~10영업일" 등 한국어는 복수형 없음 → 타언어 plural 규칙 필요. 날짜(formatShortDate)·시간(오전/오후)·금액(원, toLocaleString) 전부 `Intl`/ICU 로 교체.
9. **AI 응답 언어 일치**: UI locale 과 AI 프롬프트/참조데이터(vetTerms·redFlags·petContext) locale 불일치 시 응답이 엉뚱한 언어로 — UI 번역과 별도 트랙으로 동기화 필요.
10. **법적 문서 현지화**: 위치정보법·개인정보보호법은 국내 특화 — 단순 번역이 아니라 출시 국가별 조항 재검토(법률 리스크).
11. **하드코딩 날짜**: TrialBanner 의 "2026. 05. 13" 등 코드 내 고정 날짜 — i18n 이전에 동적화 필요.
12. **키 충돌/중복**: 동일 원문이 add/[id]/edit 등 여러 파일에 흩어져 있어(record.type.*, common.*), 1차로 `common.*` 통합 후 키 부여하지 않으면 중복 키·불일치 번역 발생.
