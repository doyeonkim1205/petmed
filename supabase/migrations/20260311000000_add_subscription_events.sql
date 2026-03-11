-- Subscription events log for tracking all subscription lifecycle events
CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('purchase', 'renew', 'cancel', 'refund', 'expired', 'downgrade', 'upgrade')),
  plan text NOT NULL CHECK (plan IN ('basic', 'premium')),
  amount integer,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type, created_at DESC);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON subscription_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON subscription_events
  FOR ALL USING (auth.role() = 'service_role');
