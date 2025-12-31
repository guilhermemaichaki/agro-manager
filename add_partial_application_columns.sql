-- Adicionar colunas para aplicação parcial na tabela applications
-- Este script adiciona as colunas is_partial e partial_area que foram
-- implementadas no código mas ainda não existem no banco de dados

-- Adicionar a coluna 'is_partial' como BOOLEAN, não nula, com valor padrão FALSE
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS is_partial BOOLEAN NOT NULL DEFAULT FALSE;

-- Adicionar a coluna 'partial_area' como NUMERIC(10, 2), permitindo nulos
-- Esta coluna armazena a área em hectares quando a aplicação é parcial
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS partial_area NUMERIC(10, 2);

-- Comentários para documentação
COMMENT ON COLUMN applications.is_partial IS 'Indica se a aplicação é parcial (true) ou na área total do talhão (false)';
COMMENT ON COLUMN applications.partial_area IS 'Área em hectares a ser aplicada quando is_partial = true. NULL quando is_partial = false';
