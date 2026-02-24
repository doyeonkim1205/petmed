CREATE TABLE IF NOT EXISTS search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  pet_type TEXT NOT NULL,
  articles JSONB NOT NULL DEFAULT '[]',
  analysis JSONB,
  disease_description JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_cache_key ON search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_search_cache_created ON search_cache(created_at);

ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cache" ON search_cache FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert cache" ON search_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
