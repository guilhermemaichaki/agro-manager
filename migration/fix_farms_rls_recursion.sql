-- ============================================
-- CORREÇÃO: Remover recursão infinita nas políticas RLS de farms
-- ============================================
-- Execute este script no Supabase SQL Editor
-- O problema é que as políticas de farms fazem SELECT em farm_members,
-- que por sua vez fazem SELECT em farms, causando recursão mútua

-- Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Members can view farms" ON farms;
DROP POLICY IF EXISTS "Owners can update farms" ON farms;
DROP POLICY IF EXISTS "Owners can delete farms" ON farms;

-- Criar função helper com SECURITY DEFINER para verificar se usuário é membro da fazenda
-- Esta função executa com privilégios elevados e BYPASS RLS, evitando recursão
CREATE OR REPLACE FUNCTION is_user_farm_member(p_farm_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM farm_members
    WHERE farm_id = p_farm_id 
      AND user_id = p_user_id 
      AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar políticas corrigidas que evitam recursão
-- Política 1: Usuários podem ver fazendas onde são owners OU onde são membros (usando função SECURITY DEFINER)
CREATE POLICY "Members can view farms"
  ON farms FOR SELECT
  USING (
    -- Usuário é owner da fazenda
    owner_id = auth.uid()
    OR
    -- OU usuário é membro da fazenda (usando função SECURITY DEFINER que bypass RLS)
    is_user_farm_member(id, auth.uid())
  );

-- Política 2: Apenas owners podem atualizar fazenda (usando owner_id diretamente)
CREATE POLICY "Owners can update farms"
  ON farms FOR UPDATE
  USING (
    owner_id = auth.uid()
  )
  WITH CHECK (
    owner_id = auth.uid()
  );

-- Política 3: Apenas owners podem deletar fazenda (usando owner_id diretamente)
CREATE POLICY "Owners can delete farms"
  ON farms FOR DELETE
  USING (
    owner_id = auth.uid()
  );
