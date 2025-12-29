-- Script COMPLETO para limpar TODAS as colunas antigas da tabela field_crops
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script remove todas as colunas antigas e garante apenas as corretas

DO $$
BEGIN
  -- Lista de colunas antigas que devem ser removidas
  -- (colunas que não fazem parte do novo schema)
  
  -- Remover harvest_cycle_id se existir
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'harvest_cycle_id'
  ) THEN
    ALTER TABLE public.field_crops 
    DROP COLUMN harvest_cycle_id CASCADE;
    
    RAISE NOTICE 'Coluna harvest_cycle_id removida';
  END IF;
  
  -- Remover crop_year_id se existir
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_year_id'
  ) THEN
    ALTER TABLE public.field_crops 
    DROP COLUMN crop_year_id CASCADE;
    
    RAISE NOTICE 'Coluna crop_year_id removida';
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
    
    RAISE NOTICE 'Coluna culture_id removida';
  END IF;
  
  -- Garantir que todas as colunas corretas existem
  
  -- id (deve existir como PRIMARY KEY)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'id'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
    
    RAISE NOTICE 'Coluna id adicionada';
  END IF;
  
  -- field_id (deve existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'field_id'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE NOT NULL;
    
    RAISE NOTICE 'Coluna field_id adicionada';
  END IF;
  
  -- crop_id (deve existir - esta é a nova coluna principal)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_id'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Coluna crop_id adicionada (NULL permitido temporariamente)';
    RAISE WARNING 'ATENÇÃO: crop_id foi criada como NULL. Migre os dados e depois torne NOT NULL.';
  END IF;
  
  -- status (deve existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN status TEXT DEFAULT 'PLANNED';
    
    RAISE NOTICE 'Coluna status adicionada';
  END IF;
  
  -- date_planted (deve existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'date_planted'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN date_planted DATE;
    
    RAISE NOTICE 'Coluna date_planted adicionada';
  END IF;
  
  -- date_harvest_prediction (deve existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'date_harvest_prediction'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN date_harvest_prediction DATE;
    
    RAISE NOTICE 'Coluna date_harvest_prediction adicionada';
  END IF;
  
  -- created_at (deve existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.field_crops 
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    
    RAISE NOTICE 'Coluna created_at adicionada';
  END IF;
  
  -- Criar índices se não existirem
  CREATE INDEX IF NOT EXISTS idx_field_crops_field_id ON public.field_crops(field_id);
  CREATE INDEX IF NOT EXISTS idx_field_crops_crop_id ON public.field_crops(crop_id);
  CREATE INDEX IF NOT EXISTS idx_field_crops_status ON public.field_crops(status);
  
  -- Garantir constraint UNIQUE (field_id, crop_id) se ambas as colunas existirem
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'field_id'
  ) AND EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_id'
  ) THEN
    -- Remover constraint antiga se existir com nome diferente
    IF EXISTS (
      SELECT FROM pg_constraint 
      WHERE conname LIKE 'field_crops%unique%' 
      OR conname LIKE 'field_crops%key'
    ) THEN
      -- Não podemos usar DROP CONSTRAINT IF EXISTS diretamente, então vamos tentar remover todas as possíveis
      BEGIN
        ALTER TABLE public.field_crops DROP CONSTRAINT IF EXISTS field_crops_field_id_crop_id_key;
        ALTER TABLE public.field_crops DROP CONSTRAINT IF EXISTS field_crops_field_id_crop_id_unique;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignorar se não existir
      END;
    END IF;
    
    -- Criar constraint UNIQUE se não existir
    IF NOT EXISTS (
      SELECT FROM pg_constraint 
      WHERE conname = 'field_crops_field_id_crop_id_key'
    ) THEN
      ALTER TABLE public.field_crops 
      ADD CONSTRAINT field_crops_field_id_crop_id_key UNIQUE(field_id, crop_id);
      
      RAISE NOTICE 'Constraint UNIQUE (field_id, crop_id) criada';
    END IF;
  END IF;
  
  -- Habilitar Row Level Security (RLS)
  ALTER TABLE public.field_crops ENABLE ROW LEVEL SECURITY;
  
  -- Política básica de RLS
  DROP POLICY IF EXISTS "Enable all operations for field_crops" ON public.field_crops;
  CREATE POLICY "Enable all operations for field_crops" ON public.field_crops
    FOR ALL
    USING (true)
    WITH CHECK (true);
  
  RAISE NOTICE 'Limpeza completa concluída!';
  
END $$;

-- Verificar a estrutura final da tabela field_crops
-- Deve mostrar apenas: id, field_id, crop_id, status, date_planted, date_harvest_prediction, created_at
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'field_crops'
ORDER BY ordinal_position;
