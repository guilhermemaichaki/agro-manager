-- ============================================
-- CORREÇÃO COMPLETA: RLS para user_profiles
-- Este script garante que todas as políticas necessárias existam
-- ============================================

-- 1. Garantir que RLS está habilitado
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas antigas
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert access for users" ON user_profiles;
DROP POLICY IF EXISTS "Enable update access for users" ON user_profiles;

-- 3. Criar política de SELECT
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- 4. Criar política de INSERT (IMPORTANTE para novos usuários)
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Criar política de UPDATE
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. Verificar se as políticas foram criadas
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'user_profiles';
  
  IF policy_count >= 3 THEN
    RAISE NOTICE '✅ Sucesso! % políticas criadas para user_profiles', policy_count;
  ELSE
    RAISE WARNING '⚠️ Apenas % políticas encontradas. Verifique se todas foram criadas.', policy_count;
  END IF;
END $$;

-- 7. Listar políticas criadas
SELECT 
  policyname as "Nome da Política",
  cmd as "Operação",
  qual as "Condição USING",
  with_check as "Condição WITH CHECK"
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;
