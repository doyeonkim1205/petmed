'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingGate } from '@/components/Onboarding';
import { NativePushListener } from '@/components/NativePushListener';
import { LocaleSync } from '@/components/LocaleSync';

export function Providers({ children }: { children: React.ReactNode }) {
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
