/**
 * Criar Usuário Admin - Paulo Silva Tomázeto
 *
 * Email: paulosilvatomazeto@gmail.com
 * Role: admin
 * Plano: premium
 * Créditos: ilimitados
 *
 * Este script cria o registro do usuário na tabela public.users
 * Depois você faz login com Google que tudo sincroniza automaticamente
 */

-- ============================================================
-- OPÇÃO 1: Inserir usuário (quando você fizer login com Google depois)
-- ============================================================

-- Este INSERT será executado APÓS você fazer login com Google
-- Quando fizer login, o Supabase criará um auth.users automaticamente
-- Depois execute este script para adicionar os dados em public.users

INSERT INTO public.users (
  id,
  email,
  display_name,
  photo_url,
  role,
  plan,
  credits_available,
  credits_used_this_month,
  monthly_limit,
  subscription_status,
  created_at,
  updated_at
) VALUES (
  auth.uid(), -- Pega o ID do usuário autenticado (Google)
  'paulosilvatomazeto@gmail.com',
  'Paulo Silva Tomázeto',
  NULL, -- Será preenchido com foto do Google
  'admin',
  'premium',
  999999, -- Créditos "ilimitados" (999.999)
  0,
  999999,
  'active',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  plan = 'premium',
  credits_available = 999999,
  monthly_limit = 999999,
  subscription_status = 'active',
  updated_at = now();

-- ============================================================
-- OPÇÃO 2 (ALTERNATIVA): Se souber o UUID do Google Auth
-- ============================================================

-- Se você já conhece o UUID do seu auth.users do Google, use:
-- (Substitua 'SEU-UUID-AQUI' pelo UUID real)

-- INSERT INTO public.users (
--   id,
--   email,
--   display_name,
--   role,
--   plan,
--   credits_available,
--   credits_used_this_month,
--   monthly_limit,
--   subscription_status,
--   created_at,
--   updated_at
-- ) VALUES (
--   'SEU-UUID-AQUI',
--   'paulosilvatomazeto@gmail.com',
--   'Paulo Silva Tomázeto',
--   'admin',
--   'premium',
--   999999,
--   0,
--   999999,
--   'active',
--   now(),
--   now()
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   role = 'admin',
--   plan = 'premium',
--   credits_available = 999999,
--   monthly_limit = 999999,
--   subscription_status = 'active';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Depois de executar, rode este SELECT para verificar:
SELECT
  id,
  email,
  role,
  plan,
  credits_available,
  monthly_limit,
  subscription_status,
  created_at
FROM public.users
WHERE email = 'paulosilvatomazeto@gmail.com';

-- Deve retornar 1 linha com seus dados:
-- - role: admin
-- - plan: premium
-- - credits_available: 999999
