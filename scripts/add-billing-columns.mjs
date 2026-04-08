// Add billing-related columns to subscriptions on both DBs.
// Reads SUPABASE_ACCESS_TOKEN from .env.local.
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
  console.error('SUPABASE_ACCESS_TOKEN not found in .env.local. Generate one at https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const PROJECTS = {
  production: 'ylbxtzwbwbnlmfxqgmoz',
  development: 'lzmmiksdvioidcldrnvh',
};

const SQL = `
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_failed_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_billing_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_billing_failure_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'subscriptions_billing_type_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_billing_type_check
      CHECK (billing_type IN ('one_time', 'recurring'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing
  ON public.subscriptions (next_billing_at)
  WHERE billing_type = 'recurring' AND status = 'active';
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
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
