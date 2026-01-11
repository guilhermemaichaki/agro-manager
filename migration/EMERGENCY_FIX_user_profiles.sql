-- ============================================
-- FIX DE EMERGÊNCIA: Criar user_profiles
-- ============================================
-- IMPORTANTE: Execute este script no Supabase SQL Editor
-- Este script cria a tabela SEM RLS primeiro, depois configura tudo

-- PASSO 1: Verificar se a tabela existe (deve retornar vazio se não existir)
SELECT 'Tabela existe?' as status, COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles';

-- PASSO 2: Remover tabela se existir (CUIDADO: Isso apaga dados!)
-- DESCOMENTE APENAS SE QUISER RECRIAR DO ZERO
-- DROP TABLE IF EXISTS user_profiles CASCADE;

-- PASSO 3: Criar a tabela user_profiles SEM RLS primeiro
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- PASSO 4: Garantir que RLS está DESABILITADO temporariamente
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- PASSO 5: Criar perfis para TODOS os usuários existentes
INSERT INTO user_profiles (id, email, full_name)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = u.id
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name);

-- PASSO 6: Criar função updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASSO 7: Criar trigger updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PASSO 8: Criar função handle_new_user
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

-- PASSO 9: Criar trigger handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- PASSO 10: Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- PASSO 11: Remover políticas antigas
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- PASSO 12: Criar políticas RLS
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- PASSO 13: VERIFICAR RESULTADO - Deve mostrar os perfis criados
SELECT 
  'VERIFICAÇÃO FINAL' as status,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as profiles_with_name
FROM user_profiles;

-- PASSO 14: Listar todos os perfis
SELECT 
  id,
  email,
  full_name,
  created_at
FROM user_profiles
ORDER BY created_at DESC;
