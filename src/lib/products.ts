import { createClient } from '@supabase/supabase-js';

export interface PaymentProduct {
  id: string;
  name: string;
  plan: string;
  price: number;
  period: 'month' | 'year';
  description: string | null;
  active: boolean;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function getProductById(id: string): Promise<PaymentProduct | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_products')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .single();
  if (error || !data) return null;
  return data as PaymentProduct;
}

export async function getActiveProducts(): Promise<PaymentProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_products')
    .select('*')
    .eq('active', true)
    .order('price', { ascending: true });
  if (error || !data) return [];
  return data as PaymentProduct[];
}
