-- ============================================
-- CRIAR TABELAS DE PRODUTOS
-- ============================================
-- Este script cria as tabelas relacionadas a produtos
-- Execute este script ANTES de create_applications_table.sql

-- Tabela de produtos (defensivos agrícolas)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL, -- Empresa fabricante
  active_principle TEXT, -- Princípio ativo
  unit TEXT NOT NULL, -- Unidade (ex: "L", "kg")
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company);

-- Tabela de fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para fornecedores
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_cnpj ON suppliers(cnpj);

-- Tabela de entradas de estoque (compras)
CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL, -- Preço unitário
  total_price NUMERIC(10, 2) NOT NULL, -- Preço total (quantity * unit_price)
  entry_date DATE NOT NULL,
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para stock_entries
CREATE INDEX IF NOT EXISTS idx_stock_entries_product_id ON stock_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_supplier_id ON stock_entries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_entry_date ON stock_entries(entry_date);

-- Tabela de movimentações de estoque (histórico)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'IN', 'OUT')),
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2), -- Preço unitário (para entradas)
  reference_id UUID, -- ID da entrada ou aplicação relacionada
  reference_type TEXT CHECK (reference_type IN ('entry', 'application')), -- Tipo de referência
  movement_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_type ON stock_movements(reference_type);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_products_updated_at_trigger ON products;
CREATE TRIGGER update_products_updated_at_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

DROP TRIGGER IF EXISTS update_suppliers_updated_at_trigger ON suppliers;
CREATE TRIGGER update_suppliers_updated_at_trigger
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

DROP TRIGGER IF EXISTS update_stock_entries_updated_at_trigger ON stock_entries;
CREATE TRIGGER update_stock_entries_updated_at_trigger
  BEFORE UPDATE ON stock_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();
