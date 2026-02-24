-- Add 'basic' to profiles plan check if not exists
DO $$
BEGIN
  -- Drop old constraint and add new one with 'basic'
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
    CHECK (plan IN ('free', 'basic', 'premium'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- If column has no constraint, that's fine
END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  toss_customer_key TEXT,
  toss_billing_key TEXT,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payment_history table
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  toss_payment_key TEXT NOT NULL,
  toss_order_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'canceled', 'refunded')),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can view own subscriptions'
  ) THEN
    CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can only read their own payment history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_history' AND policyname = 'Users can view own payment history'
  ) THEN
    CREATE POLICY "Users can view own payment history" ON public.payment_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);
