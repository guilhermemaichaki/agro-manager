-- ============================================
-- ADICIONAR COLUNA field_crop_id À TABELA applications
-- ============================================
-- Execute este script no Supabase SQL Editor
-- O código está usando field_crop_id mas a coluna não existe na tabela applications

-- Adicionar coluna field_crop_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'field_crop_id'
  ) THEN
    -- Adicionar a coluna como nullable (pode ser NULL)
    ALTER TABLE applications
    ADD COLUMN field_crop_id UUID REFERENCES field_crops(id) ON DELETE SET NULL;

    -- Criar índice para melhor performance
    CREATE INDEX IF NOT EXISTS idx_applications_field_crop_id ON applications(field_crop_id);

    RAISE NOTICE 'Coluna field_crop_id adicionada à tabela applications';
  ELSE
    RAISE NOTICE 'Coluna field_crop_id já existe na tabela applications';
  END IF;
END $$;
