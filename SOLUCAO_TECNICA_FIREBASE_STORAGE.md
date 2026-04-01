# Solução Técnica: Implementar Signed URLs para Firebase Storage

## Problema Raiz

O Firebase Storage CLI gera URLs públicas **sem tokens de acesso**. Quando o browser tenta acessar estas URLs:

1. Se o bucket tem **Storage Rules restritivas** (padrão): Falha "Permission Denied"
2. Se o bucket é **público mas sem CORS**: Falha "CORS preflight failed"
3. **A mesma URL funciona no servidor Gemini** porque está fora do browser e pode usar Firebase Admin SDK

---

## Solução: Signed URLs

### Como Funciona

1. **Servidor backend** (que tem Firebase Admin credentials):
   - Gera URL assinada (contém credenciais criptografadas)
   - URL válida por 7 dias (configurável)
   - Não requer autenticação adicional do client

2. **Cliente** (browser):
   - Recebe URL assinada do servidor
   - Pode acessar diretamente sem CORS (credenciais inclusos)
   - Pode enviar para Gemini API

3. **Gemini API**:
   - Recebe URL assinada
   - Acessa direto do Google Cloud (mesmo region, sem CORS)
   - Processa imagem normalmente

---

## Implementação

### Passo 1: Adicionar Endpoint Signed URL em server.ts

```typescript
// server.ts - adicionar após o endpoint /api/storage/upload (linha 181)

/**
 * Generate a signed URL for reading a file from Firebase Storage
 * Signed URLs bypass CORS and don't require client authentication
 */
app.post("/api/storage/signed-url", async (req, res) => {
  const { path } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: "Missing path parameter" });
  }

  try {
    console.log(`[Storage Signed URL] Generating for path: ${path}`);
    
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    
    // Generate signed URL valid for 7 days
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    console.log("[Storage Signed URL] Success");
    res.json({ url: signedUrl });
  } catch (error: any) {
    console.error("[Storage Signed URL] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
```

### Passo 2: Atualizar storageService.ts

Adicionar função para obter signed URL:

```typescript
// storageService.ts - adicionar após uploadBase64ViaProxy (linha 497)

/**
 * Get a signed URL for a file in Firebase Storage
 * Signed URLs include authentication credentials and bypass CORS
 */
export const getSignedUrl = async (path: string): Promise<string> => {
  try {
    const response = await axios.post('/api/storage/signed-url', { path });
    if (response.data.url) {
      return response.data.url;
    }
    throw new Error('No signed URL returned');
  } catch (error: any) {
    console.error('Get Signed URL Error:', error.response?.data || error.message);
    throw new Error(`GET_SIGNED_URL_FAILED: ${error.message}`);
  }
};

/**
 * Upload image and return signed URL (not public URL)
 * This ensures the URL works across all clients and APIs
 */
export const uploadTempImageWithSignedUrl = async (file: File | Blob, userId: string): Promise<{ path: string; url: string }> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file instanceof File ? file.name.split('.').pop() : 'jpg';
  const filename = `${timestamp}-${random}.${ext}`;
  const path = `input-images/${userId}/kie-temp/${filename}`;
  const storageRef = ref(storage, path);
  
  // Upload file
  await uploadBytes(storageRef, file);
  
  // Get signed URL instead of public URL
  const signedUrl = await getSignedUrl(path);
  
  return { path, url: signedUrl };
};

/**
 * Update the background upload in uploadImage to use signed URLs
 */
export const uploadImageWithSignedUrl = async (
  file: File, 
  validationResult: ValidationChainResult,
  base64Image?: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  const userId = auth.currentUser.uid;
  const sessionId = `sess_${Date.now()}`;
  const sha256 = validationResult.fileHash!;
  const dimensions = validationResult.dimensions!;

  const backgroundUpload = async () => {
    try {
      console.log('[Background] Starting upload process...');
      
      // 1. Handle HEIC/TIFF
      let processedFile = file;
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.tiff')) {
        const blob = await heic2any({ blob: file, toType: 'image/jpeg' });
        processedFile = new File([blob as Blob], file.name.replace(/\.(heic|tiff)$/i, '.jpg'), { type: 'image/jpeg' });
      }

      const isAdminEmail = auth.currentUser?.email === 'paulosilvatomazeto@gmail.com';
      
      // Update Quota
      if (!isAdminEmail) {
        const today = new Date().toISOString().split('T')[0];
        const quotaRef = doc(db, 'user_upload_quota', userId);
        const quotaSnap = await getDoc(quotaRef);
        if (quotaSnap.exists() && quotaSnap.data().periodStart === today) {
          await updateDoc(quotaRef, { dailyUploadsCount: increment(1) });
        } else {
          await setDoc(quotaRef, { 
            userId, 
            dailyUploadsCount: 1, 
            dailyLimit: 0, 
            periodStart: today,
            periodEnd: today
          });
        }
      }

      const compressedBlob = await compressImage(processedFile);
      const filename = `${sha256}.${processedFile.name.split('.').pop()}`;
      const storagePath = `generation_images/${userId}/${sessionId}/${filename}`;
      const storageRef = ref(storage, storagePath);
      const compressedPath = `generation_images/${userId}/${sessionId}/preview_${filename}`;
      const compressedRef = ref(storage, compressedPath);
      
      // Perform uploads
      const [originalResult, compressedResult] = await Promise.all([
        uploadBytes(storageRef, processedFile),
        uploadBytes(compressedRef, compressedBlob)
      ]);

      // Get signed URLs instead of public URLs
      const [originalUrl, compressedUrl] = await Promise.all([
        getSignedUrl(storagePath),
        getSignedUrl(compressedPath)
      ]);

      // Save metadata
      const uploadId = `up_${Date.now()}`;
      const validationId = `val_${Date.now()}`;

      await Promise.all([
        setDoc(doc(db, 'file_deduplication_index', sha256), {
          fileHash: sha256,
          userId,
          originalStoragePath: storagePath,
          createdAt: new Date().toISOString(),
          reuseCount: 0
        }),
        setDoc(doc(db, 'image_uploads', uploadId), {
          id: uploadId,
          userId,
          originalFilename: file.name,
          fileSize: processedFile.size,
          fileType: processedFile.type.split('/')[1],
          mimeType: processedFile.type,
          dimensions,
          uploadTimestamp: new Date().toISOString(),
          storagePath,
          sha256,
          imageOriginalUrl: originalUrl,
          imageCompressedUrl: compressedUrl,
          exif: validationResult.exif
        }),
        setDoc(doc(db, 'generation_sessions', sessionId), {
          id: sessionId,
          userId,
          imageOriginalUrl: originalUrl,
          imageCompressedUrl: compressedUrl,
          imageMetadata: dimensions,
          base64Image: base64Image || null,
          createdAt: new Date().toISOString(),
          scanStatus: 'pending'
        }, { merge: true }),
        setDoc(doc(db, 'file_validation_results', validationId), {
          id: validationId,
          userId,
          fileHash: sha256,
          validationTimestamp: new Date().toISOString(),
          validationSteps: validationResult.steps,
          validationPassed: validationResult.allValid,
          validationErrors: validationResult.steps.filter(s => !s.valid).map(s => s.error)
        })
      ]);

      console.log('[Background] Upload and metadata saved successfully');
    } catch (err) {
      console.error('[Background] Upload failed:', err);
    }
  };

  // Trigger background upload without awaiting
  backgroundUpload();

  // Return immediately with session info
  return {
    sessionId,
    imageOriginalUrl: '', // Will be updated in DB later
    imageCompressedUrl: '',
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

### Passo 3: Criar Storage Rules Explícito

Criar novo arquivo `/storage.rules`:

```firestore
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to read their own input images
    match /input-images/{userId}/{allPaths=**} {
      allow read: if request.auth.uid == userId || 
                     request.auth.token.email == "paulosilvatomazeto@gmail.com";
      allow write: if request.auth.uid == userId || 
                      request.auth.token.email == "paulosilvatomazeto@gmail.com";
    }
    
    // Allow authenticated users to read/write generation results
    match /generation_images/{userId}/{allPaths=**} {
      allow read: if request.auth.uid == userId || 
                     request.auth.token.email == "paulosilvatomazeto@gmail.com";
      allow write: if request.auth.uid == userId || 
                      request.auth.token.email == "paulosilvatomazeto@gmail.com";
    }
    
    // Allow any authenticated user to use temp storage (short-lived)
    match /temp_generation/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Admin override (will be handled by Firebase Admin SDK server-side)
    match /{allPaths=**} {
      allow read, write: if false; // Default deny, rules above take precedence
    }
  }
}
```

Depois, deploy no Firebase Console:
```bash
firebase deploy --only storage
```

---

## Fluxo Resultante

### Antes (Problema)

```
Browser                     Firebase Storage              Gemini API
  |                               |                           |
  |--Upload file-->|             |                           |
  |                |--Save-->OK   |                           |
  |<--Public URL---|             |                           |
  |                               |                           |
  |--Try GET http://...---> CORS/PERMISSION FAILED            |
  |                               |                           |
  |                               |  getDownloadURL()         |
  |--Send URL to Gemini--------->|                           |
                                  |--Use Firebase Admin-->|   |
                                  |                      |--Access OK-|
```

### Depois (Solução)

```
Browser                 Backend Server            Firebase Storage        Gemini API
  |                          |                          |                    |
  |--Upload file-->|         |                          |                    |
  |                |-----Upload--->|                    |                    |
  |                |                |--Save-->OK         |                    |
  |                |<--Storage Path--|                   |                    |
  |                |                                     |                    |
  |--Request-->|   |--Generate Signed URL-->|           |                    |
  | Signed URL |<--|<--Signed URL + Creds--|           |                    |
  |                                                      |                    |
  |--Access with Signed URL-->|  (Credentials embedded) |                    |
  |                            |--OK-->Content           |                    |
  |<--Content---------<--------|                        |                    |
  |                                                      |                    |
  |--Send Signed URL to Gemini------>|                 |                    |
  |                                   |--Access with Creds-->|              |
  |                                   |                      |--Process OK-|
  |                                   |<--Result------------|              |
```

---

## Vantagens desta Solução

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **CORS Headers** | Dependente da config bucket | Não necessário (creds inclusos) |
| **Expiração** | URLs permanentes | 7 dias (configurável) |
| **Segurança** | URLs públicas visíveis | Credenciais criptografadas em URL |
| **Gemini** | Função, mas pode falhar | Sempre funciona |
| **Client Auth** | Requer SDK Firebase | Não necessário |
| **Performance** | Cache indefinido | Cache 7 dias |

---

## Testing

### 1. Verificar se endpoint funciona

```bash
curl -X POST http://localhost:3000/api/storage/signed-url \
  -H "Content-Type: application/json" \
  -d '{"path": "input-images/user123/kie-temp/test.jpg"}'
```

Esperado:
```json
{
  "url": "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0425317525.firebasestorage.app/o/input-images%2F...?GoogleAccessId=...&Signature=...&Expires=..."
}
```

### 2. Verificar se Gemini consegue acessar

```javascript
const signedUrl = "https://firebasestorage.googleapis.com/...";
const response = await axios.post('/api/kie/gemini', {
  model: 'gemini-3.1-pro',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this image' },
        { type: 'image_url', image_url: { url: signedUrl } }
      ]
    }
  ]
});
```

### 3. Verificar se browser consegue acessar

```javascript
const signedUrl = await getSignedUrl('input-images/user123/test.jpg');
const img = new Image();
img.src = signedUrl; // Deve carregar sem CORS error
```

---

## Rollback

Se houver problema, reverter para URLs públicas é simples:

```typescript
// storageService.ts - volta ao original
const url = await getDownloadURL(storageRef);
```

---

## Próximas Otimizações

1. **Cache URLs assinadas**: Gerar uma por arquivo, reusar por 7 dias
2. **Batch endpoint**: Gerar múltiplas URLs em uma request
3. **Custom expiration**: Permitir expiration customizada por arquivo
4. **Metrics**: Rastrear uso de signed URLs

---

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| "Missing or insufficient permissions" | Storage rules muito restritivos | Verificar `storage.rules` e redeploy |
| "Signed URL invalid or expired" | URL gerada 7+ dias atrás | Gerar nova URL |
| "404 File not found" | Path incorreto | Verificar path usado em `getSignedUrl()` |
| "CORS error com Signed URL" | Não deveria ocorrer | Verificar se URL foi enviada inteiro |

