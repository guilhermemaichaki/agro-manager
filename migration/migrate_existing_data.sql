-- ============================================
-- SCRIPT DE MIGRAÇÃO DE DADOS EXISTENTES
-- ============================================
-- Este script associa todas as fazendas existentes a um usuário proprietário
-- 
-- INSTRUÇÕES:
-- 1. Substitua 'SEU_EMAIL@exemplo.com' pelo email do usuário proprietário
-- 2. O usuário deve já existir no auth.users (criar primeiro via Supabase Auth ou interface)
-- 3. Execute este script após criar o usuário e executar create_auth_tables.sql

-- ============================================
-- CONFIGURAÇÃO - ALTERE AQUI
-- ============================================
-- Substitua pelo email do usuário proprietário
DO $$
DECLARE
  v_owner_email TEXT := 'guilhermemaichaki@gmail.com'; -- ALTERE AQUI
  v_owner_id UUID;
  v_farm_id UUID;
BEGIN
  -- Buscar ID do usuário pelo email
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE email = v_owner_email;
  
  -- Verificar se usuário existe
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado. Crie o usuário primeiro via Supabase Auth.', v_owner_email;
  END IF;
  
  -- Garantir que o perfil existe
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (v_owner_id, v_owner_email, '')
  ON CONFLICT (id) DO NOTHING;
  
  -- Atualizar todas as fazendas existentes para ter o owner_id
  UPDATE farms
  SET owner_id = v_owner_id
  WHERE owner_id IS NULL;
  
  -- Criar registro de membro para cada fazenda
  FOR v_farm_id IN SELECT id FROM farms WHERE owner_id = v_owner_id
  LOOP
    -- Inserir membro como owner se não existir
    INSERT INTO farm_members (farm_id, user_id, role, accepted_at)
    VALUES (v_farm_id, v_owner_id, 'owner', now())
    ON CONFLICT (farm_id, user_id) DO UPDATE
    SET role = 'owner',
        accepted_at = COALESCE(farm_members.accepted_at, now());
  END LOOP;
  
  RAISE NOTICE 'Migração concluída! % fazendas associadas ao usuário %.', 
    (SELECT COUNT(*) FROM farms WHERE owner_id = v_owner_id),
    v_owner_email;
END $$;
