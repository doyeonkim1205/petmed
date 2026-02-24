export default function PrivacyPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">개인정보처리방침</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">시행일: 2026년 2월 24일</p>

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
        <p><strong>결제 정보:</strong> 카드사 정보, 승인번호 (카드번호는 직접 저장하지 않으며, 토스페이먼츠를 통해 처리)</p>
        <p><strong>자동 수집 항목:</strong> 서비스 이용 기록, 접속 로그, 기기 정보</p>
        <p><strong>소셜 로그인 시:</strong> Google 또는 카카오 계정의 이메일 주소, 프로필 사진(선택)</p>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <ul>
          <li>회원 탈퇴 시까지 보유하며, 탈퇴 요청 후 지체 없이 파기합니다.</li>
          <li>관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
          <li>전자상거래법에 따른 계약·청약철회 기록: 5년</li>
          <li>통신비밀보호법에 따른 접속 로그: 3개월</li>
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
              <td className="py-2">AI 기반 논문 분석 및 건강 정보 요약</td>
              <td className="py-2">미국</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">토스페이먼츠(주)</td>
              <td className="py-2">결제 처리 및 정산</td>
              <td className="py-2">대한민국</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="6. 개인정보의 파기 절차 및 방법">
        <ul>
          <li><strong>파기 절차:</strong> 회원 탈퇴 요청 시 즉시 파기하며, 법령에 따라 보관이 필요한 정보는 별도 분리하여 보관 후 기간 만료 시 파기합니다.</li>
          <li><strong>파기 방법:</strong> 전자적 파일은 복구 불가능한 방법으로 삭제하며, 종이 문서는 분쇄 또는 소각합니다.</li>
          <li><strong>소셜 로그인 연동 해제:</strong> 회원 탈퇴 시 Google 또는 카카오 소셜 로그인 연동을 서버 측에서 자동 해제하여, 재가입 시 새로운 동의 절차를 거치도록 합니다.</li>
        </ul>
      </Section>

      <Section title="7. 정보주체의 권리·의무 및 행사 방법">
        <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
        <ul>
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리정지 요구</li>
        </ul>
        <p>권리 행사는 앱 내 프로필 설정 또는 이메일(<a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a>)을 통해 가능합니다.</p>
      </Section>

      <Section title="8. 개인정보 침해사고 대응">
        <p>서비스는 개인정보 침해사고 발생 시 다음과 같이 대응합니다.</p>
        <ul>
          <li><strong>24시간 이내:</strong> 침해사고 탐지 및 차단 조치</li>
          <li><strong>72시간 이내:</strong> 해당 이용자에게 침해 사실, 유출 항목, 대응 조치를 통지</li>
          <li>개인정보보호위원회 및 한국인터넷진흥원(KISA)에 지체 없이 신고</li>
          <li>피해 최소화를 위한 비밀번호 변경 권고 및 추가 보안 조치 시행</li>
        </ul>
      </Section>

      <Section title="9. 개인정보 보호책임자">
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

      <Section title="10. 개인정보의 안전성 확보 조치">
        <p>서비스는 개인정보의 안전성 확보를 위해 다음 조치를 취하고 있습니다.</p>
        <ul>
          <li>모든 데이터 전송 시 HTTPS(TLS) 암호화 적용</li>
          <li>비밀번호 해시 처리 저장 (평문 저장 금지)</li>
          <li>API 접근 시 인증 토큰 기반 접근 제어</li>
          <li>서버 측 보안 헤더 적용 (XSS, 클릭재킹 방지)</li>
          <li>민감한 API 키의 서버 측 전용 관리 (클라이언트 노출 방지)</li>
        </ul>
      </Section>

      <Section title="11. 개인정보처리방침의 변경">
        <p>본 방침은 시행일로부터 적용되며, 변경 사항이 있을 경우 서비스 내 공지를 통해 안내합니다.</p>
      </Section>
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
