# ✅ GUIA SQL CORRETO - Criar Admin

O erro acontece porque **o usuário ainda não existe na tabela**.

---

## 🔍 PRIMEIRO: Verifique se o Usuário Existe

Execute ISTO no Supabase SQL Editor:

```sql
SELECT id, email FROM public.users WHERE email = 'paulosilvatomazeto@gmail.com';
```

### Resultados Possíveis:

**Resultado 1: Retorna 1 linha**
```
id                                   | email
12345678-1234-1234-1234-123456789abc | paulosilvatomazeto@gmail.com
```
→ Vá para **OPÇÃO 1** abaixo

**Resultado 2: Retorna vazio (0 linhas)**
```
(0 rows)
```
→ Vá para **OPÇÃO 2** abaixo

---

## ✅ OPÇÃO 1: Usuário JÁ Existe (já fez login com Google)

Execute ESTE SQL exato:

```sql
UPDATE public.users SET role = 'admin', plan = 'premium', credits = 999999, monthly_limit = 999999, subscription_status = 'active' WHERE email = 'paulosilvatomazeto@gmail.com';
```

**Resultado esperado:**
```
✓ Success. 1 row affected.
```

---

## ✅ OPÇÃO 2: Usuário NÃO Existe (ainda não fez login com Google)

### Passo 1: Faça login com Google no seu app
- Clique em "Login com Google"
- Use: paulosilvatomazeto@gmail.com
- Complemente o login

### Passo 2: Execute este SQL no Supabase

```sql
UPDATE public.users SET role = 'admin', plan = 'premium', credits = 999999, monthly_limit = 999999, subscription_status = 'active' WHERE email = 'paulosilvatomazeto@gmail.com';
```

**Resultado esperado:**
```
✓ Success. 1 row affected.
```

---

## ✅ VERIFICAR SE FUNCIONOU

Execute ISTO para confirmar:

```sql
SELECT id, email, role, plan, credits, monthly_limit, subscription_status FROM public.users WHERE email = 'paulosilvatomazeto@gmail.com';
```

**Resultado esperado:**
```
id                                   | email                           | role  | plan     | credits | monthly_limit | subscription_status
12345678-1234-1234-1234-123456789abc | paulosilvatomazeto@gmail.com    | admin | premium  | 999999  | 999999        | active
```

✅ Se vir `role = admin` e `plan = premium` e `credits = 999999`, **está perfeito!**

---

## 📝 Resumo SQL Correto

```sql
-- Sintaxe correta PostgreSQL/Supabase:
UPDATE <tabela>
SET <coluna1> = <valor1>, <coluna2> = <valor2>, ...
WHERE <condicao>;

-- Aplicado para você:
UPDATE public.users
SET role = 'admin', plan = 'premium', credits = 999999, monthly_limit = 999999, subscription_status = 'active'
WHERE email = 'paulosilvatomazeto@gmail.com';
```

---

## ❌ O Que NÃO Fazer

```sql
-- ❌ ERRADO - Sem SET
UPDATE public.users role = 'admin' WHERE email = '...';

-- ❌ ERRADO - Sem UPDATE
SET role = 'admin' WHERE email = '...';

-- ❌ ERRADO - Quebras de linha erradas
UPDATE public.users
SET
  role = 'admin',
  plan = 'premium',
...

-- ✅ CORRETO
UPDATE public.users SET role = 'admin', plan = 'premium' WHERE email = '...';
```

---

## 🚀 Próximos Passos

1. ✅ Execute o SQL de verificação (SELECT)
2. ✅ Se retornar vazio, faça login com Google primeiro
3. ✅ Execute o SQL de UPDATE
4. ✅ Execute o SQL de verificação novamente
5. ✅ Pronto! Você é Admin Premium com Créditos Ilimitados!

---

**Qualquer dúvida, execute o SELECT primeiro para ver qual OPÇÃO usar.** 💡
