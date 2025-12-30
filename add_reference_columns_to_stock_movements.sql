-- Script para adicionar as colunas reference_id e reference_type à tabela stock_movements
-- Execute este script no SQL Editor do Supabase Dashboard
-- Essas colunas são usadas para rastrear a origem das movimentações (entrada ou aplicação)

DO $$
BEGIN
  -- 1. Adicionar coluna reference_id se não existir
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'stock_movements' 
      AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE public.stock_movements
    ADD COLUMN reference_id UUID;
    
    RAISE NOTICE 'Coluna reference_id adicionada à tabela stock_movements';
  ELSE
    RAISE NOTICE 'Coluna reference_id já existe na tabela stock_movements';
  END IF;
  
  -- 2. Adicionar coluna reference_type se não existir
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'stock_movements' 
      AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE public.stock_movements
    ADD COLUMN reference_type TEXT CHECK (reference_type IN ('entry', 'application'));
    
    RAISE NOTICE 'Coluna reference_type adicionada à tabela stock_movements';
  ELSE
    RAISE NOTICE 'Coluna reference_type já existe na tabela stock_movements';
  END IF;
  
  -- 3. Criar índice para melhor performance (opcional, mas recomendado)
  CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id 
    ON public.stock_movements(reference_id);
  
  CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_type 
    ON public.stock_movements(reference_type);
  
  RAISE NOTICE 'Índices criados para reference_id e reference_type';
  
END $$;

-- Verificação: Listar todas as colunas da tabela stock_movements
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'stock_movements'
ORDER BY ordinal_position;
