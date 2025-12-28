-- TABELA DE FAZENDAS
CREATE TABLE farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE ANOS SAFRA (Ex: 2025/2026)
CREATE TABLE harvest_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE CICLOS DA SAFRA (NOVA! - Ex: Verão, Safrinha)
CREATE TABLE harvest_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  harvest_year_id UUID REFERENCES harvest_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE TALHÕES
CREATE TABLE fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area NUMERIC(10,2), -- Atenção: O código as vezes chama de area_hectares
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE SUB-TALHÕES
CREATE TABLE sub_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_hectares NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE CULTURAS
CREATE TABLE cultures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE VÍNCULO (PLANEJAMENTO ATUALIZADO)
CREATE TABLE field_crops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  harvest_cycle_id UUID REFERENCES harvest_cycles(id) NOT NULL, -- Ligação nova
  culture_id UUID REFERENCES cultures(id) NOT NULL,
  
  -- Um talhão só pode ter 1 cultura por Ciclo
  UNIQUE(field_id, harvest_cycle_id)
);

-- TABELA DE APLICAÇÕES
CREATE TABLE applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID REFERENCES fields(id),
  sub_field_id UUID REFERENCES sub_fields(id),
  field_crop_id UUID REFERENCES field_crops(id),
  date DATE NOT NULL,
  status TEXT DEFAULT 'PLANNED', -- PLANNED, DONE, CANCELLED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);