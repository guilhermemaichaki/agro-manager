-- ============================================
-- SCRIPT COMPLETO: Criar user_profiles e corrigir usuários existentes
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Este script cria a tabela user_profiles se não existir e cria perfis para usuários existentes

-- 1. Criar a tabela user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Criar função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para updated_at (se não existir)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Criar perfis para usuários existentes que não têm perfil
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

-- 5. Verificar resultado
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as profiles_with_name
FROM user_profiles;
