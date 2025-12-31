-- Ajustar políticas RLS para machineries
-- Permitir inserções sem autenticação (similar a outras tabelas do sistema)

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view their own machineries" ON machineries;
DROP POLICY IF EXISTS "Users can insert their own machineries" ON machineries;
DROP POLICY IF EXISTS "Users can update their own machineries" ON machineries;
DROP POLICY IF EXISTS "Users can delete their own machineries" ON machineries;

-- Criar novas políticas que permitem operações sem autenticação
-- Se houver user_id, verifica se é o dono. Se não houver user_id, permite.

-- Política para SELECT: permite ver todos os maquinários (ou apenas os do usuário se autenticado)
CREATE POLICY "Allow select machineries"
  ON machineries FOR SELECT
  USING (
    auth.uid() IS NULL OR auth.uid() = user_id
  );

-- Política para INSERT: permite inserir se não houver autenticação ou se user_id corresponder
CREATE POLICY "Allow insert machineries"
  ON machineries FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR auth.uid() = user_id
  );

-- Política para UPDATE: permite atualizar se não houver autenticação ou se for o dono
CREATE POLICY "Allow update machineries"
  ON machineries FOR UPDATE
  USING (
    auth.uid() IS NULL OR auth.uid() = user_id
  );

-- Política para DELETE: permite deletar se não houver autenticação ou se for o dono
CREATE POLICY "Allow delete machineries"
  ON machineries FOR DELETE
  USING (
    auth.uid() IS NULL OR auth.uid() = user_id
  );
