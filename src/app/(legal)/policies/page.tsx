'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Shield, CreditCard, MapPin, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const policies = [
  { href: '/terms', label: '이용약관', icon: FileText },
  { href: '/privacy', label: '개인정보처리방침', icon: Shield },
  { href: '/refund', label: '환불 정책', icon: CreditCard },
  { href: '/location-terms', label: '위치기반서비스 이용약관', icon: MapPin },
  { href: '/business', label: '사업자 정보', icon: Building2 },
];

export default function PoliciesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex flex-col pb-20">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-10 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">약관 및 정책</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 py-3 space-y-1">
        {policies.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 text-gray-600">
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
