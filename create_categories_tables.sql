-- Criar tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'predefined', -- 'predefined' ou 'custom'
  group_name TEXT NOT NULL, -- 'defensivos', 'adjuvantes', ou 'custom'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de relacionamento many-to-many
CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (product_id, category_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_group_name ON categories(group_name);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- Inserir categorias pré-definidas - Defensivos Agrícolas
INSERT INTO categories (name, type, group_name) VALUES
  ('Herbicidas', 'predefined', 'defensivos'),
  ('Inseticidas', 'predefined', 'defensivos'),
  ('Fungicidas', 'predefined', 'defensivos'),
  ('Acaricidas', 'predefined', 'defensivos'),
  ('Nematicidas', 'predefined', 'defensivos'),
  ('Bactericidas', 'predefined', 'defensivos'),
  ('Biológicos', 'predefined', 'defensivos'),
  ('Reguladores de Crescimento', 'predefined', 'defensivos'),
  ('Formicidas', 'predefined', 'defensivos'),
  ('Moluscicidas', 'predefined', 'defensivos')
ON CONFLICT (name) DO NOTHING;

-- Inserir categorias pré-definidas - Adjuvantes e Afins
INSERT INTO categories (name, type, group_name) VALUES
  ('Óleo Mineral', 'predefined', 'adjuvantes'),
  ('Óleo Vegetal', 'predefined', 'adjuvantes'),
  ('Antideriva', 'predefined', 'adjuvantes'),
  ('Espalhante', 'predefined', 'adjuvantes'),
  ('Adesivo (Fixador)', 'predefined', 'adjuvantes'),
  ('Umectante', 'predefined', 'adjuvantes'),
  ('Redutor de pH (Acidificante)', 'predefined', 'adjuvantes'),
  ('Antiespumante', 'predefined', 'adjuvantes'),
  ('Sequestrante de Cátions', 'predefined', 'adjuvantes'),
  ('Fertilizante Foliar', 'predefined', 'adjuvantes'),
  ('Limpa Tanque', 'predefined', 'adjuvantes'),
  ('Corante Marcador', 'predefined', 'adjuvantes')
ON CONFLICT (name) DO NOTHING;
