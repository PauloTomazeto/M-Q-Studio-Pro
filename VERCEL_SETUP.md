# Configuração da Aplicação na Vercel

## 📋 Checklist de Deploy

### 1. Variáveis de Ambiente na Vercel Dashboard

Acesse: **Settings → Environment Variables** e adicione:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key-aqui
VITE_STORAGE_BUCKET_NAME=user-uploads
KIE_API_KEY=sua-chave-kie-aqui
GEMINI_API_KEY=sua-chave-gemini-aqui (opcional)
```

**⚠️ IMPORTANTE:** Adicionar para **Environments**: Production, Preview, Development

### 2. Supabase CORS Configuration

Ir para: **Supabase Dashboard → Storage → CORS Settings**

Adicionar seu domínio Vercel:

```json
{
  "allowedHeaders": ["*"],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "allowedOrigins": [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://seu-projeto.vercel.app",
    "https://*.vercel.app"
  ],
  "exposedHeaders": [],
  "maxAgeSeconds": 3600
}
```

### 3. Criar Bucket no Supabase

1. Ir para **Supabase → Storage**
2. Criar novo bucket chamado **`user-uploads`**
3. Configurar políticas RLS:

**Política de Leitura (Pública):**
```sql
CREATE POLICY "Public Read" ON storage.objects
  FOR SELECT USING (true);
```

**Política de Upload (Autenticado):**
```sql
CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'user-uploads'
  );
```

### 4. Configuração de Build na Vercel

Vercel detecta automaticamente:
- **Build Command**: `npm run build` ✓
- **Output Directory**: `dist` ✓
- **Node.js Version**: 20.x ✓

Nada a configurar! A configuração está em `vercel.json`

### 5. Limites e Timeouts

| Aspecto | Limite | Solução |
|--------|--------|---------|
| Duração máxima da função | 60s (grátis) / 900s (Pro) | Processamento KIE será mais rápido que limite |
| Tamanho máximo do arquivo | 4.5GB (Vercel) / 100MB (Supabase) | Upload limitado a 20MB (OK) |
| Upload timeout | 55s (configurado) | Suficiente para uploads ≤ 20MB |

## 🚀 Deploy na Vercel

### Opção 1: Git Integration (Recomendado)

```bash
1. Push para GitHub
2. Conectar repo em https://vercel.com/dashboard
3. Vercel detecta vite.config.ts + server.ts automaticamente
4. Deploy automático em cada push
```

### Opção 2: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel deploy
```

## 🧪 Testar Deploy

### 1. Verificar Build Logs

Após fazer push:
1. Ir para **vercel.com/dashboard**
2. Clicar no projeto
3. Ver **Deployments**
4. Clicar em deploy recente
5. Verificar **Build Logs** e **Runtime Logs**

### 2. Testar Upload na Vercel

```
1. Acessar https://seu-projeto.vercel.app
2. Fazer login
3. Tentar upload de imagem
4. Monitorar DevTools (F12):
   - Network: requests para Supabase devem completar
   - Console: logs de progresso aparecem
```

### 3. Verificar Variáveis de Ambiente

No console Vercel, verificar se aparecem:
```
VITE_SUPABASE_URL: ✓ https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY: ✓ [configurado]
VITE_STORAGE_BUCKET_NAME: ✓ user-uploads
KIE_API_KEY: ✓ [configurado]
```

## 🔍 Troubleshooting

### Upload ainda fica travado?

```javascript
// Colar no console Vercel:
fetch('https://seu-projeto.supabase.co/storage/v1/buckets', {
  headers: {
    'Authorization': 'Bearer SEU_ANON_KEY'
  }
})
.then(r => r.json())
.then(d => console.log('✅ Supabase OK:', d))
.catch(e => console.log('❌ CORS Error:', e))
```

### Erro: "CORS_ERROR"

**Solução:**
1. Verificar CORS settings no Supabase Storage
2. Adicionar domínio Vercel em `allowedOrigins`
3. Aguardar 5 minutos para propagar
4. Fazer hard refresh (Ctrl+Shift+R)

### Erro: "AUTH_REQUIRED"

**Solução:**
1. Fazer login na aplicação
2. Verificar que JWT token está no localStorage
3. Verificar que `VITE_SUPABASE_ANON_KEY` está em variáveis de ambiente

### Erro: "UPLOAD_TIMEOUT" (55s)

**Causa:** Upload > 55 segundos (arquivo muito grande ou internet lenta)

**Solução:**
1. Para Vercel Pro (900s timeout): Fazer upgrade
2. Ou: Comprimir imagem antes de upload
3. Ou: Implementar upload em chunks

## 📊 Monitoramento

### Observar Logs em Tempo Real

```bash
vercel logs seu-projeto.vercel.app --tail
```

### Logs do Runtime

Vercel mostra automaticamente em:
**Deployments → Logs → Runtime Logs**

Procure por:
- `[KIE Proxy]` - logs de chamadas KIE
- `[CORS Headers]` - headers de CORS sendo setados
- Erros de conexão Supabase

## ✅ Checklist Final

- [ ] `.env` configurado localmente (para testes)
- [ ] `vercel.json` commitado ✓
- [ ] `server.ts` atualizado ✓
- [ ] `package.json` tem scripts corretos ✓
- [ ] Variáveis de ambiente na Vercel Dashboard
- [ ] Supabase CORS inclui domínio Vercel
- [ ] Bucket `user-uploads` criado no Supabase
- [ ] Políticas RLS configuradas
- [ ] Deploy feito com sucesso
- [ ] Upload funciona sem erros

## 📞 Suporte

| Problema | Solução |
|----------|---------|
| Build falha | Verificar `npm run build` localmente |
| Upload não funciona | Verificar CORS + variáveis de ambiente |
| 504 Gateway Timeout | Aumentar tempo na Vercel Pro ou otimizar KIE |
| CORS error | Adicionar domínio em Supabase CORS settings |

---
**Última atualização:** 2026-04-16
**Versão:** 1.0 (Vercel Ready)
