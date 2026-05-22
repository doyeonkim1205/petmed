export default function PrivacyPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">개인정보처리방침</h1>

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
        <p><strong>선택 항목:</strong> 프로필 사진, 반려동물 정보(이름, 종류, 품종, 생년월일), 건강 기록(증상, 진료 내용, 투약 정보)</p>
        <p><strong>사진 증상 분석 (선택):</strong> 사용자가 분석 목적으로 직접 업로드한 반려동물 증상 사진. 분석 요청 시 일시적으로 처리되며 서버에 저장하지 않습니다. 자세한 처리 방식은 아래 7. 섹션 참고.</p>
        <p><strong>결제 정보:</strong> 카드사 정보, 승인번호 (카드번호는 직접 저장하지 않으며, 토스페이먼츠를 통해 처리). 자동 결제 이용 시 토스페이먼츠로부터 발급받은 암호화된 빌링키를 저장합니다.</p>
        <p><strong>푸시 알림:</strong> 알림 수신 동의 시 기기 식별을 위한 구독 정보(엔드포인트, 암호화 키)를 수집합니다. 유료 플랜에서만 수집되며, 구독 해지 또는 탈퇴 시 즉시 삭제됩니다.</p>
        <p><strong>자동 수집 항목:</strong> 서비스 이용 기록, 접속 로그, 기기 정보</p>
        <p><strong>소셜 로그인 시:</strong> Google 또는 카카오 계정의 이메일 주소, 프로필 사진(선택)</p>
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
        <table className="w-full text-sm border-collapse mt-2">
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

      <Section title="7. 사진 증상 분석 데이터 처리 (Image Data Handling)">
        <p>
          PawDex 는 보호자가 반려동물의 증상 사진을 업로드하면 AI 가 시각 단서를 분석해
          의심 진단 후보를 제공하는 &quot;사진 증상 분석&quot; 기능을 운영합니다.
          본 섹션은 사진 데이터의 수집·처리·저장 방식을 투명하게 안내합니다.
        </p>

        <p className="mt-3"><strong>7.1 사진 수집 시점 및 권한</strong></p>
        <ul>
          <li>사용자가 사진 증상 분석 메뉴에서 <strong>명시적으로 사진을 첨부</strong>한 경우에만 수집합니다.</li>
          <li>앱은 사용자 동의 하에 디바이스의 <strong>카메라 또는 사진 보관함(갤러리)</strong> 접근 권한을 사용합니다.</li>
          <li>사용자가 거부하면 사진 분석 기능은 사용할 수 없으며, 다른 서비스 이용에는 영향이 없습니다.</li>
          <li>사진 외 다른 미디어 (영상·음성·문서) 는 수집하지 않습니다.</li>
        </ul>

        <p className="mt-3"><strong>7.2 사진 처리 흐름</strong></p>
        <ul>
          <li>업로드된 사진은 디바이스에서 1280px 이내 + JPEG 0.8 품질로 자동 압축됩니다.</li>
          <li>압축된 사진은 HTTPS(TLS) 로 PawDex 서버를 거쳐 OpenAI 의 Vision API 로 전송됩니다.</li>
          <li>AI 가 시각 분석을 마치면 사진 데이터는 <strong>즉시 폐기</strong>되며 서버에 저장하지 않습니다.</li>
          <li>분석 결과 (텍스트 진단 후보·관찰 사항·권고 행동) 만 사용자에게 반환됩니다.</li>
        </ul>

        <p className="mt-3"><strong>7.3 사진 저장 정책 — 서버 미저장</strong></p>
        <ul>
          <li>PawDex 서버 데이터베이스 / 스토리지 / 백업 어디에도 <strong>사진 자체는 저장하지 않습니다</strong>.</li>
          <li>분석 결과를 사용자가 명시적으로 &quot;보관함 저장&quot; 한 경우에만, 사진 썸네일이 <strong>해당 사용자의 디바이스 IndexedDB</strong> 에 저장됩니다.</li>
          <li>IndexedDB 의 썸네일은 디바이스 단위로만 보관되며 다른 기기 / 서버와 공유되지 않습니다. 브라우저 데이터 삭제 시 함께 삭제됩니다.</li>
          <li>분석 결과 텍스트 (진단 후보 등) 와 메타 데이터 (선택한 부위 카테고리, AI 신뢰도, 입력 유형) 만 서비스 통계 목적으로 일부 저장됩니다. 사진 픽셀 데이터는 포함되지 않습니다.</li>
        </ul>

        <p className="mt-3"><strong>7.4 AI 학습에 미사용</strong></p>
        <ul>
          <li>OpenAI 의 API 정책상 API 를 통해 전송된 데이터는 <strong>모델 학습에 사용되지 않습니다</strong>. (<a href="https://openai.com/enterprise-privacy" className="text-blue-500" target="_blank" rel="noopener noreferrer">openai.com/enterprise-privacy</a> 참조)</li>
          <li>PawDex 자체도 사진 데이터를 자체 머신러닝 학습에 사용하지 않습니다.</li>
          <li>제3자에게 사진을 판매·공유·중개하지 않습니다.</li>
        </ul>

        <p className="mt-3"><strong>7.5 보존 및 삭제</strong></p>
        <ul>
          <li>OpenAI 측 임시 처리 데이터는 OpenAI 의 API 데이터 보존 정책 (기본 30일 이내 삭제) 에 따릅니다.</li>
          <li>PawDex 서버의 분석 결과 메타는 회원 탈퇴 시 즉시 삭제됩니다.</li>
          <li>디바이스 IndexedDB 의 썸네일은 사용자가 보관함에서 삭제하거나 브라우저 데이터 삭제 시 즉시 사라집니다.</li>
        </ul>

        <p className="mt-3"><strong>7.6 분석 결과의 한계 — 의료 자문 아님</strong></p>
        <p>
          사진 증상 분석은 보호자에게 <strong>참고용 정보</strong> 만 제공합니다.
          AI 가 사진의 시각 단서를 기반으로 의심 진단 후보를 나열하지만,
          이는 수의사의 진료를 대체할 수 없으며 확진이 아닙니다.
          정확한 진단·치료를 위해서는 반드시 동물병원에서 진료를 받으셔야 합니다.
        </p>
      </Section>

      <Section title="8. 개인정보의 파기 절차 및 방법">
        <ul>
          <li><strong>파기 절차:</strong> 회원 탈퇴 요청 시 즉시 파기하며, 법령에 따라 보관이 필요한 정보는 별도 분리하여 보관 후 기간 만료 시 파기합니다.</li>
          <li><strong>파기 방법:</strong> 전자적 파일은 복구 불가능한 방법으로 삭제하며, 종이 문서는 분쇄 또는 소각합니다.</li>
          <li><strong>소셜 로그인 연동 해제:</strong> 회원 탈퇴 시 Google 또는 카카오 소셜 로그인 연동을 서버 측에서 자동 해제하여, 재가입 시 새로운 동의 절차를 거치도록 합니다.</li>
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
        </ul>
      </Section>

      <Section title="13. 개인정보처리방침의 변경">
        <p>본 방침은 시행일로부터 적용되며, 변경 사항이 있을 경우 서비스 내 공지를 통해 안내합니다.</p>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">시행일: 2026년 5월 22일 (개정 — 사진 증상 분석 데이터 처리 섹션 추가)</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-gray-600 [&_li]:dark:text-gray-400">
        {children}
      </div>
    </section>
  );
}
