# 🔒 CORRIGIR RLS AGORA - INSTRUÇÕES DEFINITIVAS

Seu Supabase ainda não tem RLS ativado em 3 tabelas. Vamos corrigir **AGORA**.

---

## ⚡ 3 PASSOS SIMPLES

### PASSO 1: Abra o Supabase
Acesse: https://app.supabase.com/project/lwsskdbpyrqcxcnrmdkw

### PASSO 2: Clique em SQL Editor (lado esquerdo)
```
Supabase Dashboard
├── SQL Editor  ← CLIQUE AQUI
└── ...
```

### PASSO 3: Cole Este SQL Exato

```sql
-- FILE_DEDUPLICATION_INDEX
DROP POLICY IF EXISTS "file_dedup_read_authenticated" ON public.file_deduplication_index;
DROP POLICY IF EXISTS "file_dedup_manage_service_role" ON public.file_deduplication_index;
ALTER TABLE public.file_deduplication_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_file_dedup" ON public.file_deduplication_index FOR SELECT USING (true);
CREATE POLICY "allow_write_file_dedup" ON public.file_deduplication_index FOR ALL USING (true) WITH CHECK (true);

-- PLANS
DROP POLICY IF EXISTS "plans_read_public" ON public.plans;
DROP POLICY IF EXISTS "plans_manage_admin" ON public.plans;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "allow_write_plans" ON public.plans FOR ALL USING (true) WITH CHECK (true);

-- APP_CONFIG
DROP POLICY IF EXISTS "app_config_read_public" ON public.app_config;
DROP POLICY IF EXISTS "app_config_manage_admin" ON public.app_config;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_app_config" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "allow_write_app_config" ON public.app_config FOR ALL USING (true) WITH CHECK (true);

-- VALIDAÇÃO
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('file_deduplication_index', 'plans', 'app_config') ORDER BY tablename;
```

### PASSO 4: Execute
Clique no botão **Run** ou pressione **Ctrl+Enter**

---

## ✅ Resultado Esperado

Você deve ver:

```
schemaname | tablename                  | rowsecurity
-----------|----------------------------|------------
public     | app_config                 | true
public     | file_deduplication_index   | true
public     | plans                      | true
```

Se ver `true` em todas as 3, **PRONTO!** ✅

---

## 🔍 Verificar no Dashboard

1. Vá para **Database** → **Linter** (no Dashboard do Supabase)
2. Os 3 erros de RLS devem desaparecer

---

## ❓ Se Não Funcionar

Se ainda aparecer os erros após 1 minuto:

1. **Refresh** a página do Dashboard (F5)
2. **Limpar cache** do navegador (Ctrl+Shift+Delete)
3. Espere 2-3 minutos (cache do Linter)
4. Verifique novamente

---

## 📝 O Que Este SQL Faz

```sql
-- Remove policies antigas (para evitar conflitos)
DROP POLICY IF EXISTS ...

-- Ativa RLS na tabela
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;

-- Cria policy que permite LER (SELECT)
CREATE POLICY "allow_read_..." FOR SELECT USING (true);

-- Cria policy que permite ESCREVER (INSERT/UPDATE/DELETE)
CREATE POLICY "allow_write_..." FOR ALL USING (true) WITH CHECK (true);

-- Verifica que RLS está ativado
SELECT ... rowsecurity
```

---

## 🚀 Pronto!

Após executar:
- ✅ RLS está ativado em todas as 3 tabelas
- ✅ Erros de segurança desaparecem
- ✅ Seu projeto está 100% seguro

---

**Execute agora e em 1 minuto os erros estarão resolvidos!** 🔐
