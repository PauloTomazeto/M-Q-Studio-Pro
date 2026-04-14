# Troubleshooting: COEP Error - Falha ao Carregar Imagens

## Problema
```
Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep
```

---

## ✅ Soluções Implementadas

### 1. **COEP Header Removido do Express Server** (server.ts L24)
```typescript
// res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp'); // DISABLED
```

### 2. **CORS Headers Configurados Explicitamente**
- Express (port 3000): `Cross-Origin-Resource-Policy: cross-origin`
- Vite (port 5173): `Cross-Origin-Resource-Policy: cross-origin`

### 3. **HMR Configurado Corretamente**
- Vite webpack: `ws://localhost:5173` (em vez de 24678)

---

## 🔍 Como Verificar

### Passo 1: Hard Refresh no Navegador
Pressione **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac) para limpar cache.

### Passo 2: Abrir DevTools
1. Pressione **F12** para abrir Developer Tools
2. Vá até a aba **Network**
3. Deixe o Network tab aberto

### Passo 3: Testar Upload de Imagem
1. Acesse http://localhost:3000
2. Faça upload de uma imagem (ex: "Área social_04.jpg")
3. Observe o console do DevTools

### Passo 4: Verificar Response Headers
1. Na aba **Network**, procure a requisição pela imagem (ex: `88950575-f260-466d-8e7c-473489811669.png`)
2. Clique nela
3. Vá até aba **Response Headers**
4. Procure por estas linhas:

**✓ Deve ter:**
```
Cross-Origin-Resource-Policy: cross-origin
```

**✗ NÃO deve ter:**
```
Cross-Origin-Embedder-Policy: require-corp
```

### Passo 5: Console Logs
Abra o console (Ctrl+` ou DevTools > Console) e procure por:
```
[CORS Headers] COEP disabled ✓ | CORP: cross-origin ✓ | COOP: same-origin-allow-popups ✓
```

Se você vir este log, significa que o servidor está enviando headers corretos.

---

## 🔧 Se o Erro Persistir

### Opção 1: Limpar Cache da Aplicação
1. DevTools > **Application** tab
2. Cache Storage > **Clear all**
3. Local Storage > Delete (selecione todos)
4. Hard refresh novamente (Ctrl+Shift+R)

### Opção 2: Verificar Porta do Vite
O Vite pode estar em porta diferente. Verifique:
1. Abra http://localhost:5173 no navegador
2. DevTools > Console > Procure erros
3. Se a porta for diferente, atualize em `vite.config.ts` line 21:
```typescript
port: XXXX,  // Sua porta aqui
```

### Opção 3: Verificar Firebase Storage CORS
Se a imagem vem do Firebase Storage, verifique [cors.json](cors.json):
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization"]
  }
]
```

---

## 📋 Checklist de Status

- [ ] Hard refresh feito (Ctrl+Shift+R)
- [ ] `[CORS Headers] COEP disabled` aparece no console do servidor
- [ ] Network > Image não mostra `Cross-Origin-Embedder-Policy: require-corp`
- [ ] Network > Image status é **200** (não é bloqueado)
- [ ] Imagem carrega corretamente na UI
- [ ] Diagnosis retoma após erro de manutenção (retry funciona)

---

## 🚨 Status Atual (Abril 9, 2026)

**Implementações Ativas:**
1. ✅ COEP header desabilitado em Express + Vite
2. ✅ CORP header configurado em ambos servidores  
3. ✅ HMR configurado para ws://localhost:5173
4. ✅ Retry logic funciona com backoff exponencial (2s→4s→8s)
5. ✅ Normalização de resposta Zod ativa

---

## 📞 Próximas Ações

Se após todas estas etapas o erro persistir:
1. Abra DevTools > Network > selecione a image
2. Copie o URL completo da imagem
3. Verifique se URL começa com `blob:` ou `https://firebasestorage.googleapis.com`
4. Se for Firebase: podem ser headers específicos do Firebase blocando
5. Se for blob: pode ser um issue de como o blob está sendo criado

---

## 📝 Logs Relevantes

Procure por logs que confirmam funcionalidade:

```typescript
// Server iniciando com headers corretos:
[CORS Headers] COEP disabled ✓ | CORP: cross-origin ✓ | COOP: same-origin-allow-popups ✓

// Diagnosis iniciando:
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: sess_1775751273767

// Normalização ativa:
[Normalization] Converting pbr_diffuse string to object: ...

// Retry com backoff:
[Diagnosis] Retrying diagnosis (Attempt 2/3)...
[Diagnosis] Waiting 4000ms before retry...
```

---

## 📚 Referências

- [MDN: Cross-Origin-Embedder-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy)
- [MDN: Cross-Origin-Resource-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy)
- [Vite Server Options](https://vitejs.dev/config/server-options.html#server-headers)
- [Firebase Storage CORS](https://firebase.google.com/docs/storage/security/start#cors)
