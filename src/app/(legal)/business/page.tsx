import { getLocale, getTranslations } from 'next-intl/server';
import { LegalPage, LegalRefNotice } from '../_components/LegalHeader';

export default async function BusinessPage() {
  const locale = await getLocale();
  const t = await getTranslations('legal');
  const en = locale === 'en';
  const rows = en
    ? [
        { label: 'Company name', value: 'DYLabs' },
        { label: 'Representative', value: 'Kim Doyeon' },
        { label: 'Business reg. no.', value: '769-77-00552' },
        { label: 'Mail-order sales reg. no.', value: '2026-화성동탄-1654' },
        { label: 'Address', value: '81, Dongtansunhwan-daero 26-gil, Hwaseong-si, Gyeonggi-do, Republic of Korea' },
        { label: 'Email', value: 'dylabs.pawdex@gmail.com', href: 'mailto:dylabs.pawdex@gmail.com' },
        { label: 'Phone', value: '010-8306-9687', href: 'tel:010-8306-9687' },
      ]
    : [
        { label: '상호명', value: '디와이랩스(DYLabs)' },
        { label: '대표자', value: '김도연' },
        { label: '사업자등록번호', value: '769-77-00552' },
        { label: '통신판매업 신고번호', value: '2026-화성동탄-1654' },
        { label: '주소', value: '경기도 화성시 동탄순환대로 26길 81' },
        { label: '이메일', value: 'dylabs.pawdex@gmail.com', href: 'mailto:dylabs.pawdex@gmail.com' },
        { label: '전화번호', value: '010-8306-9687', href: 'tel:010-8306-9687' },
      ];

  return (
    <LegalPage title={t('businessTitle')}>
    <article className="prose prose-sm dark:prose-invert max-w-none" style={{ fontSize: '13px' }}>
      {en && <LegalRefNotice text={t('refNotice')} />}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 space-y-4">
        {rows.map((r) => (
          <InfoRow key={r.label} label={r.label} value={r.value} href={'href' in r ? r.href : undefined} />
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        {en
          ? 'This business information is disclosed pursuant to Article 13 of the Act on the Consumer Protection in Electronic Commerce of the Republic of Korea.'
          : '본 사업자 정보는 「전자상거래 등에서의 소비자보호에 관한 법률」 제13조에 따라 공시합니다.'}
      </p>
    </article>
    </LegalPage>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-4 not-prose">
      <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">{label}</span>
      {href ? (
        <a href={href} className="text-[13px] text-gray-800 dark:text-gray-200">{value}</a>
      ) : (
        <span className="text-[13px] text-gray-800 dark:text-gray-200">{value}</span>
      )}
    </div>
  );
}
