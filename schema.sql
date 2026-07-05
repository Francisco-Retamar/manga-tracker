-- Ejecutar en SQL Editor de Supabase Dashboard

CREATE TABLE mangas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  current_chapter INTEGER NOT NULL DEFAULT 0,
  my_chapter INTEGER NOT NULL DEFAULT 0,
  reading_url TEXT,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mangas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mangas"
  ON mangas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_mangas_user_id ON mangas(user_id);
