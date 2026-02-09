'use client';

import Link from 'next/link';
import { Search, FileText, MapPin, Heart } from 'lucide-react';

const quickLinks = [
  { icon: Search, label: '질병 검색', href: '/search', color: 'bg-blue-500' },
  { icon: FileText, label: '커뮤니티', href: '/community', color: 'bg-green-500' },
  { icon: MapPin, label: '병원 찾기', href: '/map', color: 'bg-orange-500' },
  { icon: Heart, label: '건강 체크', href: '/search', color: 'bg-pink-500' },
];

export default function HomePage() {
  return (
    <div className="bg-gray-50 min-h-full">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] text-white p-6 pb-10">
        <h1 className="text-2xl font-bold mb-2">반려동물 건강 정보</h1>
        <p className="text-white/80 text-sm">
          우리 아이의 건강을 위한 모든 정보를 찾아보세요
        </p>
      </div>

      {/* Quick Links */}
      <div className="px-4 -mt-6">
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-4 gap-4">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-12 h-12 ${item.color} rounded-full flex items-center justify-center text-white`}>
                <item.icon size={24} />
              </div>
              <span className="text-xs text-gray-600 text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Posts Section */}
      <div className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">최근 게시글</h2>
          <Link href="/community" className="text-sm text-[#7C3AED]">
            더보기
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-gray-500 text-sm text-center py-8">
            커뮤니티에서 다양한 이야기를 나눠보세요!
          </p>
          <Link
            href="/community"
            className="block w-full py-3 text-center bg-[#7C3AED] text-white rounded-lg font-medium"
          >
            게시판 가기
          </Link>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
          <h3 className="font-bold text-gray-900 mb-2">PetMed 소개</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            PetMed는 반려동물의 건강 정보를 제공하고,
            보호자들이 서로 소통할 수 있는 커뮤니티 플랫폼입니다.
            질병 정보 검색, 주변 동물병원 찾기, 커뮤니티 등
            다양한 기능을 이용해보세요.
          </p>
        </div>
      </div>
    </div>
  );
}
