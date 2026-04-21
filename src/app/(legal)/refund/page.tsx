export default function RefundPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">환불 정책</h1>

      <Section title="1. 환불 정책 개요">
        <p>PawDex(이하 &quot;서비스&quot;)는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 다음과 같은 환불 정책을 운영합니다. 결제 상품(월간/연간)에 따라 환불 기준이 다릅니다.</p>
      </Section>

      <Section title="2. 월간 구독 환불">
        <ul>
          <li>결제일로부터 <strong>24시간 이내</strong>이고, 유료 서비스를 이용하지 않은 경우 <strong>전액 환불</strong>이 가능합니다.</li>
          <li>결제 후 24시간이 경과하였거나 유료 서비스를 이용한 경우 환불이 불가합니다.</li>
          <li>자동 갱신으로 결제된 차회분도 동일한 기준이 적용됩니다. 즉, 자동 결제일로부터 24시간 이내에 환불을 요청하고 해당 결제 주기의 유료 서비스를 이용하지 않은 경우 전액 환불 가능합니다.</li>
        </ul>
      </Section>

      <Section title="2-1. 자동 갱신(정기 결제) 안내">
        <ul>
          <li>자동 갱신을 등록하면 매월 같은 날 같은 카드로 자동 결제됩니다.</li>
          <li>구독/결제 관리 페이지에서 언제든지 <strong>구독 해지</strong>를 통해 자동 결제를 중지할 수 있습니다.</li>
          <li>구독 해지 시에도 현재 결제 주기 만료일까지는 유료 기능을 계속 이용할 수 있습니다.</li>
          <li>자동 결제 실패 시 1일 → 3일 → 7일 간격으로 최대 3회 재시도하며, 모두 실패하면 자동으로 무료 플랜으로 전환됩니다.</li>
          <li>카드 분실, 도난, 만료, 잘못된 카드 정보 등으로 결제가 거절된 경우에는 즉시 무료 플랜으로 전환되며 푸시 알림으로 안내드립니다.</li>
        </ul>
      </Section>

      <Section title="3. 연간 구독 환불 (비율 환불)">
        <p>연간 구독은 남은 기간에 비례하여 환불됩니다.</p>
        <ul>
          <li>결제일로부터 <strong>24시간 이내</strong>이고, 유료 서비스를 이용하지 않은 경우 <strong>전액 환불</strong>이 가능합니다.</li>
          <li>24시간 경과 후에는 남은 개월 수에 비례한 금액이 환불됩니다.</li>
          <li>이용 개월 수는 결제일로부터 환불 신청일까지의 기간을 기준으로 산정하며, 1일이라도 사용한 달은 1개월로 계산됩니다.</li>
          <li><strong>환불 가능 금액 = 결제 금액 × (남은 개월 수 / 12)</strong></li>
          <li className="text-gray-500">예시: 40,000원으로 연간 구독 후 3개월 사용 시 → 남은 9개월 → 환불액 = 40,000 × (9/12) = <strong>30,000원</strong></li>
          <li>남은 개월 수가 0 이하인 경우 환불이 불가합니다.</li>
        </ul>
      </Section>

      <Section title="4. 유료 서비스 이용 기준">
        <p>다음 중 하나라도 사용한 경우 유료 서비스를 이용한 것으로 간주합니다.</p>
        <ul>
          <li>AI 논문 분석</li>
          <li>증상 분석</li>
          <li>건강 기록 작성</li>
          <li>논문 저장</li>
          <li>푸시 알림 설정</li>
        </ul>
      </Section>

      <Section title="5. 환불 방법">
        <ul>
          <li>환불 요청은 서비스 내 프로필 &gt; 요금제 관리에서 가능합니다.</li>
          <li>환불 조건 충족 시 자동으로 즉시 처리됩니다.</li>
          <li>환불은 원래 결제 수단으로 처리됩니다. (카드 결제 → 카드 취소)</li>
          <li>카드사 사정에 따라 취소 반영까지 추가 시간이 소요될 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="6. 환불 불가 사유">
        <ul>
          <li>월간 구독: 결제 후 24시간이 경과하였거나 유료 서비스를 이용한 경우</li>
          <li>연간 구독: 남은 개월 수가 0 이하인 경우</li>
          <li>구독 기간이 만료된 경우</li>
          <li>이용약관 위반으로 서비스가 제한된 경우</li>
        </ul>
      </Section>

      <Section title="7. 구독 해지 / 자동 갱신 해제">
        <p>해지/해제 관련 항목은 다음과 같이 구분됩니다.</p>
        <ul>
          <li><strong>구독 해지</strong>: 현재 결제 주기 만료일까지 유료 기능을 사용하고, 이후 무료 플랜으로 전환됩니다. 자동 갱신 사용자는 더 이상 자동 결제가 일어나지 않습니다.</li>
          <li><strong>자동 갱신 끄기</strong>: 등록된 결제 카드 정보를 즉시 삭제하고 다음 결제일에 자동 결제가 일어나지 않도록 합니다. 현재 결제 주기 만료일까지는 유료 기능을 계속 이용할 수 있습니다.</li>
          <li>구독 해지 / 자동 갱신 끄기 모두 서비스 내 요금제 관리 페이지에서 1-2 클릭으로 가능합니다.</li>
          <li>해지/해제는 환불과 다른 절차입니다. 환불을 원하시는 경우 별도의 환불 요청을 진행해 주시기 바랍니다.</li>
        </ul>
      </Section>

      <Section title="8. 연락처">
        <ul>
          <li>환불 관련 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
        </ul>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">시행일: 2026년 4월 13일 (개정)</p>
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
