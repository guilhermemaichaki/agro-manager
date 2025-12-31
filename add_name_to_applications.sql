-- Adicionar coluna name na tabela applications
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Aplicação sem nome';

-- Atualizar registros existentes para ter um nome padrão baseado na data
UPDATE applications
SET name = 'Aplicação ' || TO_CHAR(application_date, 'DD/MM/YYYY')
WHERE name = 'Aplicação sem nome';

-- Remover o DEFAULT após popular os dados existentes (opcional, mas recomendado)
-- ALTER TABLE applications ALTER COLUMN name DROP DEFAULT;
