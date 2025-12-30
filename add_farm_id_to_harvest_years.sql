-- Script para adicionar a coluna farm_id à tabela harvest_years
-- Execute este script no SQL Editor do Supabase Dashboard

DO $$
BEGIN
  -- Verificar se a coluna farm_id já existe
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'harvest_years' 
    AND column_name = 'farm_id'
  ) THEN
    -- Adicionar coluna farm_id
    ALTER TABLE public.harvest_years 
    ADD COLUMN farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Coluna farm_id adicionada à tabela harvest_years';
    RAISE WARNING 'ATENÇÃO: A coluna farm_id foi criada como NULL. Você precisa migrar os dados existentes e depois tornar a coluna NOT NULL.';
    
    -- Se houver dados existentes, você pode precisar associá-los a uma fazenda padrão
    -- Por exemplo, se houver apenas uma fazenda:
    -- UPDATE public.harvest_years SET farm_id = (SELECT id FROM public.farms LIMIT 1) WHERE farm_id IS NULL;
    
  ELSE
    RAISE NOTICE 'Coluna farm_id já existe na tabela harvest_years';
  END IF;
  
  -- Verificar se há harvest_years sem farm_id e tornar a coluna NOT NULL se todos tiverem farm_id
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'harvest_years' 
    AND column_name = 'farm_id'
    AND is_nullable = 'YES'
  ) THEN
    -- Verificar se todos os registros têm farm_id
    IF NOT EXISTS (
      SELECT 1 FROM public.harvest_years WHERE farm_id IS NULL
    ) THEN
      -- Tornar a coluna NOT NULL se todos os registros tiverem farm_id
      ALTER TABLE public.harvest_years 
      ALTER COLUMN farm_id SET NOT NULL;
      
      RAISE NOTICE 'Coluna farm_id definida como NOT NULL';
    ELSE
      RAISE WARNING 'Existem harvest_years sem farm_id. Associe todos os registros a uma fazenda antes de tornar a coluna NOT NULL.';
    END IF;
  END IF;
  
END $$;

-- Verificar a estrutura final da tabela harvest_years
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'harvest_years'
ORDER BY ordinal_position;
