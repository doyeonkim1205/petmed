import { readFileSync } from 'node:fs';

function loadEnv(p) {
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) { let v=m[2].trim(); if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); v=v.replace(/\\n$/,''); out[m[1]]=v; }
  }
  return out;
}

// Update plus_monthly price to 3500 and description on both DBs
for (const [env, file] of [['production', '.env.production'], ['development', '.env.development']]) {
  const e = loadEnv(file);
  const h = {apikey: e.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + e.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json'};

  // We need a separate product for auto-billing vs one-time
  // Currently plus_monthly is used for both. Let's keep it as the auto price (3500)
  // and create plus_monthly_onetime for one-time (3900)

  // Update plus_monthly to 3500 (auto-billing price)
  const r1 = await fetch(e.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payment_products?id=eq.plus_monthly', {
    method: 'PATCH', headers: h,
    body: JSON.stringify({
      price: 3500,
      name: 'PawDex Plus 월간 자동 결제',
      description: '매월 자동 결제 (1회 대비 10.3% 할인)',
      updated_at: new Date().toISOString(),
    }),
  });
  console.log(`[${env}] plus_monthly → 3500:`, r1.status);

  // Create plus_monthly_onetime (3900) for one-time
  const r2 = await fetch(e.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payment_products', {
    method: 'POST',
    headers: { ...h, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      id: 'plus_monthly_onetime',
      name: 'PawDex Plus 월간 1회 결제',
      plan: 'plus',
      price: 3900,
      period: 'month',
      description: '30일 이용권 (1회 결제)',
      active: true,
    }),
  });
  console.log(`[${env}] plus_monthly_onetime → 3900:`, r2.status);

  // Verify
  const r3 = await fetch(e.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payment_products?select=id,price,name&active=eq.true&order=price', { headers: h });
  console.log(`[${env}] products:`, await r3.json());
  console.log('');
}
