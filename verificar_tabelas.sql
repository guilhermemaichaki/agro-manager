-- Query de Verificação - Execute esta query DEPOIS de executar o migrate_to_crops_schema.sql
-- Esta query mostra a estrutura das tabelas crops e field_crops

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('crops', 'field_crops')
ORDER BY table_name, ordinal_position;
