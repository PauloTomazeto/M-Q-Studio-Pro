# 👤 CRIAR SUA CONTA ADMIN NO SUPABASE

**Email:** paulosilvatomazeto@gmail.com  
**Role:** Admin  
**Plano:** Premium  
**Créditos:** Ilimitados (999.999)

---

## ⚡ 2 PASSOS

### PASSO 1: Fazer Login com Google no App

1. Abra seu app MQ STUDIO PRO (localhost ou produção)
2. Clique em **"Login com Google"**
3. Use o email: **paulosilvatomazeto@gmail.com**
4. Complete o login

Isso cria seu registro automaticamente no `auth.users` do Supabase.

### PASSO 2: Executar SQL para Promover para Admin

1. Abra o Supabase Dashboard:  
   https://app.supabase.com/project/lwsskdbpyrqcxcnrmdkw

2. Vá para **SQL Editor** → **New Query**

3. Cole este SQL:

```sql
-- Atualizar seu usuário para ADMIN com PREMIUM
UPDATE public.users
SET
  role = 'admin',
  plan = 'premium',
  credits_available = 999999,
  monthly_limit = 999999,
  subscription_status = 'active',
  updated_at = now()
WHERE email = 'paulosilvatomazeto@gmail.com';
```

4. Clique em **Run** (Ctrl+Enter)

5. Você deve ver: **✓ Success. 1 row affected.**

---

## ✅ Resultado

Depois de executar o SQL, você terá:

| Campo | Valor |
|-------|-------|
| **Email** | paulosilvatomazeto@gmail.com |
| **Role** | admin |
| **Plano** | premium |
| **Créditos** | 999999 (ilimitados) |
| **Status** | active |

---

## 🔍 Verificar se Funcionou

No Supabase Dashboard, vá para **Table Editor** e:

1. Abra a tabela `users`
2. Procure por seu email
3. Verifique:
   - ✅ role = 'admin'
   - ✅ plan = 'premium'
   - ✅ credits_available = 999999
   - ✅ subscription_status = 'active'

---

## 💡 Se Preferir (Alternativa)

Se quiser criar sem fazer login primeiro, você precisa do seu UUID do Google Auth.

Quando fizer login no seu app:
1. Abra o DevTools (F12)
2. Console
3. Cole: `await supabase.auth.getUser().then(u => console.log(u.data.user.id))`
4. Copie o UUID
5. Execute o SQL com o UUID:

```sql
INSERT INTO public.users (
  id,
  email,
  display_name,
  role,
  plan,
  credits_available,
  monthly_limit,
  subscription_status,
  created_at,
  updated_at
) VALUES (
  'SEU-UUID-AQUI', -- Cole o UUID aqui
  'paulosilvatomazeto@gmail.com',
  'Paulo Silva Tomázeto',
  'admin',
  'premium',
  999999,
  999999,
  'active',
  now(),
  now()
);
```

---

## 🚀 Próximas Passos

1. ✅ Faça login com Google
2. ✅ Execute o SQL de UPDATE
3. ✅ Refresh a página do app
4. ✅ Você será Admin com Premium e Créditos Ilimitados!

---

**Pronto! Em 2 minutos você terá sua conta admin criada.** 🎉
