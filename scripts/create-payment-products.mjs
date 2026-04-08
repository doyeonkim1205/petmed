// Run once to create payment_products table on both DBs.
// Usage: node scripts/create-payment-products.mjs

// Read access token from .env.local (never commit it)
import { readFileSync } from 'node:fs';
function readToken() {
  try {
    const text = readFileSync('.env.local', 'utf8');
    const m = text.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    }
  } catch {}
  return process.env.SUPABASE_ACCESS_TOKEN || '';
}
const TOKEN = readToken();
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not found in .env.local. Generate one at https://supabase.com/dashboard/account/tokens and add it.');
  process.exit(1);
}
const PROJECTS = {
  production: 'ylbxtzwbwbnlmfxqgmoz',
  development: 'lzmmiksdvioidcldrnvh',
};

const SQL = `
CREATE TABLE IF NOT EXISTS public.payment_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  plan text NOT NULL,
  price integer NOT NULL,
  period text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_products_select_anyone" ON public.payment_products;
CREATE POLICY "payment_products_select_anyone" ON public.payment_products
  FOR SELECT USING (true);

INSERT INTO public.payment_products (id, name, plan, price, period, description, active)
VALUES (
  'plus_monthly',
  'PawDex Plus 월간 구독',
  'plus',
  3900,
  'month',
  '월 단위 자동 결제, 언제든지 해지 가능',
  true
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      plan = EXCLUDED.plan,
      price = EXCLUDED.price,
      period = EXCLUDED.period,
      description = EXCLUDED.description,
      active = EXCLUDED.active,
      updated_at = now();

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS product_id text REFERENCES public.payment_products(id);
`;

for (const [env, ref] of Object.entries(PROJECTS)) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  const text = await res.text();
  console.log(`[${env}] ${res.status}: ${text.slice(0, 300)}`);
}
