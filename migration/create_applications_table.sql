-- ============================================
-- CRIAR TABELA APPLICATIONS
-- ============================================
-- Esta tabela armazena os registros de aplicações de defensivos
-- Execute este script ANTES de setup_rls_policies.sql

CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE NOT NULL,
  harvest_year_id UUID REFERENCES harvest_years(id) ON DELETE CASCADE NOT NULL,
  application_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled', 'PLANNED', 'DONE', 'CANCELED')),
  rate NUMERIC(10, 2), -- Taxa em L/ha
  nozzle TEXT, -- Bico
  operator_name TEXT,
  machine TEXT,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_partial BOOLEAN NOT NULL DEFAULT FALSE,
  partial_area NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_applications_field_id ON applications(field_id);
CREATE INDEX IF NOT EXISTS idx_applications_harvest_year_id ON applications(harvest_year_id);
CREATE INDEX IF NOT EXISTS idx_applications_application_date ON applications(application_date);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Tabela de produtos da aplicação (muitos-para-muitos)
-- Verificar se a tabela products existe antes de criar a FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'products'
  ) THEN
    CREATE TABLE IF NOT EXISTS application_products (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      application_id UUID REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
      dosage NUMERIC(10, 2) NOT NULL, -- Dosagem em L/ha ou kg/ha
      quantity_used NUMERIC(10, 2) NOT NULL, -- Quantidade utilizada (calculada: dosage * field.area)
      dosage_unit TEXT DEFAULT 'L/ha',
      cost NUMERIC(10, 2), -- Custo do produto nesta aplicação
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Criar índices para application_products
    CREATE INDEX IF NOT EXISTS idx_application_products_application_id ON application_products(application_id);
    CREATE INDEX IF NOT EXISTS idx_application_products_product_id ON application_products(product_id);
    
    RAISE NOTICE 'Tabela application_products criada com sucesso';
  ELSE
    RAISE NOTICE 'Tabela products não existe. Execute create_products_tables.sql primeiro. Pulando criação de application_products.';
  END IF;
END $$;

-- Índices para application_products (já criados no bloco DO acima, se products existir)

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_applications_updated_at_trigger ON applications;
CREATE TRIGGER update_applications_updated_at_trigger
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_applications_updated_at();
