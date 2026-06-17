import { getLocale, getTranslations } from 'next-intl/server';
import { LegalPage, LegalRefNotice } from '../_components/LegalHeader';

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getTranslations('legal');
  const en = locale === 'en';

  return (
    <LegalPage title={t('termsTitle')}>
    <article className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: '13px' }}>
      {en ? <TermsEn refNotice={t('refNotice')} /> : <TermsKo />}
    </article>
    </LegalPage>
  );
}

function TermsKo() {
  return (
    <>
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
          <li>&quot;콘텐츠&quot;란 서비스 내에서 회원이 작성한 건강 기록(증상·진료·입퇴원·일상 기록 등), 반려동물 정보, 업로드한 사진·파일 등 일체의 정보를 말합니다.</li>
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
          <li>AI 기반 증상 분석 (텍스트 입력) 및 사진 증상 분석 (선택 기능)</li>
          <li>반려동물 건강 기록 관리 (증상, 진료, 입퇴원, 일상 기록, 투약 기록)</li>
          <li>일상 기록 (산책·식사·수분·배변·기분 등 평소 모습 메모)</li>
          <li>체중 변화 및 의료비 통계 관리</li>
          <li>투약 알림 및 진료 예약 관리</li>
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
              <li>자동화된 수단(봇, 스크래퍼 등)을 이용하여 서비스의 API를 비정상적으로 호출하거나 과도한 요청을 발생시키는 행위</li>
              <li>서비스의 AI 분석 기능을 본래 목적 외의 용도로 악용하는 행위</li>
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

      <Section title="제10조 (AI 분석 서비스)">
        <ol>
          <li>서비스는 OpenAI의 AI 기술을 활용하여 논문 분석, 건강 정보 요약 등의 기능을 제공합니다.</li>
          <li>AI 분석 기능은 로그인한 회원에게만 제공되며, 인증된 요청에 한해 처리됩니다.</li>
          <li>AI 분석 결과는 참고 목적으로만 제공되며, 전문 수의사의 판단을 대체하지 않습니다.</li>
          <li>서비스는 AI 분석 과정에서 이용자의 개인정보를 AI 제공업체에 전달하지 않으며, 질병·증상 관련 텍스트만 처리합니다.</li>
        </ol>
      </Section>

      <Section title="제11조 (면책조항)">
        <ol>
          <li>서비스에서 제공하는 건강 정보는 참고 목적이며, 전문 수의사의 진단 및 치료를 대체하지 않습니다.</li>
          <li>서비스는 논문 검색 및 AI 분석 결과의 정확성을 보증하지 않으며, 이를 기반으로 한 의료적 판단에 대해 책임지지 않습니다.</li>
          <li>서비스는 천재지변 또는 이에 준하는 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
          <li>서비스는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.</li>
          <li>서비스는 이용자가 게시한 콘텐츠의 신뢰성, 정확성에 대해 책임지지 않습니다.</li>
        </ol>
      </Section>

      <Section title="제12조 (유료 서비스 및 결제)">
        <ol>
          <li>서비스는 무료(Free), 플러스(Plus)의 2단계 요금제를 제공하며, 각 요금제의 이용 범위 및 요금은 서비스 내 요금제 페이지에 게시합니다.</li>
          <li>플러스 요금제는 결제 주기에 따라 월간(매월 자동 갱신 또는 1회 결제)과 연간(1회 결제)으로 구성됩니다.</li>
          <li>유료 서비스의 결제는 토스페이먼츠(주)가 제공하는 결제 시스템을 통해 처리됩니다.</li>
          <li>결제 금액, 결제일, 이용 기간 등은 결제 시 명확히 표시됩니다.</li>
          <li>서비스는 요금제의 가격 및 내용을 변경할 수 있으며, 변경 시 30일 전 서비스 내 공지를 통해 안내합니다.</li>
        </ol>
      </Section>

      <Section title="제12조의2 (자동 결제)">
        <ol>
          <li>회원이 자동 갱신을 선택한 월간 구독은 결제일과 동일한 일자에 등록된 결제 수단으로 자동으로 결제됩니다.</li>
          <li>자동 결제 등록 시 회원은 결제 페이지에서 별도로 자동 결제에 동의하여야 합니다.</li>
          <li>회원은 서비스 내 요금제 관리 페이지에서 언제든지 자동 갱신을 해제할 수 있으며, 해제 시 등록된 결제 수단 정보는 즉시 폐기됩니다.</li>
          <li>자동 갱신을 해제하더라도 현재 결제 주기 만료일까지는 유료 기능을 계속 이용할 수 있습니다.</li>
          <li>자동 결제가 실패한 경우 서비스는 일정 간격으로 최대 3회까지 재시도하며, 모두 실패하면 자동으로 무료 플랜으로 전환됩니다. 카드 분실, 도난, 만료 등 즉시 재시도가 무의미한 경우에는 곧바로 무료 플랜으로 전환됩니다.</li>
          <li>자동 결제 예정일 3일 전에 푸시 알림으로 결제 예정 사실을 안내합니다.</li>
          <li>자동 결제 관련 환불 기준은 환불 정책에 따릅니다.</li>
        </ol>
      </Section>

      <Section title="제13조 (청약철회 및 환불)">
        <ol>
          <li>회원은 결제일로부터 7일 이내에 청약을 철회할 수 있으며, 유료 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.</li>
          <li>유료 서비스 이용 후 환불을 요청하는 경우, 이용 기간에 따라 일할 계산하여 잔여 금액을 환불합니다.</li>
          <li>환불은 원래 결제 수단을 통해 처리되며, 처리 기간은 3~10 영업일이 소요됩니다.</li>
          <li>환불 정책의 상세한 내용은 서비스 내 환불 정책 페이지에서 확인할 수 있습니다.</li>
          <li>본 조항은 「전자상거래 등에서의 소비자보호에 관한 법률」에 따릅니다.</li>
        </ol>
      </Section>

      <Section title="제14조 (구독 해지)">
        <ol>
          <li>회원은 서비스 내 요금제 관리 페이지에서 언제든지 구독을 해지할 수 있습니다.</li>
          <li>구독 해지 시 현재 결제 주기의 만료일까지 유료 기능을 계속 이용할 수 있습니다.</li>
          <li>결제 주기 만료 후 자동으로 무료(Free) 플랜으로 전환됩니다.</li>
          <li>무료 플랜 전환 시 유료 플랜 제한을 초과하는 데이터는 삭제되지 않으나, 해당 기능의 추가 사용이 제한됩니다.</li>
          <li>구독 해지와 자동 갱신 해제는 별개의 절차이며, 자동 갱신만 끄고 현재 결제 주기를 계속 이용하고자 하는 경우 자동 갱신 끄기 기능을 이용할 수 있습니다.</li>
        </ol>
      </Section>

      <Section title="제15조 (분쟁 해결)">
        <ol>
          <li>서비스와 이용자 간에 발생한 분쟁에 관한 소송은 대한민국 법률에 따릅니다.</li>
          <li>서비스와 이용자 간에 분쟁이 발생한 경우, 양 당사자는 분쟁의 해결을 위해 성실히 협의합니다.</li>
          <li>협의에도 불구하고 분쟁이 해결되지 않을 경우, 관할 법원에 소송을 제기할 수 있습니다.</li>
        </ol>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">시행일: 2026년 6월 3일 (개정 — 일상 기록 / AI 사진 증상 분석 명시)</p>
    </>
  );
}

function TermsEn({ refNotice }: { refNotice: string }) {
  return (
    <>
      <LegalRefNotice text={refNotice} />

      <Section title="Article 1 (Purpose)">
        <p>
          These terms set out the rights, obligations, and responsibilities between the Service and users, and other
          necessary matters, in connection with the use of the pet health information platform provided by PawDex (the &quot;Service&quot;).
        </p>
      </Section>

      <Section title="Article 2 (Definitions)">
        <ol>
          <li>&quot;Service&quot; means all services provided by PawDex, including pet health information search, health record management, and the animal-hospital finder.</li>
          <li>&quot;Member&quot; means a person who has signed up for the Service and entered into a usage agreement.</li>
          <li>&quot;Content&quot; means all information created by a Member within the Service, including health records (symptom, visit, hospitalization, daily records, etc.), pet information, and uploaded photos/files.</li>
        </ol>
      </Section>

      <Section title="Article 3 (Effect and Amendment of Terms)">
        <ol>
          <li>These terms take effect when posted on the Service screen or otherwise announced to users.</li>
          <li>Where there is a reasonable cause, the Service may amend these terms within the scope permitted by applicable law, and the amended terms are announced within the Service from 7 days before their effective date.</li>
          <li>If a Member does not agree to the amended terms, they may stop using the Service and withdraw their membership.</li>
        </ol>
      </Section>

      <Section title="Article 4 (Provision of the Service)">
        <p>The Service provides the following features.</p>
        <ul>
          <li>Pet disease/health information search and paper-based analysis</li>
          <li>AI-based symptom analysis (text input) and photo symptom analysis (optional feature)</li>
          <li>Pet health record management (symptom, visit, hospitalization, daily records, medication records)</li>
          <li>Daily records (notes on routine such as walks, meals, hydration, elimination, mood)</li>
          <li>Weight trend and medical expense statistics</li>
          <li>Medication reminders and appointment management</li>
          <li>Animal-hospital finder (map-based location search)</li>
          <li>Pet profile management</li>
          <li>Other services additionally developed or provided through partnerships by the Service</li>
        </ul>
      </Section>

      <Section title="Article 5 (Changes and Suspension of the Service)">
        <ol>
          <li>The Service may change all or part of the Service as required for operational or technical reasons.</li>
          <li>The Service may temporarily suspend the Service in the event of force majeure such as a natural disaster, system failure, or other unavoidable cause.</li>
          <li>When the Service is changed or suspended, users are notified through an announcement within the Service.</li>
        </ol>
      </Section>

      <Section title="Article 6 (Membership Registration)">
        <ol>
          <li>A user applies for membership by entering member information in the form prescribed by the Service and agreeing to these terms.</li>
          <li>The Service accepts the membership application unless one of the following applies:
            <ul>
              <li>The applicant has previously lost membership under these terms</li>
              <li>The applicant entered false information</li>
              <li>The application does not meet other requirements set by the Service</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="Article 7 (Withdrawal and Loss of Membership)">
        <ol>
          <li>A Member may request withdrawal from the Service at any time, and the Service processes the withdrawal immediately.</li>
          <li>The Service may restrict or revoke membership if a Member falls under any of the following:
            <ul>
              <li>Registering false information when applying</li>
              <li>Threatening order by interfering with other users&apos; use of the Service or misappropriating information</li>
              <li>Using the Service to engage in acts prohibited by law or these terms</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="Article 8 (Member Obligations)">
        <ol>
          <li>Members must comply with applicable laws, these terms, and usage guidance.</li>
          <li>Members must not engage in any of the following:
            <ul>
              <li>Misappropriating another person&apos;s personal information</li>
              <li>Unauthorized modification of information posted on the Service</li>
              <li>Transmitting or posting information not permitted by the Service (such as computer programs)</li>
              <li>Infringing the intellectual property rights, including copyrights, of the Service or third parties</li>
              <li>Damaging the reputation of, or interfering with the business of, the Service or third parties</li>
              <li>Publishing or posting obscene, violent, or otherwise contrary-to-public-order information on the Service</li>
              <li>Abnormally calling the Service&apos;s API or generating excessive requests using automated means (bots, scrapers, etc.)</li>
              <li>Misusing the Service&apos;s AI analysis features for purposes other than their intended use</li>
            </ul>
          </li>
        </ol>
      </Section>

      <Section title="Article 9 (Obligations of the Service Provider)">
        <ol>
          <li>The Service strives to provide the Service continuously and stably as set out in applicable laws and these terms.</li>
          <li>The Service establishes and complies with a Privacy Policy to protect users&apos; personal information.</li>
          <li>The Service strives to maintain a security system so that users can use the Service safely.</li>
        </ol>
      </Section>

      <Section title="Article 10 (AI Analysis Service)">
        <ol>
          <li>The Service provides features such as paper analysis and health information summaries using OpenAI&apos;s AI technology.</li>
          <li>AI analysis features are provided only to logged-in Members and are processed only for authenticated requests.</li>
          <li>AI analysis results are provided for reference only and do not replace the judgment of a professional veterinarian.</li>
          <li>The Service does not transmit users&apos; personal information to the AI provider during analysis, and processes only disease/symptom-related text.</li>
        </ol>
      </Section>

      <Section title="Article 11 (Disclaimer)">
        <ol>
          <li>The health information provided by the Service is for reference and does not replace diagnosis and treatment by a professional veterinarian.</li>
          <li>The Service does not guarantee the accuracy of paper search and AI analysis results and is not responsible for medical decisions based on them.</li>
          <li>The Service is exempt from liability where it cannot provide the Service due to force majeure such as a natural disaster.</li>
          <li>The Service is not responsible for service disruptions caused by the user&apos;s fault.</li>
          <li>The Service is not responsible for the reliability or accuracy of content posted by users.</li>
        </ol>
      </Section>

      <Section title="Article 12 (Paid Services and Payment)">
        <ol>
          <li>The Service offers a two-tier plan structure, Free and Plus; the usage scope and price of each plan are posted on the plans page within the Service.</li>
          <li>The Plus plan consists of monthly (automatic monthly renewal or one-time payment) and annual (one-time payment) options depending on the billing cycle.</li>
          <li>Payment for paid services is processed through the payment system provided by Toss Payments Co., Ltd.</li>
          <li>The payment amount, payment date, and usage period are clearly shown at the time of payment.</li>
          <li>The Service may change plan prices and contents; changes are announced within the Service 30 days in advance.</li>
        </ol>
      </Section>

      <Section title="Article 12-2 (Automatic Payment)">
        <ol>
          <li>For a monthly subscription with auto-renewal selected, payment is made automatically on the same date as the payment date using the registered payment method.</li>
          <li>When registering automatic payment, the Member must separately consent to automatic payment on the payment page.</li>
          <li>A Member may turn off auto-renewal at any time on the Subscription &amp; Billing page; when turned off, the registered payment method information is discarded immediately.</li>
          <li>Even after turning off auto-renewal, paid features remain usable until the end of the current billing cycle.</li>
          <li>If automatic payment fails, the Service retries up to 3 times at set intervals; if all fail, the plan is automatically switched to Free. Where an immediate retry is meaningless (e.g. a lost, stolen, or expired card), the plan switches to Free immediately.</li>
          <li>A push notification is sent 3 days before the scheduled automatic payment date to inform the Member of the upcoming charge.</li>
          <li>Refund standards related to automatic payment follow the Refund Policy.</li>
        </ol>
      </Section>

      <Section title="Article 13 (Withdrawal of Subscription and Refund)">
        <ol>
          <li>A Member may withdraw their offer within 7 days of the payment date, and a full refund is available if the paid service has not been used.</li>
          <li>If a refund is requested after using the paid service, the remaining amount is refunded on a pro-rata basis according to the usage period.</li>
          <li>Refunds are processed through the original payment method and take 3–10 business days.</li>
          <li>Detailed refund terms can be found on the Refund Policy page within the Service.</li>
          <li>This article follows the Act on the Consumer Protection in Electronic Commerce of the Republic of Korea.</li>
        </ol>
      </Section>

      <Section title="Article 14 (Cancelling a Subscription)">
        <ol>
          <li>A Member may cancel their subscription at any time on the Subscription &amp; Billing page within the Service.</li>
          <li>Upon cancellation, paid features remain usable until the end of the current billing cycle.</li>
          <li>After the billing cycle ends, the plan is automatically switched to Free.</li>
          <li>When switching to Free, data exceeding the Free plan limits is not deleted, but further use of those features is restricted.</li>
          <li>Cancelling a subscription and turning off auto-renewal are separate processes; if you want to keep the current cycle while only turning off auto-renewal, you can use the turn-off auto-renewal feature.</li>
        </ol>
      </Section>

      <Section title="Article 15 (Dispute Resolution)">
        <ol>
          <li>Lawsuits regarding disputes between the Service and users are governed by the laws of the Republic of Korea.</li>
          <li>If a dispute arises between the Service and a user, both parties shall consult in good faith to resolve it.</li>
          <li>If the dispute is not resolved despite consultation, a lawsuit may be filed with the competent court.</li>
        </ol>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">Effective date: June 3, 2026 (revised — daily records / AI photo symptom analysis specified)</p>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-gray-600 [&_li]:dark:text-gray-400">
        {children}
      </div>
    </section>
  );
}
