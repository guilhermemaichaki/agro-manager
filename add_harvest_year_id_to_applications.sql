-- Script para adicionar a coluna harvest_year_id à tabela applications
-- Execute este script no SQL Editor do Supabase Dashboard

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'applications' 
      AND column_name = 'harvest_year_id'
  ) THEN
    -- Adicionar a coluna harvest_year_id
    ALTER TABLE public.applications
    ADD COLUMN harvest_year_id UUID REFERENCES public.harvest_years(id) ON DELETE CASCADE;
    
    -- Criar índice para melhor performance
    CREATE INDEX IF NOT EXISTS idx_applications_harvest_year_id ON public.applications(harvest_year_id);
    
    RAISE NOTICE 'Coluna harvest_year_id adicionada com sucesso à tabela applications';
  ELSE
    RAISE NOTICE 'Coluna harvest_year_id já existe na tabela applications';
  END IF;
END $$;

-- Verificação: Listar todas as colunas da tabela applications
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'applications'
ORDER BY ordinal_position;
