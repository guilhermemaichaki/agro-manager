# Criar Bucket machinery-photos no Supabase Storage

## Método 1: Via Dashboard (Recomendado)

1. Acesse o **Supabase Dashboard** (https://app.supabase.com)
2. Selecione seu projeto
3. No menu lateral, clique em **"Storage"**
4. Clique no botão **"New bucket"** (ou "Create bucket")
5. Preencha os campos:
   - **Name**: `machinery-photos` (exatamente este nome, sem espaços)
   - **Public bucket**: Marque esta opção como **SIM/ON** (importante para permitir acesso público às imagens)
6. Clique em **"Create bucket"**

## Método 2: Via SQL (Alternativo)

Se preferir criar via SQL, execute este script no **Supabase SQL Editor**:

```sql
-- Criar o bucket machinery-photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('machinery-photos', 'machinery-photos', true)
ON CONFLICT (id) DO NOTHING;
```

## Após criar o bucket

Execute o script `fix_machinery_storage_rls.sql` para configurar as políticas RLS que permitem uploads sem autenticação.
