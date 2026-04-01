# Code Snippets Prontos para Implementação

## 1. SERVER.TS - Adicionar Após Linha 181

Copie e cole DEPOIS da rota `/api/storage/upload`:

```typescript
  // NOVA ROTA: Firebase Storage Proxy Download (Resolve CORS)
  app.get("/api/storage/download/:fileId", async (req, res) => {
    const { fileId } = req.params;
    
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
        
        // Decode fileId back to path (se necessário)
        let filePath: string;
        try {
          filePath = Buffer.from(fileId, 'base64').toString('utf-8');
        } catch {
          filePath = fileId;
        }

        const file = bucket.file(filePath);
        
        // Check if file exists (com timeout)
        const [exists] = await Promise.race([
          file.exists(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('EXISTS_CHECK_TIMEOUT')), 5000)
          )
        ]) as any;

        if (!exists) {
          return res.status(404).json({ error: "File not found", filePath });
        }

        // Download file com timeout
        const [buffer] = await Promise.race([
          file.download(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DOWNLOAD_TIMEOUT')), 30000)
          )
        ]) as any;

        // Get metadata
        const [metadata] = await file.getMetadata().catch(() => [{}]);
        
        // Set CORS headers explicitamente
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
        res.setHeader('Access-Control-Max-Age', '3600');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', metadata.contentType || 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        
        console.log(`[Storage Proxy] Download success: ${filePath} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
        res.send(buffer);
        return;

      } catch (error: any) {
        lastError = error;
        console.error(`[Storage Proxy] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt - 1) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Todas as tentativas falharam
    console.error(`[Storage Proxy] All ${MAX_RETRIES} attempts failed for ${fileId}`);
    const errorMsg = lastError?.message || 'Download failed';
    res.status(500).json({ 
      error: "Failed to download file", 
      reason: errorMsg,
      attempts: MAX_RETRIES
    });
  });

  // NOVA ROTA: Generate Signed URLs
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
        expires: Date.now() + 1 * 60 * 60 * 1000,
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

## 2. SRC/SERVICES/STORAGESERVICE.TS - Adicionar Ao Final

Copie e cole ao final do arquivo (antes de `export const uploadBase64ViaProxy`):

```typescript
/**
 * NOVO: Download de arquivo via proxy com retry automático
 * Resolve CORS completamente
 */
export const downloadViaProxy = async (
  filePath: string, 
  maxRetries: number = 3
): Promise<Blob> => {
  // Encode filePath como fileId
  const fileId = Buffer.from(filePath).toString('base64');
  
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
 * Para uso direto em Gemini API
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
 */
export const getImageUrl = async (
  filePath: string,
  base64Fallback?: string
): Promise<{ url: string; method: 'signed' | 'proxy' | 'base64' }> => {
  // Método 1: Tentativa com Signed URL
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

  // Método 3: Fallback final
  if (base64Fallback) {
    console.log('[Client] Using base64 fallback');
    return { url: base64Fallback, method: 'base64' };
  }

  throw new Error('IMAGE_URL_UNAVAILABLE: All methods failed');
};
```

---

## 3. ACTUALIZAR UPLOADIMAGE (STORAGESERVICE.TS)

ENCONTRE esta função (ao redor de linha 346):

```typescript
export const uploadImage = async (
  file: File, 
  validationResult: ValidationChainResult,
  base64Image?: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> => {
```

MODIFIQUE o retorno para incluir caminhos de arquivo:

```typescript
export const uploadImage = async (
  file: File, 
  validationResult: ValidationChainResult,
  base64Image?: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult & { storagePathOriginal: string; storagePathCompressed: string }> => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  const userId = auth.currentUser.uid;
  const sessionId = `sess_${Date.now()}`;
  const sha256 = validationResult.fileHash!;
  const dimensions = validationResult.dimensions!;

  // Store paths for later use
  const filename = `${sha256}.${file.name.split('.').pop()}`;
  const storagePath = `generation_images/${userId}/${sessionId}/${filename}`;
  const compressedPath = `generation_images/${userId}/${sessionId}/preview_${filename}`;

  // Return immediately with a temporary result to allow UI to proceed
  const backgroundUpload = async () => {
    try {
      console.log('[Background] Starting upload process...');
      
      // ... resto do código (manter igual) ...
      
      console.log('[Background] Upload and metadata saved successfully');
    } catch (err) {
      console.error('[Background] Upload failed:', err);
    }
  };

  backgroundUpload();

  // Return imediatamente COM caminhos
  return {
    sessionId,
    imageOriginalUrl: '',
    imageCompressedUrl: '',
    storagePathOriginal: storagePath,  // NOVO
    storagePathCompressed: compressedPath,  // NOVO
    metadata: {
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: file.size,
      format: file.type.split('/')[1],
      sha256,
      exif: validationResult.exif
    }
  };
};
```

---

## 4. ACTUALIZAR ZUSTAND STORE (src/store/studioStore.ts)

ENCONTRE a interface do estado e ADICIONE:

```typescript
export const useStudioStore = create<StudioStore>((set) => ({
  // ... existing state ...
  
  // NOVO: Storage paths para acesso direto
  storagePathOriginal: '',
  storagePathCompressed: '',
  
  setStoragePaths: (original: string, compressed: string) => 
    set({ storagePathOriginal: original, storagePathCompressed: compressed }),
}));
```

---

## 5. ATUALIZAR UPLOADSTEP.TSX

ENCONTRE esta linha (ao redor de 179):

```typescript
const result = await uploadImage(file, validationResult, base64);
```

MODIFIQUE PARA:

```typescript
const result = await uploadImage(file, validationResult, base64);

// NOVO: Armazenar caminhos
useStudioStore.setState({
  storagePathOriginal: result.storagePathOriginal,
  storagePathCompressed: result.storagePathCompressed
});
```

---

## 6. ATUALIZAR DIAGNOSISSTEP.TSX

ENCONTRE a função `runAnalysis` (ao redor de linha 74):

MODIFIQUE O INÍCIO ASSIM:

```typescript
const runAnalysis = async () => {
  if (analysisStartedRef.current && status === 'success') return;
  
  let imageToAnalyze = base64Image;
  
  // NOVO: Tentar usar URL assinada
  const { storagePathOriginal } = useStudioStore.getState();
  if (storagePathOriginal && !imageToAnalyze?.startsWith('http')) {
    try {
      console.log('[Diagnosis] Tentando obter URL assinada...');
      const { url } = await getImageUrl(storagePathOriginal, base64Image);
      console.log(`[Diagnosis] Usando ${url.startsWith('http') ? 'signed/proxy URL' : 'base64'}`);
      imageToAnalyze = url;
    } catch (error) {
      console.warn('[Diagnosis] Falha ao obter URL, usando base64:', error);
      imageToAnalyze = base64Image;
    }
  }
  
  if (!imageToAnalyze || !sessionId) {
    console.warn('Missing image data or sessionId for analysis');
    if (!base64Image && image) {
      setError('Aguardando processamento da imagem...');
    }
    return;
  }
  
  // ... resto do código (manter igual) ...
};
```

NÃO ESQUEÇA DE IMPORTAR NO TOPO DO ARQUIVO:

```typescript
import { getImageUrl } from '../../services/storageService';
```

---

## 7. ATUALIZAR KIESERVICE.TS - FUNÇÃO diagnoseImage

ENCONTRE esta linha (ao redor de 354):

```typescript
let formattedImage = imageBase64;
if (!formattedImage.startsWith('data:')) {
  formattedImage = `data:image/jpeg;base64,${formattedImage}`;
}
```

MODIFIQUE PARA ACEITAR URLs:

```typescript
// Aceitar tanto base64 quanto URLs
let formattedImage = imageBase64;
let imageType: 'data_url' | 'http_url' = 'data_url';

if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
  // É uma URL (signed ou proxy)
  formattedImage = imageBase64;
  imageType = 'http_url';
  console.log('[KIE] Using HTTP URL for diagnosis');
} else if (!imageBase64.startsWith('data:')) {
  // É base64 sem data URL header
  formattedImage = `data:image/jpeg;base64,${imageBase64}`;
  console.log('[KIE] Using base64 data URL for diagnosis');
} else {
  console.log('[KIE] Using existing data URL for diagnosis');
}
```

---

## 8. TESTES RÁPIDOS - COPIAR PARA CONSOLE

Teste no navegador (F12 → Console) APÓS implementação:

```javascript
// Test 1: Proxy Download
(async () => {
  try {
    const blob = await fetch('/api/storage/download/Z2VuZXJhdGlvbl9pbWFnZXMvdXNlcklkL3Nlc3NJZC9maWxlLmpwZw==').then(r => r.blob());
    console.log('✓ Proxy works:', blob.size, 'bytes');
  } catch (e) {
    console.log('✗ Proxy failed:', e.message);
  }
})();

// Test 2: Signed URL
(async () => {
  try {
    const res = await fetch('/api/storage/get-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: 'generation_images/userId/sessId/file.jpg' })
    }).then(r => r.json());
    console.log('✓ Signed URL works:', res.url.substring(0, 50) + '...');
  } catch (e) {
    console.log('✗ Signed URL failed:', e.message);
  }
})();
```

---

## 9. CHECKLIST DE COLAGEM

- [ ] Copiei server.ts routes (2 rotas novas)
- [ ] Copiei storageService.ts functions (3 funções novas)
- [ ] Modifiquei uploadImage() return type
- [ ] Atualizei studioStore.ts state
- [ ] Atualizei UploadStep.tsx para usar setStoragePaths()
- [ ] Atualizei DiagnosisStep.tsx para usar getImageUrl()
- [ ] Atualizei kieService.diagnoseImage() para aceitar URLs
- [ ] Testei no console
- [ ] Nenhum erro TypeScript (npm run lint)
- [ ] Testei fluxo completo (upload → diagnosis)

---

## 10. DEBUGGING

Se algo não funcionar:

```javascript
// Ver logs detalhados
localStorage.setItem('debug', '*'); // Habilita todos os logs

// Verificar se proxy está respondendo
fetch('/api/storage/download/test').then(r => r.text()).then(console.log);

// Verificar se signed URL é gerado
fetch('/api/storage/get-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filePath: 'test' })
}).then(r => r.json()).then(console.log);

// Ver erro específico em DiagnosisStep
useStudioStore.getState().scanErrors // Mostra erros do Gemini
```

---

## ORDEM RECOMENDADA

1. **Primeiro**: Adicionar rotas em `server.ts` ✓
2. **Segundo**: Adicionar funções em `storageService.ts` ✓
3. **Terceiro**: Atualizar imports e uso em componentes ✓
4. **Quarto**: Testar no navegador ✓
5. **Quinto**: Debug se necessário ✓

**Tempo total**: 30-45 minutos de copiar-colar + 20-30 minutos de testes.
