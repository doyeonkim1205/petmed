'use client';

import Link from 'next/link';
import Slider from 'react-slick';
import { ChevronRight, Star, MapPin } from 'lucide-react';
import { mockDiseases, mockProducts, mockPosts, mockHospitals } from '@/data/mock';

import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

export default function HomePage() {
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    arrows: false,
  };

  const topDiseases = mockDiseases.slice(0, 5);
  const topProducts = mockProducts;
  const topPosts = mockPosts;
  const topHospitals = mockHospitals;

  return (
    <div className="pb-4 space-y-8">
      {/* Top Banner Ad */}
      <div className="mx-4 mt-4 bg-gray-200 h-16 rounded-lg flex items-center justify-center text-gray-500 text-xs relative overflow-hidden">
        <span className="z-10 bg-white/80 px-2 py-0.5 rounded text-[10px] absolute top-1 right-1">AD</span>
        <p>프리미엄 펫 보험, 지금 가입하면 50% 할인!</p>
      </div>

      {/* Section 1: Popular Diseases Slide */}
      <section className="bg-blue-600 text-white pb-8 pt-4 rounded-b-3xl px-4 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">인기 질병 랭킹 TOP 5</h2>
          <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">실시간</span>
        </div>
        <Slider {...sliderSettings} className="popular-disease-slider">
          {topDiseases.map((disease, index) => (
            <div key={disease.id} className="px-1">
              <Link href={`/search?q=${disease.name}`} className="block bg-white text-gray-800 rounded-xl p-4 shadow-lg min-h-[160px] relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 font-bold px-3 py-1 rounded-bl-xl text-sm">
                  {index + 1}위
                </div>
                <div className="flex gap-4 items-center h-full">
                  <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    <img src={disease.images[0]} alt={disease.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 line-clamp-1">{disease.name}</h3>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{disease.summary}</p>
                    <span className={`text-xs px-2 py-0.5 rounded border ${disease.type === 'cat' ? 'border-pink-300 text-pink-500' : disease.type === 'dog' ? 'border-blue-300 text-blue-500' : 'border-purple-300 text-purple-500'}`}>
                      {disease.type === 'cat' ? '고양이' : disease.type === 'dog' ? '강아지' : '통합'}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </Slider>
      </section>

      {/* Section 2: Popular Products */}
      <section className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">요즘 뜨는 용품</h2>
          <Link href="/search" className="text-gray-400 text-sm flex items-center">더보기 <ChevronRight size={16}/></Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {topProducts.map((product) => (
             <div key={product.id} className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
               <div className="aspect-square bg-gray-100">
                 <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
               </div>
               <div className="p-3">
                 <h3 className="text-sm font-medium text-gray-900 line-clamp-1 mb-1">{product.name}</h3>
                 <p className="text-sm font-bold text-blue-600">{product.price}</p>
               </div>
             </div>
          ))}
        </div>
      </section>

      {/* Section 3: Popular Posts */}
      <section className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">실시간 인기글</h2>
          <Link href="/community" className="text-gray-400 text-sm flex items-center">더보기 <ChevronRight size={16}/></Link>
        </div>
        <div className="flex flex-col gap-3">
          {topPosts.slice(0, 3).map((post, index) => (
            <Link key={post.id} href={`/community/${post.id}`} className="flex items-center gap-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
               <div className="flex-shrink-0 text-xl font-bold text-blue-600 w-6 text-center">{index + 1}</div>
               <div className="flex-1 min-w-0">
                 <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{post.title}</h3>
                 <div className="flex items-center text-xs text-gray-400 mt-1 gap-2">
                   <span>{post.category === 'boast' ? '자랑' : post.category === 'info' ? '정보' : '기타'}</span>
                   <span>•</span>
                   <span>조회 {post.likes * 10}</span>
                 </div>
               </div>
               {post.image && (
                 <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={post.image} alt="" className="w-full h-full object-cover" />
                 </div>
               )}
            </Link>
          ))}
        </div>
      </section>

      {/* Section 4: Popular Hospitals */}
      <section className="px-4 pb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">많이 찾는 동물병원</h2>
          <Link href="/map" className="text-gray-400 text-sm flex items-center">더보기 <ChevronRight size={16}/></Link>
        </div>
        <div className="space-y-3">
          {topHospitals.slice(0, 3).map((hospital) => (
            <div key={hospital.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
               <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    {hospital.name}
                    {hospital.is24h && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">24시</span>}
                  </h3>
                  <div className="flex items-center text-gray-500 text-xs mt-1 gap-1">
                    <MapPin size={12} />
                    {hospital.address}
                  </div>
               </div>
               <div className="flex flex-col items-center justify-center bg-yellow-50 px-2 py-1 rounded text-yellow-700">
                  <span className="text-xs font-bold flex items-center gap-1"><Star size={10} fill="currentColor"/> {hospital.rating}</span>
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
