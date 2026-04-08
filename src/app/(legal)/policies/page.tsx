'use client';

import { FileText, Shield, CreditCard, MapPin, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const policies = [
  { href: '/terms', label: '이용약관', icon: FileText },
  { href: '/privacy', label: '개인정보처리방침', icon: Shield },
  { href: '/refund', label: '환불 정책', icon: CreditCard },
  { href: '/location-terms', label: '위치기반서비스 이용약관', icon: MapPin },
  { href: '/business', label: '사업자 정보', icon: Building2 },
];

export default function PoliciesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">약관 및 정책</h1>
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
                <span className="text-sm">{item.label}</span>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
