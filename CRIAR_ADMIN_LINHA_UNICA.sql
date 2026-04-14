-- SOLUÇÃO FINAL - SQL em linha única (sem quebras que causam erro)

UPDATE public.users SET role = 'admin', plan = 'premium', credits = 999999, monthly_limit = 999999, subscription_status = 'active', updated_at = NOW() WHERE email = 'paulosilvatomazeto@gmail.com';
