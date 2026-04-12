'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Users, Crown, UserCheck } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

export default function NotificationsPage() {
  const [target, setTarget] = useState<'all' | 'plus' | 'free' | 'user'>('all');
  const [userEmail, setUserEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async () => {
    if (!title || !body) { setResult('제목과 내용을 입력해주세요.'); return; }
    if (target === 'user' && !userEmail) { setResult('이메일을 입력해주세요.'); return; }
    if (!confirm(`${target === 'all' ? '전체' : target === 'user' ? userEmail : target} 사용자에게 알림을 보내시겠습니까?`)) return;

    setSending(true);
    setResult('');
    try {
      const res = await authFetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, userEmail: target === 'user' ? userEmail : undefined, title, body, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(`✅ 발송 완료: ${data.sent}건 성공, ${data.failed}건 실패`);
      setTitle('');
      setBody('');
    } catch (err) {
      setResult(`❌ ${err instanceof Error ? err.message : '발송 실패'}`);
    } finally {
      setSending(false);
    }
  };

  const targets = [
    { value: 'all', label: '전체', icon: Users, desc: '모든 사용자' },
    { value: 'plus', label: 'Plus', icon: Crown, desc: '유료 사용자만' },
    { value: 'free', label: 'Free', icon: UserCheck, desc: '무료 사용자만' },
    { value: 'user', label: '특정 사용자', icon: Send, desc: '이메일로 지정' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">푸시 알림 발송</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">대상 선택</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {targets.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.value} onClick={() => setTarget(t.value as typeof target)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    target === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <Icon size={18} className={target === t.value ? 'text-blue-500' : 'text-gray-400'} />
                  <div>
                    <p className={`text-sm font-medium ${target === t.value ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              );
            })}
            {target === 'user' && (
              <input type="email" placeholder="사용자 이메일" value={userEmail} onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-2" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">알림 내용</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">제목</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="알림 제목"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">내용</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="알림 내용" rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">클릭 시 이동 URL</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            {/* Preview */}
            {title && (
              <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                <p className="text-xs text-gray-400 mb-1">미리보기</p>
                <p className="text-sm font-bold text-gray-800">{title}</p>
                <p className="text-xs text-gray-600">{body}</p>
              </div>
            )}

            {result && <p className="text-sm">{result}</p>}

            <button onClick={handleSend} disabled={sending}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={14} />
              {sending ? '발송 중...' : '알림 발송'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
