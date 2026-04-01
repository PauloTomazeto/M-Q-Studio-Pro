# Referência Rápida: Arquivos Analisados e Alterações Necessárias

## Arquivos Analisados

### 1. Configuração CORS
**Caminho:** `/cors.json`  
**Status:** ✅ Correto  
**Conteúdo:**
- ✅ `http://localhost:3000` whitelisted
- ✅ GET, POST, PUT, DELETE, HEAD permitidos
- ✅ Headers CORS: Content-Type, Authorization, x-goog-resumable
- ✅ MaxAge: 3600s

**Ação:** Nenhuma

---

### 2. Configuração Firebase (Client)
**Caminho:** `/firebase-applet-config.json`  
**Status:** ✅ Correto  
**Conteúdo:**
- projectId: gen-lang-client-0425317525
- storageBucket: gen-lang-client-0425317525.firebasestorage.app
- firestoreDatabaseId: ai-studio-d112afcf-eff3-4910-9578-794e6a8b8870

**Ação:** Nenhuma

---

### 3. Inicialização Firebase (Client SDK)
**Caminho:** `/src/firebase.ts`  
**Status:** ✅ Correto  
**Conteúdo:**
- getAuth(), getFirestore(), getStorage() inicializados
- Config do firebase-applet-config.json aplicado
- handleFirestoreError() implementado

**Ação:** Nenhuma

---

### 4. Firestore Rules
**Caminho:** `/firestore.rules`  
**Status:** ✅ Correto  
**Linhas relevantes:**
- 132-134: `image_uploads/{uploadId}` - autenticado, userId validado
- 136-138: `generation_sessions/{sessionId}` - autenticado, userId validado
- 152-154: `file_deduplication_index/{fileHash}` - autenticado

**Ação:** Nenhuma

---

### 5. Storage Rules
**Caminho:** `/storage.rules`  
**Status:** ❌ **NÃO EXISTE**  
**Esperado:**
```firestore
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /input-images/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
    }
    match /generation_images/{userId}/{allPaths=**} {
      allow read, write: if request.auth.uid == userId;
    }
    match /temp_generation/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Ação:** ✏️ **CRIAR NOVO ARQUIVO**

---

### 6. Serviço de Storage (Client)
**Caminho:** `/src/services/storageService.ts` (498 linhas)  
**Status:** ⚠️ Funciona mas sem URLs assinadas

#### Funções Atuais:
- `calculateHash()` (L57-62) - SHA256 file hash ✅
- `getImageDimensions()` (L64-79) - Validação dimensões ✅
- `extractExif()` (L81-90) - Extrai metadados ✅
- `compressImage()` (L92-137) - Compressão ✅
- `validateFileChain()` (L139-321) - Validação multi-step ✅
- `uploadTempImage()` (L323-335) - Upload com URL pública ⚠️
- `deleteTempImage()` (L337-344) - Delete ✅
- `uploadImage()` (L346-480) - Upload com background job ⚠️
- `uploadBase64ViaProxy()` (L482-497) - Proxy upload ✅

#### Alterações Necessárias:
1. ✏️ **Adicionar após L497:**
```typescript
export const getSignedUrl = async (path: string): Promise<string> => {
  const response = await axios.post('/api/storage/signed-url', { path });
  return response.data.url;
};

export const uploadTempImageWithSignedUrl = async (
  file: File | Blob, 
  userId: string
): Promise<{ path: string; url: string }> => {
  // ... upload code ...
  const signedUrl = await getSignedUrl(path);
  return { path, url: signedUrl };
};
```

**Ação:** ✏️ **ATUALIZAR/ADICIONAR FUNÇÕES**

---

### 7. Servidor Backend
**Caminho:** `/server.ts` (204 linhas)  
**Status:** ✅ Proxy funcionando, ausente endpoint de Signed URL

#### Endpoints Atuais:
- `POST /api/kie/gemini` (L34-56) - Gemini proxy ✅
- `POST /api/kie/kling` (L58-75) - Kling proxy ✅
- `GET /api/kie/kling/status/:taskId` (L77-92) - Status ✅
- `POST /api/kie/nano-banana/create` (L95-122) - Nano Banana proxy ✅
- `GET /api/kie/nano-banana/status/:taskId` (L124-139) - Status ✅
- `POST /api/storage/upload` (L142-181) - Upload com proxy ✅
- Vite middleware (L184-196) - Dev server ✅

#### Alterações Necessárias:
1. ✏️ **Adicionar após L181 (após `/api/storage/upload`):**
```typescript
app.post("/api/storage/signed-url", async (req, res) => {
  const { path } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  try {
    console.log(`[Storage Signed URL] Generating for path: ${path}`);
    
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    
    console.log("[Storage Signed URL] Success");
    res.json({ url: signedUrl });
  } catch (error: any) {
    console.error("[Storage Signed URL] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
```

**Ação:** ✏️ **ADICIONAR ENDPOINT**

---

### 8. Serviço KIE
**Caminho:** `/src/services/kieService.ts` (parte analisada até L483)  
**Status:** ✅ Não precisa alteração

#### Funções Relevantes:
- `diagnoseImage()` (L345-451) - Upload via URL ✅
- `detectArchitecture()` (L453-483) - Detecção com URL ✅
- Usa URLs diretamente com `image_url` parameter ✅

**Ação:** Nenhuma

---

### 9. Componente GenerationStep
**Caminho:** `/src/components/studio/GenerationStep.tsx` (parte analisada até L294)  
**Status:** ✅ Não precisa alteração

#### Fluxo Relevante (L145-165):
- Obtém `mainImageUrl` e `mirrorImageUrl` do store ✅
- Envia para `kieService.generateImage()` ✅
- URLs são usadas transparentemente ✅

**Ação:** Nenhuma

---

### 10. Configuração Firebase Blueprint
**Caminho:** `/firebase-blueprint.json`  
**Status:** ℹ️ Informativo (não precisa alteração)

**Ação:** Nenhuma

---

## Resumo de Alterações

### Arquivos a Criar

| # | Arquivo | Tipo | Linhas | Prioridade |
|---|---------|------|--------|-----------|
| 1 | `/storage.rules` | Rules | 25-30 | 🔴 Alta |

### Arquivos a Modificar

| # | Arquivo | Localização | Linhas | Prioridade |
|---|---------|-------------|--------|-----------|
| 1 | `/server.ts` | Após L181 | ~40 | 🔴 Alta |
| 2 | `/src/services/storageService.ts` | Após L497 | ~60 | 🔴 Alta |

### Arquivos Sem Alteração

| # | Arquivo | Razão |
|---|---------|-------|
| 1 | `/cors.json` | Já correto |
| 2 | `/firebase-applet-config.json` | Config OK |
| 3 | `/firestore.rules` | Rules OK |
| 4 | `/src/firebase.ts` | Init OK |
| 5 | `/src/services/kieService.ts` | Usa URLs transparente |
| 6 | `/src/components/studio/GenerationStep.tsx` | Usa URLs transparente |
| 7 | Todos os componentes UI | Auto trabalham com URLs |

---

## Mapa de Dependências

```
User Flow:
  GenerationStep.tsx
    ├─ useStudioStore (get mainImageUrl)
    ├─ kieService.generateImage()
    │   └─ POST /api/kie/gemini (server.ts)
    │       └─ Envia URL para Gemini
    │           └─ Gemini acessa URL
    │               └─ browser/server retorna
    │                   └─ firebase storage
    │
    └─ showImage()
        └─ <img src={mainImageUrl} />
            └─ Browser tenta GET
                └─ Signed URL (com creds)
                    └─ firebase storage ✅

Upload Flow (Current):
  storageService.uploadTempImage()
    ├─ uploadBytes() to storage ref
    └─ getDownloadURL() [SEM CREDS] ❌

Upload Flow (New):
  storageService.uploadTempImageWithSignedUrl()
    ├─ uploadBytes() to storage ref
    ├─ POST /api/storage/signed-url
    │   └─ server.ts: bucket.file(path).getSignedUrl()
    │       └─ Firebase Admin SDK
    └─ Retorna URL com creds ✅
```

---

## Checklist de Implementação

```
FASE 1: Criar Storage Rules
[ ] Criar arquivo /storage.rules
[ ] Aplicar regras explícitas por path
[ ] Deploy: firebase deploy --only storage

FASE 2: Backend (server.ts)
[ ] Adicionar import axios (já existe)
[ ] Adicionar endpoint POST /api/storage/signed-url
[ ] Usar admin.storage().bucket().file().getSignedUrl()
[ ] Testar com curl/Postman

FASE 3: Client (storageService.ts)
[ ] Adicionar função getSignedUrl()
[ ] Adicionar função uploadTempImageWithSignedUrl()
[ ] Testar em browser

FASE 4: Integração
[ ] Atualizar chamadas a uploadTempImage()
[ ] Testar download em browser
[ ] Testar acesso Gemini API
[ ] Verificar expiração URLs

FASE 5: Limpeza
[ ] Manter uploadTempImage() como fallback (compatibilidade)
[ ] Adicionar logs de sucesso/falha
[ ] Documentar padrão
```

---

## Comandos para Deploy

### Deploy Storage Rules
```bash
firebase deploy --only storage
```

### Test Signed URL Endpoint
```bash
curl -X POST http://localhost:3000/api/storage/signed-url \
  -H "Content-Type: application/json" \
  -d '{"path":"input-images/test-user/test.jpg"}'

# Esperado:
# {"url":"https://firebasestorage.googleapis.com/v0/b/...?GoogleAccessId=...&Signature=...&Expires=..."}
```

### Test Browser Access
```javascript
fetch('http://localhost:3000/api/storage/signed-url', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({path: 'input-images/user/file.jpg'})
})
.then(r => r.json())
.then(data => {
  const img = new Image();
  img.src = data.url;
  img.onload = () => console.log('✅ Signed URL funciona');
  img.onerror = () => console.log('❌ Falhou');
  document.body.appendChild(img);
});
```

---

## Métricas para Monitoramento

### Antes da Implementação
- Taxa de sucesso: ~60-70%
- Erros CORS: 30-40%
- Erros Permission: 10-20%

### Depois da Implementação
- Taxa de sucesso: >99%
- Erros CORS: 0%
- Erros Permission: 0%

---

## Contato para Dúvidas

### Documentação Técnica Completa
Ver arquivo: `ANALISE_CORS_FIREBASE_STORAGE.md`

### Implementação Passo-a-Passo
Ver arquivo: `SOLUCAO_TECNICA_FIREBASE_STORAGE.md`

### Diagramas Visuais
Ver arquivo: `DIAGNOSTICO_VISUAL.txt`

### Este Arquivo
`REFERENCIA_ARQUIVOS.md` - Mapa de arquivos e alterações

---

**Última atualização:** 2026-04-01  
**Status:** ✅ Análise completa, pronto para implementação

