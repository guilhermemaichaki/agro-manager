-- ============================================
-- CORREÇÃO: Renomear coluna de área na tabela fields
-- ============================================
-- Execute este script no Supabase SQL Editor
-- O código está usando area_hct mas a coluna no banco é area
-- Esta migration renomeia area para area_hct

-- Renomear coluna 'area' para 'area_hct' se existir
DO $$
BEGIN
  -- Se existe coluna 'area' mas não existe 'area_hct', renomear
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fields' 
    AND column_name = 'area'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fields' 
    AND column_name = 'area_hct'
  ) THEN
    ALTER TABLE fields RENAME COLUMN area TO area_hct;
    RAISE NOTICE 'Coluna area renomeada para area_hct';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fields' 
    AND column_name = 'area_hectares'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fields' 
    AND column_name = 'area_hct'
  ) THEN
    -- Se existe area_hectares, renomear também
    ALTER TABLE fields RENAME COLUMN area_hectares TO area_hct;
    RAISE NOTICE 'Coluna area_hectares renomeada para area_hct';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fields' 
    AND column_name = 'area_hct'
  ) THEN
    -- Se não existe nenhuma, criar area_hct
    ALTER TABLE fields ADD COLUMN area_hct NUMERIC(10,2);
    RAISE NOTICE 'Coluna area_hct criada (nenhuma coluna de área existia)';
  ELSE
    RAISE NOTICE 'Coluna area_hct já existe';
  END IF;
END $$;
