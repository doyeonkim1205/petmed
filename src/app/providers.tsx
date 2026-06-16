'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingGate } from '@/components/Onboarding';
import { NativePushListener } from '@/components/NativePushListener';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NativePushListener />
      <OnboardingGate>
        {children}
      </OnboardingGate>
    </AuthProvider>
  );
}
