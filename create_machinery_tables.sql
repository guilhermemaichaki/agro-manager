-- Criar tabela de maquinários
CREATE TABLE IF NOT EXISTS machineries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('pulverizador', 'drone', 'aviao')),
  tank_capacity_liters NUMERIC(10, 2) NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de receitas práticas
CREATE TABLE IF NOT EXISTS practical_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  machinery_id UUID REFERENCES machineries(id) ON DELETE SET NULL,
  capacity_used_percent NUMERIC(5, 2) NOT NULL, -- Percentual da capacidade usada
  application_rate_liters_per_hectare NUMERIC(10, 2) NOT NULL, -- Taxa de aplicação (L/ha)
  liters_of_solution NUMERIC(10, 2), -- Litros de calda definidos
  area_hectares NUMERIC(10, 2), -- Área em hectares calculada
  multiplier INTEGER DEFAULT 1, -- Quantas vezes aplicar essa receita
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de produtos da receita prática
CREATE TABLE IF NOT EXISTS practical_recipe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practical_recipe_id UUID REFERENCES practical_recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  dosage NUMERIC(10, 2) NOT NULL, -- Dosagem original do produto
  quantity_in_recipe NUMERIC(10, 2) NOT NULL, -- Quantidade na receita
  remaining_quantity NUMERIC(10, 2) NOT NULL, -- Quantidade restante após essa receita
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_machineries_user_id ON machineries(user_id);
CREATE INDEX IF NOT EXISTS idx_practical_recipes_application_id ON practical_recipes(application_id);
CREATE INDEX IF NOT EXISTS idx_practical_recipes_machinery_id ON practical_recipes(machinery_id);
CREATE INDEX IF NOT EXISTS idx_practical_recipe_products_recipe_id ON practical_recipe_products(practical_recipe_id);
CREATE INDEX IF NOT EXISTS idx_practical_recipe_products_product_id ON practical_recipe_products(product_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE machineries ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_recipe_products ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para machineries
CREATE POLICY "Users can view their own machineries"
  ON machineries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own machineries"
  ON machineries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own machineries"
  ON machineries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own machineries"
  ON machineries FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para practical_recipes
-- Usar apenas created_by para verificar o dono, já que applications não tem user_id
CREATE POLICY "Users can view their own practical recipes"
  ON practical_recipes FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own practical recipes"
  ON practical_recipes FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own practical recipes"
  ON practical_recipes FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own practical recipes"
  ON practical_recipes FOR DELETE
  USING (auth.uid() = created_by);

-- Políticas RLS para practical_recipe_products
-- Verificar através do created_by da receita prática
CREATE POLICY "Users can view practical recipe products"
  ON practical_recipe_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND practical_recipes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert practical recipe products"
  ON practical_recipe_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND practical_recipes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update practical recipe products"
  ON practical_recipe_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND practical_recipes.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete practical recipe products"
  ON practical_recipe_products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM practical_recipes
      WHERE practical_recipes.id = practical_recipe_products.practical_recipe_id
      AND practical_recipes.created_by = auth.uid()
    )
  );

-- Comentários para documentação
COMMENT ON TABLE machineries IS 'Tabela de maquinários cadastrados pelos usuários';
COMMENT ON TABLE practical_recipes IS 'Tabela de receitas práticas geradas para aplicações';
COMMENT ON TABLE practical_recipe_products IS 'Tabela de produtos incluídos em cada receita prática';
