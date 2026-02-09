'use client';

import { MapPin } from 'lucide-react';

export default function MapPage() {
  return (
    <div className="bg-gray-50 min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 bg-[#7C3AED]/10 rounded-full flex items-center justify-center mb-4">
        <MapPin size={40} className="text-[#7C3AED]" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">지도 서비스 준비 중</h2>
      <p className="text-gray-500 text-center">
        주변 동물병원을 찾을 수 있는<br />
        지도 서비스를 준비하고 있습니다.
      </p>
    </div>
  );
}
