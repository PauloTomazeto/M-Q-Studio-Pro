# ⚡ QUICK START - Implementação em 30 Minutos

## Status: 🔴 BLOQUEADO (CORS error)
**Solução**: Implementar Proxy Node.js  
**Tempo**: 30 minutos  
**Risco**: Baixo

---

## 🎯 O QUE FAZER AGORA

### Step 1: Abra `server.ts` (2 minutos)

Localização: `/server.ts` linha ~181 (após rota `/api/storage/upload`)

Adicione este código:

```typescript
// Firebase Storage Download Proxy
app.get("/api/storage/download/:path(*)", async (req, res) => {
  try {
    const filePath = req.params.path;
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    // Verificar se arquivo existe
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: "File not found" });
    }

    // Obter metadata para content-type
    const [metadata] = await file.getMetadata();

    // Headers
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');

    // Stream arquivo
    console.log("[Storage] Downloading:", filePath);
    file.createReadStream()
      .on('error', (err) => {
        console.error("[Storage] Error:", err);
        res.status(500).json({ error: "Failed to download file" });
      })
      .pipe(res);

  } catch (error: any) {
    console.error("[Storage Download]", error.message);
    res.status(500).json({ error: error.message });
  }
});
```

---

### Step 2: Abra `storageService.ts` (3 minutos)

Localização: `/src/services/storageService.ts` linha ~482

Substitua a função `uploadBase64ViaProxy`:

```typescript
export const uploadBase64ViaProxy = async (base64: string, path?: string): Promise<string> => {
  try {
    const response = await axios.post('/api/storage/upload', {
      base64,
      path: path || 'temp_generation'
    });

    if (response.data.url) {
      // NOVO: Converter URL pública para proxy URL
      const firebaseUrl = response.data.url;

      // Extrair path do bucket da URL
      const pathMatch = firebaseUrl.match(/\/b\/[^\/]+\/o\/(.+)$/);
      if (pathMatch) {
        const fullPath = decodeURIComponent(pathMatch[1].split('?')[0]);
        const proxyUrl = `/api/storage/download/${fullPath}`;
        console.log('[Storage] Proxy URL:', proxyUrl);
        return proxyUrl;
      }

      return firebaseUrl;
    }
    throw new Error('No URL returned from proxy');
  } catch (error: any) {
    console.error('Upload Error:', error.response?.data || error.message);
    throw new Error(`STORAGE_PROXY_UPLOAD_FAILED: ${error.message}`);
  }
};
```

---

### Step 3: Restart Server (1 minuto)

```bash
# Ctrl+C para parar servidor
# Depois:
npm run dev
```

---

### Step 4: Teste (10 minutos)

1. Abra http://localhost:3000
2. Vá a **Diagnóstico**
3. Faça upload de imagem
4. Verifique console: Deve mostrar `[Storage] Proxy URL:`
5. Diagnóstico deve funcionar automaticamente
6. Verifique se análise aparece

---

### Step 5: Validar (14 minutos)

- [ ] Upload retorna `/api/storage/download/...`
- [ ] Diagnóstico processa imagem
- [ ] Scan result aparece
- [ ] Sem erros CORS no console

**Se tudo funcionar**: ✅ PROBLEMA RESOLVIDO!

**Se ainda falhar**: Procure por CORS errors no console e relate

---

## 📋 Antes/Depois

### ANTES (Hoje - com erro):
```
User Upload
  ↓
Server retorna: https://firebasestorage.googleapis.com/.../image.jpg
  ↓
Browser tenta acessar
  ↓
CORS BLOCKED ❌
  ↓
Error: "Você deve anexar a Imagem Principal"
```

### DEPOIS (Após implementação):
```
User Upload
  ↓
Server retorna: /api/storage/download/generation_images/.../image.jpg
  ↓
Browser acessa via proxy
  ↓
Server faz stream de Firebase ✅
  ↓
Tudo funciona ✅
```

---

## 🆘 Se Falhar

1. Verifique se código foi copiado corretamente
2. Procure por erros no console do VS Code
3. Confirme que `npm run dev` reiniciou sem erros
4. Tente fazer upload de novo

Se ainda não funcionar:
- Volte ao documento **CRONOGRAMA_SOLUCAO_COMPLETO.md**
- Tente Fase 1 (aplicar CORS via gsutil)

---

## ✅ Checklist Rápido

```
[ ] Abri server.ts
[ ] Copiei endpoint download proxy
[ ] Abri storageService.ts
[ ] Atualizei função uploadBase64ViaProxy
[ ] Salvei ambos arquivos
[ ] Reiniciei npm run dev
[ ] Testei upload em localhost:3000
[ ] Vejo /api/storage/download/ na URL
[ ] Diagnóstico funciona
[ ] Sem erros CORS
```

---

## 🎉 Pronto!

Essa é a implementação. Simples, direto, 30 minutos.

Se der certo, tudo funciona. Se não, você tem os outros documentos com alternativas.

Boa sorte! 🚀
