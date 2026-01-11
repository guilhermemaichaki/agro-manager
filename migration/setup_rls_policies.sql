-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Configuração de políticas de segurança baseadas em permissões de fazenda
-- ============================================

-- Habilitar RLS em todas as tabelas relacionadas
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS PARA user_profiles
-- ============================================

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- POLÍTICAS PARA farm_members
-- ============================================

-- Membros podem ver membros da mesma fazenda
CREATE POLICY "Members can view farm members"
  ON farm_members FOR SELECT
  USING (
    farm_id IN (
      SELECT farm_id FROM farm_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Apenas admins e owners podem inserir novos membros
CREATE POLICY "Admins can insert farm members"
  ON farm_members FOR INSERT
  WITH CHECK (
    farm_id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role IN ('owner', 'admin')
        AND fm.accepted_at IS NOT NULL
    )
  );

-- Apenas admins e owners podem atualizar membros (exceto owner não pode mudar outro owner)
CREATE POLICY "Admins can update farm members"
  ON farm_members FOR UPDATE
  USING (
    farm_id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role IN ('owner', 'admin')
        AND fm.accepted_at IS NOT NULL
    )
    AND (role != 'owner' OR user_id = auth.uid()) -- Owner não pode mudar outro owner
  );

-- Apenas owners podem deletar membros (exceto owner não pode deletar outro owner)
CREATE POLICY "Owners can delete farm members"
  ON farm_members FOR DELETE
  USING (
    farm_id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role = 'owner'
        AND fm.accepted_at IS NOT NULL
    )
    AND (role != 'owner' OR user_id = auth.uid()) -- Owner não pode deletar outro owner
  );

-- ============================================
-- POLÍTICAS PARA farm_invitations
-- ============================================

-- Apenas admins e owners podem ver convites da fazenda
CREATE POLICY "Admins can view farm invitations"
  ON farm_invitations FOR SELECT
  USING (
    farm_id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role IN ('owner', 'admin')
        AND fm.accepted_at IS NOT NULL
    )
  );

-- Apenas admins e owners podem criar convites
CREATE POLICY "Admins can create farm invitations"
  ON farm_invitations FOR INSERT
  WITH CHECK (
    farm_id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role IN ('owner', 'admin')
        AND fm.accepted_at IS NOT NULL
    )
  );

-- Apenas admins e owners podem deletar convites
CREATE POLICY "Admins can delete farm invitations"
  ON farm_invitations FOR DELETE
  USING (
    farm_id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role IN ('owner', 'admin')
        AND fm.accepted_at IS NOT NULL
    )
  );

-- ============================================
-- POLÍTICAS PARA farms
-- ============================================

-- Usuários podem ver fazendas onde são membros
CREATE POLICY "Members can view farms"
  ON farms FOR SELECT
  USING (
    id IN (
      SELECT farm_id FROM farm_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Apenas usuários autenticados podem criar fazendas (serão owners)
CREATE POLICY "Authenticated users can create farms"
  ON farms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Apenas owners podem atualizar fazenda
CREATE POLICY "Owners can update farms"
  ON farms FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role = 'owner'
        AND fm.accepted_at IS NOT NULL
    )
  );

-- Apenas owners podem deletar fazenda
CREATE POLICY "Owners can delete farms"
  ON farms FOR DELETE
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT fm.farm_id FROM farm_members fm
      WHERE fm.user_id = auth.uid() 
        AND fm.role = 'owner'
        AND fm.accepted_at IS NOT NULL
    )
  );

-- ============================================
-- POLÍTICAS PARA harvest_years
-- ============================================

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE harvest_years ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Members can view harvest years" ON harvest_years;
DROP POLICY IF EXISTS "Members can create harvest years" ON harvest_years;
DROP POLICY IF EXISTS "Members can update harvest years" ON harvest_years;
DROP POLICY IF EXISTS "Members can delete harvest years" ON harvest_years;

-- Membros podem ver safras de suas fazendas
CREATE POLICY "Members can view harvest years"
  ON harvest_years FOR SELECT
  USING (
    farm_id IN (
      SELECT farm_id FROM farm_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Apenas com permissão create podem criar
CREATE POLICY "Members can create harvest years"
  ON harvest_years FOR INSERT
  WITH CHECK (
    has_farm_permission(farm_id, auth.uid(), 'create')
  );

-- Apenas com permissão update podem atualizar
CREATE POLICY "Members can update harvest years"
  ON harvest_years FOR UPDATE
  USING (
    has_farm_permission(farm_id, auth.uid(), 'update')
  );

-- Apenas com permissão delete podem deletar
CREATE POLICY "Members can delete harvest years"
  ON harvest_years FOR DELETE
  USING (
    has_farm_permission(farm_id, auth.uid(), 'delete')
  );

-- ============================================
-- POLÍTICAS PARA fields
-- ============================================

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Members can view fields" ON fields;
DROP POLICY IF EXISTS "Members can create fields" ON fields;
DROP POLICY IF EXISTS "Members can update fields" ON fields;
DROP POLICY IF EXISTS "Members can delete fields" ON fields;

-- Membros podem ver talhões de suas fazendas
CREATE POLICY "Members can view fields"
  ON fields FOR SELECT
  USING (
    farm_id IN (
      SELECT farm_id FROM farm_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Apenas com permissão create podem criar
CREATE POLICY "Members can create fields"
  ON fields FOR INSERT
  WITH CHECK (
    has_farm_permission(farm_id, auth.uid(), 'create')
  );

-- Apenas com permissão update podem atualizar
CREATE POLICY "Members can update fields"
  ON fields FOR UPDATE
  USING (
    has_farm_permission(farm_id, auth.uid(), 'update')
  );

-- Apenas com permissão delete podem deletar
CREATE POLICY "Members can delete fields"
  ON fields FOR DELETE
  USING (
    has_farm_permission(farm_id, auth.uid(), 'delete')
  );

-- ============================================
-- POLÍTICAS PARA crops, field_crops, applications
-- ============================================
-- Essas tabelas têm relação indireta com farms através de harvest_years/fields
-- Vamos criar políticas baseadas nessa relação

-- crops: através de harvest_years
-- Verificar se a tabela existe antes de aplicar políticas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'crops'
  ) THEN
    ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Members can view crops" ON crops;
    DROP POLICY IF EXISTS "Members can create crops" ON crops;
    DROP POLICY IF EXISTS "Members can update crops" ON crops;
    DROP POLICY IF EXISTS "Members can delete crops" ON crops;

    CREATE POLICY "Members can view crops"
      ON crops FOR SELECT
      USING (
        harvest_year_id IN (
          SELECT hy.id FROM harvest_years hy
          INNER JOIN farm_members fm ON hy.farm_id = fm.farm_id
          WHERE fm.user_id = auth.uid() AND fm.accepted_at IS NOT NULL
        )
      );

    CREATE POLICY "Members can create crops"
      ON crops FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM harvest_years hy
          INNER JOIN farm_members fm ON hy.farm_id = fm.farm_id
          WHERE hy.id = harvest_year_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'create')
        )
      );

    CREATE POLICY "Members can update crops"
      ON crops FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM harvest_years hy
          INNER JOIN farm_members fm ON hy.farm_id = fm.farm_id
          WHERE hy.id = harvest_year_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'update')
        )
      );

    CREATE POLICY "Members can delete crops"
      ON crops FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM harvest_years hy
          INNER JOIN farm_members fm ON hy.farm_id = fm.farm_id
          WHERE hy.id = harvest_year_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'delete')
        )
      );
    
    RAISE NOTICE 'Políticas RLS criadas para tabela crops';
  ELSE
    RAISE NOTICE 'Tabela crops não existe, pulando políticas RLS';
  END IF;
END $$;

-- field_crops: através de fields
-- Verificar se a tabela existe antes de aplicar políticas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'field_crops'
  ) THEN
    ALTER TABLE field_crops ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Members can view field crops" ON field_crops;
    DROP POLICY IF EXISTS "Members can create field crops" ON field_crops;
    DROP POLICY IF EXISTS "Members can update field crops" ON field_crops;
    DROP POLICY IF EXISTS "Members can delete field crops" ON field_crops;

    CREATE POLICY "Members can view field crops"
      ON field_crops FOR SELECT
      USING (
        field_id IN (
          SELECT f.id FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE fm.user_id = auth.uid() AND fm.accepted_at IS NOT NULL
        )
      );

    CREATE POLICY "Members can create field crops"
      ON field_crops FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE f.id = field_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'create')
        )
      );

    CREATE POLICY "Members can update field crops"
      ON field_crops FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE f.id = field_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'update')
        )
      );

    CREATE POLICY "Members can delete field crops"
      ON field_crops FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE f.id = field_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'delete')
        )
      );
    
    RAISE NOTICE 'Políticas RLS criadas para tabela field_crops';
  ELSE
    RAISE NOTICE 'Tabela field_crops não existe, pulando políticas RLS';
  END IF;
END $$;

-- applications: através de fields
-- Verificar se a tabela existe antes de aplicar políticas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'applications'
  ) THEN
    ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Members can view applications" ON applications;
    DROP POLICY IF EXISTS "Members can create applications" ON applications;
    DROP POLICY IF EXISTS "Members can update applications" ON applications;
    DROP POLICY IF EXISTS "Members can delete applications" ON applications;

    CREATE POLICY "Members can view applications"
      ON applications FOR SELECT
      USING (
        field_id IN (
          SELECT f.id FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE fm.user_id = auth.uid() AND fm.accepted_at IS NOT NULL
        )
      );

    CREATE POLICY "Members can create applications"
      ON applications FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE f.id = field_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'create')
        )
      );

    CREATE POLICY "Members can update applications"
      ON applications FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE f.id = field_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'update')
        )
      );

    CREATE POLICY "Members can delete applications"
      ON applications FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM fields f
          INNER JOIN farm_members fm ON f.farm_id = fm.farm_id
          WHERE f.id = field_id
            AND fm.user_id = auth.uid()
            AND fm.accepted_at IS NOT NULL
            AND has_farm_permission(fm.farm_id, auth.uid(), 'delete')
        )
      );
    
    RAISE NOTICE 'Políticas RLS criadas para tabela applications';
  ELSE
    RAISE NOTICE 'Tabela applications não existe, pulando políticas RLS';
  END IF;
END $$;
