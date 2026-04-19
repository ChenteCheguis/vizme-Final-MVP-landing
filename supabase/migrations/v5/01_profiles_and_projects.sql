-- ============================================================
-- VIZME V5 - Migration 01: profiles + projects
-- Sprint 1 - DB Foundation
-- ============================================================

-- PROFILES: mirror of auth.users with V5 fields
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text,
  tier            text NOT NULL DEFAULT 'freemium' CHECK (tier IN ('freemium','pro','enterprise')),
  trial_ends_at   timestamptz,
  subscription_id text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- Trigger that auto-creates a profile row when a new auth.users row appears
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- PROJECTS: one project = one client business
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  question    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects(user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own projects"
  ON projects FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users create own projects"
  ON projects FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own projects"
  ON projects FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users delete own projects"
  ON projects FOR DELETE USING (user_id = auth.uid());
