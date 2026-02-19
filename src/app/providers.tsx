'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingGate } from '@/components/Onboarding';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OnboardingGate>
        {children}
      </OnboardingGate>
    </AuthProvider>
  );
}
