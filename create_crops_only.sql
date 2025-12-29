-- Script SIMPLES para criar APENAS a tabela crops
-- Execute este script PRIMEIRO no SQL Editor do Supabase Dashboard
-- Depois execute o script de migração completo se necessário

-- Criar tabela crops
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

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_crops_harvest_year_id ON public.crops(harvest_year_id);
CREATE INDEX IF NOT EXISTS idx_crops_culture_id ON public.crops(culture_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;

-- Política básica de RLS
DROP POLICY IF EXISTS "Enable all operations for crops" ON public.crops;
CREATE POLICY "Enable all operations for crops" ON public.crops
  FOR ALL
  USING (true)
  WITH CHECK (true);
