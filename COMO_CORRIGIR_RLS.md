# 🔒 Como Corrigir Erros de RLS (Row Level Security)

**Problema:** 3 tabelas Supabase não têm RLS ativado:
- `public.file_deduplication_index`
- `public.plans`
- `public.app_config`

**Solução:** Executar o script SQL `SUPABASE_RLS_FIX.sql` no seu Supabase.

---

## 📋 Passo a Passo

### 1️⃣ Abra o SQL Editor do Supabase
- Acesse: https://app.supabase.com/project/lwsskdbpyrqcxcnrmdkw
- Clique em **SQL Editor** (menu esquerdo)
- Clique em **New Query**

### 2️⃣ Copie o SQL
Abra o arquivo `SUPABASE_RLS_FIX.sql` neste projeto e copie todo o conteúdo.

### 3️⃣ Cole no Supabase
Cole o código SQL na janela de query do Supabase.

### 4️⃣ Execute
Clique em **Run** ou pressione **Ctrl+Enter**.

Você deve ver a mensagem: **✓ Success. No rows returned.**

### 5️⃣ Valide
No final, o script executa uma validação que retorna:

```
tablename                    | rowsecurity
-----------------------------|------------
file_deduplication_index     | true
plans                        | true
app_config                   | true
```

Se ver `true` em todas as 3, **está tudo certo!** ✅

---

## 📝 O que o Script Faz

### `file_deduplication_index` (Deduplicação de Arquivos)
```sql
-- Ativa RLS
-- Policy 1: Usuários autenticados podem ler
-- Policy 2: Service role (backend) pode gerenciar
```

### `plans` (Planos de Preço)
```sql
-- Ativa RLS
-- Policy 1: Qualquer um pode ler (público)
-- Policy 2: Apenas admin pode criar/editar/deletar
```

### `app_config` (Configuração da Aplicação)
```sql
-- Ativa RLS
-- Policy 1: Qualquer um pode ler (público)
-- Policy 2: Apenas admin pode criar/editar/deletar
```

---

## ✅ Depois de Executar

O erro no Dashboard do Supabase deve desaparecer em alguns segundos.

Para verificar:
1. Vá para **Database** → **Linter** no Dashboard
2. Deve mostrar 0 erros de segurança

---

## 🔍 Se Algo Não Funcionar

### Erro: "Policy já existe"
**Solução:** Primeiro delete as policies antigas:
```sql
DROP POLICY IF EXISTS "file_dedup_read_authenticated" ON public.file_deduplication_index;
DROP POLICY IF EXISTS "file_dedup_manage_service_role" ON public.file_deduplication_index;
-- ... e as outras

-- Depois execute o script novamente
```

### Erro: "Função is_admin() não existe"
**Solução:** A função já existe no seu banco (foi criada no script original). Se não existir, crie:

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) > 0
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📞 Próximos Passos

1. ✅ Execute o script SQL no Supabase
2. ✅ Valide que RLS está ativado
3. ✅ Teste seu aplicativo localmente
4. ✅ Deploy em produção

---

**Pronto! Seu banco de dados estará 100% seguro com RLS ativado em todas as tabelas.** 🔐
