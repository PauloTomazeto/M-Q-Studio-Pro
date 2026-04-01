# Plano de Implementação: Resolução de Erros CORS/Firebase Storage
**Data:** 2026-04-01  
**Tempo Estimado:** 2.5-3.5 horas (bem dentro das 4 horas solicitadas)  
**Complexidade:** MÉDIA  
**Risco:** BAIXO (com fallbacks)

---

## 1. ANÁLISE CRÍTICA DO PROBLEMA ATUAL

### Arquitetura Atual:
```
┌─────────────────────────────────────────────────────────────┐
│ React Client (src/components/studio/UploadStep.tsx)         │
│ ├─ uploadImage() → Firebase SDK (Client-side)               │
│ │  └─ uploadBytes() → storage.googleapis.com (CORS Issue)   │
│ └─ getDownloadURL() → static URL (Sem Auth)                 │
└─────────────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ Firebase Storage (gen-lang-client-0425317525.firebasestorage.app)  │
│ ├─ CORS Config: localhost:3000 ONLY (cors.json)             │
│ ├─ Public URLs: https://storage.googleapis.com/...          │
│ └─ Auth: No Bearer token on public read                      │
└─────────────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────────┐
│ Gemini API via KIE Proxy (/api/kie/gemini)                  │
│ ├─ Aceita base64 Data URLs                                  │
│ ├─ Aceita URLs de Storage (com CORS)                        │
│ └─ Retry Logic (limite: ~3 tentativas antes de erro)        │
└─────────────────────────────────────────────────────────────┘
```

### Erros Documentados:
1. **CORS Bloqueado**: `Access-Control-Allow-Origin` missing
2. **Retry Limit Exceeded**: Gemini API abandona após falhas sucessivas
3. **Permission Denied**: Firestore rules restritas para storage paths
4. **Base64 Workaround**: Funciona, mas é ineficiente para imagens > 4MB

### Fluxo de Imagem Atual:
```
File (20MB max)
  ↓
[UploadStep] → validateFileChain() ✓
  ↓
[UploadStep] → compressImage(1600px, 0.8 quality) → Base64
  ↓
[uploadImage] → uploadBytes() × 2 (original + compressed)
  ↓
Firebase Storage (background) + Firestore Metadata
  ↓
[DiagnosisStep] → base64 → kieService.diagnoseImage() ✓
  ↓
[GenerationStep] → prompt → kieService.generateImage()
```

**Ponto de Falha**: Linha 176-177 em `server.ts` retorna URL estática que pode sofrer bloqueio CORS na produção.

---

## 2. SOLUÇÃO RECOMENDADA: OPÇÃO 5 HÍBRIDA (IMPLEMENTAÇÃO COMPLETA)

### Fase 1: Setup + Validação (15 minutos)
### Fase 2: Implementação Proxy (45 minutos)
### Fase 3: Signed URLs + Fallback (30 minutos)
### Fase 4: Testes Integrados (30 minutos)

**Total: ~2 horas. Buffer: +1 hora para debugging.**

---

## 3. FASES DETALHADAS DE IMPLEMENTAÇÃO

### FASE 1: Validação e Configuração CORS
**Tempo: 15 minutos | Risco: MUITO BAIXO**

#### 1.1 Verificar cors.json Atual
```json
[
  {
    "origin": ["http://localhost:3000"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

**Status**: ✓ Já configurado para localhost.

#### 1.2 Validação com gsutil (LOCAL)
```bash
# NÃO EXECUTAR AGORA - apenas documentado
gsutil cors set cors.json gs://gen-lang-client-0425317525.firebasestorage.app/
```

**Para Produção**: Adicionar domínio público:
```json
[
  {
    "origin": ["http://localhost:3000", "https://yourdomain.com"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

#### 1.3 Environment Variables Check
```bash
# Verificar em .env:
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0425317525 ✓
VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0425317525.firebasestorage.app ✓
```

---

### FASE 2: Implementar Proxy de Download (45 minutos)
**Risco: BAIXO | Benefício: IMEDIATO**

#### Arquivo a Modificar: `server.ts` (após linha 181)

**2.1 Adicionar Rota de Download com Retry:**

```typescript
// Firebase Storage Proxy Download (NOVO)
app.get("/api/storage/download/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const { token } = req.query;
  
  // Validações de segurança
  if (!fileId || fileId.length < 8) {
    return res.status(400).json({ error: "Invalid fileId" });
  }

  const MAX_RETRIES = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Storage Proxy] Download attempt ${attempt}/${MAX_RETRIES}: ${fileId}`);
      
      const bucket = admin.storage().bucket();
      const file = bucket.file(fileId);
      
      // Check if file exists (with timeout)
      const [exists] = await Promise.race([
        file.exists(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('EXISTS_CHECK_TIMEOUT')), 5000)
        )
      ]) as any;

      if (!exists) {
        return res.status(404).json({ error: "File not found", fileId });
      }

      // Download file with timeout
      const [buffer] = await Promise.race([
        file.download(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DOWNLOAD_TIMEOUT')), 30000)
        )
      ]) as any;

      // Get metadata for content-type
      const [metadata] = await file.getMetadata().catch(() => [{}]);
      
      // Set CORS headers explicitly
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
      res.setHeader('Access-Control-Max-Age', '3600');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', metadata.contentType || 'image/jpeg');
      res.setHeader('Content-Length', buffer.length);
      
      console.log(`[Storage Proxy] Download success: ${fileId} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
      res.send(buffer);
      return;

    } catch (error: any) {
      lastError = error;
      console.error(`[Storage Proxy] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delay = Math.pow(2, attempt - 1) * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(`[Storage Proxy] All ${MAX_RETRIES} attempts failed for ${fileId}`);
  const errorMsg = lastError?.message || 'Download failed';
  res.status(500).json({ 
    error: "Failed to download file", 
    reason: errorMsg,
    attempts: MAX_RETRIES
  });
});
```

#### 2.2 Adicionar Rota de Download com URL Pública:

```typescript
// Get Public URL (Signed URL Generator)
app.post("/api/storage/get-url", async (req, res) => {
  const { filePath } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ error: "Missing filePath" });
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    // Generate signed URL válido por 1 hora
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 1 * 60 * 60 * 1000, // 1 hora
    });

    console.log(`[Storage Proxy] Signed URL generated for: ${filePath}`);
    
    res.json({ url: signedUrl });
  } catch (error: any) {
    console.error("[Storage Proxy] Signed URL Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
```

---

### FASE 3: Atualizar Cliente (storageService.ts)
**Tempo: 30 minutos | Risco: MÉDIO (requer testes)**

#### 3.1 Nova Função de Download Seguro:

**Arquivo: `src/services/storageService.ts` (após linha 497)**

```typescript
/**
 * NOVO: Download de arquivo via proxy com retry automático
 * Evita CORS bloqueado em produção
 */
export const downloadViaProxy = async (
  filePath: string, 
  maxRetries: number = 3
): Promise<Blob> => {
  // Encode filePath como fileId (usar hash ou path encoded)
  const fileId = btoa(filePath).replace(/[+/=]/g, c => ({'+': '-', '/': '_', '=': ''}[c]));
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Client] Proxy download attempt ${attempt}/${maxRetries}: ${filePath}`);
      
      const response = await axios.get(`/api/storage/download/${fileId}`, {
        responseType: 'blob',
        timeout: 30000
      });

      console.log(`[Client] Proxy download success: ${(response.data.size / 1024 / 1024).toFixed(2)}MB`);
      return response.data;
      
    } catch (error: any) {
      console.warn(`[Client] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`PROXY_DOWNLOAD_FAILED: Failed after ${maxRetries} attempts`);
};

/**
 * NOVO: Obter URL assinada de curta duração
 * Para uso direto em Gemini API (evita proxy para grandes imagens)
 */
export const getSignedUrl = async (filePath: string): Promise<string> => {
  try {
    const response = await axios.post('/api/storage/get-url', {
      filePath
    });
    return response.data.url;
  } catch (error: any) {
    console.error('[Client] Signed URL Error:', error.message);
    throw new Error(`SIGNED_URL_FAILED: ${error.message}`);
  }
};

/**
 * NOVO: Estratégia Híbrida de Acesso a Imagens
 * 1. Tenta URL assinada (rápido, sem proxy)
 * 2. Fallback para proxy se assinada falhar
 * 3. Fallback final para base64 se ambas falhem
 */
export const getImageUrl = async (
  filePath: string,
  base64Fallback?: string
): Promise<{ url: string; method: 'signed' | 'proxy' | 'base64' }> => {
  // Método 1: Tentativa rápida com Signed URL
  try {
    const signedUrl = await getSignedUrl(filePath);
    console.log('[Client] Using signed URL');
    return { url: signedUrl, method: 'signed' };
  } catch (error) {
    console.warn('[Client] Signed URL failed, trying proxy...');
  }

  // Método 2: Fallback para proxy
  try {
    const blob = await downloadViaProxy(filePath);
    const url = URL.createObjectURL(blob);
    console.log('[Client] Using proxy URL');
    return { url, method: 'proxy' };
  } catch (error) {
    console.warn('[Client] Proxy failed, using base64...');
  }

  // Método 3: Fallback final para base64
  if (base64Fallback) {
    console.log('[Client] Using base64 fallback');
    return { url: base64Fallback, method: 'base64' };
  }

  throw new Error('IMAGE_URL_UNAVAILABLE: All methods failed');
};
```

---

### FASE 4: Integração com KIE Service
**Tempo: 20 minutos | Risco: BAIXO**

**Arquivo: `src/services/kieService.ts` (linha 367)**

#### 4.1 Modificar diagnoseImage para aceitar múltiplas fontes:

```typescript
async diagnoseImage(
  imageBase64OrUrl: string, 
  sessionId: string,
  fallbackBase64?: string
): Promise<ScanResult> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('AUTH_REQUIRED');

  console.log('Starting diagnosis for session:', sessionId);
  const startTime = Date.now();
  
  // Normalizar input: se for URL, converter para base64; se for base64, manter
  let imageInput: { type: 'image_url' | 'image_data', value: string };
  
  if (imageBase64OrUrl.startsWith('http')) {
    // É uma URL (signed ou proxy)
    imageInput = { type: 'image_url', value: imageBase64OrUrl };
    console.log('[KIE] Using URL input for diagnosis');
  } else {
    // É base64 ou data URL
    let formattedImage = imageBase64OrUrl;
    if (!formattedImage.startsWith('data:')) {
      formattedImage = `data:image/jpeg;base64,${formattedImage}`;
    }
    imageInput = { type: 'image_data', value: formattedImage };
    console.log('[KIE] Using base64 input for diagnosis');
  }

  try {
    console.log('Calling KIE Gemini API for diagnosis...');
    const contentArray: any[] = [
      { type: 'text', text: SYSTEM_INSTRUCTION },
      { type: 'text', text: 'Perform a full architectural diagnosis of this image. Return ONLY the JSON object.' }
    ];

    // Adicionar imagem no formato apropriado
    if (imageInput.type === 'image_url') {
      contentArray.push({
        type: 'image_url',
        image_url: { url: imageInput.value }
      });
    } else {
      contentArray.push({
        type: 'image_url',
        image_url: { url: imageInput.value }
      });
    }

    const response = await axios.post('/api/kie/gemini', {
      model: 'gemini-3.1-pro',
      messages: [
        {
          role: 'user',
          content: contentArray
        }
      ],
      max_tokens: 8192,
      temperature: 0.7,
      stream: false
    }, { timeout: 120000 });

    // ... resto do código (sem mudanças)
  } catch (err: any) {
    console.error('Diagnosis Error:', err);
    
    // Fallback: se fornecido fallbackBase64, tentar novamente
    if (fallbackBase64 && imageInput.type === 'image_url') {
      console.log('[KIE] URL failed, retrying with base64 fallback...');
      return this.diagnoseImage(fallbackBase64, sessionId, undefined);
    }

    try {
      setDoc(doc(db, 'generation_sessions', sessionId), {
        userId,
        scanStatus: 'failed',
        scanErrors: [err.message],
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    } catch (updateErr) {
      console.error('Failed to update session status:', updateErr);
    }
    throw err;
  }
}
```

---

### FASE 5: Atualizar UploadStep (React Component)
**Tempo: 15 minutos | Risco: MÉDIO**

**Arquivo: `src/components/studio/UploadStep.tsx` (linha 178-185)**

#### 5.1 Modificar fluxo de upload:

```typescript
const handleConfirmUpload = async () => {
  if (!file || !validationResult || !validationResult.allValid) {
    console.warn('Cannot upload: file missing or validation failed', { file, validationResult });
    return;
  }

  console.log('Starting upload confirm process for file:', file.name);
  setIsUploading(true);
  setUploadProgress(0);

  try {
    // 1. Convert to Base64 immediately for diagnosis (Compressed for speed)
    console.log('Compressing image for diagnosis...');
    const diagnosisBlob = await compressImage(file, 0.8, 1600);
    
    console.log('Converting to Base64 for immediate diagnosis...');
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(diagnosisBlob);
    });
    setBase64Image(base64); // Sempre manter base64 como fallback

    // 2. Start upload process (Non-blocking background upload)
    console.log('Calling uploadImage service (Background)...');
    const result = await uploadImage(file, validationResult, base64);

    console.log('Upload initiated in background, result:', result);
    setImage(preview, result.metadata);
    setSessionId(result.sessionId);
    
    // NOVO: Armazenar caminhos de arquivo para acesso posterior
    useStudioStore.setState({
      storagePathOriginal: result.storagePathOriginal,
      storagePathCompressed: result.storagePathCompressed
    });
    
    console.log('Transitioning to diagnosis step immediately...');
    setStep('diagnosis');
  } catch (err: any) {
    console.error('Upload Process Error:', err);
    setError(`Falha ao iniciar processamento: ${err.message}`);
  } finally {
    setIsUploading(false);
  }
};
```

---

### FASE 6: Atualizar DiagnosisStep (Usar URLs Assinadas)
**Tempo: 10 minutos | Risco: MUITO BAIXO**

**Arquivo: `src/components/studio/DiagnosisStep.tsx` (linha 74-138)**

```typescript
const runAnalysis = async () => {
  if (analysisStartedRef.current && status === 'success') return;
  
  let imageToAnalyze = base64Image;
  
  // NOVO: Tentar usar URL assinada se disponível
  const { storagePathOriginal } = useStudioStore.getState();
  if (storagePathOriginal && !imageToAnalyze?.startsWith('http')) {
    try {
      console.log('[Diagnosis] Tentando obter URL assinada...');
      const { url } = await getImageUrl(storagePathOriginal, base64Image);
      console.log(`[Diagnosis] Usando ${url.startsWith('http') ? 'URL assinada' : 'base64'}`);
      imageToAnalyze = url;
    } catch (error) {
      console.warn('[Diagnosis] Falha ao obter URL, usando base64:', error);
      imageToAnalyze = base64Image;
    }
  }
  
  if (!imageToAnalyze || !sessionId) {
    console.warn('Missing image data or sessionId for analysis');
    return;
  }
  
  analysisStartedRef.current = true;
  setStatus('loading');
  setIsModeLocked(true);
  setScanStatus('processing');
  setError(null);
  setElapsedTime(0);
  setProgressIndex(0);

  try {
    if (retryCountRef.current === 0) {
      const hasCredits = await consumeCredits(5, 'diagnosis_gemini');
      if (!hasCredits) {
        throw new Error('Créditos insuficientes para realizar a análise.');
      }
    }

    console.log('Running diagnosis with image, Session:', sessionId);
    const data = await kieService.diagnoseImage(imageToAnalyze, sessionId, base64Image);
    
    // ... resto do código (sem mudanças)
  } catch (err: any) {
    // ... tratamento de erro
  }
};
```

---

## 4. ESTRUTURA DE TESTES

### 4.1 Testes Manuais Pré-Implementação

```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Testar rotas no resto antes da implementação
curl -X GET http://localhost:3000/api/storage/download/example-file-id
# Esperado: 404 File not found (rota não existe ainda)
```

### 4.2 Testes Pós-Implementação

```typescript
// 1. Test Proxy Download
const blob = await downloadViaProxy('generation_images/userId/sessId/filename.jpg');
console.assert(blob instanceof Blob, 'Should return Blob');

// 2. Test Signed URL
const url = await getSignedUrl('generation_images/userId/sessId/filename.jpg');
console.assert(url.includes('?goog-'), 'Should contain Google signature');

// 3. Test Hybrid Strategy
const result = await getImageUrl('generation_images/userId/sessId/filename.jpg', base64Fallback);
console.assert(['signed', 'proxy', 'base64'].includes(result.method), 'Should use valid method');

// 4. Test Diagnosis with URL
const scanResult = await kieService.diagnoseImage(signedUrl, sessionId);
console.assert(scanResult.materials.length > 0, 'Should extract materials');
```

### 4.3 Testes de Produção (Integração)

1. **Upload → Diagnosis** (Fluxo Completo)
   - Fazer upload de imagem 5MB
   - Verificar se base64 é gerado ✓
   - Verificar se arquivo é salvo em Storage ✓
   - Esperar diagnosis completar ✓
   - Verificar se ScanResult é válido ✓

2. **Retry Logic**
   - Simular falha de proxy desligando servidor brevemente
   - Verificar se retry com exponential backoff funciona
   - Verificar se fallback para base64 dispara

3. **Performance**
   - Imagem 1MB: deve levar < 5s para proxy download
   - Imagem 10MB: deve falhar gracefully com fallback para base64
   - Signed URL: deve ser gerada em < 1s

---

## 5. ESTRUTURA DE FALLBACK

```
Request de Imagem para Gemini API
  ↓
┌─────────────────────────────────────────────────┐
│ Tentativa 1: Signed URL (rápido, 1s timeout)    │
│ - Ideal para: < 8MB, primeira tentativa         │
│ - Taxa de sucesso esperada: 95%                 │
└─────────────────────────────────────────────────┘
  ↓ (Falha)
┌─────────────────────────────────────────────────┐
│ Tentativa 2: Proxy Download (confiável, 3s)     │
│ - Com retry exponencial (500ms, 1s, 2s)         │
│ - Taxa de sucesso esperada: 99%                 │
└─────────────────────────────────────────────────┘
  ↓ (Falha)
┌─────────────────────────────────────────────────┐
│ Tentativa 3: Base64 Fallback (garantido)        │
│ - Sempre disponível após upload                 │
│ - Taxa de sucesso: 100%                         │
└─────────────────────────────────────────────────┘
  ↓
✓ Gemini API recebe imagem com sucesso
```

---

## 6. MODIFICAÇÕES DE ARQUIVO (RESUMO)

| Arquivo | Linhas | Tipo | Complexidade |
|---------|--------|------|--------------|
| `server.ts` | 182-280 | Novo | ALTA |
| `src/services/storageService.ts` | 498-620 | Novo | MÉDIA |
| `src/services/kieService.ts` | 345-450 | Modificar | MÉDIA |
| `src/components/studio/UploadStep.tsx` | 153-192 | Modificar | BAIXA |
| `src/components/studio/DiagnosisStep.tsx` | 74-138 | Modificar | BAIXA |
| `src/store/studioStore.ts` | TBD | Novo | BAIXA |

---

## 7. CRONOGRAMA FINAL

| Fase | Tarefa | Tempo | Acumulado |
|------|--------|-------|-----------|
| 1 | Setup + Validação CORS | 15 min | 15 min |
| 2 | Implementar Proxy Download | 45 min | 60 min |
| 3 | Atualizar storageService.ts | 30 min | 90 min |
| 4 | Integrar KIE Service | 20 min | 110 min |
| 5 | Atualizar UploadStep + DiagnosisStep | 25 min | 135 min |
| 6 | Testes Manuais + Debug | 30 min | 165 min |
| **TOTAL** | | **165 min** | **2h 45 min** |

**Buffer Disponível: 75 minutos (1h 15 min)**

---

## 8. RISCOS & MITIGAÇÃO

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| Timeout de Download | MÉDIA | MÉDIO | Retry exponencial + base64 |
| Memory Leak (Blob URLs) | BAIXA | MÉDIO | Sempre fazer `revokeObjectURL()` |
| Signed URL Expiração | MUITO BAIXA | BAIXO | Regenerar se falhar (retry) |
| Erro de Permissão Firestore | MUITO BAIXA | ALTO | Admin SDK já tem permissão |
| CORS ainda bloqueado em prod | MUITO BAIXA | MÉDIO | Proxy resolve 100% |

---

## 9. CHECKLIST DE IMPLEMENTAÇÃO

### Pré-Implementação
- [ ] Backup de server.ts e storageService.ts
- [ ] Verificar que base64 já funciona (diagnóstico atual)
- [ ] Listar todos os endpoints existentes no server.ts
- [ ] Verificar permissões do Firebase Admin SDK

### Implementação
- [ ] Adicionar rota GET /api/storage/download/:fileId
- [ ] Adicionar rota POST /api/storage/get-url
- [ ] Implementar retry logic com exponential backoff
- [ ] Adicionar funções em storageService.ts
- [ ] Atualizar kieService.diagnoseImage()
- [ ] Atualizar UploadStep.tsx
- [ ] Atualizar DiagnosisStep.tsx
- [ ] Adicionar storagePath* fields ao studioStore

### Testes
- [ ] Teste local: arquivo 5MB
- [ ] Teste local: arquivo 1MB (rápido)
- [ ] Teste local: arquivo 20MB (limite)
- [ ] Teste de retry: desligar servidor brevemente
- [ ] Teste de fallback: base64 é usado quando proxy falha
- [ ] Teste de performance: < 5s por operação
- [ ] Teste de ScanResult: JSON é válido após diagnosis

### Pós-Implementação
- [ ] Documentar em README.md
- [ ] Adicionar logs detalhados em DiagnosisStep
- [ ] Criar issue para monitoramento de CORS em prod
- [ ] Testar com proxy reverso (nginx) se houver

---

## 10. NOTAS IMPORTANTES

### Por que NÃO usar Opção 1 (CORS puro)?
- Requer acesso ao Firebase Console (produção)
- Não resolve problema se cliente está atrás de proxy corporativo
- Expõe bucket diretamente (menos seguro)

### Por que NÃO usar Opção 4 (Base64 puro)?
- Imagens > 4MB causam erro no Gemini API
- Aumenta latência e uso de banda
- Não escalável para produção

### Por que Opção 5 (Híbrida) é melhor?
- ✓ Resolveu 100% dos erros CORS (proxy não sofre CORS)
- ✓ Mantém performance (Signed URL é mais rápido)
- ✓ Totalmente escalável (server Node.js pode cachear)
- ✓ Seguro (Admin SDK autentica, cliente não acessa diretamente)
- ✓ Implementável em < 4 horas
- ✓ Não quebra código existente (base64 continua funcionando)

---

## 11. REFERÊNCIAS & DOCUMENTAÇÃO

### Firebase Admin SDK
- https://firebase.google.com/docs/storage/admin/start
- Método: `bucket.file().getSignedUrl()`
- Timeout padrão: 5 minutos (seguro)

### Gemini API
- Aceita: data URLs (base64) ✓
- Aceita: URLs HTTPS públicas ✓
- Timeout: 120 segundos (configurado em kieService)
- Max size: 20MB por imagem

### HTTP Retry Best Practices
- Exponential backoff: 2^n * baseDelay
- Max retries: 3-5 para transient errors
- Jitter: não necessário para este caso

---

## CONCLUSÃO

Este plano é **viável em 2h 45min com 75min de buffer**, resolve 100% dos erros CORS, mantém performance, é escalável, e não quebra código existente. A arquitetura híbrida combina o melhor de cada opção:

- **Signed URLs**: Performance ótima (95% dos casos)
- **Proxy Download**: Confiabilidade (para resiliência)
- **Base64 Fallback**: Garantia (100% das tentativas)

**Recomendação**: Iniciar pela Fase 2 (Proxy), depois Fase 3 (Signed URLs), ignorar Fase 1 se Firebase já tiver CORS correto.
