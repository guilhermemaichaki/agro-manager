-- Script completo para criar as tabelas crops e field_crops no Supabase
-- Execute este script no SQL Editor do Supabase Dashboard
-- Acesse: Supabase Dashboard > SQL Editor > New Query

-- ============================================
-- 1. CRIAR TABELA CROPS
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

-- Criar índices para melhor performance
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
-- 2. CRIAR TABELA FIELD_CROPS (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS public.field_crops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE NOT NULL,
  crop_id UUID REFERENCES public.crops(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'PLANNED', -- 'PLANNED' (Aguardando) ou 'PLANTED' (Confirmado)
  date_planted DATE, -- A Data Real do Plantio (Só preenche quando status = PLANTED)
  date_harvest_prediction DATE, -- Previsão de colheita ajustada
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(field_id, crop_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_field_crops_field_id ON public.field_crops(field_id);
CREATE INDEX IF NOT EXISTS idx_field_crops_crop_id ON public.field_crops(crop_id);
CREATE INDEX IF NOT EXISTS idx_field_crops_status ON public.field_crops(status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.field_crops ENABLE ROW LEVEL SECURITY;

-- Política básica de RLS (permite todas as operações - ajuste conforme necessário)
DROP POLICY IF EXISTS "Enable all operations for field_crops" ON public.field_crops;
CREATE POLICY "Enable all operations for field_crops" ON public.field_crops
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. VERIFICAÇÃO (opcional - para confirmar que as tabelas foram criadas)
-- ============================================
-- Execute esta query para verificar se as tabelas foram criadas:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('crops', 'field_crops')
-- ORDER BY table_name;
