/**
 * Fix RLS Issues - Tabelas sem Row Level Security
 *
 * Este script ativa RLS nas 3 tabelas que apresentam erro de segurança:
 * - file_deduplication_index
 * - plans
 * - app_config
 */

-- ============================================================
-- 1. FILE_DEDUPLICATION_INDEX - RLS Enable
-- ============================================================

-- Ativar RLS
ALTER TABLE public.file_deduplication_index ENABLE ROW LEVEL SECURITY;

-- Policy 1: Usuários autenticados podem ler
CREATE POLICY "file_dedup_read_authenticated"
ON public.file_deduplication_index FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Service role pode gerenciar
CREATE POLICY "file_dedup_manage_service_role"
ON public.file_deduplication_index FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 2. PLANS - RLS Enable
-- ============================================================

-- Ativar RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Policy 1: Qualquer um pode ler (público)
CREATE POLICY "plans_read_public"
ON public.plans FOR SELECT
USING (true);

-- Policy 2: Apenas admin pode modificar
CREATE POLICY "plans_manage_admin"
ON public.plans FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "plans_update_admin"
ON public.plans FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "plans_delete_admin"
ON public.plans FOR DELETE
USING (is_admin());

-- ============================================================
-- 3. APP_CONFIG - RLS Enable
-- ============================================================

-- Ativar RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Policy 1: Qualquer um pode ler (configurações públicas)
CREATE POLICY "app_config_read_public"
ON public.app_config FOR SELECT
USING (true);

-- Policy 2: Apenas admin pode modificar
CREATE POLICY "app_config_manage_admin"
ON public.app_config FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "app_config_update_admin"
ON public.app_config FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "app_config_delete_admin"
ON public.app_config FOR DELETE
USING (is_admin());

-- ============================================================
-- VALIDAÇÃO
-- ============================================================

-- Verificar que RLS está ativado em todas as tabelas
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('file_deduplication_index', 'plans', 'app_config')
ORDER BY tablename;

-- Output esperado: rowsecurity = true para todas as 3 tabelas
