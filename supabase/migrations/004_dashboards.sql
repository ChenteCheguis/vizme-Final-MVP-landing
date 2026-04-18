-- Dashboards guardados por el usuario (máx 5 por usuario)
CREATE TABLE IF NOT EXISTS dashboards (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL DEFAULT 'Mi Dashboard',
  config      jsonb       NOT NULL DEFAULT '{}',
  snapshot    jsonb,
  version     integer     DEFAULT 1,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_dashboards"
  ON dashboards FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION update_dashboard_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_dashboard_timestamp();
