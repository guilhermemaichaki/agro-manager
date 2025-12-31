# Configuração do Supabase Storage para Fotos de Maquinários

## Passo 1: Criar o Bucket

1. Acesse o Supabase Dashboard
2. Vá para "Storage" no menu lateral
3. Clique em "New bucket"
4. Nome do bucket: `machinery-photos`
5. Marque como **público** (para permitir acesso às imagens)
6. Clique em "Create bucket"

## Passo 2: Configurar Políticas RLS (Row Level Security)

Após criar o bucket, configure as políticas de segurança:

1. Vá para "Storage" > "Policies" > `machinery-photos`
2. Adicione as seguintes políticas:

### Política de SELECT (Visualizar)
```sql
CREATE POLICY "Users can view their own machinery photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'machinery-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política de INSERT (Upload)
```sql
CREATE POLICY "Users can upload their own machinery photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'machinery-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política de UPDATE (Atualizar)
```sql
CREATE POLICY "Users can update their own machinery photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'machinery-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política de DELETE (Excluir)
```sql
CREATE POLICY "Users can delete their own machinery photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'machinery-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Nota

As políticas acima garantem que cada usuário só pode acessar suas próprias fotos, que são organizadas em pastas por `user_id`.
