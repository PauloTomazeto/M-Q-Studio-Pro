/**
 * CORRIGIDO - Criar Usuário Admin
 *
 * Email: paulosilvatomazeto@gmail.com
 * Role: admin
 * Plano: premium
 * Créditos: ilimitados
 */

-- Execute este SQL exato no Supabase SQL Editor
UPDATE public.users
SET
  "role" = 'admin',
  "plan" = 'premium',
  credits_available = 999999,
  monthly_limit = 999999,
  subscription_status = 'active',
  updated_at = now()
WHERE email = 'paulosilvatomazeto@gmail.com';
