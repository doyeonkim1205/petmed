'use client';

import { useState } from 'react';
import { MapPin, Search, Navigation, Phone } from 'lucide-react';
import { mockHospitals, Hospital } from '@/data/mock';

export default function MapPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | '24h' | 'shop' | 'lost'>('all');
  const [selectedSpot, setSelectedSpot] = useState<Hospital | null>(null);

  const filters = [
    { id: 'all', label: '전체' },
    { id: '24h', label: '24시 병원' },
    { id: 'shop', label: '용품점' },
    { id: 'lost', label: '유기동물' },
  ];

  const filteredHospitals = activeFilter === '24h'
    ? mockHospitals.filter(h => h.is24h)
    : mockHospitals;

  const getPosition = (idx: number) => {
      const positions = [
          { top: '30%', left: '20%' },
          { top: '50%', left: '60%' },
          { top: '40%', left: '80%' },
          { top: '70%', left: '30%' },
          { top: '60%', left: '50%' },
      ];
      return positions[idx % positions.length];
  };

  return (
    <div className="relative h-full min-h-[calc(100vh-8rem)] bg-gray-100 overflow-hidden">
      {/* Map Background (Mock) */}
      <div className="absolute inset-0 bg-[#e8e8e8] opacity-50 bg-[radial-gradient(#d1d1d1_1px,transparent_1px)] [background-size:16px_16px]"></div>

      {/* Mock Map UI Elements */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
         <div className="flex-1 bg-white rounded-lg shadow-md flex items-center px-3 py-2">
            <Search size={18} className="text-gray-400 mr-2" />
            <input type="text" placeholder="병원, 용품점 검색" className="w-full text-sm outline-none" />
         </div>
      </div>

      <div className="absolute top-16 left-4 right-4 z-10 flex gap-2 overflow-x-auto hide-scrollbar pb-2">
         {filters.map(f => (
            <button
               key={f.id}
               onClick={() => setActiveFilter(f.id as 'all' | '24h' | 'shop' | 'lost')}
               className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition-colors border ${
                  activeFilter === f.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200'
               }`}
            >
               {f.label}
            </button>
         ))}
      </div>

      {/* Pins */}
      {filteredHospitals.map((hospital, idx) => (
         <button
            key={hospital.id}
            onClick={() => setSelectedSpot(hospital)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all hover:scale-110 z-0 hover:z-20"
            style={getPosition(idx)}
         >
            <div className={`flex flex-col items-center ${selectedSpot?.id === hospital.id ? 'scale-110 z-30' : ''}`}>
               <div className={`px-2 py-1 bg-white rounded shadow text-[10px] font-bold mb-1 whitespace-nowrap opacity-0 group-hover:opacity-100 ${selectedSpot?.id === hospital.id ? 'opacity-100' : ''}`}>
                  {hospital.name}
               </div>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${hospital.is24h ? 'bg-red-500' : 'bg-blue-500'}`}>
                  <MapPin size={16} className="text-white" fill="currentColor" />
               </div>
               <div className="w-2 h-1 bg-black/20 rounded-full mt-1 blur-[1px]"></div>
            </div>
         </button>
      ))}

      {/* Bottom Sheet for Selected Spot */}
      {selectedSpot && (
         <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-xl p-4 z-20 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex justify-between items-start mb-2">
               <div>
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                     {selectedSpot.name}
                     {selectedSpot.is24h && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">24시</span>}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedSpot.address}</p>
               </div>
               <button onClick={() => setSelectedSpot(null)} className="text-gray-400 p-1 bg-gray-50 rounded-full">
                  <Navigation size={18} />
               </button>
            </div>

            <div className="flex gap-2 mt-4">
               <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                  <Phone size={16} /> 전화하기
               </button>
               <button className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-2">
                  <Navigation size={16} /> 길찾기
               </button>
            </div>
         </div>
      )}
    </div>
  );
}
