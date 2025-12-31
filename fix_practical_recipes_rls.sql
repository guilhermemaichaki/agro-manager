-- Ajustar políticas RLS para practical_recipes e practical_recipe_products
-- Permitir operações sem autenticação (similar a outras tabelas do sistema)

-- Remover políticas antigas de practical_recipes
DROP POLICY IF EXISTS "Users can view their own practical recipes" ON practical_recipes;
DROP POLICY IF EXISTS "Users can insert their own practical recipes" ON practical_recipes;
DROP POLICY IF EXISTS "Users can update their own practical recipes" ON practical_recipes;
DROP POLICY IF EXISTS "Users can delete their own practical recipes" ON practical_recipes;

-- Criar novas políticas que permitem operações sem autenticação
-- Política para SELECT: permite ver todas as receitas práticas (ou apenas as do usuário se autenticado)
CREATE POLICY "Allow select practical recipes"
  ON practical_recipes FOR SELECT
  USING (
    auth.uid() IS NULL OR auth.uid() = created_by
  );

-- Política para INSERT: permite inserir se não houver autenticação ou se created_by corresponder
CREATE POLICY "Allow insert practical recipes"
  ON practical_recipes FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR auth.uid() = created_by
  );

-- Política para UPDATE: permite atualizar se não houver autenticação ou se for o dono
CREATE POLICY "Allow update practical recipes"
  ON practical_recipes FOR UPDATE
  USING (
    auth.uid() IS NULL OR auth.uid() = created_by
  );

-- Política para DELETE: permite deletar se não houver autenticação ou se for o dono
CREATE POLICY "Allow delete practical recipes"
  ON practical_recipes FOR DELETE
  USING (
    auth.uid() IS NULL OR auth.uid() = created_by
  );

-- Remover políticas antigas de practical_recipe_products
DROP POLICY IF EXISTS "Users can view practical recipe products" ON practical_recipe_products;
DROP POLICY IF EXISTS "Users can insert practical recipe products" ON practical_recipe_products;
DROP POLICY IF EXISTS "Users can update practical recipe products" ON practical_recipe_products;
DROP POLICY IF EXISTS "Users can delete practical recipe products" ON practical_recipe_products;

-- Criar novas políticas para practical_recipe_products
-- Política para SELECT: permite ver produtos de receitas práticas
CREATE POLICY "Allow select practical recipe products"
  ON practical_recipe_products FOR SELECT
  USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND (auth.uid() IS NULL OR practical_recipes.created_by = auth.uid())
    )
  );

-- Política para INSERT: permite inserir produtos de receitas práticas
CREATE POLICY "Allow insert practical recipe products"
  ON practical_recipe_products FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND (auth.uid() IS NULL OR practical_recipes.created_by = auth.uid())
    )
  );

-- Política para UPDATE: permite atualizar produtos de receitas práticas
CREATE POLICY "Allow update practical recipe products"
  ON practical_recipe_products FOR UPDATE
  USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND (auth.uid() IS NULL OR practical_recipes.created_by = auth.uid())
    )
  );

-- Política para DELETE: permite deletar produtos de receitas práticas
CREATE POLICY "Allow delete practical recipe products"
  ON practical_recipe_products FOR DELETE
  USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND (auth.uid() IS NULL OR practical_recipes.created_by = auth.uid())
    )
  );
