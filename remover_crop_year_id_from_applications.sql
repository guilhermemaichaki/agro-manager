-- Script para remover a coluna antiga crop_year_id da tabela applications
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script remove crop_year_id e garante que harvest_year_id está correta

DO $$
BEGIN
  -- 1. Remover constraint NOT NULL de crop_year_id se existir (para permitir remoção)
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'applications' 
      AND column_name = 'crop_year_id'
  ) THEN
    -- Primeiro, remover a constraint NOT NULL se existir
    BEGIN
      ALTER TABLE public.applications 
      ALTER COLUMN crop_year_id DROP NOT NULL;
      RAISE NOTICE 'Constraint NOT NULL removida de crop_year_id';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível remover NOT NULL (pode não existir): %', SQLERRM;
    END;
    
    -- Depois, remover a coluna completamente
    ALTER TABLE public.applications 
    DROP COLUMN IF EXISTS crop_year_id CASCADE;
    
    RAISE NOTICE 'Coluna crop_year_id removida da tabela applications';
  ELSE
    RAISE NOTICE 'Coluna crop_year_id não existe na tabela applications';
  END IF;
  
  -- 2. Garantir que harvest_year_id existe e está correta
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'applications' 
      AND column_name = 'harvest_year_id'
  ) THEN
    -- Adicionar a coluna harvest_year_id
    ALTER TABLE public.applications
    ADD COLUMN harvest_year_id UUID REFERENCES public.harvest_years(id) ON DELETE CASCADE;
    
    -- Criar índice para melhor performance
    CREATE INDEX IF NOT EXISTS idx_applications_harvest_year_id ON public.applications(harvest_year_id);
    
    RAISE NOTICE 'Coluna harvest_year_id adicionada à tabela applications';
  ELSE
    RAISE NOTICE 'Coluna harvest_year_id já existe na tabela applications';
  END IF;
  
END $$;

-- Verificação: Listar todas as colunas da tabela applications
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'applications'
ORDER BY ordinal_position;
