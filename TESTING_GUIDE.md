# Guia de Testes Completo - CORS/Firebase Resolution

## 1. PRÉ-REQUISITOS

```bash
# Verificar que servidor está rodando
npm run dev
# Esperado: "Server running on http://localhost:3000"

# Verificar que dependências estão instaladas
npm list firebase firebase-admin axios
# Esperado: Todas as versões instaladas
```

---

## 2. TESTES UNITÁRIOS (Server-Side)

### 2.1 Teste de Rota de Download

**Arquivo**: `test_proxy_download.ts` (criar na raiz)

```typescript
import axios from 'axios';

const testProxyDownload = async () => {
  console.log('=== TEST: Proxy Download ===\n');
  
  const BASE_URL = 'http://localhost:3000';
  const fileId = Buffer.from('generation_images/test/sample.jpg').toString('base64');
  
  try {
    console.log(`Testing: GET /api/storage/download/${fileId}`);
    
    const response = await axios.get(
      `${BASE_URL}/api/storage/download/${fileId}`,
      { responseType: 'blob' }
    );
    
    console.log('✓ Status:', response.status);
    console.log('✓ Content-Type:', response.headers['content-type']);
    console.log('✓ Size:', `${(response.data.size / 1024).toFixed(2)}KB`);
    console.log('✓ CORS Header:', response.headers['access-control-allow-origin']);
    
    return true;
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    return false;
  }
};

testProxyDownload().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Executar**:
```bash
npx tsx test_proxy_download.ts
# Esperado output:
# ✓ Status: 200
# ✓ Content-Type: image/jpeg
# ✓ Size: XXX.XXKB
# ✓ CORS Header: *
```

---

### 2.2 Teste de Signed URL

**Arquivo**: `test_signed_url.ts` (criar na raiz)

```typescript
import axios from 'axios';

const testSignedUrl = async () => {
  console.log('=== TEST: Signed URL Generation ===\n');
  
  const BASE_URL = 'http://localhost:3000';
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/storage/get-url`,
      { filePath: 'generation_images/test/sample.jpg' }
    );
    
    console.log('✓ Status:', response.status);
    console.log('✓ URL Generated:', response.data.url.substring(0, 80) + '...');
    console.log('✓ Has Signature:', response.data.url.includes('goog-'));
    console.log('✓ Has Expiration:', response.data.url.includes('X-Goog-Expires'));
    
    // Try to fetch the signed URL
    console.log('\nTesting if signed URL is accessible...');
    const imgResponse = await axios.get(response.data.url, { 
      responseType: 'blob',
      timeout: 5000 
    });
    
    console.log('✓ Signed URL Accessible:', `${(imgResponse.data.size / 1024).toFixed(2)}KB`);
    
    return true;
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
};

testSignedUrl().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Executar**:
```bash
npx tsx test_signed_url.ts
# Esperado output:
# ✓ Status: 200
# ✓ URL Generated: https://storage.googleapis.com/...
# ✓ Has Signature: true
# ✓ Has Expiration: true
# ✓ Signed URL Accessible: XXX.XXKB
```

---

## 3. TESTES MANUAIS (Browser Console)

### 3.1 Verificar API Endpoints

```javascript
// Test 1: Proxy Download is available
console.log('TEST 1: Proxy Download Endpoint');
fetch('/api/storage/download/test123')
  .then(r => ({status: r.status, headers: Object.fromEntries(r.headers)}))
  .then(data => console.log('✓ Response:', data))
  .catch(e => console.log('✗ Error:', e.message));

// Test 2: Signed URL endpoint is available
console.log('\nTEST 2: Signed URL Endpoint');
fetch('/api/storage/get-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filePath: 'test' })
})
  .then(r => r.json())
  .then(data => console.log('✓ Response:', data))
  .catch(e => console.log('✗ Error:', e.message));
```

### 3.2 Verificar Client Functions

```javascript
// Test 3: downloadViaProxy function exists
console.log('\nTEST 3: Download Via Proxy Function');
console.log('Function exists:', typeof window.downloadViaProxy === 'function' ? '✓' : '✗');

// Test 4: getSignedUrl function exists
console.log('\nTEST 4: Get Signed URL Function');
console.log('Function exists:', typeof window.getSignedUrl === 'function' ? '✓' : '✗');

// Test 5: getImageUrl function exists
console.log('\nTEST 5: Get Image URL Function');
console.log('Function exists:', typeof window.getImageUrl === 'function' ? '✓' : '✗');
```

**Note**: Essas funções podem não estar expostas globalmente. Use:

```javascript
// Alternativa: verificar em Network tab do DevTools
// 1. Abra DevTools (F12)
// 2. Vá para "Network"
// 3. Faça upload de imagem
// 4. Procure por requisições para "/api/storage/"
```

---

## 4. TESTES DE INTEGRAÇÃO (UI)

### 4.1 Teste Fluxo Completo: Upload → Diagnosis

**Passo a Passo**:

1. **Preparação**
   ```
   - Abrir http://localhost:3000
   - Fazer login (se necessário)
   - Navegar para Studio
   - Abrir DevTools (F12) → Console
   ```

2. **Upload de Imagem**
   ```
   - Arrastar imagem de teste (5-10MB, arquitetura)
   - Aguardar validação
   - Clicar "Iniciar Transformação"
   ```

3. **Verificar Logs**
   ```javascript
   // Esperado nos logs:
   [Storage Proxy] Uploading to: temp_gen
   [Storage Proxy] Upload Success: https://storage.googleapis.com/...
   [Background] Starting upload process...
   [Background] Upload and metadata saved successfully
   ```

4. **Diagnosis**
   ```
   - Aguardar diagnóstico (deve levar < 45s)
   - Verificar logs:
   ```
   
   ```javascript
   // Esperado:
   [Diagnosis] Tentando obter URL assinada...
   [Diagnosis] Usando signed/proxy URL (ou base64)
   [KIE] Using HTTP URL for diagnosis (ou base64)
   Starting diagnosis for session: sess_...
   KIE Gemini API responded successfully
   Diagnosis completed in XXXXms
   ```

5. **Resultado**
   ```
   - Deve exibir "Diagnóstico Concluído"
   - Materiais, iluminação, câmera detectados
   - Confidência > 0%
   ```

### 4.2 Teste de Fallback: Quando Signed URL Falha

**Simular Falha**:

```javascript
// No Console, execute:
// Desabilitar rotas de signed URL
fetch('/api/storage/get-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filePath: 'invalid/path' })
}).then(r => r.json()).then(console.log);
// Esperado: erro 500
```

**Resultado Esperado**:
- Diagnosis continua funcionando (usando base64 fallback)
- Mensagem no console: `[Diagnosis] Falha ao obter URL, usando base64`
- Resultado final é idêntico

### 4.3 Teste de Retry: Quando Proxy Falha

**Simular Falha Transitória** (difícil sem desligar servidor):

```bash
# Terminal 1: Para o servidor
# Ctrl+C no npm run dev

# Terminal 2: No Console, inicie upload
# Resultado: "Failed after 3 attempts"

# Terminal 1: Reinicie servidor
# npm run dev

# Terminal 2: Retry automático deve tentar novamente
```

**Esperado**: Exponential backoff:
- Tentativa 1: erro imediato
- Tentativa 2: erro depois de 500ms
- Tentativa 3: erro depois de 1000ms
- Fallback para base64 (sucesso)

---

## 5. TESTES DE PERFORMANCE

### 5.1 Comparar Métodos de Acesso

**Script de Teste**:

```javascript
// Cole no Console enquanto desenvolvimento

const testPerformance = async () => {
  console.log('=== PERFORMANCE TEST ===\n');
  
  const filePath = 'generation_images/userId/sessionId/file.jpg';
  
  // Test 1: Signed URL
  console.time('Signed URL');
  try {
    const res = await fetch('/api/storage/get-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    console.timeEnd('Signed URL');
    console.log('✓ Signed URL method:', res.ok ? 'SUCCESS' : 'FAILED');
  } catch (e) {
    console.timeEnd('Signed URL');
    console.log('✗ Signed URL method: ERROR');
  }
  
  // Test 2: Proxy Download
  console.time('Proxy Download');
  try {
    const fileId = btoa(filePath);
    const res = await fetch(`/api/storage/download/${fileId}`);
    console.timeEnd('Proxy Download');
    console.log('✓ Proxy method:', res.ok ? 'SUCCESS' : 'FAILED');
  } catch (e) {
    console.timeEnd('Proxy Download');
    console.log('✗ Proxy method: ERROR');
  }
};

testPerformance();
// Esperado:
// Signed URL: ~200-500ms
// Proxy Download: ~500-2000ms
```

### 5.2 Medir Tamanho de Transfer

```javascript
// Abrir DevTools → Network
// Fazer upload de imagem
// Filtrar por "api/storage"

// Observações esperadas:
// POST /api/storage/upload: 10-20MB (depende do arquivo)
// POST /api/storage/get-url: < 5KB
// GET /api/storage/download/...: 1-5MB (imagem comprimida)

// Verificar: Se tamanho é OK para Gemini API (max 20MB)
```

---

## 6. TESTES DE SEGURANÇA

### 6.1 Validação de Path Traversal

```javascript
// TEST: Tentar acessar arquivos fora da pasta esperada
const maliciousPaths = [
  '../../../etc/passwd',
  '../../firebase-credentials.json',
  'generation_images/../../sensitive.txt',
];

maliciousPaths.forEach(path => {
  const fileId = btoa(path);
  fetch(`/api/storage/download/${fileId}`)
    .then(r => {
      console.log(`${path}: ${r.status} - ${r.ok ? '✗ VULNERABLE' : '✓ SAFE'}`);
    })
    .catch(e => console.log(`${path}: ✓ SAFE (error: ${e.message})`));
});

// Esperado: Todos retornam 404 ou erro
```

### 6.2 Validação de CORS

```javascript
// TEST: Verificar headers CORS
fetch('/api/storage/download/test', {
  method: 'GET'
}).then(r => {
  const cors = r.headers.get('access-control-allow-origin');
  const methods = r.headers.get('access-control-allow-methods');
  const headers = r.headers.get('access-control-allow-headers');
  
  console.log('CORS Headers:');
  console.log('Allow Origin:', cors ? `✓ ${cors}` : '✗ Missing');
  console.log('Allow Methods:', methods ? `✓ ${methods}` : '✗ Missing');
  console.log('Allow Headers:', headers ? `✓ ${headers}` : '✗ Missing');
});

// Esperado:
// Allow Origin: ✓ *
// Allow Methods: ✓ GET, HEAD, OPTIONS
// Allow Headers: ✓ Content-Type, Range
```

---

## 7. TESTES DE COMPATIBILIDADE

### 7.1 Testar com Diferentes Tamanhos de Imagem

```javascript
// Criar imagens de teste de vários tamanhos
const imageSizes = [
  { name: '1MB', multiplier: 1 },
  { name: '5MB', multiplier: 5 },
  { name: '10MB', multiplier: 10 },
  { name: '20MB (max)', multiplier: 20 },
];

// Para cada tamanho:
// 1. Criar canvas de teste
// 2. Fazer upload
// 3. Executar diagnosis
// 4. Verificar sucesso/falha

const createTestImage = async (sizeInMB) => {
  const canvas = document.createElement('canvas');
  canvas.width = 4000;
  canvas.height = 3000;
  const ctx = canvas.getContext('2d');
  
  // Desenhar padrão
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', 0.5);
  });
};
```

### 7.2 Testar com Diferentes Formatos

```javascript
// Testar: JPEG, PNG, WebP, HEIC (se suportado)
const formats = [
  'image/jpeg',
  'image/png',
  'image/webp',
  // 'image/heic', // Pode não ser suportado no servidor
];

formats.forEach(async (format) => {
  console.log(`Testing format: ${format}`);
  // Converter canvas para formato
  // Fazer upload
  // Verificar resultado
});
```

---

## 8. CHECKLIST FINAL DE TESTES

### Antes de Merge para Main

- [ ] **Server Routes**
  - [ ] GET /api/storage/download/:fileId retorna blob
  - [ ] POST /api/storage/get-url retorna URL assinada
  - [ ] CORS headers estão presentes
  - [ ] Retry logic funciona (3 tentativas)
  - [ ] Timeout é respeitado (5s para exists, 30s para download)

- [ ] **Client Functions**
  - [ ] downloadViaProxy() baixa arquivo com sucesso
  - [ ] getSignedUrl() gera URL válida
  - [ ] getImageUrl() tenta métodos em ordem correta
  - [ ] Fallback para base64 funciona

- [ ] **Integration**
  - [ ] Upload → Diagnosis fluxo completo
  - [ ] Signed URL é usado quando possível
  - [ ] Proxy é usado quando signed URL falha
  - [ ] Base64 é usado como último recurso
  - [ ] Logs são claros e informativos

- [ ] **Performance**
  - [ ] Signed URL: < 500ms
  - [ ] Proxy: < 2000ms
  - [ ] Diagnosis: < 45s
  - [ ] Imagens até 20MB funcionam

- [ ] **Security**
  - [ ] Path traversal bloqueado
  - [ ] CORS headers corretos
  - [ ] Signed URLs têm expiração
  - [ ] Admin SDK autentica requests

- [ ] **Error Handling**
  - [ ] 404 quando arquivo não existe
  - [ ] 500 com retry message quando proxy falha
  - [ ] Graceful fallback a base64
  - [ ] Mensagens de erro claras

---

## 9. DEBUGGING AVANÇADO

### 9.1 Ver todas as requisições de Storage

```javascript
// No Console, monkey-patch axios
const originalGet = window.axios.get;
window.axios.get = function(...args) {
  if (args[0].includes('storage')) {
    console.log('[INTERCEPT GET]', args[0]);
  }
  return originalGet.apply(this, args);
};

const originalPost = window.axios.post;
window.axios.post = function(...args) {
  if (args[0].includes('storage')) {
    console.log('[INTERCEPT POST]', args[0], args[1]);
  }
  return originalPost.apply(this, args);
};
```

### 9.2 Rastrear fluxo de imagem completo

```javascript
// Cole isto no Console para ver fluxo completo
window.debugImageFlow = () => {
  const store = useStudioStore.getState();
  console.log('=== IMAGE FLOW DEBUG ===');
  console.log('base64Image length:', store.base64Image?.length || 0);
  console.log('storagePathOriginal:', store.storagePathOriginal);
  console.log('storagePathCompressed:', store.storagePathCompressed);
  console.log('sessionId:', store.sessionId);
  console.log('scanStatus:', store.scanStatus);
  console.log('scanResult:', store.scanResult ? '✓ Exists' : '✗ Missing');
  console.log('scanErrors:', store.scanErrors);
};

// Executar:
debugImageFlow();
```

---

## 10. CONCLUSÃO

Quando todos os testes passarem:
1. TypeScript: `npm run lint` (sem erros)
2. Browser: Network tab mostra requisições corretas
3. Logs: Mensagens informativamente detalhadas
4. Performance: Dentro dos limites esperados
5. Segurança: Path traversal bloqueado

**Tempo esperado para testes completos**: 1-2 horas
