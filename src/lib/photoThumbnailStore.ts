/**
 * 사진 증상 분석 결과의 썸네일을 IndexedDB 에 저장.
 *
 * 왜 IndexedDB 인가:
 *   - 사진 자체는 서버에 저장 안 함 (개인정보 보호)
 *   - 보관함에서 "어떤 사진이었지?" 보고 싶을 때 필요한 UX
 *   - localStorage 는 ~5MB 제한 + base64 인코딩 = 사진 몇 장이면 가득 참
 *   - IndexedDB 는 디바이스 단위 수십 MB 가능
 *
 * 한계:
 *   - 디바이스 단위 (다른 기기에선 안 보임)
 *   - 사용자가 브라우저 데이터 지우면 사라짐
 *   - TWA / 일반 웹 / iOS 각각 별도 저장소
 *
 * 키 구조:
 *   - analysisId (saved_analyses.id) ↔ thumbnail dataURL
 */

const DB_NAME = 'pawdex-thumbs';
const STORE_NAME = 'photo_analysis';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveThumbnail(analysisId: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataUrl, analysisId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB 실패는 silent — 썸네일은 nice-to-have
  }
}

export async function getThumbnail(analysisId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const result = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(analysisId);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function deleteThumbnail(analysisId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(analysisId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}

/**
 * 보관함에서 여러 항목 표시 시 한 번에 가져오기 (각각 get 보다 효율적).
 * 알 수 없는 ID 는 키에서 빠짐.
 */
export async function getThumbnailsBulk(analysisIds: string[]): Promise<Record<string, string>> {
  if (analysisIds.length === 0) return {};
  try {
    const db = await openDB();
    const result = await new Promise<Record<string, string>>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const acc: Record<string, string> = {};
      let pending = analysisIds.length;
      if (pending === 0) resolve(acc);
      analysisIds.forEach(id => {
        const req = store.get(id);
        req.onsuccess = () => {
          if (typeof req.result === 'string') acc[id] = req.result;
          if (--pending === 0) resolve(acc);
        };
        req.onerror = () => {
          if (--pending === 0) resolve(acc);
        };
      });
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return result;
  } catch {
    return {};
  }
}
