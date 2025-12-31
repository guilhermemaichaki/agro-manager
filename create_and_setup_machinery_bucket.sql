-- Script completo: Criar bucket e configurar políticas RLS para machinery-photos

-- Passo 1: Criar o bucket (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('machinery-photos', 'machinery-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Passo 2: Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can upload their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload to machinery-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from machinery-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update to machinery-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from machinery-photos" ON storage.objects;

-- Passo 3: Criar políticas que permitem operações no bucket machinery-photos sem autenticação
-- Permitir INSERT (upload) para qualquer pessoa no bucket machinery-photos
CREATE POLICY "Allow public upload to machinery-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'machinery-photos'
  );

-- Permitir SELECT (visualizar) para qualquer pessoa no bucket machinery-photos
CREATE POLICY "Allow public select from machinery-photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'machinery-photos'
  );

-- Permitir UPDATE para qualquer pessoa no bucket machinery-photos
CREATE POLICY "Allow public update to machinery-photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'machinery-photos'
  );

-- Permitir DELETE para qualquer pessoa no bucket machinery-photos
CREATE POLICY "Allow public delete from machinery-photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'machinery-photos'
  );
