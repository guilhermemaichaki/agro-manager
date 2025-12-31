-- IMPORTANTE: Certifique-se de que o bucket 'machinery-photos' foi criado antes de executar este script!
-- Se o bucket não existir, crie-o primeiro via Dashboard ou execute:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('machinery-photos', 'machinery-photos', true);

-- Ajustar políticas RLS do bucket machinery-photos para permitir uploads sem autenticação

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can upload their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own machinery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own machinery photos" ON storage.objects;

-- Criar políticas que permitem operações no bucket machinery-photos sem autenticação
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
