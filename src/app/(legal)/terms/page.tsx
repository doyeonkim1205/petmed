export default function TermsPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">이용약관</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">시행일: 2026년 2월 19일</p>

      <Section title="제1조 (목적)">
        <p>
          본 약관은 PawDex(이하 &quot;서비스&quot;)가 제공하는 반려동물 건강 정보 플랫폼의 이용과 관련하여
          서비스와 이용자 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (정의)">
        <ol>
          <li>&quot;서비스&quot;란 PawDex가 제공하는 반려동물 건강 정보 검색, 건강 기록 관리, 동물병원 찾기 등 일체의 서비스를 말합니다.</li>
          <li>&quot;회원&quot;이란 서비스에 가입하여 이용 계약을 체결한 자를 말합니다.</li>
          <li>&quot;콘텐츠&quot;란 서비스 내에서 회원이 작성한 건강 기록, 반려동물 정보 등 일체의 정보를 말합니다.</li>
        </ol>
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ol>
          <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을 발생합니다.</li>
          <li>서비스는 합리적인 사유가 있는 경우 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은 적용일자 7일 전부터 서비스 내 공지합니다.</li>
          <li>회원이 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제4조 (서비스의 제공)">
        <p>서비스는 다음의 기능을 제공합니다.</p>
        <ul>
          <li>반려동물 질병·건강 정보 검색 및 논문 기반 분석</li>
          <li>반려동물 건강 기록 관리 (증상, 진료, 투약 기록)</li>
          <li>동물병원 찾기 (지도 기반 위치 검색)</li>
          <li>반려동물 프로필 관리</li>
          <li>기타 서비스가 추가 개발하거나 제휴를 통해 제공하는 서비스</li>
        </ul>
      </Section>

      <Section title="제5조 (서비스의 변경 및 중단)">
        <ol>
          <li>서비스는 운영상, 기술상의 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있습니다.</li>
          <li>서비스는 천재지변, 시스템 장애, 기타 불가항력적 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</li>
          <li>서비스 변경 또는 중단 시 서비스 내 공지를 통해 이용자에게 알립니다.</li>
        </ol>
      </Section>

      <Section title="제6조 (회원가입)">
        <ol>
          <li>이용자는 서비스가 정한 양식에 따라 회원정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.</li>
          <li>서비스는 다음 각 호에 해당하지 않는 한 회원가입을 승낙합니다.
            <ul>
              <li>가입신청자가 본 약관에 의해 이전에 회원자격을 상실한 적이 있는 경우</li>
              <li>허위의 정보를 기재한 경우</li>
              <li>기타 서비스가 정한 이용신청 요건이 충족되지 않은 경우</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="제7조 (회원 탈퇴 및 자격 상실)">
        <ol>
          <li>회원은 언제든지 서비스에 탈퇴를 요청할 수 있으며, 서비스는 즉시 회원탈퇴를 처리합니다.</li>
          <li>회원이 다음 각 호의 사유에 해당하는 경우 서비스는 회원자격을 제한 또는 상실시킬 수 있습니다.
            <ul>
              <li>가입 신청 시 허위 내용을 등록한 경우</li>
              <li>다른 이용자의 서비스 이용을 방해하거나 정보를 도용하는 등 질서를 위협하는 경우</li>
              <li>서비스를 이용하여 법령 또는 본 약관이 금지하는 행위를 하는 경우</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="제8조 (회원의 의무)">
        <ol>
          <li>회원은 관계법령, 본 약관의 규정, 이용안내 등을 준수하여야 합니다.</li>
          <li>회원은 다음 각 호의 행위를 하여서는 안 됩니다.
            <ul>
              <li>타인의 개인정보를 도용하는 행위</li>
              <li>서비스에 게시된 정보의 무단 변경</li>
              <li>서비스가 허용하지 않은 정보(컴퓨터 프로그램 등)의 송신 또는 게시</li>
              <li>서비스 또는 제3자의 저작권 등 지적재산권에 대한 침해</li>
              <li>서비스 또는 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
              <li>외설적, 폭력적, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="제9조 (서비스 제공자의 의무)">
        <ol>
          <li>서비스는 관련 법령과 본 약관이 정하는 바에 따라 지속적이고 안정적으로 서비스를 제공하기 위해 노력합니다.</li>
          <li>서비스는 이용자의 개인정보 보호를 위해 개인정보처리방침을 수립하고 이를 준수합니다.</li>
          <li>서비스는 이용자가 안전하게 서비스를 이용할 수 있도록 보안 시스템을 갖추기 위해 노력합니다.</li>
        </ol>
      </Section>

      <Section title="제10조 (면책조항)">
        <ol>
          <li>서비스에서 제공하는 건강 정보는 참고 목적이며, 전문 수의사의 진단 및 치료를 대체하지 않습니다.</li>
          <li>서비스는 논문 검색 및 AI 분석 결과의 정확성을 보증하지 않으며, 이를 기반으로 한 의료적 판단에 대해 책임지지 않습니다.</li>
          <li>서비스는 천재지변 또는 이에 준하는 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
          <li>서비스는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.</li>
          <li>서비스는 이용자가 게시한 콘텐츠의 신뢰성, 정확성에 대해 책임지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제11조 (분쟁 해결)">
        <ol>
          <li>서비스와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법률에 따릅니다.</li>
          <li>서비스와 이용자 간에 분쟁이 발생한 경우, 양 당사자는 분쟁의 해결을 위해 성실히 협의합니다.</li>
          <li>협의에도 불구하고 분쟁이 해결되지 않을 경우, 관할 법원에 소송을 제기할 수 있습니다.</li>
        </ol>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-gray-600 [&_li]:dark:text-gray-400">
        {children}
      </div>
    </section>
  );
}
