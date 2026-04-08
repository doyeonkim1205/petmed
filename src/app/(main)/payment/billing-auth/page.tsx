import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getProductById, getActiveProducts } from '@/lib/products';
import BillingAuthClient from './BillingAuthClient';

interface PageProps {
  searchParams: Promise<{ productId?: string; plan?: string }>;
}

export default async function BillingAuthPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Resolve productId either directly or from `plan=plus` shorthand
  let productId = params.productId;
  if (!productId && params.plan) {
    const products = await getActiveProducts();
    const matched = products.find((p) => p.plan === params.plan && p.period === 'month');
    productId = matched?.id;
  }

  const product = productId ? await getProductById(productId) : null;

  // Recurring billing only makes sense for monthly products
  const isAllowed = product && product.period === 'month';

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      }
    >
      <BillingAuthClient product={isAllowed ? product : null} />
    </Suspense>
  );
}
