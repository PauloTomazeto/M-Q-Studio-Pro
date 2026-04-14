# ⚡ FIX RÁPIDO - Erro Supabase no Vercel

## O Erro
```
Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## A Solução (3 minutos)

### 1. Acesse
```
https://vercel.com → Seu Projeto → Settings → Environment Variables
```

### 2. Copie do `.env` Local

Abra: `c:\Users\Usuario\Music\MQ STUDIO PRO\.env`

Você verá:
```
VITE_SUPABASE_URL=https://lwsskdbpyrqcxcnrmdkw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
VITE_KIE_API_KEY=b7e6d04e2b37c593a0f8dac63ef612e9
```

### 3. Cole no Vercel

Para cada linha:
1. **Name:** `VITE_SUPABASE_URL`
2. **Value:** `https://lwsskdbpyrqcxcnrmdkw.supabase.co`
3. **Select:** `Production`
4. **Click:** `Add`

(Repita para cada variável)

### 4. Redeploy

Clique em **Redeploy** na aba Deployments

---

## ✅ Pronto!

Seu erro estará resolvido! 🚀

---

## 📝 Copiar/Colar Rápido

```
Nome: VITE_SUPABASE_URL
Valor: https://lwsskdbpyrqcxcnrmdkw.supabase.co

Nome: VITE_SUPABASE_ANON_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3NrZGJweXJxY3hjbnJtZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODQyNjEsImV4cCI6MjA5MTc2MDI2MX0.RJoXVD2iQbHLgvRkD1Bpcli0OgXODrwzJNXWfhm_E8o

Nome: SUPABASE_SERVICE_ROLE_KEY
Valor: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3NrZGJweXJxY3hjbnJtZGt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4NDI2MSwiZXhwIjoyMDkxNzYwMjYxfQ.HUS0bHgeBnBDGUlRpmwJKSgHbEI3U7sZjcbTvkeKQV8

Nome: VITE_KIE_API_KEY
Valor: b7e6d04e2b37c593a0f8dac63ef612e9

Nome: NODE_ENV
Valor: production
```
