'use client';

import { useTranslations } from 'next-intl';
import { FileText, Shield, CreditCard, MapPin, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { LegalPage } from '../_components/LegalHeader';

const policies = [
  { href: '/terms', labelKey: 'termsTitle', icon: FileText },
  { href: '/privacy', labelKey: 'privacyTitle', icon: Shield },
  { href: '/refund', labelKey: 'refundTitle', icon: CreditCard },
  { href: '/location-terms', labelKey: 'locationTitle', icon: MapPin },
  { href: '/business', labelKey: 'businessTitle', icon: Building2 },
] as const;

export default function PoliciesPage() {
  const t = useTranslations('legal');
  return (
    <LegalPage title={t('policiesTitle')}>
      <div className="space-y-1">
        {policies.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <Icon size={18} className="text-gray-400" />
                <span className="text-[13px]">{t(item.labelKey)}</span>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </Link>
          );
        })}
      </div>
    </LegalPage>
  );
}
