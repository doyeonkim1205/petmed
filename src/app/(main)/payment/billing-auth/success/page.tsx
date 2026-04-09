import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BillingAuthSuccessClient from './BillingAuthSuccessClient';

interface PageProps {
  searchParams: Promise<{
    authKey?: string;
    customerKey?: string;
    productId?: string;
    mode?: string;
  }>;
}

export default async function BillingAuthSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      }
    >
      <BillingAuthSuccessClient
        authKey={params.authKey || ''}
        customerKey={params.customerKey || ''}
        productId={params.productId || ''}
        mode={params.mode || 'register'}
      />
    </Suspense>
  );
}
