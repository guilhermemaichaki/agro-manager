-- Script de migração para criar/atualizar as tabelas crops e field_crops
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script verifica e atualiza a estrutura existente

-- ============================================
-- 1. CRIAR TABELA CROPS (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS public.crops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  harvest_year_id UUID REFERENCES public.harvest_years(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- Ex: "Soja Intacta"
  culture_id UUID REFERENCES public.cultures(id) NOT NULL,
  variety TEXT,
  cycle TEXT NOT NULL, -- "Verão", "Inverno", "Safrinha"
  estimated_start_date DATE, -- Janela Ideal Início
  estimated_end_date DATE,   -- Janela Ideal Fim
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para melhor performance (apenas se não existirem)
CREATE INDEX IF NOT EXISTS idx_crops_harvest_year_id ON public.crops(harvest_year_id);
CREATE INDEX IF NOT EXISTS idx_crops_culture_id ON public.crops(culture_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

-- Política básica de RLS (permite todas as operações - ajuste conforme necessário)
DROP POLICY IF EXISTS "Enable all operations for crops" ON public.crops;
CREATE POLICY "Enable all operations for crops" ON public.crops
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. VERIFICAR E CRIAR/ATUALIZAR TABELA FIELD_CROPS
-- ============================================

DO $$
BEGIN
  -- Se a tabela não existe, criar
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops'
  ) THEN
    -- Criar tabela field_crops do zero
    CREATE TABLE public.field_crops (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE NOT NULL,
      crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE NOT NULL,
      status TEXT DEFAULT 'PLANNED', -- 'PLANNED' (Aguardando) ou 'PLANTED' (Confirmado)
      date_planted DATE, -- A Data Real do Plantio (Só preenche quando status = PLANTED)
      date_harvest_prediction DATE, -- Previsão de colheita ajustada
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE(field_id, crop_id)
    );
    
    RAISE NOTICE 'Tabela field_crops criada com sucesso';
    
  ELSE
    -- Tabela existe - adicionar colunas que faltam
    
    -- Adicionar crop_id se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'field_crops' 
      AND column_name = 'crop_id'
    ) THEN
      ALTER TABLE public.field_crops 
      ADD COLUMN crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE;
      
      CREATE INDEX IF NOT EXISTS idx_field_crops_crop_id ON public.field_crops(crop_id);
      
      RAISE NOTICE 'Coluna crop_id adicionada à tabela field_crops';
      RAISE WARNING 'ATENÇÃO: A coluna crop_id foi criada como NULL. Você precisa migrar os dados existentes e depois tornar a coluna NOT NULL.';
    END IF;
    
    -- Adicionar status se não existir
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
    
    -- Adicionar date_planted se não existir
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
    
    -- Adicionar date_harvest_prediction se não existir
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
    
    RAISE NOTICE 'Tabela field_crops atualizada com sucesso';
  END IF;
  
  -- Criar índices apenas se as colunas existirem
  -- Índice em field_id
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'field_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_field_crops_field_id ON public.field_crops(field_id);
  END IF;
  
  -- Índice em crop_id
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'crop_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_field_crops_crop_id ON public.field_crops(crop_id);
  END IF;
  
  -- Índice em status (só se a coluna existir)
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops' 
    AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_field_crops_status ON public.field_crops(status);
  END IF;
  
  -- Garantir que a constraint UNIQUE existe (apenas se ambas as colunas existirem)
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
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
      SELECT FROM pg_constraint 
      WHERE conname = 'field_crops_field_id_crop_id_key'
    ) THEN
      ALTER TABLE public.field_crops 
      ADD CONSTRAINT field_crops_field_id_crop_id_key UNIQUE(field_id, crop_id);
    END IF;
  END IF;
  
  -- Habilitar Row Level Security (RLS)
  ALTER TABLE public.field_crops ENABLE ROW LEVEL SECURITY;
  
  -- Política básica de RLS (permite todas as operações - ajuste conforme necessário)
  DROP POLICY IF EXISTS "Enable all operations for field_crops" ON public.field_crops;
  CREATE POLICY "Enable all operations for field_crops" ON public.field_crops
    FOR ALL
    USING (true)
    WITH CHECK (true);
    
END $$;
