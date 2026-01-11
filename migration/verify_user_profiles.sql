-- Script de verificação - Execute no Supabase SQL Editor
-- Este script verifica se a tabela user_profiles existe e mostra os dados

-- 1. Verificar se a tabela existe
SELECT 
  table_name,
  table_schema,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles';

-- 2. Se a tabela existir, contar quantos perfis existem
SELECT 
  COUNT(*) as total_profiles
FROM user_profiles;

-- 3. Listar todos os perfis (se a tabela existir)
SELECT 
  id,
  email,
  full_name,
  created_at,
  updated_at
FROM user_profiles
ORDER BY created_at DESC;

-- 4. Verificar se há usuários no auth.users sem perfil
SELECT 
  u.id,
  u.email,
  u.created_at as user_created_at,
  CASE 
    WHEN up.id IS NULL THEN 'SEM PERFIL'
    ELSE 'COM PERFIL'
  END as status
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
ORDER BY u.created_at DESC;
