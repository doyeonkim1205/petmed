/**
 * 홈 "오늘의 건강 팁" 풀.
 *
 * 날짜 기반으로 매일 자동 로테이션된다(HealthTip 컴포넌트 참조).
 * 콘텐츠를 미리 작성해두면 운영 부담 없이 순환 — 출시 후 계절/인기 주제로 확장 가능.
 * href 는 반드시 실제 존재하는 라우트만 사용한다.
 */
export type HealthTip = {
  text: string;
  href: string;
};

export const HEALTH_TIPS: HealthTip[] = [
  { text: '여름 산책은 해 진 뒤에! 뜨거운 아스팔트는 발바닥 화상을 일으켜요 🐾', href: '/search?mode=symptom' },
  { text: '갑자기 물을 많이 마신다면 신장·당뇨 신호일 수 있어요 💧', href: '/search?mode=symptom' },
  { text: '체중 1kg 변화도 작은 몸엔 큰 변화. 정기적으로 측정해 기록해두세요 ⚖️', href: '/records/stats?tab=weight' },
  { text: '고양이는 통증을 숨겨요. 평소와 다른 행동은 바로 기록해두세요 📝', href: '/records' },
  { text: '예방접종·심장사상충 일정은 캘린더에 등록해두면 놓치지 않아요 📅', href: '/records?tab=calendar' },
  { text: '초콜릿·포도·양파·자일리톨은 반려동물에게 독성! 절대 주지 마세요 🚫', href: '/search?mode=disease' },
  { text: '환절기엔 기침·재채기가 늘어요. 증상 부위는 사진으로 남겨두면 좋아요 📷', href: '/search/photo' },
  { text: '산책 후엔 진드기 체크! 귀 안쪽과 발가락 사이를 꼼꼼히 살펴주세요', href: '/search?mode=symptom' },
  { text: '구토·설사가 하루 이상 지속되거나 피가 섞이면 병원 진료가 필요해요', href: '/search?mode=symptom' },
  { text: '양치는 치주질환 예방의 핵심. 주 3회 이상 닦아주는 걸 권장해요 🦷', href: '/search?mode=disease' },
  { text: '사료를 바꿀 땐 1주에 걸쳐 천천히 섞어 바꿔야 설사를 막을 수 있어요', href: '/search?mode=symptom' },
  { text: '노령기(7세 이상)부턴 건강검진 주기를 짧게. 변화를 일찍 잡는 게 중요해요', href: '/records?tab=calendar' },
  { text: '평소 음수량·배변 상태를 알아두면 이상 징후를 빨리 알아챌 수 있어요', href: '/records' },
  { text: '물그릇은 매일 세척하세요. 미끌한 막은 세균(바이오필름)이에요 💧', href: '/search?mode=disease' },
];
