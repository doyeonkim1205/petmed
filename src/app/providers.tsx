'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingGate } from '@/components/Onboarding';
import { NativePushListener } from '@/components/NativePushListener';
import { LocaleSync } from '@/components/LocaleSync';
import { captureFirstTouch } from '@/lib/attribution';

export function Providers({ children }: { children: React.ReactNode }) {
  // 첫 방문 유입정보(referrer/utm/landing) write-once 저장 — 가입 시 auth.signup 에 합쳐 기록.
  useEffect(() => { captureFirstTouch(); }, []);
  return (
    <AuthProvider>
      <NativePushListener />
      <LocaleSync />
      <OnboardingGate>
        {children}
      </OnboardingGate>
    </AuthProvider>
  );
}
