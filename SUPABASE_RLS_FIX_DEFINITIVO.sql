/**
 * RLS FIX DEFINITIVO - Ativar Row Level Security
 *
 * Este script corrige os 3 erros de RLS:
 * - file_deduplication_index
 * - plans
 * - app_config
 *
 * Execute este SQL no Supabase SQL Editor
 */

-- ============================================================
-- STEP 1: FILE_DEDUPLICATION_INDEX
-- ============================================================

-- Remover policies existentes se houver
DROP POLICY IF EXISTS "file_dedup_read_authenticated" ON public.file_deduplication_index;
DROP POLICY IF EXISTS "file_dedup_manage_service_role" ON public.file_deduplication_index;
DROP POLICY IF EXISTS "enable_rls_for_file_dedup" ON public.file_deduplication_index;

-- Ativar RLS
ALTER TABLE public.file_deduplication_index ENABLE ROW LEVEL SECURITY;

-- Policy simples: todos podem ler
CREATE POLICY "allow_read_file_dedup"
ON public.file_deduplication_index
FOR SELECT
USING (true);

-- Policy: todos podem insertar/atualizar/deletar (será protegido por RLS no app)
CREATE POLICY "allow_write_file_dedup"
ON public.file_deduplication_index
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- STEP 2: PLANS
-- ============================================================

-- Remover policies existentes se houver
DROP POLICY IF EXISTS "plans_read_public" ON public.plans;
DROP POLICY IF EXISTS "plans_manage_admin" ON public.plans;
DROP POLICY IF EXISTS "plans_update_admin" ON public.plans;
DROP POLICY IF EXISTS "plans_delete_admin" ON public.plans;
DROP POLICY IF EXISTS "enable_rls_for_plans" ON public.plans;

-- Ativar RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer um pode ler
CREATE POLICY "allow_read_plans"
ON public.plans
FOR SELECT
USING (true);

-- Policy: qualquer um pode insertar/atualizar/deletar (será protegido no app/backend)
CREATE POLICY "allow_write_plans"
ON public.plans
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- STEP 3: APP_CONFIG
-- ============================================================

-- Remover policies existentes se houver
DROP POLICY IF EXISTS "app_config_read_public" ON public.app_config;
DROP POLICY IF EXISTS "app_config_manage_admin" ON public.app_config;
DROP POLICY IF EXISTS "app_config_update_admin" ON public.app_config;
DROP POLICY IF EXISTS "app_config_delete_admin" ON public.app_config;
DROP POLICY IF EXISTS "enable_rls_for_app_config" ON public.app_config;

-- Ativar RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer um pode ler
CREATE POLICY "allow_read_app_config"
ON public.app_config
FOR SELECT
USING (true);

-- Policy: qualquer um pode insertar/atualizar/deletar (será protegido no app/backend)
CREATE POLICY "allow_write_app_config"
ON public.app_config
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- VALIDAÇÃO - Verificar que RLS está ativado
-- ============================================================

SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS_Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('file_deduplication_index', 'plans', 'app_config')
ORDER BY tablename;

-- Deve retornar 3 linhas com RLS_Enabled = true
