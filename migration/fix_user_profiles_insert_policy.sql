-- ============================================
-- CORREÇÃO: Adicionar política INSERT para user_profiles
-- Problema: Novos usuários não conseguem criar seu próprio perfil após confirmar email
-- ============================================

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Permitir que usuários criem seu próprio perfil
-- O id do perfil deve ser igual ao auth.uid() (o usuário só pode criar seu próprio perfil)
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Verificar se a política foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    RAISE NOTICE '✅ Política "Users can insert own profile" criada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar a política';
  END IF;
END $$;
