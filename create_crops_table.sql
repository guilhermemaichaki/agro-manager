-- Script para criar a tabela crops no Supabase
-- Execute este script no SQL Editor do Supabase Dashboard
-- Acesse: Supabase Dashboard > SQL Editor > New Query

-- Verificar se a tabela crops já existe (opcional - apenas para debug)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crops';

-- TABELA DE DEFINIÇÃO DA SAFRA (O "Planejamento Macro")
-- Se a tabela já existir com outro nome, você pode renomeá-la ou criar esta nova
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

-- Habilitar Row Level Security (RLS) se necessário
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

-- Política básica de RLS (ajuste conforme suas necessidades de segurança)
-- Esta política permite todas as operações - você pode restringir depois
DROP POLICY IF EXISTS "Enable all operations for crops" ON public.crops;
CREATE POLICY "Enable all operations for crops" ON public.crops
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verificar se a tabela field_crops existe (necessária para o funcionamento completo)
-- Se não existir, execute também o schema.sql completo ou crie a tabela field_crops:
/*
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
*/
