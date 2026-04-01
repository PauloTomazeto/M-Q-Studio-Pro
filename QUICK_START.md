# ⚡ Quick Start: Implementação Signed URLs

**Tempo total: 1-2 horas**

---

## TL;DR (Too Long; Didn't Read)

### O Problema
URLs do Firebase Storage **sem credenciais** → Browser falha CORS/Permission

### A Solução
URLs **com credenciais incorporadas** → Browser consegue acessar

### O Que Fazer
1. Adicionar endpoint `/api/storage/signed-url` em `server.ts` (40 linhas)
2. Adicionar função `getSignedUrl()` em `storageService.ts` (60 linhas)
3. Criar arquivo `storage.rules` (25 linhas)
4. Deploy `storage.rules` no Firebase Console

---

## Passo 1: Adicionar Endpoint em server.ts (20 min)

**Localização:** Após a linha 181 (fim do `/api/storage/upload`)

**Código:**
```typescript
/**
 * Generate a signed URL for reading a file from Firebase Storage
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

**Teste:**
```bash
curl -X POST http://localhost:3000/api/storage/signed-url \
  -H "Content-Type: application/json" \
  -d '{"path":"input-images/test-user/test.jpg"}'
```

Esperado: JSON com URL começando por `https://firebasestorage.googleapis.com/...?GoogleAccessId=...`

---

## Passo 2: Adicionar Funções em storageService.ts (20 min)

**Localização:** Após a linha 497 (fim da função `uploadBase64ViaProxy`)

**Código:**
```typescript
/**
 * Get a signed URL for a file in Firebase Storage
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
 * Upload image and return signed URL
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
  
  // Get signed URL
  const signedUrl = await getSignedUrl(path);
  
  return { path, url: signedUrl };
};
```

**Teste Local:**
```javascript
// No console do browser
const signedUrl = await getSignedUrl('input-images/user123/test.jpg');
console.log('Signed URL:', signedUrl);
// Esperado: URL com GoogleAccessId, Signature, Expires
```

---

## Passo 3: Criar storage.rules (10 min)

**Criar novo arquivo:** `/storage.rules`

**Conteúdo:**
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
    
    // Allow any authenticated user to use temp storage
    match /temp_generation/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Passo 4: Deploy storage.rules (5 min)

**Command:**
```bash
firebase deploy --only storage
```

**Esperado:**
```
...
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/...
```

---

## Validação Rápida (15 min)

### Test 1: Endpoint Responde
```bash
curl http://localhost:3000/api/storage/signed-url
# Esperado: {"error":"Missing path parameter"}
```

### Test 2: Signed URL Gerado
```bash
curl -X POST http://localhost:3000/api/storage/signed-url \
  -H "Content-Type: application/json" \
  -d '{"path":"temp_generation/test.jpg"}'
# Esperado: {"url":"https://firebasestorage.googleapis.com/...?GoogleAccessId=..."}
```

### Test 3: Browser Consegue Acessar
```javascript
// No console do browser, após upload
const signedUrl = await getSignedUrl('input-images/currentUser/file.jpg');
const img = new Image();
img.src = signedUrl;
img.onload = () => console.log('✅ OK');
img.onerror = () => console.log('❌ FALHA');
document.body.appendChild(img);
```

### Test 4: Gemini Consegue Acessar
```javascript
// Verificar logs do /api/kie/gemini
// Esperado: "KIE Gemini API responded successfully"
```

---

## Checklist Final

```
✅ server.ts: endpoint adicionado
✅ storageService.ts: funções adicionadas
✅ storage.rules: arquivo criado
✅ Firebase CLI: deploy executado
✅ Endpoint: respondendo corretamente
✅ Signed URL: sendo gerado
✅ Browser: consegue acessar imagem
✅ Gemini: consegue processar imagem
```

---

## Se Algo Deu Errado

### Erro: "Missing or insufficient permissions"
```
Causa: storage.rules não foi deployado
Solução: firebase deploy --only storage
```

### Erro: "404 File not found"
```
Causa: path incorreto
Solução: Verificar path usado em getSignedUrl(path)
```

### Erro: "CORS error"
```
Causa: Ainda usando getDownloadURL() em vez de getSignedUrl()
Solução: Usar uploadTempImageWithSignedUrl() em vez de uploadTempImage()
```

### Erro: "Signed URL invalid or expired"
```
Causa: URL gerada há mais de 7 dias
Solução: Regenerar URL (não deve ocorrer em produção)
```

---

## Próximo Passo

Ver documentação completa em `LEIA_PRIMEIRO.md` para entender o contexto completo.

---

**Status:** ✅ Pronto para implementar  
**Tempo:** 1-2 horas  
**Complexidade:** Baixa  
**Risco:** Muito baixo

