export default function BusinessPage() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">사업자 정보</h1>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 space-y-4">
        <InfoRow label="상호명" value="디와이랩스(DYLabs)" />
        <InfoRow label="대표자" value="김도연" />
        <InfoRow label="사업자등록번호" value="769-77-00552" />
        <InfoRow label="주소" value="경기도 화성시 동탄구 동탄순환대로26길 81" />
        <InfoRow label="이메일" value="dylabs.pawdex@gmail.com" href="mailto:dylabs.pawdex@gmail.com" />
        <InfoRow label="전화번호" value="010-8306-9687" href="tel:010-8306-9687" />
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        본 사업자 정보는 「전자상거래 등에서의 소비자보호에 관한 법률」 제13조에 따라 공시합니다.
      </p>
    </article>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{label}</span>
      {href ? (
        <a href={href} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{value}</a>
      ) : (
        <span className="text-sm text-gray-800 dark:text-gray-200">{value}</span>
      )}
    </div>
  );
}
