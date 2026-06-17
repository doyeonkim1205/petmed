import { getLocale, getTranslations } from 'next-intl/server';
import { LegalPage, LegalRefNotice } from '../_components/LegalHeader';

export default async function LocationTermsPage() {
  const locale = await getLocale();
  const t = await getTranslations('legal');
  const en = locale === 'en';

  return (
    <LegalPage title={t('locationTitle')}>
    <article className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: '13px' }}>
      {en ? <LocationTermsEn refNotice={t('refNotice')} /> : <LocationTermsKo />}
    </article>
    </LegalPage>
  );
}

function LocationTermsKo() {
  return (
    <>
      <Section title="제1조 (목적)">
        <p>
          본 약관은 디와이랩스(DYLabs)(이하 &quot;회사&quot;)가 제공하는 PawDex 서비스(이하 &quot;서비스&quot;)의
          위치기반서비스 이용에 관한 사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section title="제2조 (위치정보 수집 목적)">
        <p>서비스는 다음 목적으로 이용자의 위치정보를 수집합니다.</p>
        <ul>
          <li>주변 동물병원 검색 및 지도 기반 서비스 제공</li>
          <li>이용자 위치 기준 가까운 동물병원 정보 표시</li>
        </ul>
      </Section>

      <Section title="제3조 (위치정보의 저장 및 보유)">
        <ul>
          <li>서비스는 이용자의 위치정보를 서버에 저장하지 않습니다.</li>
          <li>위치정보는 실시간으로만 사용되며, 동물병원 검색 결과 표시 후 즉시 폐기됩니다.</li>
          <li>위치정보는 이용자의 기기(브라우저)에서만 처리되며, 서버로 전송되지 않습니다.</li>
        </ul>
      </Section>

      <Section title="제4조 (제3자 제공)">
        <p>서비스는 동물병원 찾기 기능 제공을 위해 다음 제3자 서비스를 이용합니다.</p>
        <table className="w-full text-[13px] border-collapse mt-2">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 font-medium">제공받는 자</th>
              <th className="text-left py-2 font-medium">제공 항목</th>
              <th className="text-left py-2 font-medium">이용 목적</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">카카오(주) (Kakao Maps API)</td>
              <td className="py-2">위치 좌표 (위도/경도)</td>
              <td className="py-2">지도 표시 및 주변 동물병원 검색</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="제5조 (위치 권한 철회)">
        <p>이용자는 언제든지 위치정보 수집에 대한 동의를 철회할 수 있습니다.</p>
        <ul>
          <li><strong>브라우저 설정:</strong> 브라우저 설정 &gt; 사이트 설정 &gt; 위치에서 PawDex의 위치 권한을 차단할 수 있습니다.</li>
          <li><strong>모바일 기기:</strong> 설정 &gt; 앱 권한 &gt; 위치에서 브라우저의 위치 권한을 해제할 수 있습니다.</li>
          <li>위치 권한을 철회하더라도 동물병원 찾기 외의 다른 서비스는 정상적으로 이용할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제6조 (법적 근거)">
        <p>본 약관은 다음 법률에 근거하여 운영됩니다.</p>
        <ul>
          <li>「위치정보의 보호 및 이용 등에 관한 법률」</li>
          <li>「개인정보 보호법」</li>
          <li>「정보통신망 이용촉진 및 정보보호 등에 관한 법률」</li>
        </ul>
      </Section>

      <Section title="제7조 (연락처)">
        <ul>
          <li>위치정보 관련 문의: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
        </ul>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">시행일: 2026년 2월 24일</p>
    </>
  );
}

function LocationTermsEn({ refNotice }: { refNotice: string }) {
  return (
    <>
      <LegalRefNotice text={refNotice} />

      <Section title="Article 1 (Purpose)">
        <p>
          These terms govern the use of location-based services within the PawDex service (the &quot;Service&quot;)
          provided by DYLabs (the &quot;Company&quot;).
        </p>
      </Section>

      <Section title="Article 2 (Purpose of Collecting Location Information)">
        <p>The Service collects your location information for the following purposes:</p>
        <ul>
          <li>Searching for nearby animal hospitals and providing map-based services</li>
          <li>Showing animal hospital information closest to your location</li>
        </ul>
      </Section>

      <Section title="Article 3 (Storage and Retention of Location Information)">
        <ul>
          <li>The Service does not store your location information on its servers.</li>
          <li>Location information is used only in real time and is discarded immediately after the hospital search results are displayed.</li>
          <li>Location information is processed only on your device (browser) and is not transmitted to our servers.</li>
        </ul>
      </Section>

      <Section title="Article 4 (Provision to Third Parties)">
        <p>The Service uses the following third-party service to provide the animal-hospital finder feature.</p>
        <table className="w-full text-[13px] border-collapse mt-2">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 font-medium">Recipient</th>
              <th className="text-left py-2 font-medium">Items provided</th>
              <th className="text-left py-2 font-medium">Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">Kakao Corp. (Kakao Maps API)</td>
              <td className="py-2">Location coordinates (latitude/longitude)</td>
              <td className="py-2">Map display and nearby animal hospital search</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Article 5 (Withdrawing Location Permission)">
        <p>You may withdraw your consent to location collection at any time.</p>
        <ul>
          <li><strong>Browser settings:</strong> You can block PawDex&apos;s location permission under Browser settings &gt; Site settings &gt; Location.</li>
          <li><strong>Mobile device:</strong> You can revoke the browser&apos;s location permission under Settings &gt; App permissions &gt; Location.</li>
          <li>Even after withdrawing location permission, all services other than the animal-hospital finder remain fully usable.</li>
        </ul>
      </Section>

      <Section title="Article 6 (Legal Basis)">
        <p>These terms are operated based on the following Korean laws:</p>
        <ul>
          <li>Act on the Protection and Use of Location Information</li>
          <li>Personal Information Protection Act</li>
          <li>Act on Promotion of Information and Communications Network Utilization and Information Protection</li>
        </ul>
      </Section>

      <Section title="Article 7 (Contact)">
        <ul>
          <li>Location information inquiries: <a href="mailto:dylabs.pawdex@gmail.com" className="text-blue-500">dylabs.pawdex@gmail.com</a></li>
        </ul>
      </Section>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-10">Effective date: February 24, 2026</p>
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
