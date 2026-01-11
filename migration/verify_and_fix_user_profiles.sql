-- Script para verificar se a tabela user_profiles existe e criar perfis para usuários existentes
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR SE A TABELA EXISTE
-- ============================================
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles';

-- ============================================
-- 2. SE A TABELA NÃO EXISTIR, CRIAR A TABELA
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- 3. CRIAR PERFIS PARA USUÁRIOS EXISTENTES
-- ============================================
-- Este INSERT cria perfis para usuários que já existem no auth.users mas não têm perfil
INSERT INTO user_profiles (id, email, full_name)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. VERIFICAR RESULTADO
-- ============================================
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.created_at
FROM user_profiles up
ORDER BY up.created_at DESC;
