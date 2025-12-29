-- Script para remover colunas antigas da tabela field_crops
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script remove crop_year_id e culture_id se existirem

DO $$
BEGIN
  -- Remover crop_year_id se existir
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_year_id'
  ) THEN
    ALTER TABLE public.field_crops 
    DROP COLUMN crop_year_id CASCADE;
    
    RAISE NOTICE 'Coluna crop_year_id removida da tabela field_crops';
  END IF;
  
  -- Remover culture_id se existir (agora vem através de crop_id -> crops -> culture_id)
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'culture_id'
  ) THEN
    ALTER TABLE public.field_crops 
    DROP COLUMN culture_id CASCADE;
    
    RAISE NOTICE 'Coluna culture_id removida da tabela field_crops';
  END IF;
  
  -- Garantir que crop_id existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_id'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Coluna crop_id adicionada à tabela field_crops';
    RAISE WARNING 'ATENÇÃO: A coluna crop_id foi criada como NULL. Você precisa migrar os dados existentes e depois tornar a coluna NOT NULL.';
  END IF;
  
  -- Garantir que status existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN status TEXT DEFAULT 'PLANNED';
    
    RAISE NOTICE 'Coluna status adicionada à tabela field_crops';
  END IF;
  
  -- Garantir que date_planted existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'date_planted'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN date_planted DATE;
    
    RAISE NOTICE 'Coluna date_planted adicionada à tabela field_crops';
  END IF;
  
  -- Garantir que date_harvest_prediction existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'date_harvest_prediction'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN date_harvest_prediction DATE;
    
    RAISE NOTICE 'Coluna date_harvest_prediction adicionada à tabela field_crops';
  END IF;
  
  RAISE NOTICE 'Limpeza de colunas antigas concluída';
  
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
