export default function RefundPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">환불 정책</h1>

      <Section title="1. 환불 조건">
        <p>PawDex(이하 &quot;서비스&quot;)는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 다음과 같은 환불 정책을 운영합니다.</p>
        <ul>
          <li>결제일로부터 <strong>24시간 이내</strong>, 유료 서비스를 이용하지 않은 경우 <strong>전액 환불</strong>이 가능합니다.</li>
          <li>결제 후 24시간이 경과하였거나 유료 서비스를 이용한 경우 환불이 불가합니다.</li>
        </ul>
      </Section>

      <Section title="2. 유료 서비스 이용 기준">
        <p>다음 중 하나라도 사용한 경우 유료 서비스를 이용한 것으로 간주합니다.</p>
        <ul>
          <li>AI 논문 분석</li>
          <li>증상 검색</li>
          <li>건강 기록 작성</li>
          <li>논문 저장</li>
        </ul>
      </Section>

      <Section title="3. 환불 방법">
        <ul>
          <li>환불 요청은 서비스 내 프로필 &gt; 요금제 관리에서 가능합니다.</li>
          <li>환불 조건 충족 시 자동으로 즉시 처리됩니다.</li>
          <li>환불은 원래 결제 수단으로 처리됩니다. (카드 결제 → 카드 취소)</li>
          <li>카드사 사정에 따라 취소 반영까지 추가 시간이 소요될 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="4. 환불 불가 사유">
        <ul>
          <li>결제 후 24시간이 경과한 경우</li>
          <li>유료 서비스를 이용한 경우</li>
          <li>구독 기간이 만료된 경우</li>
          <li>이용약관 위반으로 서비스가 제한된 경우</li>
        </ul>
      </Section>

      <Section title="5. 구독 해지">
        <ul>
          <li>구독 해지는 서비스 내 프로필 &gt; 요금제 관리에서 언제든지 가능합니다.</li>
          <li>구독 해지 시 현재 결제 주기의 만료일까지 유료 기능을 계속 이용할 수 있습니다.</li>
          <li>만료일 이후 자동으로 무료 플랜으로 전환됩니다.</li>
        </ul>
      </Section>

      <Section title="6. 연락처">
        <ul>
          <li>환불 관련 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
        </ul>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">시행일: 2026년 3월 11일</p>
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
