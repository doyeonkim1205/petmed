# PawDex iOS App Store 출시 체크리스트

> 목표: **iOS 한국 출시 → 그다음 미국(Play + App Store 국가 추가)**
> 기준일: 2026-06-23 / 코딩은 Windows(`petmed-next`), 네이티브 빌드·제출은 Mac(`pawdex-cap`)
> 관련 메모리: `project_ios_launch_plan`, `project_capacitor_migration`, `project_play_billing_nativebilling`

작업 주체 표기: **[Win]** = Windows에서 코드(내가 가능) / **[Mac]** = Mac+Xcode(직접) / **[콘솔]** = 웹 콘솔 작업(직접)

---

## Phase 0 — 사전 준비물 (시작 전 확인)

- [ ] **[콘솔]** Apple Developer Program 가입 ($99/년) — 없으면 App Store Connect 진입 불가
- [ ] **[Mac]** Xcode 최신 설치 + Command Line Tools
- [ ] **[Mac]** CocoaPods 설치 (`sudo gem install cocoapods`) — Capacitor iOS 의존성 관리
- [ ] **[Mac]** Apple ID로 Xcode 로그인 (Signing & Capabilities용)
- [ ] 초기화된 iPhone 준비 ✅ (보유) — 실기기 테스트·Sandbox 결제용
- [ ] **[콘솔]** App Store Connect에서 **번들 ID `com.dylabs.pawdex`** 사용 가능 여부 확인
      (Android는 `com.dylabs.pawdex` 사용 중 — iOS 번들 ID는 별개 네임스페이스라 동일 사용 가능)

---

## Phase 1 — Windows 코드 준비 (Mac 없이 선행) [Win]

> 어댑터 구조상 iOS 코드는 웹/Android 사용자에게 100% dormant → develop 배포해도 안전.

- [ ] **결제 어댑터 iOS 분기** (`src/lib/platform/payments.ts`)
  - 현재 `RC_GOOGLE_API_KEY`만 사용, `NativeBilling`은 Android Kotlin 전용
  - `NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY` 추가 + 플랫폼별 키 선택
  - `manageSubscriptionsUrl()` iOS 분기 (`https://apps.apple.com/account/subscriptions`)
  - ⚠️ **iOS 결제 구현 방식은 Phase 4에서 실기기 검증 후 확정** (RC JS 우선, 막히면 Swift 브릿지)
- [ ] **Apple 로그인** (`src/lib/platform/auth.ts`)
  - `@capgo/capacitor-social-login`가 Apple 지원 → `nativeAppleSignIn()` 추가
  - Supabase Apple provider 설정 필요(아래 콘솔 작업과 연동)
  - 로그인 화면에 Apple 버튼 추가 (iOS에서만 노출)
- [ ] **Apple 토큰 revoke** (`src/app/api/delete-account/route.ts`)
  - 현재 `revokeGoogle`만 존재 → `revokeApple` 추가 (**없으면 5.1.1 반려**)
  - Apple은 client_secret(JWT) 생성 필요 — 서버 env에 Apple 키 보관
- [ ] **권한 문구(Info.plist) 텍스트 한/영 준비** — 위치/카메라/사진 (실제 plist 주입은 [Mac])
- [ ] develop → 배포 → 동작 무영향 확인 (웹/TWA isApp=false)

---

## Phase 2 — Mac: iOS 프로젝트 생성 & 네이티브 설정 [Mac]

- [ ] `pawdex-cap` 클론/동기화 (git 추적 X → 폴더 통째로 Mac에 복사하거나 재설정)
- [ ] `npm install` → `npx cap add ios` → `npx cap sync ios`
- [ ] **iPhone 전용 설정** `TARGETED_DEVICE_FAMILY = 1` (iPad 심사 면제 권장)
- [ ] `capacitor.config` 확인 — appId `com.dylabs.pawdex`, server.url=`https://pawdex.store`
- [ ] **APNs** — Firebase 콘솔에 APNs 인증키(.p8) 업로드 + `GoogleService-Info.plist` 추가
- [ ] **Kakao** — iOS URL 스킴(`kakao{네이티브키}`) Info.plist 등록 + LSApplicationQueriesSchemes
- [ ] **Info.plist 권한 문구** 주입 (위치/카메라/사진 — Phase 1에서 준비한 텍스트)
- [ ] **아이콘/스플래시** — `@capacitor/assets`로 iOS 셋 자동생성
      (⚠️ Apple 1024² 투명도/둥근모서리 금지 — 불투명 배경 원본 사용)
- [ ] Xcode 빌드 → 초기화된 iPhone 실기기 실행 성공

---

## Phase 3 — 네이티브 기능 실기기 검증 [Mac]

- [ ] **로그인**: 이메일 / 구글 / 카카오
  - ⚠️ 카카오 **검은화면 깜박임 iOS 재현 여부** 확인 (Android는 0.7초 수용했음)
  - 구글: iOS용 OAuth 클라이언트(GCP)·reversed client ID URL 스킴 필요
- [ ] **Apple 로그인** 실동작 (Phase 1 코드 + Supabase provider)
- [ ] **위치**(병원찾기) 권한 + 조회
- [ ] **푸시**(APNs) 권한 + 토큰 등록(`/api/push/fcm/register`) + 발송 수신
- [ ] **카메라/사진** 첨부 동작
- [ ] **외부링크 / 뒤로가기 / 상태바·키보드** 폴리시 (Android 대비 iOS 차이 점검)
- [ ] **탈퇴 → Apple revoke** 실제 호출 확인

---

## Phase 4 — 결제 (RevenueCat iOS) ⚠️ 최대 관문

- [ ] **[콘솔]** App Store Connect에 구독상품 생성 (`plus_monthly` / `plus_yearly`)
- [ ] **[콘솔]** RevenueCat에 iOS 앱 추가 + App Store Connect 연결 + Apple Public SDK Key 발급
- [ ] **[Win]** `NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY` Vercel env 추가 + payments.ts 적용
- [ ] **[Mac]** 실기기에서 **RevenueCat Capacitor JS 기본 SDK 검증** (offerings/purchase/restore)
  - Android에서 깨졌던 "복잡객체 마샬링 멈춤"이 **iOS WKWebView에서 재현되는지** = 분기점
  - ✅ 정상 → RC JS 그대로 사용 (Swift 브릿지 불필요)
  - ❌ 멈춤 → **플랜B**: `NativeStoreKitBridge.swift` (Android NativeBilling 구조 그대로, 평평 JSON)
- [ ] **[Mac/콘솔]** Sandbox 테스터 계정으로 구매 → `profiles.plan=plus` 까지 end-to-end 검증
- [ ] 웹훅 `product_id` 매핑 확인 (store 'APP_STORE'→? / 베이스플랜 접미사 처리)

---

## Phase 5 — App Store Connect 등록 [콘솔]

- [ ] 앱 생성 (이름/카테고리/연령등급)
- [x] **App Privacy 라벨** 작성 가이드 완료 → `docs/ios-app-privacy.md` (그대로 입력)
      추적 데이터 없음 → **ATT 불필요**. 반려동물 기록=User Content(Health 아님).
- [x] **스크린샷** 1290×2796 8장 완료 → 바탕화면 `PawDex/홍보/앱스토어 스크린샷/pawdex_0N_ios.png`
      (Play 완성본을 폭 맞춰 확대 + 배경 가장자리 연장, 찌그러짐·이음새 없음)
- [x] 심사 노트 + 리뷰어 테스트 계정 완료 → `docs/ios-review-notes.md`
      계정 `apple.review@pawdex.store`(프로덕션, 데모 데이터 채움, free 플랜→구독 테스트 가능)
- [ ] 개인정보처리방침 URL (`pawdex.store/privacy`) 입력

---

## Phase 6 — TestFlight & 심사 제출 [Mac/콘솔]

- [ ] Archive → App Store Connect 업로드
- [ ] TestFlight 내부 테스트 (로그인·결제·복원·취소·탈퇴 전체 회귀)
- [ ] 심사 제출 → 리뷰 대응

---

## 미국 확장 (출시 후 별도)

- 새 앱 아님 — **기존 앱에 국가 추가 + 영어 켜기** (`en.json` 완비)
- Play도 미국 국가 추가
- App Store 미국 스크린샷/설명 영어본

---

## ⚠️ 운영(main/prod) 반영 전 DB 마이그레이션 — 순서 필수

> develop→main 머지 **전에** prod DB에 컬럼을 먼저 추가해야 한다.
> 순서가 뒤집히면 코드가 없는 컬럼에 write 시도 → API 에러(로그인 자체는 안 깨지나 에러 로그·기록 누락).
> dev DB에는 이미 적용 완료. **dev-first → 머지 시 prod 적용** 규칙(`feedback_db_migration_flow`).

- [ ] **[콘솔]** prod DB(`ylbxtzwbwbnlmfxqgmoz`)에 컬럼 추가
      `ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS platform text;`
      (어드민 대시보드 "유입 분석 — 플랫폼" 카운트용. dev `lzmmiksdvioidcldrnvh` 적용 완료 ✅)
- [ ] 위 적용 **후** develop → main 머지 / prod 배포

---

## 심사 반려 주의 포인트 (Apple)

| 가이드라인 | 리스크 | 대응 |
|---|---|---|
| 5.1.1 | 탈퇴 시 Apple 토큰 revoke 누락 | Phase 1 `revokeApple` |
| 4.8 | 소셜 로그인 중 Apple 옵션 없음 | Phase 1 Apple 로그인 추가 |
| 3.1.1 | 디지털 구독을 외부 결제로 우회 | iOS는 반드시 StoreKit(RC) — 토스 fallback 절대 금지 |
| 4.2 | "웹사이트를 그냥 감싼 앱" 의심 | 네이티브 기능(푸시/위치/로그인/결제) 강조, 심사노트 |
| 2.1 | 권한 문구 미흡 | Info.plist 한/영 명확히 |
