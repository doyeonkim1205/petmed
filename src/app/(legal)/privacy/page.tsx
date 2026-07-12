import { getLocale, getTranslations } from 'next-intl/server';
import { LegalPage, LegalRefNotice } from '../_components/LegalHeader';

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations('legal');
  const en = locale === 'en';

  return (
    <LegalPage title={t('privacyTitle')}>
    <article className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: '13px' }}>
      {en ? <PrivacyEn refNotice={t('refNotice')} /> : <PrivacyKo />}
    </article>
    </LegalPage>
  );
}

function PrivacyKo() {
  return (
    <>
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
        PawDex(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 및 관련 법령을 준수합니다.
        본 개인정보처리방침은 서비스가 수집하는 개인정보의 항목, 수집 및 이용 목적, 보유 기간 등을 안내합니다.
      </p>

      <Section title="1. 개인정보의 처리 목적">
        <p>서비스는 다음 목적을 위해 개인정보를 처리합니다.</p>
        <ul>
          <li>회원가입 및 본인 확인</li>
          <li>반려동물 건강 기록 관리</li>
          <li>질병 검색 결과 저장 및 분석</li>
          <li>동물병원 찾기 서비스 제공</li>
          <li>질병 정보 검색 및 논문 분석 결과 제공</li>
          <li>서비스 개선 및 오류 대응</li>
        </ul>
      </Section>

      <Section title="2. 수집하는 개인정보 항목">
        <p><strong>필수 항목:</strong> 이메일 주소, 비밀번호(해시 처리), 닉네임</p>
        <p><strong>선택 항목:</strong> 프로필 사진, 반려동물 정보(이름, 종류, 품종, 생년월일, 성별, 중성화, 체중, 만성질환), 건강 기록(증상, 진료 내용, 입퇴원, 일상 기록(산책·식사·수분·배변·기분 등), 투약 정보, 체중 기록)</p>
        <p><strong>사진 증상 분석 (선택):</strong> 사용자가 분석 목적으로 직접 업로드한 반려동물 증상 사진. 분석 요청 시 일시적으로 처리되며 서버에 저장하지 않습니다. 자세한 처리 방식은 아래 7. 섹션 참고.</p>
        <p><strong>결제 정보:</strong> 웹(pawdex.store) 결제 시 카드사 정보, 승인번호 (카드번호는 직접 저장하지 않으며, 토스페이먼츠를 통해 처리). 자동 결제 이용 시 토스페이먼츠로부터 발급받은 암호화된 빌링키를 저장합니다. 모바일 앱 결제는 Apple App Store(iOS)·Google Play(Android)의 인앱 결제로 처리되며, 결제 수단 정보는 Apple·Google이 처리하여 당사가 수집하지 않습니다. 구독 상태 확인을 위해 RevenueCat을 통해 익명 사용자 식별자와 구독 상품·상태 정보를 처리합니다.</p>
        <p><strong>푸시 알림:</strong> 알림 수신 동의 시 기기 식별을 위한 구독 정보(엔드포인트, 암호화 키 또는 FCM/APNs 토큰)를 수집합니다. 유료 플랜에서만 수집되며, 구독 해지 또는 탈퇴 시 즉시 삭제됩니다.</p>
        <p><strong>자동 수집 항목:</strong> 서비스 이용 기록, 접속 로그, 기기 정보</p>
        <p><strong>소셜 로그인 시:</strong> Google, 카카오 또는 Apple 계정의 이메일 주소, 프로필 사진(선택). Apple 로그인 시 이메일 가리기를 선택하면 Apple의 비공개 릴레이 주소가 수집될 수 있습니다.</p>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <ul>
          <li>회원 탈퇴 시까지 보유하며, 탈퇴 요청 후 지체 없이 파기합니다.</li>
          <li>관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
          <li>전자상거래법에 따른 계약·청약철회 기록: 5년</li>
          <li>통신비밀보호법에 따른 접속 로그: 3개월</li>
          <li>
            <strong>서비스 개선 및 통계 분석 목적의 비식별 활동 기록:</strong>
            회원 탈퇴 시 프로필과 개인 식별 정보는 즉시 삭제되며, 활동 기록
            (행동 이력, 검색 기록 등) 은 개인을 식별할 수 있는 정보와
            분리·비식별 처리되어 서비스 개선·오류 추적·통계 분석 목적으로
            보관될 수 있습니다. 비식별 처리된 기록은 역추적을 통해 개인을
            재식별하지 않습니다.
          </li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
        <ul>
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </Section>

      <Section title="5. 개인정보 처리의 위탁">
        <p>서비스는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
        <table className="w-full text-[13px] border-collapse mt-2">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 font-medium">수탁자</th>
              <th className="text-left py-2 font-medium">위탁 업무</th>
              <th className="text-left py-2 font-medium">서버 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Supabase Inc.</td>
              <td className="py-2">데이터베이스 호스팅, 인증 처리</td>
              <td className="py-2">일본 도쿄 (Northeast Asia)</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Vercel Inc.</td>
              <td className="py-2">웹 애플리케이션 호스팅</td>
              <td className="py-2">글로벌 CDN</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">OpenAI, Inc.</td>
              <td className="py-2">AI 기반 논문 분석, 건강 정보 요약, 증상 사진 분석</td>
              <td className="py-2">미국</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">토스페이먼츠(주)</td>
              <td className="py-2">결제 처리 및 정산</td>
              <td className="py-2">대한민국</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">카카오(주)</td>
              <td className="py-2">지도 표시 및 주변 동물병원 검색</td>
              <td className="py-2">대한민국</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Apple Inc.</td>
              <td className="py-2">iOS 앱 인앱 결제 처리, Apple 로그인</td>
              <td className="py-2">미국</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Google LLC</td>
              <td className="py-2">Android 앱 인앱 결제 처리(Google Play), Google 로그인</td>
              <td className="py-2">미국</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">RevenueCat, Inc.</td>
              <td className="py-2">앱 인앱 구독 상태 관리·검증</td>
              <td className="py-2">미국</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="6. Google 사용자 데이터 처리 (Google User Data Handling)">
        <p>
          PawDex 는 Google OAuth 2.0 을 통한 로그인 기능을 제공하며,
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-500" target="_blank" rel="noopener noreferrer"> Google API Services User Data Policy</a>
          {' '}(Limited Use 요건 포함) 를 준수합니다.
        </p>

        <p className="mt-3"><strong>6.1 수집하는 Google 사용자 데이터 (Data Accessed)</strong></p>
        <ul>
          <li><strong>이메일 주소</strong> (Google OAuth scope: <code>email</code>) — 계정 식별자로 사용</li>
          <li><strong>프로필 이름</strong> (scope: <code>profile</code>) — 앱 내 닉네임 기본값</li>
          <li><strong>프로필 사진 URL</strong> (scope: <code>profile</code>, 선택) — 앱 내 프로필 이미지</li>
        </ul>
        <p>
          그 외 어떤 Google 사용자 데이터에도 접근하지 않습니다. Gmail, Google Drive,
          Google Calendar, Contacts, Photos 등 <strong>민감한 scope 는 요청하지 않으며 접근도 하지 않습니다</strong>.
        </p>

        <p className="mt-3"><strong>6.2 사용 목적 (Data Usage / Purpose)</strong></p>
        <ul>
          <li>회원 계정 생성 및 고유 식별</li>
          <li>로그인 인증 (매 세션마다 Google 을 통한 본인 확인)</li>
          <li>앱 내 프로필 표시 (닉네임, 프로필 사진)</li>
        </ul>
        <p>
          위 세 가지 용도 외에는 Google 사용자 데이터를 사용하지 않습니다.
        </p>

        <p className="mt-3"><strong>6.3 처리 및 저장 (Data Processing and Storage)</strong></p>
        <ul>
          <li>전송 구간 전체 HTTPS / TLS 1.2+ 암호화</li>
          <li>Supabase Auth 데이터베이스에 저장 (서버 위치: 일본 도쿄)</li>
          <li>이메일은 사용자 식별자로만 사용하며 외부로 노출되지 않음</li>
          <li>프로필 사진은 Google 이 제공하는 URL 을 참조만 하며 당사 서버에 복사 저장하지 않음</li>
        </ul>

        <p className="mt-3"><strong>6.4 데이터 공유 및 판매 (Data Sharing)</strong></p>
        <ul>
          <li>Google 사용자 데이터를 <strong>제3자와 공유하거나 판매하지 않습니다</strong></li>
          <li>광고 목적으로 사용하지 않습니다</li>
          <li>AI / 머신러닝 모델 학습에 사용하지 않습니다 (OpenAI 에 전송되는 데이터에도 포함되지 않음)</li>
          <li>데이터 중개(brokering) 또는 재판매하지 않습니다</li>
        </ul>

        <p className="mt-3"><strong>6.5 Limited Use 준수 선언</strong></p>
        <p>
          PawDex 의 Google 사용자 데이터 사용은 Google API Services User Data Policy 의
          Limited Use 요건을 완전히 준수합니다:
        </p>
        <ul>
          <li>앱 사용자에게 직접적으로 가시적인 기능을 제공하기 위한 목적으로만 사용</li>
          <li>AI/ML 모델 학습 및 개선에 사용하지 않음</li>
          <li>광고 또는 마케팅 목적으로 사용하지 않음</li>
          <li>제3자에게 전송/판매/공유하지 않음 (법령 요구 시 제외)</li>
        </ul>

        <p className="mt-3"><strong>6.6 보존 및 삭제 (Data Retention and Deletion)</strong></p>
        <ul>
          <li>회원이 서비스를 이용하는 동안 Google 사용자 데이터를 보관합니다</li>
          <li>회원 탈퇴 요청 시 <strong>즉시 삭제</strong>합니다 (앱 내 설정 → 회원 탈퇴 메뉴)</li>
          <li>탈퇴 시 Supabase Auth 의 Google OAuth 연결도 서버 측에서 자동 해제됩니다</li>
          <li>사용자는 언제든 Google 계정 설정 (<a href="https://myaccount.google.com/permissions" className="text-blue-500" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>) 에서 PawDex 의 접근 권한을 직접 해제할 수 있습니다</li>
        </ul>

        <p className="mt-3"><strong>6.7 문의</strong></p>
        <p>
          Google 사용자 데이터 관련 문의는 개인정보 보호책임자(<a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>) 로 연락해주세요.
        </p>
      </Section>

      <Section title="7. 사진 증상 분석 데이터 처리">
        <p>
          PawDex 는 보호자가 반려동물의 증상 사진을 업로드하면 AI 가 시각 단서를
          분석해 의심 진단 후보를 제공하는 &quot;사진 증상 분석&quot; 기능을 운영합니다.
        </p>

        <p className="mt-3"><strong>7.1 수집 및 권한</strong></p>
        <ul>
          <li>사용자가 사진 분석 메뉴에서 사진을 직접 첨부할 때만 수집합니다.</li>
          <li>디바이스의 카메라 또는 갤러리 접근 권한은 사용자 동의 하에 사용되며, 거부 시 사진 분석 기능만 비활성화되고 다른 서비스 이용엔 영향이 없습니다.</li>
        </ul>

        <p className="mt-3"><strong>7.2 처리 및 저장</strong></p>
        <ul>
          <li>사진은 디바이스에서 압축된 후 HTTPS 로 OpenAI Vision API 로 전송됩니다.</li>
          <li>AI 분석 후 사진은 즉시 폐기되며 PawDex 서버에 저장하지 않습니다.</li>
          <li>사용자가 명시 저장 시에만 사진 썸네일이 본인 디바이스 IndexedDB 에 저장되고, 다른 기기 / 서버와 공유되지 않습니다.</li>
        </ul>

        <p className="mt-3"><strong>7.3 AI 학습 미사용 및 삭제</strong></p>
        <ul>
          <li>OpenAI API 정책상 전송 데이터는 모델 학습에 사용되지 않으며, OpenAI 측에서도 30일 이내 삭제됩니다. (<a href="https://openai.com/enterprise-privacy" className="text-blue-500" target="_blank" rel="noopener noreferrer">openai.com/enterprise-privacy</a> 참조)</li>
          <li>PawDex 자체 ML 학습에 사용하지 않으며 제3자에게 공유·판매하지 않습니다.</li>
          <li>회원 탈퇴 시 분석 결과 메타는 즉시 삭제됩니다.</li>
        </ul>

        <p className="mt-3"><strong>7.4 한계 안내</strong></p>
        <p>
          사진 분석은 <strong>참고용 정보</strong> 이며 수의사 진료를 대체할 수 없습니다.
          정확한 진단과 치료는 반드시 동물병원에서 받으셔야 합니다.
        </p>
      </Section>

      <Section title="8. 개인정보의 파기 절차 및 방법">
        <ul>
          <li><strong>파기 절차:</strong> 회원 탈퇴 요청 시 즉시 파기하며, 법령에 따라 보관이 필요한 정보는 별도 분리하여 보관 후 기간 만료 시 파기합니다.</li>
          <li><strong>파기 방법:</strong> 전자적 파일은 복구 불가능한 방법으로 삭제하며, 종이 문서는 분쇄 또는 소각합니다.</li>
          <li><strong>소셜 로그인 연동 해제:</strong> 회원 탈퇴 시 Google, 카카오 또는 Apple 소셜 로그인 연동을 서버 측에서 자동 해제(Apple은 토큰 revoke)하여, 재가입 시 새로운 동의 절차를 거치도록 합니다.</li>
          <li>
            <strong>비식별 활동 기록 보관:</strong>
            탈퇴 시 프로필 (이름, 이메일, 닉네임, 연락처 등) 은 즉시 삭제되며,
            활동 기록은 내부 식별자만 남긴 비식별 상태로 보관됩니다.
            비식별 처리된 기록은 다른 정보와 결합해도 개인을 다시 식별할 수
            없도록 처리되며, 서비스 오류 추적·품질 개선·통계 목적으로만
            사용됩니다.
          </li>
        </ul>
      </Section>

      <Section title="9. 정보주체의 권리·의무 및 행사 방법">
        <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
        <ul>
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리정지 요구</li>
        </ul>
        <p>권리 행사는 앱 내 프로필 설정 또는 이메일(<a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>)을 통해 가능합니다.</p>
      </Section>

      <Section title="10. 개인정보 침해사고 대응">
        <p>서비스는 개인정보 침해사고 발생 시 다음과 같이 대응합니다.</p>
        <ul>
          <li><strong>24시간 이내:</strong> 침해사고 탐지 및 차단 조치</li>
          <li><strong>72시간 이내:</strong> 해당 이용자에게 침해 사실, 유출 항목, 대응 조치를 통지</li>
          <li>개인정보보호위원회 및 한국인터넷진흥원(KISA)에 지체 없이 신고</li>
          <li>피해 최소화를 위한 비밀번호 변경 권고 및 추가 보안 조치 시행</li>
        </ul>
      </Section>

      <Section title="11. 개인정보 보호책임자">
        <ul>
          <li>담당자: 김도연 (디와이랩스 대표)</li>
          <li>이메일: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
        </ul>
        <p>개인정보 침해에 대한 신고·상담은 아래 기관에 문의하실 수 있습니다.</p>
        <ul>
          <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
          <li>개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
        </ul>
      </Section>

      <Section title="12. 개인정보의 안전성 확보 조치">
        <p>서비스는 개인정보의 안전성 확보를 위해 다음 조치를 취하고 있습니다.</p>
        <ul>
          <li>모든 데이터 전송 시 HTTPS(TLS) 암호화 적용</li>
          <li>비밀번호 해시 처리 저장 (평문 저장 금지)</li>
          <li>API 접근 시 인증 토큰 기반 접근 제어</li>
          <li>서버 측 보안 헤더 적용 (XSS, 클릭재킹 방지)</li>
          <li>민감한 API 키의 서버 측 전용 관리 (클라이언트 노출 방지)</li>
          <li>개인정보에 접근할 수 있는 담당자를 최소한으로 제한하며, 고객지원·서비스 운영 및 오류 대응 목적에 한해 접근합니다. 모든 관리자 열람 이력은 별도로 기록·관리됩니다.</li>
        </ul>
      </Section>

      <Section title="13. 개인정보처리방침의 변경">
        <p>본 방침은 시행일로부터 적용되며, 변경 사항이 있을 경우 서비스 내 공지를 통해 안내합니다.</p>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">시행일: 2026년 7월 12일 (개정 — 개인정보 접근 통제 및 관리자 열람 기록 조항 명시)</p>
    </>
  );
}

function PrivacyEn({ refNotice }: { refNotice: string }) {
  return (
    <>
      <LegalRefNotice text={refNotice} />

      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
        PawDex (the &quot;Service&quot;) values your personal information and complies with the Personal Information Protection Act
        and related laws of the Republic of Korea. This Privacy Policy explains the items of personal information the Service
        collects, the purposes of collection and use, and the retention period.
      </p>

      <Section title="1. Purposes of Processing Personal Information">
        <p>The Service processes personal information for the following purposes:</p>
        <ul>
          <li>Membership registration and identity verification</li>
          <li>Managing pet health records</li>
          <li>Storing and analyzing disease search results</li>
          <li>Providing the animal-hospital finder service</li>
          <li>Providing disease information search and paper analysis results</li>
          <li>Service improvement and error handling</li>
        </ul>
      </Section>

      <Section title="2. Items of Personal Information Collected">
        <p><strong>Required:</strong> Email address, password (hashed), nickname</p>
        <p><strong>Optional:</strong> Profile photo, pet information (name, species, breed, date of birth, sex, neuter status, weight, chronic conditions), health records (symptoms, visit details, hospitalization, daily records (walks, meals, hydration, elimination, mood, etc.), medication information, weight records)</p>
        <p><strong>Photo symptom analysis (optional):</strong> Pet symptom photos that the user uploads for analysis. They are processed temporarily upon an analysis request and are not stored on our servers. See Section 7 below for details.</p>
        <p><strong>Payment information:</strong> For web (pawdex.store) payments, card issuer information and approval number (the card number itself is not stored directly and is processed through Toss Payments); for automatic payments, an encrypted billing key issued by Toss Payments is stored. Mobile app payments are processed via the in-app billing of the Apple App Store (iOS) and Google Play (Android); payment method details are handled by Apple/Google and are not collected by us. To verify subscription status, an anonymous user identifier and subscription product/status information are processed through RevenueCat.</p>
        <p><strong>Push notifications:</strong> With your consent to receive notifications, subscription information for device identification (endpoint, encryption keys) is collected. It is collected only on paid plans and is deleted immediately upon cancellation or withdrawal.</p>
        <p><strong>Automatically collected:</strong> Service usage records, access logs, device information</p>
        <p><strong>For social login:</strong> Email address of the Google, Kakao, or Apple account, profile photo (optional). If you choose Hide My Email when signing in with Apple, an Apple private relay address may be collected.</p>
      </Section>

      <Section title="3. Retention and Use Period of Personal Information">
        <ul>
          <li>Retained until membership withdrawal, and destroyed without delay after a withdrawal request.</li>
          <li>Where retention is required by applicable law, it is kept for the relevant period.</li>
          <li>Records of contracts and withdrawal of offers under the Electronic Commerce Act: 5 years</li>
          <li>Access logs under the Protection of Communications Secrets Act: 3 months</li>
          <li>
            <strong>De-identified activity records for service improvement and statistical analysis:</strong>
            Upon withdrawal, profile and personally identifying information is deleted immediately, while activity records
            (behavior history, search history, etc.) may be separated and de-identified from personally identifiable
            information and retained for service improvement, error tracking, and statistical analysis. De-identified
            records are not re-identified to an individual through reverse tracking.
          </li>
        </ul>
      </Section>

      <Section title="4. Provision of Personal Information to Third Parties">
        <p>As a rule, the Service does not provide users&apos; personal information to third parties. The following are exceptions:</p>
        <ul>
          <li>When the user has consented in advance</li>
          <li>When required by law, or when an investigative agency requests it for investigative purposes in accordance with the procedures and methods prescribed by law</li>
        </ul>
      </Section>

      <Section title="5. Entrustment of Personal Information Processing">
        <p>The Service entrusts personal information processing tasks as follows for smooth service provision.</p>
        <table className="w-full text-[13px] border-collapse mt-2">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 font-medium">Processor</th>
              <th className="text-left py-2 font-medium">Entrusted task</th>
              <th className="text-left py-2 font-medium">Server location</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Supabase Inc.</td>
              <td className="py-2">Database hosting, authentication</td>
              <td className="py-2">Tokyo, Japan (Northeast Asia)</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Vercel Inc.</td>
              <td className="py-2">Web application hosting</td>
              <td className="py-2">Global CDN</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">OpenAI, Inc.</td>
              <td className="py-2">AI-based paper analysis, health information summaries, symptom photo analysis</td>
              <td className="py-2">United States</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Toss Payments Co., Ltd.</td>
              <td className="py-2">Payment processing and settlement</td>
              <td className="py-2">Republic of Korea</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Kakao Corp.</td>
              <td className="py-2">Map display and nearby animal hospital search</td>
              <td className="py-2">Republic of Korea</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Apple Inc.</td>
              <td className="py-2">iOS in-app purchase processing, Sign in with Apple</td>
              <td className="py-2">United States</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Google LLC</td>
              <td className="py-2">Android in-app purchase processing (Google Play), Google login</td>
              <td className="py-2">United States</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">RevenueCat, Inc.</td>
              <td className="py-2">In-app subscription status management and validation</td>
              <td className="py-2">United States</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="6. Google User Data Handling">
        <p>
          PawDex provides login via Google OAuth 2.0 and complies with the
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-500" target="_blank" rel="noopener noreferrer"> Google API Services User Data Policy</a>
          {' '}(including the Limited Use requirements).
        </p>

        <p className="mt-3"><strong>6.1 Google User Data Accessed</strong></p>
        <ul>
          <li><strong>Email address</strong> (Google OAuth scope: <code>email</code>) — used as the account identifier</li>
          <li><strong>Profile name</strong> (scope: <code>profile</code>) — default nickname in the app</li>
          <li><strong>Profile photo URL</strong> (scope: <code>profile</code>, optional) — profile image in the app</li>
        </ul>
        <p>
          We do not access any other Google user data. We <strong>do not request or access sensitive scopes</strong> such as
          Gmail, Google Drive, Google Calendar, Contacts, or Photos.
        </p>

        <p className="mt-3"><strong>6.2 Data Usage / Purpose</strong></p>
        <ul>
          <li>Creating and uniquely identifying member accounts</li>
          <li>Login authentication (verifying identity via Google each session)</li>
          <li>Displaying the in-app profile (nickname, profile photo)</li>
        </ul>
        <p>
          We do not use Google user data for any purpose other than the three above.
        </p>

        <p className="mt-3"><strong>6.3 Data Processing and Storage</strong></p>
        <ul>
          <li>HTTPS / TLS 1.2+ encryption across the entire transmission path</li>
          <li>Stored in the Supabase Auth database (server location: Tokyo, Japan)</li>
          <li>Email is used only as a user identifier and is not exposed externally</li>
          <li>The profile photo only references the URL provided by Google and is not copied to or stored on our servers</li>
        </ul>

        <p className="mt-3"><strong>6.4 Data Sharing</strong></p>
        <ul>
          <li>We <strong>do not share or sell Google user data with third parties</strong></li>
          <li>We do not use it for advertising purposes</li>
          <li>We do not use it to train AI / machine-learning models (it is not included in data sent to OpenAI)</li>
          <li>We do not broker or resell data</li>
        </ul>

        <p className="mt-3"><strong>6.5 Limited Use Compliance Statement</strong></p>
        <p>
          PawDex&apos;s use of Google user data fully complies with the Limited Use requirements of the
          Google API Services User Data Policy:
        </p>
        <ul>
          <li>Used only to provide features directly visible to app users</li>
          <li>Not used to train or improve AI/ML models</li>
          <li>Not used for advertising or marketing purposes</li>
          <li>Not transmitted/sold/shared to third parties (except where required by law)</li>
        </ul>

        <p className="mt-3"><strong>6.6 Data Retention and Deletion</strong></p>
        <ul>
          <li>We retain Google user data while the member uses the Service</li>
          <li>We <strong>delete it immediately</strong> upon a withdrawal request (in-app Settings → Delete account menu)</li>
          <li>Upon withdrawal, the Google OAuth connection in Supabase Auth is also automatically disconnected on the server side</li>
          <li>You can revoke PawDex&apos;s access at any time in your Google account settings (<a href="https://myaccount.google.com/permissions" className="text-blue-500" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>)</li>
        </ul>

        <p className="mt-3"><strong>6.7 Inquiries</strong></p>
        <p>
          For inquiries about Google user data, please contact the Privacy Officer (<a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>).
        </p>
      </Section>

      <Section title="7. Photo Symptom Analysis Data Handling">
        <p>
          PawDex operates a &quot;photo symptom analysis&quot; feature in which, when a guardian uploads a photo of their pet&apos;s
          symptoms, AI analyzes visual cues to suggest candidate diagnoses.
        </p>

        <p className="mt-3"><strong>7.1 Collection and Permissions</strong></p>
        <ul>
          <li>Collected only when the user directly attaches a photo in the photo analysis menu.</li>
          <li>Camera or gallery access on the device is used with the user&apos;s consent; if declined, only the photo analysis feature is disabled and other services are unaffected.</li>
        </ul>

        <p className="mt-3"><strong>7.2 Processing and Storage</strong></p>
        <ul>
          <li>Photos are compressed on the device and sent over HTTPS to the OpenAI Vision API.</li>
          <li>After AI analysis, the photo is discarded immediately and is not stored on PawDex servers.</li>
          <li>Only when the user explicitly saves it, a photo thumbnail is stored in the user&apos;s own device IndexedDB and is not shared with other devices or servers.</li>
        </ul>

        <p className="mt-3"><strong>7.3 No AI Training and Deletion</strong></p>
        <ul>
          <li>Per OpenAI API policy, transmitted data is not used to train models and is deleted by OpenAI within 30 days. (See <a href="https://openai.com/enterprise-privacy" className="text-blue-500" target="_blank" rel="noopener noreferrer">openai.com/enterprise-privacy</a>)</li>
          <li>We do not use it for PawDex&apos;s own ML training and do not share or sell it to third parties.</li>
          <li>Analysis result metadata is deleted immediately upon membership withdrawal.</li>
        </ul>

        <p className="mt-3"><strong>7.4 Limitations</strong></p>
        <p>
          Photo analysis is <strong>for reference only</strong> and cannot replace a veterinary consultation.
          You must obtain an accurate diagnosis and treatment from an animal hospital.
        </p>
      </Section>

      <Section title="8. Procedures and Methods for Destroying Personal Information">
        <ul>
          <li><strong>Destruction procedure:</strong> Destroyed immediately upon a withdrawal request; information that must be retained by law is stored separately and destroyed when the period expires.</li>
          <li><strong>Destruction method:</strong> Electronic files are deleted in an unrecoverable manner, and paper documents are shredded or incinerated.</li>
          <li><strong>Disconnecting social login:</strong> Upon withdrawal, the Google, Kakao, or Apple social login connection is automatically disconnected on the server side (for Apple, the token is revoked) so that re-registration requires a new consent process.</li>
          <li>
            <strong>Retention of de-identified activity records:</strong>
            Upon withdrawal, the profile (name, email, nickname, contact, etc.) is deleted immediately, while activity
            records are retained in a de-identified state that keeps only an internal identifier. De-identified records are
            processed so that an individual cannot be re-identified even when combined with other information, and are used
            only for service error tracking, quality improvement, and statistical purposes.
          </li>
        </ul>
      </Section>

      <Section title="9. Rights and Obligations of the Data Subject and How to Exercise Them">
        <p>You may exercise the following rights at any time.</p>
        <ul>
          <li>Request to access personal information</li>
          <li>Request to correct errors</li>
          <li>Request deletion</li>
          <li>Request to suspend processing</li>
        </ul>
        <p>You can exercise these rights through in-app Profile settings or by email (<a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>).</p>
      </Section>

      <Section title="10. Response to Personal Information Breaches">
        <p>In the event of a personal information breach, the Service responds as follows.</p>
        <ul>
          <li><strong>Within 24 hours:</strong> Detect the breach and take blocking measures</li>
          <li><strong>Within 72 hours:</strong> Notify the affected user of the breach, the leaked items, and the response measures</li>
          <li>Report without delay to the Personal Information Protection Commission and the Korea Internet &amp; Security Agency (KISA)</li>
          <li>Recommend password changes and implement additional security measures to minimize harm</li>
        </ul>
      </Section>

      <Section title="11. Privacy Officer">
        <ul>
          <li>Officer: Kim Doyeon (Representative of DYLabs)</li>
          <li>Email: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
        </ul>
        <p>You may report or consult about privacy violations to the following Korean agencies.</p>
        <ul>
          <li>Privacy Infringement Report Center (privacy.kisa.or.kr / 118)</li>
          <li>Personal Information Dispute Mediation Committee (kopico.go.kr / 1833-6972)</li>
        </ul>
      </Section>

      <Section title="12. Measures to Ensure the Safety of Personal Information">
        <p>The Service takes the following measures to ensure the safety of personal information.</p>
        <ul>
          <li>HTTPS (TLS) encryption applied to all data transmission</li>
          <li>Passwords stored hashed (plaintext storage prohibited)</li>
          <li>Authentication token–based access control for API access</li>
          <li>Server-side security headers applied (XSS, clickjacking prevention)</li>
          <li>Server-side-only management of sensitive API keys (prevents client exposure)</li>
          <li>Access to personal information is limited to the minimum necessary personnel and is permitted only for customer support, service operation, and error handling; all administrator access is separately logged and managed.</li>
        </ul>
      </Section>

      <Section title="13. Changes to the Privacy Policy">
        <p>This policy applies from its effective date, and any changes are announced through a notice within the Service.</p>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">Effective date: July 12, 2026 (revised — added personal-information access control and administrator access-logging clause)</p>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-gray-600 [&_li]:dark:text-gray-400">
        {children}
      </div>
    </section>
  );
}
