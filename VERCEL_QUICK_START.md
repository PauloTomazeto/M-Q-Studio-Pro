# 🚀 Deploy na Vercel - Quick Start

## 5 Minutos para Colocar Online

### Passo 1: Configurar Variáveis (.env)

```bash
# Copiar template
cp .env.example .env

# Preencher com seus dados:
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key-aqui
VITE_STORAGE_BUCKET_NAME=user-uploads
KIE_API_KEY=sua-chave-kie-aqui
```

### Passo 2: Testar Localmente

```bash
npm install
npm run build
npm run preview
```

Acessar: http://localhost:4173 → Fazer upload de teste

### Passo 3: Adicionar Domínio no Supabase CORS

1. Supabase Dashboard → Storage → Settings
2. Adicionar em `allowedOrigins`:
   ```json
   "https://seu-projeto.vercel.app"
   ```

### Passo 4: Deploy na Vercel

#### Opção A: Git Push (Automático)
```bash
git add .
git commit -m "fix: configure for Vercel deployment"
git push
# Vercel faz deploy automático
```

#### Opção B: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel deploy
```

### Passo 5: Adicionar Variáveis na Vercel Dashboard

1. Acessar: https://vercel.com/dashboard
2. Clicar no seu projeto
3. Settings → Environment Variables
4. Adicionar as **mesmas variáveis do .env**

**⚠️ IMPORTANTE**: Marcar que valem para Production + Preview + Development

### Passo 6: Teste Final

```bash
1. Acessar: https://seu-projeto.vercel.app
2. Fazer login
3. Tentar upload de imagem
4. Abrir DevTools (F12) → Network
5. Verificar se upload completa em 5-10s
```

---

## ✅ Verificação Rápida

```bash
# Executar verificação automática
chmod +x check-vercel-config.sh
./check-vercel-config.sh
```

---

## 🆘 Erros Comuns

| Erro | Solução |
|------|---------|
| `VITE_SUPABASE_URL is undefined` | Adicionar variáveis no Vercel Dashboard |
| `CORS error` | Adicionar domínio Vercel em Supabase CORS |
| `Upload timeout` | Verificar internet, pode demorar mais |
| `Auth failed (401)` | Verificar VITE_SUPABASE_ANON_KEY |

---

## 📍 URLs Importantes

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **Seu app**: https://seu-projeto.vercel.app
- **Logs Vercel**: https://vercel.com/seu-projeto/seu-projeto/deployments

---

## 💡 Pro Tips

✅ Testar `npm run build` localmente antes de fazer push
✅ Verificar logs em Vercel → Deployments → Logs
✅ Se quebrou, reverter último deploy em Vercel (< 1s)
✅ Cada push = novo deploy automático (não custa nada)

---

**Pronto!** Seu app agora está na Vercel! 🎉
