export default function RefundPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">환불 정책</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">시행일: 2026년 2월 24일</p>

      <Section title="1. 환불 범위">
        <p>PawDex(이하 &quot;서비스&quot;)는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 다음과 같은 환불 정책을 운영합니다.</p>
        <ul>
          <li>결제일로부터 7일 이내, 유료 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.</li>
          <li>7일 이내라도 유료 서비스(AI 분석, 논문 저장 등)를 이용한 경우, 일할 계산하여 잔여 기간에 해당하는 금액을 환불합니다.</li>
        </ul>
      </Section>

      <Section title="2. 환불 방법">
        <ul>
          <li>환불은 원래 결제 수단으로 처리됩니다. (카드 결제 → 카드 취소)</li>
          <li>토스페이먼츠를 통해 결제된 건은 토스페이먼츠 환불 시스템을 통해 처리됩니다.</li>
        </ul>
      </Section>

      <Section title="3. 일할 계산 방식">
        <p>이용 기간에 따른 환불 금액은 다음과 같이 계산됩니다.</p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 my-3">
          <p className="text-xs text-gray-600 dark:text-gray-300 font-mono">
            환불금액 = 결제금액 × (잔여일수 ÷ 총 이용일수)
          </p>
        </div>
        <ul>
          <li>이용일수는 결제일부터 환불 요청일까지로 계산합니다.</li>
          <li>환불 금액에서 결제 수수료(PG 수수료)가 차감될 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="4. 환불 불가 사유">
        <ul>
          <li>구독 기간이 만료된 경우</li>
          <li>이용약관 위반으로 서비스가 제한된 경우</li>
          <li>구독 기간 내 AI 분석 크레딧을 전부 소진한 경우 (부분 환불은 가능)</li>
        </ul>
      </Section>

      <Section title="5. 환불 처리 기간">
        <ul>
          <li>환불 요청 접수 후 3~10 영업일 이내에 처리됩니다.</li>
          <li>카드사 사정에 따라 취소 반영까지 추가 시간이 소요될 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="6. 구독 해지">
        <ul>
          <li>구독 해지는 서비스 내 프로필 &gt; 요금제 관리에서 언제든지 가능합니다.</li>
          <li>구독 해지 시 현재 결제 주기의 만료일까지 유료 기능을 계속 이용할 수 있습니다.</li>
          <li>만료일 이후 자동으로 무료 플랜으로 전환됩니다.</li>
        </ul>
      </Section>

      <Section title="7. 연락처">
        <ul>
          <li>환불 요청 및 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
          <li>전화: 010-8306-9687</li>
        </ul>
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
