'use client';

import { useEffect, useState } from 'react';
import { readDevlog, clearDevlog } from '@/lib/devlog';

/**
 * 임시 진단 오버레이 — 화면 하단에 devlog 누적 표시. 앱(WebView)에서 콘솔 없이 읽기 위함.
 * ⚠️ 디버깅용. 원인 파악 후 이 컴포넌트와 dlog 호출 전부 제거.
 */
export function DeviceDebugOverlay() {
  const [lines, setLines] = useState<string[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const refresh = () => setLines(readDevlog());
    refresh();
    window.addEventListener('devlog', refresh);
    return () => window.removeEventListener('devlog', refresh);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 4, right: 4, zIndex: 99999,
          background: '#111', color: '#0f0', fontSize: 10, padding: '2px 6px',
          borderRadius: 4, opacity: 0.85,
        }}
      >
        DBG({lines.length})
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
        maxHeight: '38vh', overflowY: 'auto', background: 'rgba(0,0,0,0.9)',
        color: '#0f0', fontSize: 10, lineHeight: 1.45, fontFamily: 'monospace',
        padding: '6px 8px 8px', borderTop: '1px solid #0f0',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 4, position: 'sticky', top: 0 }}>
        <strong style={{ color: '#fff' }}>DEVICE DEBUG ({lines.length})</strong>
        <button onClick={() => { clearDevlog(); setLines([]); }} style={{ color: '#ff0' }}>clear</button>
        <button onClick={() => setOpen(false)} style={{ color: '#0ff' }}>hide</button>
      </div>
      {lines.length === 0 && <div style={{ color: '#888' }}>(no logs yet)</div>}
      {lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l}</div>
      ))}
    </div>
  );
}
