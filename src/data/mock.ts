
export interface Disease {
  id: string;
  name: string;
  type: 'dog' | 'cat' | 'all';
  summary: string;
  precautions: string[];
  ingredients: string[];
  products: Product[];
  youtubeId: string;
  images: string[];
}

export interface Product {
  id: string;
  name: string;
  image: string;
  price: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  is24h: boolean;
  rating: number;
}

// Unsplash Image Helpers
const catImages = [
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1495360019602-e0019216774a?auto=format&fit=crop&w=800&q=80"
];

const dogImages = [
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=800&q=80"
];

const productImages = [
  "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1585846888145-c6423982da94?auto=format&fit=crop&w=800&q=80"
];

export const mockProducts: Product[] = [
  { id: '1', name: 'Premium Digestive Support', image: productImages[0], price: '25,000 KRW' },
  { id: '2', name: 'Joint Health Chews', image: productImages[1], price: '18,000 KRW' },
  { id: '3', name: 'Omega-3 Fish Oil', image: productImages[0], price: '32,000 KRW' },
];

export const mockDiseases: Disease[] = [
  {
    id: '1',
    name: '소화기 림프종 (Lymphoma)',
    type: 'cat',
    summary: '고양이에게 흔한 소화기 암으로, 구토와 설사, 체중 감소가 주 증상입니다. 조기 발견 시 항암 치료 반응이 좋은 편입니다.',
    precautions: ['지속적인 구토 시 즉시 내원', '체중 변화 매주 기록', '스테로이드 투약 시 부작용 관찰'],
    ingredients: ['Probiotics (유산균)', 'Omega-3', 'Vitamin B12'],
    products: [mockProducts[0], mockProducts[2]],
    youtubeId: 'ABC123Test', // Mock ID
    images: [catImages[0], catImages[1]]
  },
  {
    id: '2',
    name: '슬개골 탈구 (Patellar Luxation)',
    type: 'dog',
    summary: '소형견에게 흔한 질환으로 무릎뼈가 빠지는 증상입니다. 보행 이상이 관찰되면 수술이나 재활이 필요합니다.',
    precautions: ['미끄럼 방지 매트 설치', '점프 금지', '체중 관리 필수'],
    ingredients: ['Glucosamine', 'Chondroitin', 'MSM'],
    products: [mockProducts[1]],
    youtubeId: 'DEF456Test',
    images: [dogImages[0], dogImages[1]]
  },
  {
    id: '3',
    name: '신부전 (Renal Failure)',
    type: 'cat',
    summary: '신장 기능이 저하되어 독소를 배출하지 못하는 상태. 다음, 다뇨 증상이 특징적입니다.',
    precautions: ['음수량 증대 노력', '처방식 급여', '정기적인 혈액 검사'],
    ingredients: ['Omega-3', 'Antioxidants', 'Potassium Binder'],
    products: [mockProducts[2]],
    youtubeId: 'GHI789Test',
    images: [catImages[2]]
  },
  {
    id: '4',
    name: '심장사상충 (Heartworm)',
    type: 'all',
    summary: '모기에 의해 전염되는 기생충 질환으로 심장과 폐에 치명적인 손상을 줍니다. 예방이 최선입니다.',
    precautions: ['매월 예방약 투여', '모기 기피', '정기 검사'],
    ingredients: ['Prevention Medicine Only'],
    products: [],
    youtubeId: 'JKL012Test',
    images: [dogImages[2]]
  },
  {
    id: '5',
    name: '치주질환 (Periodontal Disease)',
    type: 'all',
    summary: '치아와 잇몸 주변의 염증. 구취와 통증을 유발하며 심하면 발치가 필요합니다.',
    precautions: ['매일 양치질', '정기 스케일링', '딱딱한 간식 주의'],
    ingredients: ['Propolis', 'Enzymes'],
    products: [],
    youtubeId: 'MNO345Test',
    images: [catImages[1]]
  }
];

export const mockHospitals: Hospital[] = [
  { id: '1', name: '튼튼 동물병원', address: '서울 강남구 역삼동', is24h: true, rating: 4.8 },
  { id: '2', name: '행복한 고양이 병원', address: '서울 서초구 서초동', is24h: false, rating: 4.9 },
  { id: '3', name: '24시 스카이 동물의료센터', address: '서울 송파구 잠실동', is24h: true, rating: 4.5 },
  { id: '4', name: '우리동네 동물병원', address: '서울 마포구 서교동', is24h: false, rating: 4.2 },
  { id: '5', name: '사랑 동물병원', address: '서울 강동구 천호동', is24h: true, rating: 4.6 },
];
