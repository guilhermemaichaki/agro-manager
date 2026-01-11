-- ============================================
-- CORREÇÃO: Remover recursão infinita nas políticas RLS de farm_members
-- ============================================
-- Execute este script no Supabase SQL Editor
-- O problema é que as políticas fazem SELECT na própria tabela farm_members, causando recursão

-- Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Members can view farm members" ON farm_members;
DROP POLICY IF EXISTS "Admins can insert farm members" ON farm_members;
DROP POLICY IF EXISTS "Admins can update farm members" ON farm_members;
DROP POLICY IF EXISTS "Owners can delete farm members" ON farm_members;

-- Criar função helper com SECURITY DEFINER para verificar se usuário é owner da fazenda
-- Esta função executa com privilégios elevados e BYPASS RLS, evitando recursão
CREATE OR REPLACE FUNCTION is_user_farm_owner(p_farm_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM farms
    WHERE id = p_farm_id AND owner_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar políticas corrigidas que evitam recursão usando funções SECURITY DEFINER
-- Política 1: Usuários podem ver seu próprio registro OU membros de fazendas onde são owners
CREATE POLICY "Members can view farm members"
  ON farm_members FOR SELECT
  USING (
    -- Usuário pode ver seu próprio registro
    user_id = auth.uid()
    OR
    -- OU usuário é owner da fazenda (usando função SECURITY DEFINER que bypass RLS)
    is_user_farm_owner(farm_id, auth.uid())
  );

-- Política 2: Apenas owners podem inserir novos membros
CREATE POLICY "Owners can insert farm members"
  ON farm_members FOR INSERT
  WITH CHECK (
    is_user_farm_owner(farm_id, auth.uid())
  );

-- Política 3: Apenas owners podem atualizar membros
CREATE POLICY "Owners can update farm members"
  ON farm_members FOR UPDATE
  USING (
    is_user_farm_owner(farm_id, auth.uid())
  )
  WITH CHECK (
    is_user_farm_owner(farm_id, auth.uid())
  );

-- Política 4: Apenas owners podem deletar membros
CREATE POLICY "Owners can delete farm members"
  ON farm_members FOR DELETE
  USING (
    is_user_farm_owner(farm_id, auth.uid())
  );
