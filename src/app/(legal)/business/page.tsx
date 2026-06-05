import { LegalPage } from '../_components/LegalHeader';

export default function BusinessPage() {
  return (
    <LegalPage title="사업자 정보">
    <article className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: '13px' }}>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 space-y-4">
        <InfoRow label="상호명" value="디와이랩스(DYLabs)" />
        <InfoRow label="대표자" value="김도연" />
        <InfoRow label="사업자등록번호" value="769-77-00552" />
        <InfoRow label="주소" value="경기도 화성시 동탄순환대로 26길 81" />
        <InfoRow label="이메일" value="dylabs.pawdex@gmail.com" href="mailto:dylabs.pawdex@gmail.com" />
        <InfoRow label="전화번호" value="010-8306-9687" href="tel:010-8306-9687" />
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        본 사업자 정보는 「전자상거래 등에서의 소비자보호에 관한 법률」 제13조에 따라 공시합니다.
      </p>
    </article>
    </LegalPage>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{label}</span>
      {href ? (
        <a href={href} className="text-[13px] text-gray-800 dark:text-gray-200">{value}</a>
      ) : (
        <span className="text-[13px] text-gray-800 dark:text-gray-200">{value}</span>
      )}
    </div>
  );
}
