-- ============================================================
-- VIZME V4 Migration
-- ============================================================

-- 1. Add business address fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS business_lng DOUBLE PRECISION;

-- 2. Weekly entries (quick data update without uploading Excel)
CREATE TABLE IF NOT EXISTS weekly_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  entry_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_entries_project ON weekly_entries(project_id, created_at DESC);
ALTER TABLE weekly_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_entries_user ON weekly_entries FOR ALL USING (auth.uid() = user_id);

-- 3. Competitors (Google Places cache)
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  place_id TEXT,
  name TEXT NOT NULL,
  rating NUMERIC(2,1),
  review_count INTEGER DEFAULT 0,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  hours JSONB,
  reviews_sample JSONB,
  phone TEXT,
  website TEXT,
  types TEXT[],
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitors_project ON competitors(project_id);
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitors_user ON competitors FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- 4. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'monthly', 'alert', 'competitor', 'streak')),
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_user ON notifications FOR ALL USING (auth.uid() = user_id);

-- 5. Shared links (public read-only dashboard access)
CREATE TABLE IF NOT EXISTS shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY shared_links_owner ON shared_links FOR ALL USING (auth.uid() = created_by);

-- 6. Add streak tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_weeks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_data_update TIMESTAMPTZ;

-- 7. Add discovery_result to files (cache the narrated discovery)
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS discovery_result JSONB;

-- 8. Add health_score_history to projects for trend tracking
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS health_score_current INTEGER,
  ADD COLUMN IF NOT EXISTS health_score_previous INTEGER,
  ADD COLUMN IF NOT EXISTS health_score_trend TEXT CHECK (health_score_trend IN ('up', 'down', 'stable'));
