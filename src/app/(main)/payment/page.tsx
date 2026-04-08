import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getProductById, getActiveProducts } from '@/lib/products';
import PaymentClient from './PaymentClient';

interface PageProps {
  searchParams: Promise<{ productId?: string; plan?: string }>;
}

export default async function PaymentPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Backwards compat: if `plan` query is given, resolve it to the default monthly product.
  let productId = params.productId;
  if (!productId && params.plan) {
    const products = await getActiveProducts();
    const matched = products.find((p) => p.plan === params.plan && p.period === 'month');
    productId = matched?.id;
  }

  const product = productId ? await getProductById(productId) : null;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      }
    >
      <PaymentClient product={product} />
    </Suspense>
  );
}
