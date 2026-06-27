'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingGate } from '@/components/Onboarding';
import { NativePushListener } from '@/components/NativePushListener';
import { LocaleSync } from '@/components/LocaleSync';
import { DeviceDebugOverlay } from '@/components/DeviceDebugOverlay';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NativePushListener />
      <LocaleSync />
      <OnboardingGate>
        {children}
      </OnboardingGate>
      {/* ⚠️ 임시 진단 오버레이 — 기기세션 디버깅. 원인 파악 후 제거. */}
      <DeviceDebugOverlay />
    </AuthProvider>
  );
}
