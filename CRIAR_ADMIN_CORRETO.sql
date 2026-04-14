/**
 * CORRIGIDO FINALMENTE - Criar Usuário Admin
 *
 * Email: paulosilvatomazeto@gmail.com
 * Role: admin
 * Plano: premium
 * Créditos: ilimitados (999999)
 */

-- Após fazer LOGIN com Google, execute ESTE SQL:

UPDATE public.users
SET
  role = 'admin',
  plan = 'premium',
  credits = 999999,
  monthly_limit = 999999,
  subscription_status = 'active',
  updated_at = NOW()
WHERE email = 'paulosilvatomazeto@gmail.com';

-- Verificar resultado:
SELECT
  id,
  email,
  role,
  plan,
  credits,
  monthly_limit,
  subscription_status
FROM public.users
WHERE email = 'paulosilvatomazeto@gmail.com';
