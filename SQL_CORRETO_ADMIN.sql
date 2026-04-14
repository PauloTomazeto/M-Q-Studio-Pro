-- ============================================================
-- SOLUÇÃO 1: Se você JÁ FEZ LOGIN com Google
-- (O usuário já existe na tabela)
-- ============================================================

UPDATE public.users
SET role = 'admin', plan = 'premium', credits = 999999, monthly_limit = 999999, subscription_status = 'active'
WHERE email = 'paulosilvatomazeto@gmail.com';


-- ============================================================
-- SOLUÇÃO 2: Se você AINDA NÃO FEZ LOGIN com Google
-- (Inserir novo usuário - mas precisa do auth_id)
-- ============================================================

-- Primeiro, você PRECISA fazer login com Google
-- Depois, copie seu auth_id da tabela auth.users

-- Para pegar seu auth_id:
SELECT id, email FROM auth.users WHERE email = 'paulosilvatomazeto@gmail.com';

-- Depois use este INSERT (substitua 'SEU-AUTH-ID-AQUI' pelo UUID obtido acima):
INSERT INTO public.users (auth_id, email, role, plan, credits, monthly_limit, subscription_status)
VALUES ('SEU-AUTH-ID-AQUI', 'paulosilvatomazeto@gmail.com', 'admin', 'premium', 999999, 999999, 'active');


-- ============================================================
-- VERIFICAÇÃO: Execute isto após qualquer uma das opções acima
-- ============================================================

SELECT id, email, role, plan, credits, monthly_limit, subscription_status
FROM public.users
WHERE email = 'paulosilvatomazeto@gmail.com';
