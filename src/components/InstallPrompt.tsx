'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="font-medium text-sm">PawDex 앱 설치</p>
          <p className="text-xs text-gray-500">홈 화면에 추가하여 더 빠르게 이용하세요</p>
        </div>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
        >
          <Download size={14} />
          설치
        </button>
        <button onClick={() => setDismissed(true)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
