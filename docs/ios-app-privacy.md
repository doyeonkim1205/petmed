# PawDex — App Store Connect "앱 개인정보(App Privacy)" 작성 가이드

> App Store Connect → 앱 → **앱 개인정보** 에 그대로 입력하면 됩니다.
> 기준: 실제 코드(Supabase/Sentry/RevenueCat/Geolocation/Push)에서 수집하는 데이터.
> 광고·추적 SDK(IDFA, Firebase Analytics, Facebook 등) **없음**.

---

## 0. 가장 중요한 결론
- **"데이터를 사용해 사용자를 추적함(Data Used to Track You)" → 없음 (None)**
  - 광고 식별자(IDFA) 사용 X, 제3자 광고/데이터 브로커 공유 X, 크로스앱 추적 X
  - → **ATT(앱 추적 투명성) 팝업 불필요**, `NSUserTrackingUsageDescription` 불필요
- **"건강 및 피트니스(Health & Fitness)" → 수집 안 함**
  - PawDex가 다루는 건 **반려동물** 건강 데이터 → Apple의 Health(=사용자 본인 건강) 카테고리가 **아님**.
  - 반려동물 기록은 **User Content(사용자 콘텐츠)** 로 신고. (의료 데이터 심사 강화 회피)

---

## 1. 수집하는 데이터 (전부 "추적 아님")

| Apple 데이터 유형 | 수집? | 신원 연결(Linked)? | 추적? | 목적 | 근거(코드) |
|---|---|---|---|---|---|
| **연락처 → 이메일 주소** | 예 | 예 | 아니요 | 앱 기능(계정/로그인) | Supabase Auth, 구글/애플/카카오 로그인 |
| **사용자 콘텐츠 → 사진/동영상** | 예 | 예 | 아니요 | 앱 기능 | 기록 첨부파일(medical-files 스토리지) |
| **사용자 콘텐츠 → 기타 사용자 콘텐츠** | 예 | 예 | 아니요 | 앱 기능 | 반려동물·진료·증상·복약·지출 등 기록 |
| **식별자 → 사용자 ID** | 예 | 예 | 아니요 | 앱 기능 | Supabase user id |
| **구매 → 구매 내역** | 예 | 예 | 아니요 | 앱 기능 | RevenueCat 구독 상태 |
| **위치 → 정확한 위치** | 예 | **아니요** | 아니요 | 앱 기능 | 병원 찾기(지도). 세션 내 사용, DB 미저장 |
| **사용 데이터 → 제품 상호작용** | 예 | 예 | 아니요 | 분석(자체) | activity_logs / search_logs (운영 모니터링) |
| **진단 → 충돌 데이터** | 예 | **아니요** | 아니요 | 앱 기능 | Sentry (setUser 미사용 → 익명) |
| **진단 → 성능 데이터** | 예 | **아니요** | 아니요 | 앱 기능 | Sentry |

> 푸시 토큰(APNs/FCM): Apple 분류상 별도 항목 아님. 굳이 신고한다면 **식별자 → 기기 ID(앱 기능)**. 보통 생략 가능.

---

## 2. App Store Connect 입력 순서 (질문 흐름)
각 데이터 유형마다 묻습니다:
1. **이 데이터를 수집하나요?** → 위 표의 "수집?" 대로 예/아니요
2. **사용자 신원에 연결되나요?** → 위 표의 "신원 연결?" 대로
3. **사용자 추적에 사용하나요?** → **전부 "아니요"**
4. **목적** → 위 표의 "목적"

체크할 데이터 유형(수집=예): **이메일 / 사진·동영상 / 기타 사용자 콘텐츠 / 사용자 ID / 구매 내역 / 정확한 위치 / 제품 상호작용 / 충돌 데이터 / 성능 데이터**
나머지(금융정보·검색기록 별도항목·연락처목록·건강·민감정보 등) → **수집 안 함**

---

## 3. 권한 사용 설명(Info.plist) — 이미 [Mac]에서 주입
- `NSLocationWhenInUseUsageDescription` (병원 찾기)
- `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` (기록 사진 첨부)
- `NSUserTrackingUsageDescription` → **불필요** (추적 안 함)

---

## 4. 개인정보처리방침 URL
- `https://pawdex.store/privacy`
