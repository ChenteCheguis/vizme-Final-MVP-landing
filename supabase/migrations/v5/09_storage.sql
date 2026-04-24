-- ============================================================
-- VIZME V5 - Migration 09: storage bucket user-files
-- Sprint 2 - Schema Engine
-- Bucket privado para los archivos que sube el cliente.
-- Layout: user-files/<user_id>/<file_uuid>.<ext>
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de Storage: cada usuario sólo ve/sube/borra dentro de su carpeta.

CREATE POLICY "Users can upload their files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
