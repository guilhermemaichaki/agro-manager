# Instruções de Setup - Sistema de Autenticação

Este documento descreve os passos necessários para configurar o sistema de autenticação e hierarquia de usuários.

## Passo 1: Executar Scripts SQL

Execute os scripts SQL na seguinte ordem no Supabase SQL Editor:

1. **schema.sql** - Cria as tabelas base do sistema (se ainda não executado):
   - `farms`, `harvest_years`, `fields`, `cultures`, `crops`, `field_crops`

2. **create_products_tables.sql** - Cria as tabelas de produtos e estoque:
   - `products` - Defensivos agrícolas
   - `suppliers` - Fornecedores
   - `stock_entries` - Entradas de estoque (compras)
   - `stock_movements` - Movimentações de estoque (histórico)

3. **create_categories_tables.sql** (opcional) - Cria tabelas de categorias:
   - `categories` - Categorias de produtos
   - `product_categories` - Relação muitos-para-muitos entre produtos e categorias

4. **create_applications_table.sql** - Cria a tabela de aplicações:
   - `applications` - Registros de aplicação de defensivos
   - `application_products` - Produtos utilizados em cada aplicação
   - **Nota:** Requer que a tabela `products` exista (execute create_products_tables.sql primeiro)

5. **create_machinery_tables.sql** (opcional) - Cria tabelas de maquinários:
   - `machineries` - Maquinários (pulverizadores, drones, aviões)
   - `practical_recipes` - Receitas práticas
   - `practical_recipe_products` - Produtos das receitas práticas

6. **create_auth_tables.sql** - Cria as tabelas de autenticação:
   - `user_profiles`
   - `farm_members`
   - `farm_invitations`
   - Adiciona `owner_id` à tabela `farms`

7. **setup_rls_policies.sql** - Configura as políticas RLS (Row Level Security):
   - Protege todas as tabelas baseadas em permissões de fazenda
   - Garante que usuários só vejam/editem dados de fazendas onde têm acesso
   - **Nota:** Este script verifica se as tabelas existem antes de aplicar políticas, então é seguro executar mesmo se algumas tabelas ainda não foram criadas

## Passo 2: Migrar Dados Existentes

**IMPORTANTE:** Antes de executar este script, você precisa:

1. Criar sua conta de usuário no Supabase Auth (via Dashboard ou interface de login)
2. Editar o arquivo `migration/migrate_existing_data.sql` e substituir `'SEU_EMAIL@exemplo.com'` pelo seu email real
3. Executar o script no Supabase SQL Editor

Este script irá:
- Associar todas as fazendas existentes ao seu usuário
- Criar registros de membro com role 'owner' para cada fazenda
- Criar seu perfil de usuário

## Passo 3: Configurar URLs de Redirecionamento no Supabase

No Supabase Dashboard, vá em Authentication > URL Configuration e adicione:

- **Site URL**: `http://localhost:3000` (desenvolvimento) ou sua URL de produção
- **Redirect URLs**: 
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - Sua URL de produção + `/auth/callback`
  - Sua URL de produção + `/reset-password`

## Passo 4: Configurar Email (Opcional)

Para que os emails de recuperação de senha e convites funcionem, configure:

1. No Supabase Dashboard, vá em Authentication > Email Templates
2. Configure os templates de email conforme necessário
3. Para produção, configure SMTP customizado em Authentication > Settings > SMTP Settings

## Hierarquia de Permissões

### Owner (Proprietário)
- Controle total na fazenda
- Pode deletar a fazenda
- Pode gerenciar todos os usuários

### Admin (Administrador)
- Pode gerenciar usuários (exceto owner)
- Pode criar, editar e deletar tudo (exceto deletar fazenda)
- Não pode alterar owner de outros usuários

### Manager (Gerente)
- Pode criar, editar e visualizar
- Não pode deletar
- Não pode gerenciar usuários

### Operator (Operador)
- Pode criar aplicações e movimentações
- Pode visualizar dados
- Não pode editar ou deletar

### Viewer (Visualizador)
- Apenas visualização
- Não pode criar, editar ou deletar

## Funcionalidades Implementadas

### Telas de Autenticação
- ✅ `/login` - Tela de login
- ✅ `/forgot-password` - Solicitar reset de senha
- ✅ `/reset-password` - Redefinir senha
- ✅ `/auth/callback` - Callback do Supabase

### Gerenciamento de Usuários
- ✅ `/fazendas/[id]/usuarios` - Gerenciar usuários da fazenda
  - Listar membros
  - Convidar novos usuários por email
  - Editar permissões
  - Remover membros (exceto owner)
  - Ver convites pendentes

### Proteção de Rotas
- ✅ Todas as rotas protegidas exceto login, forgot-password, reset-password
- ✅ Redirecionamento automático para login se não autenticado
- ✅ Verificação de permissões no banco via RLS

## Próximos Passos (Opcional)

1. **Envio de Emails de Convite**: Implementar função Edge ou servidor para enviar emails com links de convite
2. **Página de Aceitar Convite**: Criar página `/accept-invitation?token=...` para aceitar convites
3. **Notificações**: Adicionar notificações quando convites são aceitos/recusados
4. **Auditoria**: Adicionar logs de ações importantes

## Troubleshooting

### Erro: "Usuário não autenticado"
- Verifique se você fez login
- Verifique se as variáveis de ambiente do Supabase estão configuradas

### Erro: "Permissão negada" ao criar/editar
- Verifique se você tem as permissões necessárias na fazenda
- Verifique se as políticas RLS foram executadas corretamente

### Fazendas não aparecem no dropdown
- Verifique se você é membro da fazenda com `accepted_at` não nulo
- Verifique se o script de migração foi executado corretamente
