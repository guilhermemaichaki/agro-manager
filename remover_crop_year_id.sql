-- Script para remover a coluna antiga crop_year_id da tabela field_crops
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script remove a coluna crop_year_id se ela existir

DO $$
BEGIN
  -- Verificar se a coluna crop_year_id existe e removê-la
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_year_id'
  ) THEN
    -- Primeiro, remover a constraint NOT NULL se existir (caso tenha dados)
    -- Depois remover a coluna
    ALTER TABLE public.field_crops 
    DROP COLUMN IF EXISTS crop_year_id CASCADE;
    
    RAISE NOTICE 'Coluna crop_year_id removida da tabela field_crops';
  ELSE
    RAISE NOTICE 'Coluna crop_year_id não existe na tabela field_crops';
  END IF;
  
  -- Garantir que a coluna crop_id existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_id'
  ) THEN
    -- Adicionar coluna crop_id se não existir
    ALTER TABLE public.field_crops 
    ADD COLUMN crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Coluna crop_id adicionada à tabela field_crops';
    RAISE WARNING 'ATENÇÃO: A coluna crop_id foi criada como NULL. Você precisa migrar os dados existentes e depois tornar a coluna NOT NULL.';
  ELSE
    RAISE NOTICE 'Coluna crop_id já existe na tabela field_crops';
  END IF;
  
END $$;

-- Verificar a estrutura final da tabela field_crops
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'field_crops'
ORDER BY ordinal_position;
