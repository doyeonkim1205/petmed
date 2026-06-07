import { authFetch } from './authFetch';

/**
 * Admin CSV export 다운로드 — authFetch(Bearer) 로 받아 blob → 임시 <a> 다운로드.
 * (admin 인증이 localStorage 토큰 기반이라 일반 <a href> 로는 Authorization 헤더가 안 실림)
 */
export async function downloadCsv(url: string, fallbackName: string): Promise<void> {
  try {
    const res = await authFetch(url);
    if (!res.ok) {
      alert('내보내기에 실패했습니다.');
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const name = m ? m[1] : fallbackName;
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch {
    alert('내보내기 중 오류가 발생했습니다.');
  }
}
