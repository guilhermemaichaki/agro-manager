-- Script para verificar se as tabelas de categorias existem e quantas categorias foram inseridas

-- Verificar se a tabela categories existe
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'categories';

-- Verificar se a tabela product_categories existe
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'product_categories';

-- Contar categorias por grupo (se a tabela existir)
SELECT 
  group_name,
  type,
  COUNT(*) as quantidade
FROM categories
GROUP BY group_name, type
ORDER BY group_name, type;

-- Listar todas as categorias (se a tabela existir)
SELECT 
  id,
  name,
  type,
  group_name,
  created_at
FROM categories
ORDER BY group_name, name;
