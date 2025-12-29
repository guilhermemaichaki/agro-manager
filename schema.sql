-- TABELAS BASE
CREATE TABLE farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE harvest_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- Ex: "2025/2026"
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE cultures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, 
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE DEFINIÇÃO DA SAFRA (O "Planejamento Macro")
CREATE TABLE crops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  harvest_year_id UUID REFERENCES harvest_years(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- Ex: "Soja Intacta"
  culture_id UUID REFERENCES cultures(id) NOT NULL,
  variety TEXT,
  cycle TEXT NOT NULL, -- "Verão", "Inverno", "Safrinha"
  estimated_start_date DATE, -- Janela Ideal Início
  estimated_end_date DATE,   -- Janela Ideal Fim
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TABELA DE VÍNCULO (O "Chão de Fábrica")
CREATE TABLE field_crops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE NOT NULL,
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE NOT NULL,
  
  status TEXT DEFAULT 'PLANNED', -- 'PLANNED' (Aguardando) ou 'PLANTED' (Confirmado)
  
  date_planted DATE, -- A Data Real do Plantio (Só preenche quando status = PLANTED)
  date_harvest_prediction DATE, -- Previsão de colheita ajustada
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(field_id, crop_id)
);