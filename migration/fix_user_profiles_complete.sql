-- ============================================
-- SCRIPT COMPLETO: Criar user_profiles e configurar RLS corretamente
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Este script garante que a tabela existe, RLS está configurado, e perfis são criados

-- 1. Criar a tabela user_profiles (se não existir)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Desabilitar RLS temporariamente para garantir que podemos criar perfis
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 3. Criar função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para updated_at (se não existir)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Criar perfis para usuários existentes que não têm perfil
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

-- 6. Criar função para criar perfil automaticamente (se não existir)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Criar trigger para criar perfil automaticamente (se não existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 8. Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 9. Remover políticas existentes (para evitar conflitos)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- 10. Criar políticas RLS
-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Permitir que o trigger crie perfis (usando SECURITY DEFINER)
-- Nota: O trigger já usa SECURITY DEFINER, então isso deve funcionar

-- 11. Verificar resultado
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as profiles_with_name
FROM user_profiles;

-- 12. Listar todos os perfis criados
SELECT 
  id,
  email,
  full_name,
  created_at
FROM user_profiles
ORDER BY created_at DESC;
