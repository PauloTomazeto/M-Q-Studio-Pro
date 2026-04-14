# 🚀 Configurar Variáveis de Ambiente no Vercel

## Erro no Deploy

```
Uncaught Error: Missing Supabase credentials. 
Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
```

## Causa

As variáveis de ambiente estão em `.env.local` localmente, mas o Vercel não tem acesso a esse arquivo (está no `.gitignore`). Você precisa adicionar manualmente no painel do Vercel.

---

## ✅ Solução

### 1. Abra o Vercel Dashboard
https://vercel.com/dashboard/projects

### 2. Selecione Seu Projeto (MQ STUDIO PRO)

### 3. Clique em Settings (menu superior)

### 4. Clique em Environment Variables (lado esquerdo)

### 5. Adicione Estas Variáveis

**Para cada variável:**
1. Cole o **nome** no campo "Name"
2. Cole o **valor** no campo "Value"
3. Selecione **Production** (ou Production, Preview, Development conforme necessário)
4. Clique em **Add**

---

## 📋 Variáveis a Adicionar

### Supabase - OBRIGATÓRIO

| Nome | Valor |
|------|-------|
| **VITE_SUPABASE_URL** | `https://lwsskdbpyrqcxcnrmdkw.supabase.co` |
| **VITE_SUPABASE_ANON_KEY** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3NrZGJweXJxY3hjbnJtZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODQyNjEsImV4cCI6MjA5MTc2MDI2MX0.RJoXVD2iQbHLgvRkD1Bpcli0OgXODrwzJNXWfhm_E8o` |
| **SUPABASE_SERVICE_ROLE_KEY** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3NrZGJweXJxY3hjbnJtZGt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4NDI2MSwiZXhwIjoyMDkxNzYwMjYxfQ.HUS0bHgeBnBDGUlRpmwJKSgHbEI3U7sZjcbTvkeKQV8` |

### KIE.AI - Recomendado

| Nome | Valor |
|------|-------|
| **VITE_KIE_API_KEY** | `b7e6d04e2b37c593a0f8dac63ef612e9` |

### URLs Dinâmicas

Após fazer deploy, atualize estas com seu domínio real:

| Nome | Valor |
|------|-------|
| **VITE_API_URL** | `https://seu-dominio-vercel.vercel.app/api` |
| **VITE_FRONTEND_URL** | `https://seu-dominio-vercel.vercel.app` |
| **NODE_ENV** | `production` |

---

## 🔄 Depois de Adicionar Variáveis

### Opção 1: Redeploy Automático
Após clicar "Save", o Vercel pode automaticamente iniciar um novo deploy.

### Opção 2: Redeploy Manual
1. Vá para **Deployments**
2. Clique nos **três pontos** do seu último deployment
3. Clique em **Redeploy**

---

## ✅ Verificar se Funcionou

Após o deploy completar:
1. Acesse seu app no Vercel
2. Abra o DevTools (F12)
3. Vá para **Console**
4. Se não houver erro de "Missing Supabase credentials", está funcionando! ✅

---

## 🚨 Nota de Segurança

**NUNCA commit credenciais em git!**

- ✅ `.env.local` está em `.gitignore` (bom!)
- ✅ Credenciais são configuradas no painel Vercel (bom!)
- ❌ Não copie credenciais para código fonte

---

## 📝 Checklist

- [ ] Abri Vercel Dashboard
- [ ] Selecionei meu projeto
- [ ] Fui em Settings → Environment Variables
- [ ] Adicionei `VITE_SUPABASE_URL`
- [ ] Adicionei `VITE_SUPABASE_ANON_KEY`
- [ ] Adicionei `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Adicionei `VITE_KIE_API_KEY`
- [ ] Cliquei em Save
- [ ] Fiz Redeploy
- [ ] Testet o app e está funcionando ✅

---

**Depois disso, seu erro de credenciais estará resolvido!** 🚀
