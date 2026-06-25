# PawDex — App Store 심사 정보 (App Review Information)

> App Store Connect → 앱 → (버전) → **앱 심사 정보** 에 입력.
> 핵심: ① 로그인 필수 → **데모 계정 제공** ② 웹뷰 하이브리드 → **4.2 방어(네이티브 기능 강조)**

---

## 1. 입력 필드 (App Store Connect)

- **로그인 필요(Sign-in required)**: 예(Yes)
- **데모 계정 사용자 이름(User name)**: `apple.review@pawdex.store` ✅ (프로덕션 생성 완료, 데모 데이터 채움)
- **데모 계정 암호(Password)**: `(본인이 설정한 비밀번호 — App Store Connect에 직접 입력)`
- **연락처(Contact)**: 이름 / 이메일 / 전화번호
- **비고(Notes)**: 아래 3번 영문 텍스트 그대로 붙여넣기

---

## 2. 리뷰어 테스트 계정 — 만드는 법 (직접)
앱에서 **이메일/비밀번호로 신규 가입** 하나 만들어 주세요 (소셜 로그인 X — 리뷰어는 카카오/구글 계정이 없어요).
- 예: `appstore.review@pawdex.store` (또는 아무 이메일) + 비밀번호
- 만든 뒤 **이메일만 알려주면**, 제가 그 계정에 **데모 반려동물 + 샘플 기록**을 채워둘게요 (리뷰어가 빈 화면 아닌 풍부한 앱을 보게).
- ⚠️ 비밀번호는 저한테 알려주지 말고, **App Store Connect 데모 계정 칸에 직접** 입력하세요.

---

## 3. 심사 노트 (Notes) — 영문, 그대로 붙여넣기

```
PawDex is a health management app for dog and cat owners. Users record
their pet's vet visits, symptoms, medications, vaccinations, daily logs,
and expenses; view health statistics; search veterinary research; and find
nearby animal hospitals.

PawDex is a NATIVE hybrid app (Capacitor) and uses the following native iOS
capabilities — it is not a repackaged website:
- Sign in with Apple, Google, and Kakao (native authentication)
- Push notifications via APNs (medication & vaccination reminders)
- Location services (CoreLocation) to find nearby animal hospitals on a map
- In-App Purchase via StoreKit for the "PawDex Plus" auto-renewable subscription
- Camera & Photo Library to attach images to health records

SIGN-IN (required) — please use the email/password account below:
  1. On the login screen, TAP THE "PawDex" TITLE (logo) 7 TIMES.
     → A hidden email login form appears at the bottom (hidden from normal users
       on purpose; this is the reviewer access path).
  2. Enter:
       Email:    apple.review@pawdex.store
       Password: <YOUR_PASSWORD>  (set in the demo account fields above)
  3. Tap 로그인 (Sign in).
(Google/Kakao require Korean third-party accounts; please use the email login
 above. The demo account is pre-populated with a pet and sample records.)

HOW TO TEST:
- Records: Home → tap a category card to add/view pet health records.
- Hospital finder: bottom tab "병원 찾기" → allow location → nearby hospitals on map.
- Subscription: Profile → Subscription → select a plan. Please use a Sandbox
  tester account. "PawDex Plus" unlocks unlimited records and AI features.
- Reminders: medication/vaccination notifications are scheduled when records
  with a schedule are added.

The app's primary market is South Korea (Korean UI); English localization is
available. No third-party ad tracking or IDFA is used (ATT not required).

Contact: <NAME> / <EMAIL> / <PHONE>
```

---

## 4. 심사 노트 (한글 — 참고용, 입력은 영문)
PawDex는 강아지·고양이 보호자용 건강관리 앱입니다. 진료·증상·복약·예방접종·일상·지출
기록, 건강 통계, 수의학 논문 검색, 가까운 동물병원 찾기를 제공합니다.
**네이티브 하이브리드 앱(Capacitor)** 으로 — 애플/구글/카카오 네이티브 로그인, APNs 푸시,
위치(병원찾기), StoreKit 인앱결제(PawDex Plus), 카메라/사진 첨부 등 **네이티브 기능**을
사용합니다(단순 웹사이트 래핑 아님 → 4.2 대응). 로그인 필수라 데모 계정 제공.

---

## 5. 추가 팁
- **4.2 반려 대비**: 비고에 네이티브 기능 나열(위) = 가장 강력한 방어.
- **3.1.1**: 디지털 구독은 반드시 StoreKit(RevenueCat) — 외부 결제 유도 문구/링크 절대 금지.
- **5.1.1**: 계정 탈퇴(+ Apple 토큰 revoke) 동작 필수 — 이미 구현됨.
- 카테고리: 의료/건강 또는 라이프스타일. 연령등급: 4+.
