# 앱 업데이트 게이트 v1 — 네이티브 테스트 가이드 (선택 업데이트)

dev URL 을 바라보는 **네이티브 빌드**에서만 테스트한다. (web Preview 는 `isNativeApp()=false` 라 모달이 안 뜸.)
**prod 에서 `latest_build` 를 임시로 올려 테스트하지 말 것** — dismiss 키가 나중 실제 빌드 알림을 억제하고, 전체 유저에게 노출된다.

## 테스트 전용 더미 빌드값
실제 다음 빌드(44/11)가 아니라 **명백한 더미값**을 쓴다 → 실제 빌드와 절대 안 겹침:
- Android `latest_build = 900001`
- iOS `latest_build = 900002`
- 재표시 테스트용 추가값 `900003` (Android), `900004` (iOS)

---

## 사전 준비

### 1. 네이티브 빌드가 dev 를 바라보게
- Capacitor 셸(`C:\Users\doyeo\pawdex-cap`)의 `capacitor.config` 에서 `server.url` 을 **develop 의 Vercel Preview URL** 로 변경.
  - ⚠️ 반드시 **Preview URL**(dev Supabase 사용)을 쓸 것. 로컬 `npm run dev` 는 `.env.local` 이 **prod Supabase** 를 가리키므로 안 됨(그러면 prod 를 건드리게 됨).
  - Preview URL 은 Vercel 대시보드 → petmed-next → develop 브랜치 최신 배포에서 확인.
- Android: Android Studio 또는 `gradlew` 로 빌드·설치. iOS: Xcode 로 실기기/시뮬레이터 실행.
- 로그인까지 진입(모달은 홈 화면에서 뜸).

### 2. dev DB 테스트값 설정 (Supabase SQL Editor 또는 Management API, **dev 프로젝트 `lzmmiksdvioidcldrnvh`**)
```sql
update public.app_update_config set latest_build='900001', latest_version='9.0.1' where platform='android';
update public.app_update_config set latest_build='900002', latest_version='9.0.2' where platform='ios';
```
(min_supported_build 은 null 유지 → 필수 게이트 OFF. v1 은 선택만 테스트.)

---

## 체크리스트

각 항목: Android / iOS 각각 확인.

- [ ] **1. 모달 표시**
  - 위 더미값 설정 후 앱 실행 → 홈 진입 → **1.5초 뒤 소프트 모달**("새로운 버전이 준비됐어요" / "A new version is ready") 표시.
  - 홈이 아닌 화면에선 안 뜸(홈 전용) 확인.

- [ ] **2. Dismiss 후 재실행 억제**
  - 모달에서 **"나중에"** 탭 → 닫힘.
  - 앱 **완전 종료 후 재실행** → 홈에서 **모달 안 뜸**(reminder_days=7 억제 기간).
  - (확인: DevTools/로그로 `localStorage['app-update-dismissed:android:900001']` 에 만료 timestamp 저장됨.)

- [ ] **3. latest 변경 후 재표시**
  - dev DB 에서 `latest_build='900003'`(android) 로 변경 → 앱 재실행 →
    새 빌드라 dismiss 키(`...:900003`)가 없어 **모달 다시 표시**. (dismiss 키 = platform+latestBuild 검증)

- [ ] **4. 외부 스토어 이동**
  - 모달 **"업데이트하기"** 탭 → **Play Store(Android) / App Store(iOS) 앱이 외부로** 열리고 PawDex 페이지 표시.
  - iOS App Store URL 의 App ID = `6783735811` 페이지가 맞는지 확인.

- [ ] **5. API 실패 시 fail-open**
  - dev DB `update ... set enabled=false where platform='android';` → 앱 재실행 → **모달 없이 정상 진입**.
  - (추가) 앱 실행 직후 기내모드 등으로 `/api/app-config` 실패 상황 → **앱 정상 동작·모달 없음**(none 유지).
  - 잘못된 설정(min>latest)도 확인: `update ... set min_supported_build='900009', latest_build='900001';` → API 가 `enabled:false` 응답 → 모달 없음(전체 브릭 방지).

- [ ] **6. heartbeat DB 갱신**
  - 앱 실행(로그인) 후 dev DB 조회:
    ```sql
    select platform, app_version, app_build, last_active
    from public.active_sessions
    where app_version is not null order by last_active desc limit 5;
    ```
  - 방금 실행한 기기의 `app_version`/`app_build` 가 **설치 빌드값으로 갱신**됐는지 확인.
  - (재로그인 없이 앱 재실행만으로도 갱신되는지 = 하트비트 동작 확인.)

---

## 테스트 종료 후 반드시 복구 (dev DB)
```sql
update public.app_update_config set enabled=true, latest_version='1.0.43', latest_build='43', min_supported_build=null where platform='android';
update public.app_update_config set enabled=true, latest_version='1.0.1',  latest_build='10', min_supported_build=null where platform='ios';
```
- Capacitor 셸 `server.url` 도 원래(`https://pawdex.store`)로 되돌리기.
- 재테스트하려면 앱의 `app-update-dismissed:*` localStorage 항목도 정리.

---

## 통과 후 prod 반영 순서
1. `supabase/migrations/20260803000000_app_update_config.sql` 를 **prod DB** 에 적용
2. (iOS store_url App ID `6783735811` 최종 확인 — App Store Connect)
3. `develop → main` 배포
4. 이후 새 네이티브 빌드 **실제 스토어 공개 후** `latest_build` 갱신(Android 단계배포 100% 후)
5. 하드 게이트(RequiredUpdateGate)는 소프트 운영 검증 후 별도 작업
